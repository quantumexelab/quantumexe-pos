import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma, ok, fail, parseId, param } from "./lib.js";
import { requireAuth, signToken } from "./auth.js";
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

  const user = await prisma.user.findUnique({
    where: { contact: parsed.data.username },
    include: { role: true, status: true },
  });
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return res.status(401).json(fail("Invalid username or password", 401));
  }
  if (user.status.name !== "Active") return res.status(403).json(fail("User inactive", 403));

  const token = signToken(user);
  return res.json({
    success: true,
    message: "Login successful",
    token,
    user: {
      id: user.id,
      name: user.name,
      contact: user.contact,
      email: user.email,
      role_id: user.roleId,
      status_id: user.statusId,
      role: user.role.name,
      ststus: user.status.name,
    },
  });
});

router.get("/setup/check-env", async (_req, res) => {
  const license = await prisma.license.findFirst();
  res.json({
    exists: true,
    connected: true,
    license: license
      ? { key: license.licenseKey, status: license.status, expiry_date: license.expiryDate }
      : null,
  });
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
  const roles = await prisma.role.findMany();
  res.json(ok(roles));
});

router.get("/users/all", requireAuth, async (_req, res) => {
  const users = await prisma.user.findMany({ include: { role: true, status: true } });
  res.json(
    ok(
      users.map((u) => ({
        id: u.id,
        name: u.name,
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
    contact: z.string().min(1),
    email: z.string().optional(),
    password: z.string().min(4),
    role_id: z.number(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(fail(parsed.error.message));
  const active = await prisma.status.findFirst({ where: { name: "Active" } });
  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      contact: parsed.data.contact,
      email: parsed.data.email,
      passwordHash,
      roleId: parsed.data.role_id,
      statusId: active!.id,
    },
    include: { role: true, status: true },
  });
  res.json(ok(user, "User created"));
});

router.put("/users/:id", requireAuth, async (req, res) => {
  const id = parseId(req.params.id);
  const data: any = {};
  if (req.body?.name != null) data.name = String(req.body.name);
  if (req.body?.contact != null) data.contact = String(req.body.contact);
  if (req.body?.email != null) data.email = String(req.body.email) || null;
  if (req.body?.role_id != null) data.roleId = Number(req.body.role_id);
  if (req.body?.password) data.passwordHash = await bcrypt.hash(String(req.body.password), 10);
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

// ---------- Categories / Brands / Units / Types ----------
const crudName = (model: "category" | "brand" | "unit" | "productType", base: string) => {
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
    // @ts-expect-error dynamic
    const row = await prisma[model].create({ data: { name } });
    res.json(ok(row, "Created"));
  });
  router.put(`${base}/:id`, requireAuth, async (req, res) => {
    const id = parseId(req.params.id);
    const name = String(req.body?.name || "").trim();
    // @ts-expect-error dynamic
    const row = await prisma[model].update({ where: { id }, data: { name } });
    res.json(ok(row, "Updated"));
  });
  router.delete(`${base}/:id`, requireAuth, async (req, res) => {
    const id = parseId(req.params.id);
    // @ts-expect-error dynamic
    await prisma[model].delete({ where: { id } });
    res.json(ok(null, "Deleted"));
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
          name: "Default",
          barcode: parsed.data.barcode || `BC${parsed.data.code}`,
          price: parsed.data.price,
          cost: parsed.data.cost,
        },
      },
    },
    include: { variants: true },
  });
  await prisma.stock.create({
    data: { variantId: product.variants[0].id, quantity: parsed.data.quantity },
  });
  res.json(ok(product, "Product created"));
});

router.put("/products/update/:id", requireAuth, async (req, res) => {
  const id = parseId(req.params.id);
  const data = req.body || {};
  const product = await prisma.product.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description,
      categoryId: data.categoryId,
      brandId: data.brandId,
      unitId: data.unitId,
      productTypeId: data.productTypeId,
    },
    include: { variants: true },
  });
  if (data.price != null && product.variants[0]) {
    await prisma.productVariant.update({
      where: { id: product.variants[0].id },
      data: { price: Number(data.price), cost: data.cost != null ? Number(data.cost) : undefined },
    });
  }
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
      size: req.body?.size,
    },
  });
  await prisma.stock.create({ data: { variantId: variant.id, quantity: Number(req.body?.quantity || 0) } });
  res.json(ok(variant, "Variant added"));
});

router.post("/products/import", requireAuth, async (req, res) => {
  res.json(ok({ imported: 0 }, "Import stub accepted (send JSON array via create endpoints)"));
});

// ---------- Stock ----------
router.get("/stock/all-variations", requireAuth, async (req, res) => {
  const hasStock = req.query.hasStock === "true";
  const limit = Number(req.query.limit || 100);
  const stocks = await prisma.stock.findMany({
    where: hasStock ? { quantity: { gt: 0 } } : undefined,
    include: {
      variant: {
        include: {
          product: { include: { category: true, unit: true, brand: true } },
        },
      },
    },
    take: limit,
  });
  res.json(
    ok(
      stocks.map((s) => ({
        id: s.variantId,
        stockId: s.id,
        displayName: s.variant.product.name,
        productName: s.variant.product.name,
        productID: s.variant.product.code,
        variant_name: s.variant.name,
        barcode: s.variant.barcode,
        price: s.variant.price,
        Price: s.variant.price,
        cost: s.variant.cost,
        mrp: s.variant.price,
        sellingPrice: s.variant.price,
        unit: s.variant.product.unit?.name || "-",
        categoryId: s.variant.product.categoryId,
        category: s.variant.product.category?.name || "-",
        unitId: s.variant.product.unitId,
        quantity: s.quantity,
        expireDate: s.expireDate,
        lowThreshold: s.lowThreshold,
        supplier: "-",
        variant: s.variant,
      }))
    )
  );
});

router.get("/stock/summary-cards", requireAuth, async (_req, res) => {
  const stocks = await prisma.stock.findMany();
  const total = stocks.length;
  const low = stocks.filter((s) => s.quantity > 0 && s.quantity <= s.lowThreshold).length;
  const out = stocks.filter((s) => s.quantity <= 0).length;
  const expireSoon = stocks.filter(
    (s) => s.expireDate && s.expireDate.getTime() - Date.now() < 30 * 86400000
  ).length;
  res.json(ok({ total, low, out, expireSoon }));
});

router.get("/stock/low-stock", requireAuth, async (_req, res) => {
  const stocks = await prisma.stock.findMany({
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

router.get("/stock/low-stock/summary", requireAuth, async (_req, res) => {
  const stocks = await prisma.stock.findMany();
  const count = stocks.filter((s) => s.quantity > 0 && s.quantity <= s.lowThreshold).length;
  res.json(ok({ count }));
});

router.get("/stock/low-stock/search", requireAuth, async (req, res) => {
  const q = String(req.query.q || "").toLowerCase();
  const stocks = await prisma.stock.findMany({
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

router.get("/stock/out-of-stock", requireAuth, async (_req, res) => {
  const stocks = await prisma.stock.findMany({
    where: { quantity: { lte: 0 } },
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

router.get("/stock/out-of-stock/summary", requireAuth, async (_req, res) => {
  const count = await prisma.stock.count({ where: { quantity: { lte: 0 } } });
  res.json(ok({ count }));
});

router.get("/stock/out-of-stock/search", requireAuth, async (req, res) => {
  const q = String(req.query.q || "").toLowerCase();
  const stocks = await prisma.stock.findMany({
    where: { quantity: { lte: 0 } },
    include: { variant: { include: { product: true } } },
  });
  res.json(ok(stocks.filter((s) => s.variant.product.name.toLowerCase().includes(q))));
});

router.get("/stock/expire-stock", requireAuth, async (req, res) => {
  const days = Number(req.query.days || 60);
  const soon = new Date(Date.now() + days * 86400000);
  const stocks = await prisma.stock.findMany({
    where: { expireDate: { lte: soon } },
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

router.get("/stock/search", requireAuth, async (req, res) => {
  const q = String(req.query.q || "");
  const stocks = await prisma.stock.findMany({
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
  const stock = await prisma.stock.findFirst({
    where: { variantId: parseId(req.params.id) },
    include: { variant: { include: { product: true } } },
  });
  res.json(ok(stock));
});

router.get("/reasons/all", requireAuth, async (_req, res) => {
  res.json(ok(await prisma.damageReason.findMany()));
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
