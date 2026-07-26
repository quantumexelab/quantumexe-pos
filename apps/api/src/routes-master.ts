import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { ok, fail, prisma } from "./lib.js";
import { requireAuth, requireRoles, signMasterToken } from "./auth.js";
import {
  approveShop,
  changeMasterPassword,
  createShopRegistration,
  ensureDemoShopApproved,
  ensureMasterAdmin,
  listShops,
  refreshLocalAccessFromRegistry,
  resetShopPassword,
  revokeShop,
  verifyMasterLogin,
} from "./master/shopRegistry.js";

const router = Router();

const registerSchema = z.object({
  shopName: z.string().min(2),
  ownerName: z.string().min(2),
  phone: z.string().min(9),
  email: z.string().email(),
  password: z.string().min(6),
  address: z.string().optional(),
  city: z.string().optional(),
  nic: z.string().optional(),
  businessRegNo: z.string().optional(),
});

router.post("/auth/register", async (req, res) => {
  try {
    await ensureMasterAdmin();
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(fail("Invalid registration details"));

    const shop = await createShopRegistration(parsed.data);

    // Ensure roles/statuses exist
    let adminRole = await prisma.role.findFirst({ where: { name: "Admin" } });
    if (!adminRole) adminRole = await prisma.role.create({ data: { name: "Admin" } });
    let active = await prisma.status.findFirst({ where: { name: "Active" } });
    if (!active) active = await prisma.status.create({ data: { name: "Active" } });

    const existingUser = await prisma.user.findUnique({ where: { contact: parsed.data.phone } });
    if (existingUser) {
      return res.status(400).json(fail("This phone already has a local user. Sign in instead."));
    }

    await prisma.user.create({
      data: {
        name: parsed.data.ownerName,
        email: parsed.data.email,
        contact: parsed.data.phone,
        passwordHash: await bcrypt.hash(parsed.data.password, 10),
        roleId: adminRole.id,
        statusId: active.id,
        shopId: shop.shopId,
      },
    });

    // Shop-scoped settings (do not overwrite other shops on shared Firestore)
    const { runWithShop } = await import("./shopContext.js");
    await runWithShop(shop.shopId, async () => {
      await prisma.setting.upsert({
        where: { key: "shop_name" },
        create: { key: "shop_name", value: parsed.data.shopName },
        update: { value: parsed.data.shopName },
      });
      await prisma.setting.upsert({
        where: { key: "business_name" },
        create: { key: "business_name", value: parsed.data.shopName },
        update: { value: parsed.data.shopName },
      });
      await prisma.setting.upsert({
        where: { key: "owner_name" },
        create: { key: "owner_name", value: parsed.data.ownerName },
        update: { value: parsed.data.ownerName },
      });
      await prisma.license.create({
        data: {
          licenseKey: `QX-PENDING-${shop.shopId.slice(-6).toUpperCase()}`,
          status: "PENDING",
          expiryDate: new Date(Date.now() + 7 * 86400000),
        },
      });
    });

    res.json(
      ok(
        {
          shopId: shop.shopId,
          status: shop.status,
          login: parsed.data.phone,
          message: "Registered. Wait for Master Admin payment confirmation / approval.",
        },
        "Shop registered — pending Master Admin approval"
      )
    );
  } catch (e) {
    res.status(400).json(fail(e instanceof Error ? e.message : "Registration failed"));
  }
});

router.get("/shop/access", requireAuth, async (_req, res) => {
  try {
    if (_req.user?.role === "MasterAdmin") {
      return res.json(ok({ status: "active", role: "MasterAdmin" }));
    }
    const access = await refreshLocalAccessFromRegistry();
    res.json(ok(access));
  } catch (e) {
    res.status(500).json(fail(e instanceof Error ? e.message : "Access check failed", 500));
  }
});

router.get("/master/shops", requireAuth, requireRoles("MasterAdmin"), async (_req, res) => {
  try {
    const shops = await listShops();
    // Never send password hashes to UI
    res.json(
      ok(
        shops.map(({ passwordHash: _, ...rest }) => rest),
        "OK"
      )
    );
  } catch (e) {
    res.status(500).json(fail(e instanceof Error ? e.message : "Failed to list shops", 500));
  }
});

router.post("/master/shops/:shopId/approve", requireAuth, requireRoles("MasterAdmin"), async (req, res) => {
  try {
    const shopId = String(req.params.shopId);
    const note = String(req.body?.paymentNote || "Payment confirmed");
    const shop = await approveShop(shopId, note);
    const { passwordHash: _, ...safe } = shop;
    res.json(ok(safe, "Shop approved — payment confirmed"));
  } catch (e) {
    res.status(400).json(fail(e instanceof Error ? e.message : "Approve failed"));
  }
});

router.post("/master/shops/:shopId/revoke", requireAuth, requireRoles("MasterAdmin"), async (req, res) => {
  try {
    const shop = await revokeShop(String(req.params.shopId));
    const { passwordHash: _, ...safe } = shop;
    res.json(ok(safe, "Shop access revoked"));
  } catch (e) {
    res.status(400).json(fail(e instanceof Error ? e.message : "Revoke failed"));
  }
});

router.post("/master/shops/:shopId/reset-password", requireAuth, requireRoles("MasterAdmin"), async (req, res) => {
  try {
    const password = String(req.body?.password || "").trim();
    if (password.length < 6) return res.status(400).json(fail("Password must be at least 6 characters"));
    const shop = await resetShopPassword(String(req.params.shopId), password);

    // If this PC is that shop, update local Super Admin password too
    const local = await prisma.user.findUnique({ where: { contact: shop.phone } });
    if (local) {
      await prisma.user.update({
        where: { id: local.id },
        data: { passwordHash: await bcrypt.hash(password, 10) },
      });
    }

    const { passwordHash: _, ...safe } = shop;
    res.json(ok(safe, "Super Admin password reset"));
  } catch (e) {
    res.status(400).json(fail(e instanceof Error ? e.message : "Reset failed"));
  }
});

router.post("/master/shops/:shopId/mark-paid", requireAuth, requireRoles("MasterAdmin"), async (req, res) => {
  try {
    const note = String(req.body?.paymentNote || "Monthly payment confirmed");
    const shop = await approveShop(String(req.params.shopId), note);
    const { passwordHash: _, ...safe } = shop;
    res.json(ok(safe, "Payment recorded — access active for 30 days"));
  } catch (e) {
    res.status(400).json(fail(e instanceof Error ? e.message : "Payment update failed"));
  }
});

router.post("/master/password", requireAuth, requireRoles("MasterAdmin"), async (req, res) => {
  try {
    const current = String(req.body?.currentPassword || "");
    const next = String(req.body?.newPassword || "");
    if (next.length < 6) return res.status(400).json(fail("New password must be at least 6 characters"));
    await changeMasterPassword(current, next);
    res.json(ok({}, "Master Admin password updated"));
  } catch (e) {
    res.status(400).json(fail(e instanceof Error ? e.message : "Password change failed"));
  }
});

router.post("/master/seed-demo-shop", requireAuth, requireRoles("MasterAdmin"), async (_req, res) => {
  try {
    await ensureDemoShopApproved();
    res.json(ok({}, "Demo shop ensured active"));
  } catch (e) {
    res.status(500).json(fail(e instanceof Error ? e.message : "Seed failed", 500));
  }
});

export async function tryMasterLogin(username: string, password: string) {
  await ensureMasterAdmin();
  const okLogin = await verifyMasterLogin(username, password);
  if (!okLogin) return null;
  const token = signMasterToken(username.trim().toLowerCase());
  return {
    success: true,
    message: "Master Admin login successful",
    token,
    user: {
      id: 0,
      name: "Master Admin",
      contact: "master",
      email: "master@quantumexe.local",
      role_id: 0,
      status_id: 0,
      role: "MasterAdmin",
      ststus: "Active",
      shop_status: "active",
    },
  };
}

export { ensureMasterAdmin, ensureDemoShopApproved, refreshLocalAccessFromRegistry };
export default router;
