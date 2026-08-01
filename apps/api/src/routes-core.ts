import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma, ok, fail, parseId, param } from "./lib.js";
import { requireAuth, signToken } from "./auth.js";
import {
  LOC_SHOP,
  LOC_STORE,
  addToStoreStock,
  ensureStockPair,
  setStoreStock,
  variantDisplayName,
} from "./stockLocations.js";
import os from "os";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------- Auth / License / Setup ----------
router.post("/auth/login", async (req, res) => {
  const schema = z.object({
    username: z.string().min(1),
    password: z.string().min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(fail("Invalid credentials payload"));

  // Master Admin (cloud registry) — same Sign in screen
  try {
    const { tryMasterLogin } = await import("./routes-master.js");
    const master = await tryMasterLogin(parsed.data.username, parsed.data.password);
    if (master) return res.json(master);
  } catch (e) {
    console.warn("[auth] master login check failed:", e instanceof Error ? e.message : e);
  }

  const { DEMO_SHOP_ID, tenancyEnabled, runWithShop } = await import("./shopContext.js");
  const { findShopByPhone, refreshLocalAccessFromRegistry, getLocalShopId } = await import(
    "./master/shopRegistry.js"
  );
  const { warmShopFirestore, shopHasFirebase } = await import("./master/shopFirebase.js");

  const remoteShop = await findShopByPhone(parsed.data.username);
  let shopId = remoteShop?.shopId || null;
  if (remoteShop && shopHasFirebase(remoteShop)) {
    await warmShopFirestore(shopId);
  } else if (tenancyEnabled() && !shopId) {
    shopId = DEMO_SHOP_ID;
  }

  const { invalidateFsCache } = await import("./fsdb.js");
  invalidateFsCache();

  const login = parsed.data.username.trim();
  const findUser = () =>
    prisma.user.findFirst({
      where: {
        OR: [{ username: login }, { contact: login }],
      },
      include: { role: true, status: true },
    });

  // Dedicated shop DB first, then control/shared (pre-provision registration)
  let user = await runWithShop(shopId, findUser, { useShopFirebase: true });
  let usedDedicated = Boolean(user && remoteShop && shopHasFirebase(remoteShop));
  if (!user) {
    user = await runWithShop(shopId, findUser, { useShopFirebase: false });
    usedDedicated = false;
  }

  if (!user) return res.status(401).json(fail("Invalid username or password", 401));

  let passwordOk = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!passwordOk && remoteShop?.passwordHash) {
    if (await bcrypt.compare(parsed.data.password, remoteShop.passwordHash)) {
      await runWithShop(
        shopId,
        async () => {
          await prisma.user.update({
            where: { id: user!.id },
            data: { passwordHash: remoteShop.passwordHash },
          });
        },
        { useShopFirebase: usedDedicated }
      );
      passwordOk = true;
    }
  }
  if (!passwordOk) return res.status(401).json(fail("Invalid username or password", 401));
  const statusName = user.status?.name || "Active";
  if (statusName !== "Active") return res.status(403).json(fail("User inactive", 403));

  shopId = (user as { shopId?: string | null }).shopId || shopId || (tenancyEnabled() ? DEMO_SHOP_ID : null);

  let shop_status: string = "active";
  try {
    if (remoteShop?.shopId) {
      shopId = remoteShop.shopId;
      if (!(user as { shopId?: string | null }).shopId) {
        await runWithShop(shopId, async () => {
          await prisma.user.update({
            where: { id: user.id },
            data: { shopId: remoteShop.shopId } as { shopId: string },
          });
        });
      }
    }

    if (process.env.USE_FIRESTORE !== "1") {
      const localId = await getLocalShopId();
      if (!localId && shopId) {
        await prisma.setting.upsert({
          where: { key: "shop_id" },
          create: { key: "shop_id", value: shopId },
          update: { value: shopId },
        });
      }
    }
    const access = await refreshLocalAccessFromRegistry(shopId);
    shop_status = access.status;
  } catch {
    if (tenancyEnabled() && !shopId) shopId = DEMO_SHOP_ID;
    shop_status = "active";
  }

  const token = signToken({
    ...user,
    role: user.role?.name || "Admin",
    contact: user.contact,
    shopId,
  });
  const shopType = remoteShop?.shopType || null;
  let features = null;
  if (shopId && shopType) {
    try {
      const row = await runWithShop(shopId, async () =>
        prisma.setting.findUnique({ where: { key: "features_json" } })
      );
      if (row?.value) features = JSON.parse(row.value);
    } catch {
      /* ignore */
    }
  }

  return res.json({
    success: true,
    message: "Login successful",
    token,
    user: {
      id: user.id,
      name: user.name,
      username: (user as { username?: string | null }).username || user.contact,
      contact: user.contact,
      email: user.email,
      role_id: user.roleId,
      status_id: user.statusId,
      role: user.role?.name || "Admin",
      ststus: user.status?.name || "Active",
      shop_status,
      shopId,
      shopType,
      features,
      firebaseDedicated: Boolean(remoteShop && shopHasFirebase(remoteShop) && usedDedicated),
    },
  });
});

router.get("/setup/check-env", async (_req, res) => {
  try {
    const license = await prisma.license.findFirst();
    res.json({
      exists: true,
      connected: true,
      license: license
        ? { key: license.licenseKey, status: license.status, expiry_date: license.expiryDate }
        : null,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({
      exists: false,
      connected: false,
      message: e instanceof Error ? e.message : "DB error",
    });
  }
});

/** First-time seed (no service-account JSON needed on Cloud Functions). Only works when DB has no users. */
router.post("/setup/seed", async (_req, res) => {
  try {
    const count = await prisma.user.count();
    if (count > 0) return res.status(400).json(fail("Already seeded"));
    const { seedDemo } = await import("./seed-demo.js");
    await seedDemo();
    res.json(ok({ login: "0771234567", password: "123456" }, "Demo data seeded"));
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(e instanceof Error ? e.message : "Seed failed", 500));
  }
});

router.get("/license/status", requireAuth, async (_req, res) => {
  const license = await prisma.license.findFirst({ orderBy: { id: "desc" } });
  if (!license) return res.json(ok({ status: "MISSING" }));
  return res.json(
    ok({
      status: license.status,
      license_key: license.licenseKey,
      expiry_date: license.expiryDate,
    })
  );
});

router.post("/license/validate", async (req, res) => {
  const key = String(req.body?.license_key || "").trim();
  if (!key) return res.status(400).json(fail("License key required"));
  const existing = await prisma.license.findFirst();
  if (existing) {
    await prisma.license.update({
      where: { id: existing.id },
      data: { licenseKey: key, status: "VALID", expiryDate: new Date(Date.now() + 365 * 86400000) },
    });
  } else {
    await prisma.license.create({
      data: { licenseKey: key, status: "VALID", expiryDate: new Date(Date.now() + 365 * 86400000) },
    });
  }
  return res.json(ok({ status: "VALID" }, "License validated"));
});

// ---------- Roles / Users ----------
router.get("/roles", requireAuth, async (_req, res) => {
  const roles = await prisma.role.findMany({ orderBy: { id: "asc" } });
  // Dedupe by name (Firestore can accumulate duplicates after repeated seeds/syncs)
  const seen = new Set<string>();
  const unique = [];
  for (const r of roles) {
    const key = String(r.name || "").trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(r);
  }
  res.json(ok(unique));
});

/** Merge duplicate Role/Status rows (same name) onto the lowest id. */
router.post("/setup/cleanup-duplicates", requireAuth, async (_req, res) => {
  try {
    const remapped = { roles: 0, statuses: 0, usersFixed: 0 };

    const roles = await prisma.role.findMany({ orderBy: { id: "asc" } });
    const roleKeep = new Map<string, number>();
    for (const r of roles) {
      const key = String(r.name || "").trim().toLowerCase();
      if (!key) continue;
      if (!roleKeep.has(key)) roleKeep.set(key, r.id);
      else {
        const keepId = roleKeep.get(key)!;
        const users = await prisma.user.findMany({ where: { roleId: r.id } });
        for (const u of users) {
          await prisma.user.update({ where: { id: u.id }, data: { roleId: keepId } });
          remapped.usersFixed++;
        }
        await prisma.role.delete({ where: { id: r.id } });
        remapped.roles++;
      }
    }

    const statuses = await prisma.status.findMany({ orderBy: { id: "asc" } });
    const statusKeep = new Map<string, number>();
    for (const s of statuses) {
      const key = String(s.name || "").trim().toLowerCase();
      if (!key) continue;
      if (!statusKeep.has(key)) statusKeep.set(key, s.id);
      else {
        const keepId = statusKeep.get(key)!;
        const users = await prisma.user.findMany({ where: { statusId: s.id } });
        for (const u of users) {
          await prisma.user.update({ where: { id: u.id }, data: { statusId: keepId } });
          remapped.usersFixed++;
        }
        const customers = await prisma.customer.findMany({ where: { statusId: s.id } });
        for (const c of customers) {
          await prisma.customer.update({ where: { id: c.id }, data: { statusId: keepId } });
        }
        const suppliers = await prisma.supplier.findMany({ where: { statusId: s.id } });
        for (const srow of suppliers) {
          await prisma.supplier.update({ where: { id: srow.id }, data: { statusId: keepId } });
        }
        await prisma.status.delete({ where: { id: s.id } });
        remapped.statuses++;
      }
    }

    res.json(ok(remapped, "Duplicate roles/statuses cleaned"));
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(e instanceof Error ? e.message : "Cleanup failed", 500));
  }
});

router.get("/users/all", requireAuth, async (_req, res) => {
  const users = await prisma.user.findMany({ include: { role: true, status: true } });
  res.json(
    ok(
      users.map((u) => ({
        id: u.id,
        name: u.name,
        username: (u as { username?: string | null }).username || u.contact,
        contact: u.contact,
        email: u.email,
        role_id: u.roleId,
        role_name: u.role.name,
        status_id: u.statusId,
        status: u.status.name,
      }))
    )
  );
});

router.post("/users/add", requireAuth, async (req, res) => {
  const schema = z.object({
    name: z.string().min(1),
    username: z.string().min(2).optional(),
    contact: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    password: z.string().min(4),
    role_id: z.number(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(fail(parsed.error.message));

  const username = String(parsed.data.username || "").trim();
  const phone = String(parsed.data.phone || parsed.data.contact || "").trim();
  if (!username) return res.status(400).json(fail("Username is required"));
  // contact stays unique — use phone if provided, otherwise username (legacy-safe)
  const contact = phone || username;

  const takenUser = await prisma.user.findFirst({
    where: { OR: [{ username }, { contact }, ...(phone ? [{ contact: phone }] : [])] },
  });
  if (takenUser) {
    return res.status(400).json(fail("Username or phone already in use"));
  }

  const active = await prisma.status.findFirst({ where: { name: "Active" } });
  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      username,
      contact,
      email: parsed.data.email,
      passwordHash,
      roleId: parsed.data.role_id,
      statusId: active!.id,
    } as any,
    include: { role: true, status: true },
  });
  res.json(ok(user, "User created"));
});

router.put("/users/:id", requireAuth, async (req, res) => {
  const id = parseId(req.params.id);
  const data: any = {};
  if (req.body?.name != null) data.name = String(req.body.name);
  if (req.body?.username != null) data.username = String(req.body.username).trim();
  if (req.body?.phone != null) data.contact = String(req.body.phone).trim();
  else if (req.body?.contact != null) data.contact = String(req.body.contact).trim();
  if (req.body?.email != null) data.email = String(req.body.email) || null;
  if (req.body?.role_id != null) data.roleId = Number(req.body.role_id);
  if (req.body?.password) data.passwordHash = await bcrypt.hash(String(req.body.password), 10);

  if (data.username || data.contact) {
    const clash = await prisma.user.findFirst({
      where: {
        AND: [
          { id: { not: id } },
          {
            OR: [
              ...(data.username ? [{ username: data.username }] : []),
              ...(data.contact ? [{ contact: data.contact }, { username: data.contact }] : []),
            ],
          },
        ],
      },
    });
    if (clash) return res.status(400).json(fail("Username or phone already in use"));
  }

  const user = await prisma.user.update({
    where: { id },
    data,
    include: { role: true, status: true },
  });
  res.json(ok(user, "User updated"));
});

router.patch("/users/:id/status", requireAuth, async (req, res) => {
  const id = parseId(req.params.id);
  const user = await prisma.user.findUnique({ where: { id }, include: { status: true } });
  if (!user) return res.status(404).json(fail("User not found", 404));
  const nextName = user.status.name === "Active" ? "Inactive" : "Active";
  const status = await prisma.status.findFirst({ where: { name: nextName } });
  const updated = await prisma.user.update({
    where: { id },
    data: { statusId: status!.id },
    include: { role: true, status: true },
  });
  res.json(ok(updated, "Status updated"));
});

router.delete("/users/:id", requireAuth, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json(fail("Invalid user id"));
  if (req.user?.id === id) {
    return res.status(400).json(fail("You cannot delete your own account while logged in"));
  }
  const existing = await prisma.user.findUnique({ where: { id }, include: { role: true } });
  if (!existing) return res.status(404).json(fail("User not found", 404));

  const isAdmin = String(existing.role?.name || "").toLowerCase().includes("admin");
  if (isAdmin) {
    const all = await prisma.user.findMany({ include: { role: true, status: true } });
    const otherActiveAdmins = all.filter(
      (u) =>
        u.id !== id &&
        String(u.role?.name || "").toLowerCase().includes("admin") &&
        String(u.status?.name || "").toLowerCase() === "active"
    );
    if (otherActiveAdmins.length === 0) {
      return res.status(400).json(fail("Cannot delete the last active Admin user"));
    }
  }

  await prisma.user.delete({ where: { id } });
  res.json(ok({ id }, "User deleted"));
});

// ---------- Categories / Brands / Units / Types ----------
const crudName = (model: "category" | "brand" | "unit" | "productType", base: string) => {
  const label =
    model === "productType" ? "Product type" : model === "category" ? "Category" : model === "brand" ? "Brand" : "Unit";

  async function nameTaken(name: string, excludeId?: number) {
    // @ts-expect-error dynamic
    const rows = (await prisma[model].findMany()) as Array<{ id: number; name: string }>;
    const needle = name.trim().toLowerCase();
    return rows.some((r) => r.id !== excludeId && String(r.name || "").trim().toLowerCase() === needle);
  }

  router.get(base, requireAuth, async (_req, res) => {
    // @ts-expect-error dynamic
    const rows = await prisma[model].findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json(ok(rows));
  });
  router.get(`${base}/search`, requireAuth, async (req, res) => {
    const q = String(req.query.q || "");
    // @ts-expect-error dynamic
    const rows = await prisma[model].findMany({
      where: { name: { contains: q } },
      orderBy: { createdAt: "desc" },
    });
    res.json(ok(rows));
  });
  router.post(base, requireAuth, async (req, res) => {
    const name = String(req.body?.name || "").trim();
    if (!name) return res.status(400).json(fail("Name required"));
    if (await nameTaken(name)) {
      return res.status(400).json(fail(`${label} "${name}" already exists`));
    }
    try {
      // @ts-expect-error dynamic
      const row = await prisma[model].create({ data: { name } });
      res.json(ok(row, "Created"));
    } catch (e: any) {
      if (String(e?.code) === "P2002" || /unique/i.test(String(e?.message || ""))) {
        return res.status(400).json(fail(`${label} "${name}" already exists`));
      }
      throw e;
    }
  });
  router.put(`${base}/:id`, requireAuth, async (req, res) => {
    const id = parseId(req.params.id);
    const name = String(req.body?.name || "").trim();
    if (!name) return res.status(400).json(fail("Name required"));
    if (await nameTaken(name, id)) {
      return res.status(400).json(fail(`${label} "${name}" already exists`));
    }
    try {
      // @ts-expect-error dynamic
      const row = await prisma[model].update({ where: { id }, data: { name } });
      res.json(ok(row, "Updated"));
    } catch (e: any) {
      if (String(e?.code) === "P2002" || /unique/i.test(String(e?.message || ""))) {
        return res.status(400).json(fail(`${label} "${name}" already exists`));
      }
      throw e;
    }
  });
  router.delete(`${base}/:id`, requireAuth, async (req, res) => {
    const id = parseId(req.params.id);
    // @ts-expect-error dynamic
    const row = await prisma[model].findUnique({ where: { id } });
    if (!row) return res.status(404).json(fail(`${label} not found`, 404));

    const fk =
      model === "category"
        ? "categoryId"
        : model === "brand"
          ? "brandId"
          : model === "unit"
            ? "unitId"
            : "productTypeId";

    const usedBy = (await prisma.product.findMany({
      where: { [fk]: id } as any,
      select: { id: true, name: true, code: true, active: true },
      take: 8,
      orderBy: { id: "desc" },
    })) as Array<{ id: number; name: string; code: string; active: boolean }>;

    const usedCount = await prisma.product.count({ where: { [fk]: id } as any });

    if (usedCount > 0) {
      const samples = usedBy
        .map((p) => `"${p.name}" (${p.code})${p.active ? "" : " [deactivated]"}`)
        .join(", ");
      const more = usedCount > usedBy.length ? ` and ${usedCount - usedBy.length} more` : "";
      return res.status(400).json(
        fail(
          `Cannot delete ${label.toLowerCase()} "${(row as { name?: string }).name || id}" — it is used by ${usedCount} product(s): ${samples}${more}. Remove or reassign those products first.`,
          400
        )
      );
    }

    try {
      // @ts-expect-error dynamic
      await prisma[model].delete({ where: { id } });
      res.json(ok(null, "Deleted"));
    } catch (e: any) {
      // FK / relation guard (SQLite / Prisma)
      if (String(e?.code) === "P2003" || /foreign key|constraint/i.test(String(e?.message || ""))) {
        return res.status(400).json(
          fail(`Cannot delete ${label.toLowerCase()} — it is still used in the system.`)
        );
      }
      throw e;
    }
  });
};

crudName("category", "/categories");
crudName("brand", "/brands");
crudName("unit", "/units");
crudName("productType", "/product-types");

// ---------- Products ----------
router.get("/products", requireAuth, async (_req, res) => {
  const products = await prisma.product.findMany({
    where: { active: true },
    include: { variants: true, category: true, brand: true, unit: true, productType: true, status: true },
    orderBy: { id: "desc" },
  });
  res.json(ok(products));
});

router.get("/products/deactive", requireAuth, async (_req, res) => {
  const products = await prisma.product.findMany({
    where: { active: false },
    include: { variants: true, category: true, brand: true, unit: true, productType: true, status: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(ok(products));
});

router.get("/products/variations", requireAuth, async (_req, res) => {
  const rows = await prisma.productVariant.findMany({
    include: { product: true, stocks: true },
  });
  res.json(ok(rows));
});

router.get("/products/dropdown", requireAuth, async (_req, res) => {
  const rows = await prisma.product.findMany({
    where: { active: true },
    select: { id: true, name: true, code: true, variants: { select: { id: true, name: true, price: true, barcode: true } } },
  });
  res.json(ok(rows));
});

router.get("/products/search", requireAuth, async (req, res) => {
  const q = String(req.query.q || "");
  const products = await prisma.product.findMany({
    where: {
      active: true,
      OR: [{ name: { contains: q } }, { code: { contains: q } }],
    },
    include: { variants: true },
  });
  res.json(ok(products));
});

router.get("/products/check-code/:code", requireAuth, async (req, res) => {
  const found = await prisma.product.findUnique({ where: { code: param(req.params.code) } });
  res.json(ok({ exists: !!found }));
});

router.get("/products/:id", requireAuth, async (req, res) => {
  const id = parseId(req.params.id);
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      variants: { include: { stocks: true } },
      category: true,
      brand: true,
      unit: true,
      productType: true,
      status: true,
    },
  });
  if (!product) return res.status(404).json(fail("Product not found", 404));
  res.json(ok(product));
});

router.post("/products/create", requireAuth, async (req, res) => {
  const schema = z.object({
    name: z.string().min(1),
    code: z.string().min(1),
    description: z.string().optional(),
    categoryId: z.number().optional(),
    brandId: z.number().optional(),
    unitId: z.number().optional(),
    productTypeId: z.number().optional(),
    price: z.number().default(0),
    cost: z.number().default(0),
    barcode: z.string().optional(),
    quantity: z.number().default(0),
    size: z.string().optional(),
    color: z.string().optional(),
    variantName: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(fail(parsed.error.message));
  const active = await prisma.status.findFirst({ where: { name: "Active" } });
  const product = await prisma.product.create({
    data: {
      name: parsed.data.name,
      code: parsed.data.code,
      description: parsed.data.description,
      categoryId: parsed.data.categoryId,
      brandId: parsed.data.brandId,
      unitId: parsed.data.unitId,
      productTypeId: parsed.data.productTypeId,
      statusId: active!.id,
      variants: {
        create: {
          name: parsed.data.variantName || "Default",
          barcode: parsed.data.barcode || `BC${parsed.data.code}`,
          price: parsed.data.price,
          cost: parsed.data.cost,
          size: parsed.data.size || null,
          color: parsed.data.color || null,
        },
      },
    },
    include: { variants: true },
  });
  await setStoreStock(prisma, product.variants[0].id, parsed.data.quantity);
  res.json(ok(product, "Product created"));
});

router.put("/products/update/:id", requireAuth, async (req, res) => {
  const id = parseId(req.params.id);
  const data = req.body || {};
  const existing = await prisma.product.findUnique({
    where: { id },
    include: { variants: { include: { stocks: true } } },
  });
  if (!existing) return res.status(404).json(fail("Product not found", 404));

  if (data.code && String(data.code) !== existing.code) {
    const clash = await prisma.product.findFirst({ where: { code: String(data.code) } });
    if (clash) return res.status(400).json(fail("Product code already exists"));
  }

  await prisma.product.update({
    where: { id },
    data: {
      name: data.name != null ? String(data.name) : existing.name,
      code: data.code != null ? String(data.code) : existing.code,
      description: data.description != null ? data.description : existing.description,
      categoryId: data.categoryId != null ? Number(data.categoryId) : existing.categoryId,
      brandId: data.brandId != null ? Number(data.brandId) : existing.brandId,
      unitId: data.unitId != null ? Number(data.unitId) : existing.unitId,
      productTypeId: data.productTypeId != null ? Number(data.productTypeId) : existing.productTypeId,
    },
  });

  const variants = Array.isArray(data.variants) ? data.variants : null;

  if (variants?.length) {
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i] || {};
      const payload = {
        name: String(v.name || "Default"),
        barcode: v.barcode ? String(v.barcode) : null,
        price: Number(v.price || 0),
        cost: Number(v.cost || 0),
        size: v.size ? String(v.size) : null,
        color: v.color ? String(v.color) : null,
      };
      let variantId = v.id ? Number(v.id) : 0;
      if (variantId && existing.variants.some((x) => x.id === variantId)) {
        await prisma.productVariant.update({ where: { id: variantId }, data: payload });
      } else {
        const created = await prisma.productVariant.create({
          data: { productId: id, ...payload },
        });
        variantId = created.id;
        await setStoreStock(prisma, variantId, Number((v.quantity ?? (i === 0 ? data.quantity : 0)) || 0), {
          lowThreshold: Number(v.lowThreshold ?? data.lowThreshold ?? 5) || 5,
        });
        continue;
      }

      if (v.quantity != null || v.lowThreshold != null || (i === 0 && (data.quantity != null || data.lowThreshold != null))) {
        const qty = Number(v.quantity ?? (i === 0 ? data.quantity : undefined));
        const low = Number(v.lowThreshold ?? (i === 0 ? data.lowThreshold : undefined));
        const { store } = await ensureStockPair(prisma, variantId);
        await prisma.stock.update({
          where: { id: store.id },
          data: {
            ...(Number.isFinite(qty) ? { quantity: qty } : {}),
            ...(Number.isFinite(low) ? { lowThreshold: low } : {}),
          },
        });
      }
    }
  } else if (existing.variants[0]) {
    await prisma.productVariant.update({
      where: { id: existing.variants[0].id },
      data: {
        name: data.variantName || existing.variants[0].name,
        barcode: data.barcode != null ? String(data.barcode) : existing.variants[0].barcode,
        price: data.price != null ? Number(data.price) : existing.variants[0].price,
        cost: data.cost != null ? Number(data.cost) : existing.variants[0].cost,
        size: data.size != null ? String(data.size) || null : existing.variants[0].size,
        color: data.color != null ? String(data.color) || null : existing.variants[0].color,
      },
    });
    if (data.quantity != null || data.lowThreshold != null || data.expireDate != null) {
      const { store } = await ensureStockPair(prisma, existing.variants[0].id);
      await prisma.stock.update({
        where: { id: store.id },
        data: {
          ...(data.quantity != null ? { quantity: Number(data.quantity) } : {}),
          ...(data.lowThreshold != null ? { lowThreshold: Number(data.lowThreshold) } : {}),
          ...(data.expireDate != null
            ? { expireDate: data.expireDate ? new Date(String(data.expireDate)) : null }
            : {}),
        },
      });
    }
  }

  const product = await prisma.product.findUnique({
    where: { id },
    include: { variants: { include: { stocks: true } }, category: true, brand: true, unit: true, productType: true },
  });
  res.json(ok(product, "Updated"));
});

router.post("/products/deactive", requireAuth, async (req, res) => {
  const id = Number(req.body?.id);
  const product = await prisma.product.update({ where: { id }, data: { active: false } });
  res.json(ok(product, "Deactivated"));
});

router.patch("/products/status/:id", requireAuth, async (req, res) => {
  const id = parseId(req.params.id);
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) return res.status(404).json(fail("Not found", 404));
  const updated = await prisma.product.update({
    where: { id },
    data: { active: !product.active },
  });
  res.json(ok(updated));
});

router.delete("/products/:id", requireAuth, async (req, res) => {
  await prisma.product.delete({ where: { id: parseId(req.params.id) } });
  res.json(ok(null, "Deleted"));
});

router.post("/products/:id/variants", requireAuth, async (req, res) => {
  const productId = parseId(req.params.id);
  const variant = await prisma.productVariant.create({
    data: {
      productId,
      name: req.body?.name || "Variant",
      barcode: req.body?.barcode,
      price: Number(req.body?.price || 0),
      cost: Number(req.body?.cost || 0),
      size: req.body?.size || null,
      color: req.body?.color || null,
    },
  });
  await setStoreStock(prisma, variant.id, Number(req.body?.quantity || 0));
  res.json(ok(variant, "Variant added"));
});

router.post("/products/import", requireAuth, async (req, res) => {
  const rows = (req.body?.rows || req.body?.products || []) as Array<Record<string, unknown>>;
  if (!Array.isArray(rows) || !rows.length) {
    return res.status(400).json(fail("No rows to import. Send { rows: [...] }"));
  }

  async function findOrCreateNamed(
    model: "category" | "brand" | "unit" | "productType",
    name: string
  ) {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const delegate = (prisma as any)[model];
    const existing = await delegate.findFirst({ where: { name: trimmed } });
    if (existing) return existing.id as number;
    const created = await delegate.create({ data: { name: trimmed } });
    return created.id as number;
  }

  const active = await prisma.status.findFirst({ where: { name: "Active" } });
  if (!active) return res.status(500).json(fail("Active status missing"));

  let imported = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || {};
    const name = String(row.name || row.product_name || "").trim();
    const code = String(row.code || row.product_code || "").trim();
    if (!name || !code) {
      errors.push(`Row ${i + 1}: name and code are required`);
      continue;
    }
    try {
      const existing = await prisma.product.findFirst({ where: { code } });
      if (existing) {
        errors.push(`Row ${i + 1}: code "${code}" already exists`);
        continue;
      }

      const categoryId = await findOrCreateNamed("category", String(row.category || row.category_name || "General"));
      const brandId = await findOrCreateNamed("brand", String(row.brand || row.brand_name || "Generic"));
      const unitId = await findOrCreateNamed("unit", String(row.unit || row.unit_name || "Pcs"));
      const productTypeId = await findOrCreateNamed(
        "productType",
        String(row.product_type || row.productType || row.type || "General")
      );

      const price = Number(row.price ?? row.selling_price ?? 0) || 0;
      const cost = Number(row.cost ?? row.cost_price ?? 0) || 0;
      const quantity = Number(row.quantity ?? row.qty ?? row.opening_qty ?? 0) || 0;
      const barcode = String(row.barcode || "").trim() || `BC${code}`;
      const size = String(row.size || "").trim() || null;
      const color = String(row.color || "").trim() || null;
      const variantName = String(row.variant_name || row.variant || "Default").trim() || "Default";
      const lowThreshold = Number(row.low_threshold ?? row.lowThreshold ?? 5) || 5;

      const product = await prisma.product.create({
        data: {
          name,
          code,
          categoryId: categoryId || undefined,
          brandId: brandId || undefined,
          unitId: unitId || undefined,
          productTypeId: productTypeId || undefined,
          statusId: active.id,
          variants: {
            create: {
              name: variantName,
              barcode,
              price,
              cost,
              size,
              color,
            },
          },
        },
        include: { variants: true },
      });
      await setStoreStock(prisma, product.variants[0].id, quantity, { lowThreshold });
      imported += 1;
    } catch (e) {
      errors.push(`Row ${i + 1}: ${e instanceof Error ? e.message : "import failed"}`);
    }
  }

  res.json(ok({ imported, failed: errors.length, errors: errors.slice(0, 20) }, `Imported ${imported} product(s)`));
});

// ---------- Stock ----------
function mapVariationRow(
  variant: {
    id: number;
    name: string;
    barcode: string | null;
    price: number;
    cost: number;
    size?: string | null;
    color?: string | null;
    product: {
      name: string;
      code: string;
      categoryId: number | null;
      unitId: number | null;
      category?: { name: string } | null;
      unit?: { name: string } | null;
      brand?: { name: string } | null;
    };
  },
  store: { id: number; quantity: number; lowThreshold: number; expireDate: Date | null },
  shop: { id: number; quantity: number },
  location: string
) {
  const activeQty = location === LOC_SHOP ? shop.quantity : store.quantity;
  return {
    id: variant.id,
    stockId: location === LOC_SHOP ? shop.id : store.id,
    displayName: variantDisplayName(variant),
    productName: variant.product.name,
    productID: variant.product.code,
    productId: variant.productId,
    variantId: variant.id,
    variant_name: variant.name,
    size: variant.size || null,
    color: variant.color || null,
    barcode: variant.barcode,
    price: variant.price,
    Price: variant.price,
    cost: variant.cost,
    mrp: variant.price,
    sellingPrice: variant.price,
    unit: variant.product.unit?.name || "-",
    categoryId: variant.product.categoryId,
    category: variant.product.category?.name || "-",
    unitId: variant.product.unitId,
    quantity: activeQty,
    storeQty: store.quantity,
    shopQty: shop.quantity,
    expireDate: store.expireDate,
    lowThreshold: store.lowThreshold,
    supplier: "-",
    location,
    variant,
  };
}

router.get("/stock/all-variations", requireAuth, async (req, res) => {
  const hasStock = req.query.hasStock === "true";
  const location = String(req.query.location || LOC_STORE);
  const limit = Number(req.query.limit || 100);
  const variants = await prisma.productVariant.findMany({
    where: { product: { active: true } },
    include: { product: { include: { category: true, unit: true, brand: true } } },
    orderBy: { id: "desc" },
    take: Math.min(limit * 3, 1500),
  });
  const rows = [];
  for (const variant of variants) {
    const { store, shop } = await ensureStockPair(prisma, variant.id);
    const activeQty = location === LOC_SHOP ? shop.quantity : store.quantity;
    if (hasStock && activeQty <= 0) continue;
    rows.push(mapVariationRow(variant, store, shop, location));
    if (rows.length >= limit) break;
  }
  res.json(ok(rows));
});

router.get("/stock/summary-cards", requireAuth, async (req, res) => {
  const location = String(req.query.location || LOC_STORE);
  const stocks = await prisma.stock.findMany({ where: { location } });
  const total = stocks.length;
  const low = stocks.filter((s) => s.quantity > 0 && s.quantity <= s.lowThreshold).length;
  const out = stocks.filter((s) => s.quantity <= 0).length;
  const expireSoon = stocks.filter(
    (s) => s.expireDate && s.expireDate.getTime() - Date.now() < 30 * 86400000
  ).length;
  res.json(ok({ total, low, out, expireSoon, location }));
});

router.get("/stock/low-stock", requireAuth, async (req, res) => {
  const location = String(req.query.location || LOC_STORE);
  const stocks = await prisma.stock.findMany({
    where: { location },
    include: {
      variant: {
        include: {
          product: { include: { category: true, unit: true } },
        },
      },
    },
  });
  const rows = stocks.filter((s) => s.quantity > 0 && s.quantity <= s.lowThreshold);
  res.json(ok(rows));
});

router.get("/stock/low-stock/summary", requireAuth, async (req, res) => {
  const location = String(req.query.location || LOC_STORE);
  const stocks = await prisma.stock.findMany({ where: { location } });
  const count = stocks.filter((s) => s.quantity > 0 && s.quantity <= s.lowThreshold).length;
  res.json(ok({ count }));
});

router.get("/stock/low-stock/search", requireAuth, async (req, res) => {
  const q = String(req.query.q || "").toLowerCase();
  const location = String(req.query.location || LOC_STORE);
  const stocks = await prisma.stock.findMany({
    where: { location },
    include: { variant: { include: { product: true } } },
  });
  const rows = stocks.filter(
    (s) =>
      s.quantity > 0 &&
      s.quantity <= s.lowThreshold &&
      s.variant.product.name.toLowerCase().includes(q)
  );
  res.json(ok(rows));
});

router.get("/stock/out-of-stock", requireAuth, async (req, res) => {
  const location = String(req.query.location || LOC_STORE);
  const stocks = await prisma.stock.findMany({
    where: { quantity: { lte: 0 }, location },
    include: {
      variant: {
        include: {
          product: { include: { category: true, unit: true } },
        },
      },
    },
  });
  res.json(ok(stocks));
});

router.get("/stock/out-of-stock/summary", requireAuth, async (req, res) => {
  const location = String(req.query.location || LOC_STORE);
  const count = await prisma.stock.count({ where: { quantity: { lte: 0 }, location } });
  res.json(ok({ count }));
});

router.get("/stock/out-of-stock/search", requireAuth, async (req, res) => {
  const q = String(req.query.q || "").toLowerCase();
  const location = String(req.query.location || LOC_STORE);
  const stocks = await prisma.stock.findMany({
    where: { quantity: { lte: 0 }, location },
    include: { variant: { include: { product: true } } },
  });
  res.json(ok(stocks.filter((s) => s.variant.product.name.toLowerCase().includes(q))));
});

router.get("/stock/expire-stock", requireAuth, async (req, res) => {
  const days = Math.max(0, Number(req.query.days ?? 60) || 0);
  const location = String(req.query.location || LOC_STORE);
  const soon = new Date(Date.now() + days * 86400000);
  const stocks = await prisma.stock.findMany({
    where: { location, expireDate: { not: null, lte: soon } },
    include: {
      variant: {
        include: {
          product: { include: { category: true, unit: true } },
        },
      },
    },
    orderBy: { expireDate: "asc" },
  });
  // Defense-in-depth: some stores keep expireDate as string / null edge cases
  const soonMs = soon.getTime();
  const filtered = stocks.filter((s) => {
    if (!s.expireDate) return false;
    const expMs = new Date(s.expireDate).getTime();
    return Number.isFinite(expMs) && expMs <= soonMs;
  });
  res.json(ok(filtered));
});

router.get("/stock/search", requireAuth, async (req, res) => {
  const q = String(req.query.q || "");
  const location = String(req.query.location || LOC_STORE);
  const stocks = await prisma.stock.findMany({
    where: { location },
    include: { variant: { include: { product: true } } },
  });
  const rows = stocks.filter(
    (s) =>
      s.variant.product.name.toLowerCase().includes(q.toLowerCase()) ||
      s.variant.barcode?.includes(q)
  );
  res.json(ok(rows));
});

router.get("/stock/get-stock-by-variant/:id", requireAuth, async (req, res) => {
  const variantId = parseId(req.params.id);
  const location = String(req.query.location || LOC_STORE);
  const { store, shop } = await ensureStockPair(prisma, variantId);
  const active = location === LOC_SHOP ? shop : store;
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    include: { product: true },
  });
  res.json(ok({ ...active, variant, storeQty: store.quantity, shopQty: shop.quantity }));
});

const DEFAULT_DAMAGE_REASONS = ["Broken", "Expired", "Wet Damage", "Other"] as const;

router.get("/reasons/all", requireAuth, async (_req, res) => {
  const existing = await prisma.damageReason.findMany({ orderBy: { id: "asc" } });
  const byName = new Map<string, (typeof existing)[number]>();
  for (const r of existing) {
    const key = String(r.name || "").trim().toLowerCase();
    if (!key || byName.has(key)) continue;
    byName.set(key, r);
  }
  for (const name of DEFAULT_DAMAGE_REASONS) {
    if (byName.has(name.toLowerCase())) continue;
    const created = await prisma.damageReason.create({ data: { name } });
    byName.set(name.toLowerCase(), created);
  }
  const ordered = DEFAULT_DAMAGE_REASONS.map((n) => byName.get(n.toLowerCase())!).filter(Boolean);
  const extras = [...byName.values()].filter(
    (r) => !DEFAULT_DAMAGE_REASONS.some((n) => n.toLowerCase() === String(r.name || "").trim().toLowerCase())
  );
  res.json(ok([...ordered, ...extras]));
});

router.get("/return-status/all", requireAuth, async (_req, res) => {
  res.json(ok(await prisma.returnStatus.findMany()));
});

router.get("/damaged/table-data", requireAuth, async (_req, res) => {
  const rows = await prisma.damagedStock.findMany({
    include: {
      stock: {
        include: {
          variant: {
            include: { product: { include: { unit: true, category: true } } },
          },
        },
      },
      reason: true,
      returnStatus: true,
    },
    orderBy: { id: "desc" },
  });
  res.json(ok(rows));
});

router.get("/damaged/summary-cards", requireAuth, async (_req, res) => {
  const count = await prisma.damagedStock.count();
  const qty = await prisma.damagedStock.aggregate({ _sum: { qty: true } });
  res.json(ok({ count, qty: qty._sum.qty || 0 }));
});

router.get("/damaged/search", requireAuth, async (req, res) => {
  const q = String(req.query.q || "").toLowerCase();
  const rows = await prisma.damagedStock.findMany({
    include: { stock: { include: { variant: { include: { product: true } } } }, reason: true },
  });
  res.json(
    ok(rows.filter((r) => r.stock.variant.product.name.toLowerCase().includes(q)))
  );
});

router.post("/damaged/add", requireAuth, async (req, res) => {
  const stockId = Number(req.body?.stock_id || req.body?.stockId);
  const qty = Number(req.body?.qty || req.body?.damagedQty || 0);
  const reasonId = req.body?.reason_id || req.body?.reasonId;
  const statusId = req.body?.status_id || req.body?.statusId;
  const description = req.body?.description || "N/A";
  const stock = await prisma.stock.findUnique({ where: { id: stockId } });
  if (!stock) return res.status(404).json(fail("Stock not found", 404));
  if (stock.quantity < qty) return res.status(400).json(fail("Insufficient stock"));
  await prisma.stock.update({ where: { id: stockId }, data: { quantity: stock.quantity - qty } });
  const row = await prisma.damagedStock.create({
    data: {
      stockId,
      qty,
      reasonId: reasonId ? Number(reasonId) : undefined,
      statusId: statusId ? Number(statusId) : undefined,
      description,
    },
  });
  res.json(ok(row, "Damaged record added"));
});

router.post("/damaged/update-status", requireAuth, async (req, res) => {
  const id = Number(req.body?.id);
  const statusId = Number(req.body?.status_id || req.body?.statusId);
  const row = await prisma.damagedStock.update({ where: { id }, data: { statusId } });
  res.json(ok(row));
});

export default router;
export { router as apiRouter };
