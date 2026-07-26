import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { ok, fail, prisma } from "./lib.js";
import { requireAuth, requireRoles, signMasterToken } from "./auth.js";
import {
  approveShop,
  changeMasterPassword,
  clearShopFirebase,
  createShopRegistration,
  ensureDemoShopApproved,
  ensureMasterAdmin,
  listShops,
  refreshLocalAccessFromRegistry,
  resetShopPassword,
  revokeShop,
  setShopFirebase,
  toPublicShop,
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

router.get("/shop/access", requireAuth, async (req, res) => {
  try {
    if (req.user?.role === "MasterAdmin") {
      return res.json(ok({ status: "active", role: "MasterAdmin" }));
    }
    const access = await refreshLocalAccessFromRegistry(req.user?.shopId ?? null);
    res.json(ok(access));
  } catch (e) {
    res.status(500).json(fail(e instanceof Error ? e.message : "Access check failed", 500));
  }
});

router.get("/master/shops", requireAuth, requireRoles("MasterAdmin"), async (_req, res) => {
  try {
    const shops = await listShops();
    res.json(ok(shops.map(toPublicShop), "OK"));
  } catch (e) {
    res.status(500).json(fail(e instanceof Error ? e.message : "Failed to list shops", 500));
  }
});

router.post("/master/shops/:shopId/firebase", requireAuth, requireRoles("MasterAdmin"), async (req, res) => {
  try {
    const shopId = String(req.params.shopId);
    const firebaseProjectId = String(req.body?.firebaseProjectId || "").trim();
    const firebaseClientEmail = String(req.body?.firebaseClientEmail || "").trim();
    let firebasePrivateKey = String(req.body?.firebasePrivateKey || "").trim();
    if (!firebaseProjectId || !firebaseClientEmail || !firebasePrivateKey) {
      return res.status(400).json(fail("Project ID, client email, and private key are required"));
    }
    // Allow pasting full service-account JSON into the private-key field
    if (firebasePrivateKey.startsWith("{")) {
      try {
        const sa = JSON.parse(firebasePrivateKey) as {
          project_id?: string;
          client_email?: string;
          private_key?: string;
        };
        if (sa.project_id) {
          /* prefer explicit form fields if already set */
        }
        if (sa.private_key) firebasePrivateKey = sa.private_key;
        const shop = await setShopFirebase(shopId, {
          firebaseProjectId: firebaseProjectId || sa.project_id || "",
          firebaseClientEmail: firebaseClientEmail || sa.client_email || "",
          firebasePrivateKey,
          provision: req.body?.provision !== false,
        });
        return res.json(ok(toPublicShop(shop), "Shop Firebase connected & provisioned"));
      } catch {
        return res.status(400).json(fail("Invalid service account JSON"));
      }
    }
    const shop = await setShopFirebase(shopId, {
      firebaseProjectId,
      firebaseClientEmail,
      firebasePrivateKey,
      provision: req.body?.provision !== false,
    });
    res.json(ok(toPublicShop(shop), "Shop Firebase connected & provisioned"));
  } catch (e) {
    res.status(400).json(fail(e instanceof Error ? e.message : "Firebase connect failed"));
  }
});

router.delete("/master/shops/:shopId/firebase", requireAuth, requireRoles("MasterAdmin"), async (req, res) => {
  try {
    const shop = await clearShopFirebase(String(req.params.shopId));
    res.json(ok(toPublicShop(shop), "Shop Firebase disconnected"));
  } catch (e) {
    res.status(400).json(fail(e instanceof Error ? e.message : "Disconnect failed"));
  }
});

router.post("/master/shops/:shopId/approve", requireAuth, requireRoles("MasterAdmin"), async (req, res) => {
  try {
    const shopId = String(req.params.shopId);
    const note = String(req.body?.paymentNote || "Payment confirmed");
    const shop = await approveShop(shopId, note);
    res.json(ok(toPublicShop(shop), "Shop approved — payment confirmed"));
  } catch (e) {
    res.status(400).json(fail(e instanceof Error ? e.message : "Approve failed"));
  }
});

router.post("/master/shops/:shopId/revoke", requireAuth, requireRoles("MasterAdmin"), async (req, res) => {
  try {
    const shop = await revokeShop(String(req.params.shopId));
    res.json(ok(toPublicShop(shop), "Shop access revoked"));
  } catch (e) {
    res.status(400).json(fail(e instanceof Error ? e.message : "Revoke failed"));
  }
});

router.post("/master/shops/:shopId/reset-password", requireAuth, requireRoles("MasterAdmin"), async (req, res) => {
  try {
    const password = String(req.body?.password || "").trim();
    if (password.length < 6) return res.status(400).json(fail("Password must be at least 6 characters"));
    const shop = await resetShopPassword(String(req.params.shopId), password);
    const passwordHash = shop.passwordHash;

    const { warmShopFirestore } = await import("./master/shopFirebase.js");
    const { runWithShop } = await import("./shopContext.js");
    await warmShopFirestore(shop.shopId);
    await runWithShop(shop.shopId, async () => {
      const local = await prisma.user.findUnique({ where: { contact: shop.phone } });
      if (local) {
        await prisma.user.update({
          where: { id: local.id },
          data: { passwordHash },
        });
      }
    });

    res.json(ok(toPublicShop(shop), "Super Admin password reset"));
  } catch (e) {
    res.status(400).json(fail(e instanceof Error ? e.message : "Reset failed"));
  }
});

router.post("/master/shops/:shopId/mark-paid", requireAuth, requireRoles("MasterAdmin"), async (req, res) => {
  try {
    const note = String(req.body?.paymentNote || "Monthly payment confirmed");
    const shop = await approveShop(String(req.params.shopId), note);
    res.json(ok(toPublicShop(shop), "Payment recorded — access active for 30 days"));
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
