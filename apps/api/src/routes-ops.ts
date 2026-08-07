import { Router } from "express";
import { z } from "zod";
import os from "os";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { prisma, ok, fail, parseId, param } from "./lib.js";
import { requireAuth } from "./auth.js";
import {
  LOC_SHOP,
  LOC_STORE,
  addToStoreStock,
  ensureStockPair,
  getShopStock,
  getStoreStock,
  variantDisplayName,
} from "./stockLocations.js";
import {
  UNIT_AVAILABLE,
  allocateShopUnit,
  createStockUnits,
  ensureAvailableUnits,
  findUnitByCode,
  moveStockUnits,
  restoreSoldUnits,
  sellShopUnits,
} from "./stockUnits.js";

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function nextNo(prefix: string, count: number) {
  const d = new Date();
  return `${prefix}${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(count + 1).padStart(4, "0")}`;
}

// ---------- Customers ----------
router.get("/customers/all", requireAuth, async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 200);
  const [rows, total] = await Promise.all([
    prisma.customer.findMany({
      include: {
        status: true,
        invoices: { select: { total: true, paidAmount: true } },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { id: "desc" },
    }),
    prisma.customer.count(),
  ]);
  const mapped = rows.map((c) => {
    const creditBalance = c.invoices.reduce(
      (s, inv) => s + Math.max(0, Number(inv.total || 0) - Number(inv.paidAmount || 0)),
      0
    );
    const { invoices, ...rest } = c;
    return { ...rest, creditBalance, invoiceCount: invoices.length };
  });
  res.json(ok({ rows: mapped, total, page, limit }));
});

router.get("/customers/search", requireAuth, async (req, res) => {
  const q = String(req.query.q || "");
  const rows = await prisma.customer.findMany({
    where: {
      OR: [{ name: { contains: q } }, { phone: { contains: q } }],
    },
    include: { status: true },
  });
  res.json(ok(rows));
});

router.get("/customers/:id", requireAuth, async (req, res) => {
  const row = await prisma.customer.findUnique({
    where: { id: parseId(req.params.id) },
    include: { status: true, invoices: true },
  });
  if (!row) return res.status(404).json(fail("Not found", 404));
  res.json(ok(row));
});

router.get("/customers/:id/invoices", requireAuth, async (req, res) => {
  const rows = await prisma.invoice.findMany({
    where: { customerId: parseId(req.params.id) },
    include: { items: true },
    orderBy: { id: "desc" },
  });
  res.json(ok(rows));
});

router.post("/customers/add", requireAuth, async (req, res) => {
  const schema = z.object({
    name: z.string().min(1),
    phone: z.string().optional(),
    email: z.string().optional(),
    address: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(fail(parsed.error.message));
  const active = await prisma.status.findFirst({ where: { name: "Active" } });
  const row = await prisma.customer.create({
    data: { ...parsed.data, statusId: active!.id },
  });
  res.json(ok(row, "Customer added"));
});

router.put("/customers/:id/update", requireAuth, async (req, res) => {
  const id = parseId(req.params.id);
  const row = await prisma.customer.update({
    where: { id },
    data: {
      name: req.body?.name,
      phone: req.body?.phone,
      email: req.body?.email,
      address: req.body?.address,
    },
  });
  res.json(ok(row));
});

router.patch("/customers/:id/status", requireAuth, async (req, res) => {
  const id = parseId(req.params.id);
  const customer = await prisma.customer.findUnique({ where: { id }, include: { status: true } });
  if (!customer) return res.status(404).json(fail("Not found", 404));
  const next = customer.status.name === "Active" ? "Inactive" : "Active";
  const status = await prisma.status.findFirst({ where: { name: next } });
  const row = await prisma.customer.update({ where: { id }, data: { statusId: status!.id } });
  res.json(ok(row));
});

router.patch("/customers/:id/phone", requireAuth, async (req, res) => {
  const row = await prisma.customer.update({
    where: { id: parseId(req.params.id) },
    data: { phone: String(req.body?.phone || "") },
  });
  res.json(ok(row));
});

// ---------- Suppliers / Companies / Banks ----------
router.get("/suppliers/list", requireAuth, async (_req, res) => {
  const rows = await prisma.supplier.findMany({
    include: { company: true, bank: true, status: true },
    orderBy: { id: "desc" },
  });
  res.json(ok(rows));
});

router.get("/suppliers/dropdown-list", requireAuth, async (_req, res) => {
  const rows = await prisma.supplier.findMany({
    where: { status: { name: "Active" } },
    select: { id: true, name: true, contact: true },
  });
  res.json(ok(rows));
});

router.post("/suppliers/add", requireAuth, async (req, res) => {
  const active = await prisma.status.findFirst({ where: { name: "Active" } });
  const name = String(req.body?.name || "").trim();
  if (!name) return res.status(400).json(fail("Name required"));
  const row = await prisma.supplier.create({
    data: {
      name,
      contact: req.body?.contact || null,
      email: req.body?.email || null,
      address: req.body?.address || null,
      accountNo: req.body?.accountNo || req.body?.account || null,
      companyId: req.body?.companyId ? Number(req.body.companyId) : undefined,
      bankId: req.body?.bankId ? Number(req.body.bankId) : undefined,
      statusId: active!.id,
    },
    include: { company: true, bank: true, status: true },
  });
  res.json(ok(row, "Supplier added"));
});

router.put("/suppliers/update/:id", requireAuth, async (req, res) => {
  const row = await prisma.supplier.update({
    where: { id: parseId(req.params.id) },
    data: {
      name: req.body?.name,
      contact: req.body?.contact,
      email: req.body?.email,
      address: req.body?.address,
      accountNo: req.body?.accountNo ?? req.body?.account,
      companyId: req.body?.companyId != null && req.body.companyId !== "" ? Number(req.body.companyId) : undefined,
      bankId: req.body?.bankId != null && req.body.bankId !== "" ? Number(req.body.bankId) : undefined,
    },
    include: { company: true, bank: true, status: true },
  });
  res.json(ok(row));
});

router.put("/suppliers/update-contact/:id", requireAuth, async (req, res) => {
  const row = await prisma.supplier.update({
    where: { id: parseId(req.params.id) },
    data: { contact: req.body?.contact, email: req.body?.email },
  });
  res.json(ok(row));
});

router.put("/suppliers/update-status/:id", requireAuth, async (req, res) => {
  const id = parseId(req.params.id);
  const s = await prisma.supplier.findUnique({ where: { id }, include: { status: true } });
  if (!s) return res.status(404).json(fail("Not found", 404));
  const next = s.status.name === "Active" ? "Inactive" : "Active";
  const status = await prisma.status.findFirst({ where: { name: next } });
  const row = await prisma.supplier.update({ where: { id }, data: { statusId: status!.id } });
  res.json(ok(row));
});

router.post("/suppliers/import", requireAuth, async (_req, res) => {
  res.json(ok({ imported: 0 }, "Import accepted"));
});

router.get("/suppliers/companies", requireAuth, async (_req, res) => {
  res.json(ok(await prisma.company.findMany({ orderBy: { createdAt: "desc" } })));
});

router.post("/suppliers/companies", requireAuth, async (req, res) => {
  const name = String(req.body?.name || "").trim();
  if (!name) return res.status(400).json(fail("Name required"));
  const row = await prisma.company.create({
    data: {
      name,
      email: req.body?.email || null,
      contact: req.body?.contact || null,
    },
  });
  res.json(ok(row));
});

router.get("/suppliers/companies/:id", requireAuth, async (req, res) => {
  const row = await prisma.company.findUnique({ where: { id: parseId(req.params.id) } });
  res.json(ok(row));
});

router.put("/suppliers/companies/:id", requireAuth, async (req, res) => {
  const row = await prisma.company.update({
    where: { id: parseId(req.params.id) },
    data: {
      name: String(req.body?.name || "").trim(),
      email: req.body?.email ?? null,
      contact: req.body?.contact ?? null,
    },
  });
  res.json(ok(row));
});

router.delete("/suppliers/companies/:id", requireAuth, async (req, res) => {
  await prisma.company.delete({ where: { id: parseId(req.params.id) } });
  res.json(ok(null, "Deleted"));
});

router.get("/suppliers/banks", requireAuth, async (_req, res) => {
  res.json(ok(await prisma.bank.findMany()));
});

router.post("/suppliers/banks", requireAuth, async (req, res) => {
  const row = await prisma.bank.create({
    data: { name: String(req.body?.name || ""), accountNo: req.body?.accountNo },
  });
  res.json(ok(row));
});

router.put("/suppliers/banks/:id", requireAuth, async (req, res) => {
  const row = await prisma.bank.update({
    where: { id: parseId(req.params.id) },
    data: { name: req.body?.name, accountNo: req.body?.accountNo },
  });
  res.json(ok(row));
});

router.delete("/suppliers/banks/:id", requireAuth, async (req, res) => {
  await prisma.bank.delete({ where: { id: parseId(req.params.id) } });
  res.json(ok(null, "Deleted"));
});

// ---------- GRN ----------
router.get("/grn/list", requireAuth, async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  const [rows, total] = await Promise.all([
    prisma.grn.findMany({
      include: { supplier: true, items: { include: { variant: { include: { product: true } } } } },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { id: "desc" },
    }),
    prisma.grn.count(),
  ]);
  res.json(ok({ rows, total, page, limit }));
});

router.get("/grn/summary", requireAuth, async (_req, res) => {
  const agg = await prisma.grn.aggregate({ _sum: { totalAmount: true, paidAmount: true }, _count: true });
  res.json(
    ok({
      count: agg._count,
      total: agg._sum.totalAmount || 0,
      paid: agg._sum.paidAmount || 0,
      due: (agg._sum.totalAmount || 0) - (agg._sum.paidAmount || 0),
    })
  );
});

router.get("/grn/get-by-id/:id", requireAuth, async (req, res) => {
  const row = await prisma.grn.findUnique({
    where: { id: parseId(req.params.id) },
    include: { supplier: true, items: { include: { variant: { include: { product: true } } } } },
  });
  res.json(ok(row));
});

router.get("/grn/bills/:supplierId", requireAuth, async (req, res) => {
  const rows = await prisma.grn.findMany({
    where: { supplierId: parseId(req.params.supplierId) },
    orderBy: { id: "desc" },
  });
  res.json(ok(rows));
});

router.post("/grn/add", requireAuth, async (req, res) => {
  const supplierId = Number(req.body?.supplierId || req.body?.supplier_id);
  const items = (req.body?.items || []) as Array<{
    variantId: number;
    qty: number;
    cost: number;
    price?: number;
    mrp?: number;
  }>;
  if (!supplierId) return res.status(400).json(fail("Supplier is required"));
  if (!items.length) return res.status(400).json(fail("At least one item is required"));

  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) return res.status(400).json(fail("Supplier not found"));

  for (const item of items) {
    const cost = Number(item.cost);
    const price = Number(item.price ?? 0);
    const mrp = Number(item.mrp ?? price);
    if (!Number(item.variantId) || !Number(item.qty)) {
      return res.status(400).json(fail("Each item needs variantId and qty"));
    }
    if (!(cost > 0)) return res.status(400).json(fail("Cost price is required and must be greater than 0"));
    if (!(price > 0)) return res.status(400).json(fail("Retail selling price is required and must be greater than 0"));
    if (price < cost) return res.status(400).json(fail("Retail selling price cannot be less than cost price"));
    if (!(mrp > 0)) return res.status(400).json(fail("MRP is required and must be greater than 0"));
    if (mrp < price) return res.status(400).json(fail("MRP cannot be less than retail selling price"));
    if (mrp < cost) return res.status(400).json(fail("MRP cannot be less than cost price"));
  }

  const totalAmount = items.reduce((s, i) => s + Number(i.qty) * Number(i.cost), 0);
  const grn = await prisma.grn.create({
    data: {
      supplierId,
      billNo: req.body?.billNo || `BILL-${Date.now()}`,
      totalAmount,
      paidAmount: Number(req.body?.paidAmount || 0),
      note: req.body?.note,
      items: {
        create: items.map((i) => ({
          variantId: Number(i.variantId),
          qty: Number(i.qty),
          cost: Number(i.cost),
        })),
      },
    },
    include: { items: true },
  });
  for (const item of items) {
    const variantId = Number(item.variantId);
    const qty = Number(item.qty);
    await addToStoreStock(prisma, variantId, qty);
    await createStockUnits(prisma, variantId, Math.floor(qty), LOC_STORE);
    await prisma.productVariant.update({
      where: { id: variantId },
      data: {
        cost: Number(item.cost),
        price: Number(item.price || item.cost),
      },
    });
  }
  res.json(ok(grn, "GRN created"));
});

router.post("/grn/payment/update", requireAuth, async (req, res) => {
  const id = Number(req.body?.id || req.body?.grnId);
  const paidAmount = Number(req.body?.paidAmount || 0);
  const row = await prisma.grn.update({ where: { id }, data: { paidAmount } });
  res.json(ok(row, "Payment updated"));
});

router.get("/grn/search", requireAuth, async (req, res) => {
  const q = String(req.query.q || "");
  const rows = await prisma.grn.findMany({
    where: {
      OR: [{ billNo: { contains: q } }, { supplier: { name: { contains: q } } }],
    },
    include: { supplier: true },
  });
  res.json(ok(rows));
});

router.post("/suppliers/payments", requireAuth, async (req, res) => {
  const supplierId = Number(req.body?.supplierId);
  const amount = Number(req.body?.amount || 0);
  const grnId = req.body?.grnId ? Number(req.body.grnId) : undefined;
  const paymentType = req.body?.paymentType ? String(req.body.paymentType) : null;
  if (!supplierId || !(amount > 0)) return res.status(400).json(fail("supplierId and amount required"));

  if (grnId) {
    const grn = await prisma.grn.findUnique({ where: { id: grnId } });
    if (!grn || grn.supplierId !== supplierId) return res.status(400).json(fail("Invalid bill for supplier"));
    const balance = Math.max(0, Number(grn.totalAmount) - Number(grn.paidAmount));
    if (amount > balance + 0.0001) return res.status(400).json(fail("Amount exceeds balance"));
    await prisma.grn.update({
      where: { id: grnId },
      data: { paidAmount: Number(grn.paidAmount) + amount },
    });
  }

  const row = await prisma.supplierPayment.create({
    data: {
      supplierId,
      grnId,
      amount,
      paymentType,
      note: req.body?.note || null,
    },
  });
  res.json(ok(row, "Payment recorded"));
});

router.get("/suppliers/:id/payments", requireAuth, async (req, res) => {
  const rows = await prisma.supplierPayment.findMany({
    where: { supplierId: parseId(req.params.id) },
    orderBy: { id: "desc" },
  });
  res.json(ok(rows));
});

function posVariantPayload(
  variant: {
    id: number;
    name: string;
    barcode?: string | null;
    price: number;
    cost: number;
    size?: string | null;
    color?: string | null;
    product: { name: string; code: string };
  },
  qty: number,
  extra?: { stockUnitId?: number; unitCode?: string; barcode?: string }
) {
  const size = variant.size;
  const color = variant.color;
  const vname = variant.name;
  const displayParts = [variant.product.name];
  if (size) displayParts.push(`Size ${size}`);
  if (color) displayParts.push(color);
  if (!size && !color && vname && vname.toLowerCase() !== "default") displayParts.push(vname);
  return {
    id: variant.id,
    displayName: displayParts.join(" · "),
    productName: variant.product.name,
    productID: variant.product.code,
    barcode: extra?.barcode ?? variant.barcode,
    size: size || null,
    color: color || null,
    variantName: vname,
    price: variant.price,
    cost: variant.cost,
    quantity: qty,
    stockUnitId: extra?.stockUnitId,
    unitCode: extra?.unitCode,
  };
}

// ---------- POS / Sales / Returns ----------
router.get("/pos/products/barcode/:code", requireAuth, async (req, res) => {
  const code = param(req.params.code);

  const unit = await findUnitByCode(prisma, code);
  if (unit) {
    if (unit.status !== UNIT_AVAILABLE || unit.location !== LOC_SHOP) {
      return res.status(400).json(fail("This unit is not available in shop stock", 400));
    }
    const variant = await prisma.productVariant.findUnique({
      where: { id: unit.variantId },
      include: { product: true },
    });
    if (!variant) return res.status(404).json(fail("Product not found", 404));
    const { shop } = await ensureStockPair(prisma, variant.id);
    return res.json(
      ok(
        posVariantPayload(variant, shop.quantity, {
          stockUnitId: unit.id,
          unitCode: unit.unitCode,
          barcode: unit.unitCode,
        })
      )
    );
  }

  const variant = await prisma.productVariant.findFirst({
    where: { barcode: code },
    include: { product: true, stocks: true },
  });
  if (!variant) return res.status(404).json(fail("Product not found", 404));
  const { shop } = await ensureStockPair(prisma, variant.id);
  if (shop.quantity <= 0) return res.status(400).json(fail("No shop stock for this product", 400));

  await ensureAvailableUnits(prisma, variant.id, LOC_SHOP, 1);
  const fifo = await allocateShopUnit(prisma, variant.id);
  res.json(
    ok(
      posVariantPayload(variant, shop.quantity, fifo
        ? { stockUnitId: fifo.id, unitCode: fifo.unitCode, barcode: fifo.unitCode }
        : undefined)
    )
  );
});

router.post("/pos/invoice", requireAuth, async (req, res) => {
  const items = (req.body?.items || []) as Array<{
    stock_id?: number;
    variantId?: number;
    id?: number;
    qty: number;
    price: number;
    discount?: number;
    discountAmount?: number;
    stockUnitId?: number;
    stock_unit_id?: number;
  }>;
  if (!items.length) return res.status(400).json(fail("Items required"));

  const normalized: Array<{
    variantId: number;
    qty: number;
    price: number;
    discount: number;
    stockUnitId?: number;
  }> = [];
  for (const item of items) {
    let variantId = Number(item.variantId || item.id || 0);
    if (item.stock_id) {
      const st = await prisma.stock.findUnique({ where: { id: Number(item.stock_id) } });
      if (st) variantId = st.variantId;
    }
    if (!variantId) return res.status(400).json(fail("Invalid item"));
    const stockUnitId = Number(item.stockUnitId || item.stock_unit_id || 0) || undefined;
    normalized.push({
      variantId,
      qty: Number(item.qty),
      price: Number(item.price),
      discount: Number(item.discount || item.discountAmount || 0),
      stockUnitId,
    });
  }

  for (const item of normalized) {
    const shop = await getShopStock(prisma, item.variantId);
    if (shop.quantity < item.qty) {
      return res.status(400).json(fail(`Insufficient shop stock for variant ${item.variantId}`));
    }
  }

  const subtotal = normalized.reduce((s, i) => s + i.price * i.qty, 0);
  const discount = normalized.reduce((s, i) => s + i.discount, 0) + Number(req.body?.discount || 0);
  const total = Math.max(0, subtotal - discount);
  const count = await prisma.invoice.count();
  const invoiceNo = await nextNo("INV", count);

  try {
    const invoice = await prisma.$transaction(async (tx) => {
      for (const item of normalized) {
        const shop = await getShopStock(tx, item.variantId);
        await tx.stock.update({
          where: { id: shop.id },
          data: { quantity: shop.quantity - item.qty },
        });
      }

      const created = await tx.invoice.create({
        data: {
          invoiceNo,
          customerId: req.body?.customerId ? Number(req.body.customerId) : undefined,
          userId: req.user!.id,
          subtotal,
          discount,
          total,
          paymentType: String(req.body?.paymentType || req.body?.payment_type || "Cash"),
          paidAmount: Number(req.body?.paidAmount || total),
          items: {
            create: normalized.map((i) => ({
              variantId: i.variantId,
              qty: i.qty,
              price: i.price,
              discount: i.discount,
              stockUnitId: i.stockUnitId || null,
            })),
          },
        },
        include: {
          items: { include: { variant: { include: { product: true } } } },
          customer: true,
          user: true,
        },
      });

      for (let i = 0; i < created.items.length; i++) {
        const invItem = created.items[i];
        const src = normalized[i];
        await sellShopUnits(tx, invItem.variantId, invItem.qty, invItem.id, src?.stockUnitId);
      }

      return created;
    });

    res.json(ok(invoice, "Invoice created"));
  } catch (e) {
    res.status(400).json(fail(e instanceof Error ? e.message : "Invoice failed"));
  }
});

router.get("/pos/invoice/:no", requireAuth, async (req, res) => {
  const no = param(req.params.no);
  const row = await prisma.invoice.findFirst({
    where: {
      OR: [{ invoiceNo: no }, { id: Number(no) || -1 }],
    },
    include: { items: { include: { variant: { include: { product: true } } } }, customer: true, user: true },
  });
  if (!row) return res.status(404).json(fail("Invoice not found", 404));
  const prior = await prisma.return.findMany({
    where: { invoiceId: row.id },
    include: { items: true },
  });
  const returnedByVariant = new Map<number, number>();
  for (const r of prior) {
    for (const ri of r.items) {
      returnedByVariant.set(ri.variantId, (returnedByVariant.get(ri.variantId) || 0) + ri.qty);
    }
  }
  res.json(
    ok({
      ...row,
      items: row.items.map((it) => {
        const returnedQty = returnedByVariant.get(it.variantId) || 0;
        return {
          ...it,
          returnedQty,
          remainingQty: Math.max(0, it.qty - returnedQty),
        };
      }),
    })
  );
});

router.post("/pos/convert", requireAuth, async (req, res) => {
  // bulk to loose: adjust shop stock quantities between two variants
  const fromId = Number(req.body?.fromVariantId);
  const toId = Number(req.body?.toVariantId);
  const qty = Number(req.body?.qty || 0);
  const factor = Number(req.body?.factor || 1);
  if (!fromId || !toId || !(qty > 0) || !(factor > 0)) {
    return res.status(400).json(fail("fromVariantId, toVariantId, qty and factor required"));
  }
  if (fromId === toId) return res.status(400).json(fail("Source and destination must differ"));
  const from = await getShopStock(prisma, fromId);
  if (from.quantity < qty) return res.status(400).json(fail("Insufficient bulk stock"));
  await prisma.stock.update({ where: { id: from.id }, data: { quantity: from.quantity - qty } });
  const to = await getShopStock(prisma, toId);
  await prisma.stock.update({ where: { id: to.id }, data: { quantity: to.quantity + qty * factor } });
  res.json(ok(null, "Converted"));
});

router.post("/pos/return", requireAuth, async (req, res) => {
  const invoiceNo = String(req.body?.invoiceNo || "");
  const invoice = await prisma.invoice.findFirst({ where: { invoiceNo }, include: { items: true } });
  if (!invoice) return res.status(404).json(fail("Invoice not found", 404));
  const items = (req.body?.items || []) as Array<{ id?: number; variantId?: number; returnQuantity: number; price?: number; discount?: number }>;
  if (!items.length) return res.status(400).json(fail("Items required"));

  const priorReturns = await prisma.return.findMany({
    where: { invoiceId: invoice.id },
    include: { items: true },
  });
  const alreadyByVariant = new Map<number, number>();
  for (const r of priorReturns) {
    for (const ri of r.items) {
      alreadyByVariant.set(ri.variantId, (alreadyByVariant.get(ri.variantId) || 0) + ri.qty);
    }
  }

  let total = 0;
  const createdItems = [];
  for (const item of items) {
    const invItem = invoice.items.find((x) => x.id === item.id) || invoice.items.find((x) => x.variantId === item.variantId);
    if (!invItem) return res.status(400).json(fail("Invalid return item"));
    const qty = Number(item.returnQuantity);
    if (!Number.isFinite(qty) || qty <= 0) return res.status(400).json(fail("Return quantity must be > 0"));
    const already = alreadyByVariant.get(invItem.variantId) || 0;
    const remaining = invItem.qty - already;
    if (qty > remaining) {
      return res.status(400).json(fail(`Cannot return ${qty} — only ${remaining} left for this item`));
    }
    const price = Number(item.price ?? invItem.price);
    const lineDisc = Number(invItem.discount || 0);
    const unitDisc = invItem.qty > 0 ? lineDisc / invItem.qty : 0;
    const discount = Number(item.discount ?? unitDisc * qty);
    total += price * qty - discount;
    createdItems.push({ variantId: invItem.variantId, qty, price, discount });
    alreadyByVariant.set(invItem.variantId, already + qty);
    const shop = await getShopStock(prisma, invItem.variantId);
    await prisma.stock.update({ where: { id: shop.id }, data: { quantity: shop.quantity + qty } });
    await restoreSoldUnits(prisma, [invItem.id], qty);
  }

  const ret = await prisma.return.create({
    data: {
      invoiceId: invoice.id,
      userId: req.user!.id,
      total,
      note: req.body?.note,
      items: { create: createdItems },
    },
    include: { items: true },
  });
  res.json(ok(ret, "Return processed"));
});

router.get("/pos/returns", requireAuth, async (_req, res) => {
  const rows = await prisma.return.findMany({
    include: {
      invoice: { include: { customer: true } },
      user: true,
      items: true,
    },
    orderBy: { id: "desc" },
  });
  res.json(ok(rows));
});

router.get("/sales/invoices", requireAuth, async (req, res) => {
  const rows = await prisma.invoice.findMany({
    include: {
      customer: true,
      user: true,
      items: { include: { variant: { include: { product: true } } } },
    },
    orderBy: { id: "desc" },
    take: Number(req.query.limit || 100),
  });
  res.json(ok(rows));
});

router.get("/sales/user-sales", requireAuth, async (_req, res) => {
  const users = await prisma.user.findMany({ include: { role: true } });
  const data = [];
  for (const u of users) {
    const agg = await prisma.invoice.aggregate({
      where: { userId: u.id },
      _sum: { total: true },
      _count: true,
    });
    data.push({
      userId: u.id,
      name: u.name,
      role: u.role.name,
      invoices: agg._count,
      total: agg._sum.total || 0,
    });
  }
  res.json(ok(data));
});

// ---------- Quotations ----------
router.get("/quotations", requireAuth, async (_req, res) => {
  const rows = await prisma.quotation.findMany({
    include: { customer: true, user: true, items: { include: { variant: { include: { product: true } } } } },
    orderBy: { id: "desc" },
  });
  res.json(ok(rows));
});

router.get("/quotations/:id", requireAuth, async (req, res) => {
  const row = await prisma.quotation.findUnique({
    where: { id: parseId(req.params.id) },
    include: { customer: true, items: { include: { variant: { include: { product: true } } } } },
  });
  res.json(ok(row));
});

router.post("/quotations", requireAuth, async (req, res) => {
  const items = (req.body?.items || []) as Array<{ variantId: number; qty: number; price: number; discount?: number }>;
  const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);
  const discount = Number(req.body?.discount || 0) + items.reduce((s, i) => s + Number(i.discount || 0), 0);
  const count = await prisma.quotation.count();
  const quoteNo = await nextNo("QT", count);
  const row = await prisma.quotation.create({
    data: {
      quoteNo,
      customerId: req.body?.customerId ? Number(req.body.customerId) : undefined,
      userId: req.user!.id,
      subtotal,
      discount,
      total: Math.max(0, subtotal - discount),
      status: "Active",
      expiresAt: req.body?.expiresAt ? new Date(req.body.expiresAt) : new Date(Date.now() + 14 * 86400000),
      items: {
        create: items.map((i) => ({
          variantId: Number(i.variantId),
          qty: Number(i.qty),
          price: Number(i.price),
          discount: Number(i.discount || 0),
        })),
      },
    },
    include: { items: true },
  });
  res.json(ok(row, "Quotation created"));
});

router.put("/quotations/:id", requireAuth, async (req, res) => {
  const id = parseId(req.params.id);
  await prisma.quotationItem.deleteMany({ where: { quotationId: id } });
  const items = (req.body?.items || []) as Array<{ variantId: number; qty: number; price: number; discount?: number }>;
  const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);
  const discount = Number(req.body?.discount || 0);
  const row = await prisma.quotation.update({
    where: { id },
    data: {
      customerId: req.body?.customerId ? Number(req.body.customerId) : undefined,
      subtotal,
      discount,
      total: Math.max(0, subtotal - discount),
      status: req.body?.status || "Active",
      items: {
        create: items.map((i) => ({
          variantId: Number(i.variantId),
          qty: Number(i.qty),
          price: Number(i.price),
          discount: Number(i.discount || 0),
        })),
      },
    },
    include: { items: true },
  });
  res.json(ok(row, "Quotation updated"));
});

router.post("/quotations/:id/convert", requireAuth, async (req, res) => {
  const quote = await prisma.quotation.findUnique({
    where: { id: parseId(req.params.id) },
    include: { items: true },
  });
  if (!quote) return res.status(404).json(fail("Not found", 404));
  const items = quote.items;
  for (const item of items) {
    const shop = await getShopStock(prisma, item.variantId);
    if (shop.quantity < item.qty) return res.status(400).json(fail("Insufficient shop stock"));
  }
  const count = await prisma.invoice.count();
  const invoiceNo = await nextNo("INV", count);
  try {
    const invoice = await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const shop = await getShopStock(tx, item.variantId);
        await tx.stock.update({ where: { id: shop.id }, data: { quantity: shop.quantity - item.qty } });
      }
      await tx.quotation.update({ where: { id: quote.id }, data: { status: "Converted" } });
      const created = await tx.invoice.create({
        data: {
          invoiceNo,
          customerId: quote.customerId || undefined,
          userId: req.user!.id,
          subtotal: quote.subtotal,
          discount: quote.discount,
          total: quote.total,
          paymentType: "Cash",
          paidAmount: quote.total,
          items: {
            create: items.map((i) => ({
              variantId: i.variantId,
              qty: i.qty,
              price: i.price,
              discount: i.discount,
            })),
          },
        },
        include: { items: true },
      });
      for (const invItem of created.items) {
        await sellShopUnits(tx, invItem.variantId, invItem.qty, invItem.id);
      }
      return created;
    });
    res.json(ok(invoice, "Converted to invoice"));
  } catch (e) {
    res.status(400).json(fail(e instanceof Error ? e.message : "Convert failed"));
  }
});

// ---------- Analytics / Dashboard ----------
router.get("/analytics/store-dashboard", requireAuth, async (_req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const variants = await prisma.productVariant.findMany({
      select: { id: true },
      where: { product: { active: true } },
      take: 500,
    });
    await Promise.all(variants.map((v) => ensureStockPair(prisma, v.id)));

    const [storeStocks, shopStocks, grnCount, releaseCount, todayGrns, todayReleases, recentReleases, recentGrns] =
      await Promise.all([
        prisma.stock.findMany({
          where: { location: LOC_STORE },
          include: { variant: { include: { product: true } } },
        }),
        prisma.stock.findMany({
          where: { location: LOC_SHOP },
          include: { variant: { include: { product: true } } },
        }),
        prisma.grn.count(),
        prisma.stockRelease.count(),
        prisma.grn.count({ where: { createdAt: { gte: startOfDay } } }),
        prisma.stockRelease.count({ where: { createdAt: { gte: startOfDay } } }),
        prisma.stockRelease.findMany({
          orderBy: { id: "desc" },
          take: 8,
          include: {
            user: true,
            items: { include: { variant: { include: { product: true } } } },
          },
        }),
        prisma.grn.findMany({
          orderBy: { id: "desc" },
          take: 8,
          include: { supplier: true, items: true },
        }),
      ]);

    const storeQty = storeStocks.reduce((s, r) => s + Number(r.quantity || 0), 0);
    const shopQty = shopStocks.reduce((s, r) => s + Number(r.quantity || 0), 0);
    const storeLow = storeStocks.filter((s) => s.quantity > 0 && s.quantity <= s.lowThreshold).length;
    const storeOut = storeStocks.filter((s) => s.quantity <= 0).length;
    const shopLow = shopStocks.filter((s) => s.quantity > 0 && s.quantity <= s.lowThreshold).length;
    const shopOut = shopStocks.filter((s) => s.quantity <= 0).length;

    const nameOf = (s: (typeof storeStocks)[0]) =>
      variantDisplayName(s.variant) || s.variant?.product?.name || `Variant #${s.variantId}`;

    const storeLowItems = storeStocks
      .filter((s) => s.quantity > 0 && s.quantity <= s.lowThreshold)
      .sort((a, b) => a.quantity - b.quantity)
      .slice(0, 8)
      .map((s) => ({
        variantId: s.variantId,
        name: nameOf(s),
        qty: s.quantity,
        threshold: s.lowThreshold,
        location: "store" as const,
      }));

    const shopLowItems = shopStocks
      .filter((s) => s.quantity > 0 && s.quantity <= s.lowThreshold)
      .sort((a, b) => a.quantity - b.quantity)
      .slice(0, 8)
      .map((s) => ({
        variantId: s.variantId,
        name: nameOf(s),
        qty: s.quantity,
        threshold: s.lowThreshold,
        location: "shop" as const,
      }));

    const shopOutItems = shopStocks
      .filter((s) => s.quantity <= 0)
      .slice(0, 8)
      .map((s) => ({
        variantId: s.variantId,
        name: nameOf(s),
        qty: s.quantity,
        location: "shop" as const,
      }));

    const readyToRelease = storeStocks
      .filter((s) => s.quantity > 0)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10)
      .map((s) => {
        const shop = shopStocks.find((x) => x.variantId === s.variantId);
        return {
          variantId: s.variantId,
          name: nameOf(s),
          storeQty: s.quantity,
          shopQty: shop?.quantity ?? 0,
        };
      });

    res.json(
      ok({
        kpis: {
          storeQty,
          shopQty,
          storeSkus: storeStocks.length,
          shopSkus: shopStocks.length,
          storeLow,
          storeOut,
          shopLow,
          shopOut,
          grnCount,
          releaseCount,
          todayGrns,
          todayReleases,
        },
        storeLowItems,
        shopLowItems,
        shopOutItems,
        readyToRelease,
        recentGrns: recentGrns.map((g) => ({
          id: g.id,
          billNo: g.billNo || `GRN #${g.id}`,
          supplierName: g.supplier?.name || "-",
          totalAmount: g.totalAmount,
          itemCount: g.items.length,
          createdAt: g.createdAt,
        })),
        recentReleases: recentReleases.map((r) => ({
          id: r.id,
          releaseNo: r.releaseNo,
          createdAt: r.createdAt,
          userName: r.user?.name || "-",
          itemCount: r.items.length,
          totalQty: r.items.reduce((s, i) => s + Number(i.qty || 0), 0),
        })),
      })
    );
  } catch (e) {
    console.error("[store-dashboard]", e);
    res.status(500).json(fail(e instanceof Error ? e.message : "Store dashboard failed", 500));
  }
});

router.get("/store-release/list", requireAuth, async (req, res) => {
  const limit = Number(req.query.limit || 100);
  const rows = await prisma.stockRelease.findMany({
    orderBy: { id: "desc" },
    take: limit,
    include: {
      user: true,
      items: {
        include: {
          variant: { include: { product: true } },
          units: { orderBy: { id: "asc" } },
        },
      },
    },
  });
  res.json(ok(rows));
});

router.get("/store-release/store-stock", requireAuth, async (req, res) => {
  const hasStock = req.query.hasStock === "true";
  const q = String(req.query.q || "").toLowerCase();
  const limit = Number(req.query.limit || 200);
  const variants = await prisma.productVariant.findMany({
    where: { product: { active: true } },
    include: { product: { include: { category: true, unit: true } } },
    orderBy: { id: "desc" },
    take: Math.min(limit * 3, 1500),
  });
  const rows = [];
  for (const variant of variants) {
    const { store, shop } = await ensureStockPair(prisma, variant.id);
    if (hasStock && store.quantity <= 0) continue;
    const displayName = variantDisplayName(variant);
    if (q && !displayName.toLowerCase().includes(q) && !String(variant.barcode || "").includes(q)) continue;
    rows.push({
      variantId: variant.id,
      displayName,
      productName: variant.product.name,
      productCode: variant.product.code,
      barcode: variant.barcode,
      price: variant.price,
      size: (variant as { size?: string | null }).size || null,
      color: (variant as { color?: string | null }).color || null,
      variantName: variant.name,
      storeQty: store.quantity,
      shopQty: shop.quantity,
      unit: variant.product.unit?.name || "-",
    });
    if (rows.length >= limit) break;
  }
  res.json(ok(rows));
});

router.post("/store-release/add", requireAuth, async (req, res) => {
  const items = (req.body?.items || []) as Array<{ variantId: number; qty: number }>;
  const note = req.body?.note ? String(req.body.note) : null;
  if (!items.length) return res.status(400).json(fail("At least one item is required"));

  const normalized = items.map((i) => ({
    variantId: Number(i.variantId),
    qty: Number(i.qty),
  }));

  for (const item of normalized) {
    if (!item.variantId || !(item.qty > 0)) {
      return res.status(400).json(fail("Each item needs variantId and qty > 0"));
    }
    const store = await getStoreStock(prisma, item.variantId);
    if (store.quantity < item.qty) {
      const variant = await prisma.productVariant.findUnique({
        where: { id: item.variantId },
        include: { product: true },
      });
      const label = variant ? variantDisplayName(variant) : `Variant ${item.variantId}`;
      return res.status(400).json(fail(`Insufficient store stock for ${label}. Available: ${store.quantity}`));
    }
  }

  const count = await prisma.stockRelease.count();
  const releaseNo = await nextNo("REL", count);

  try {
    const release = await prisma.$transaction(async (tx) => {
      const row = await tx.stockRelease.create({
        data: {
          releaseNo,
          userId: req.user!.id,
          note,
          items: {
            create: normalized.map((i) => ({
              variantId: i.variantId,
              qty: Math.floor(i.qty),
            })),
          },
        },
        include: {
          user: true,
          items: { include: { variant: { include: { product: true } } } },
        },
      });

      for (const item of normalized) {
        const moveQty = Math.floor(item.qty);
        const releaseItem = row.items.find((ri: { variantId: number }) => ri.variantId === item.variantId);
        const { store, shop } = await ensureStockPair(tx, item.variantId);
        await tx.stock.update({
          where: { id: store.id },
          data: { quantity: store.quantity - item.qty },
        });
        await tx.stock.update({
          where: { id: shop.id },
          data: { quantity: shop.quantity + item.qty },
        });
        await moveStockUnits(tx, item.variantId, moveQty, LOC_STORE, LOC_SHOP, releaseItem?.id);
      }

      return tx.stockRelease.findUnique({
        where: { id: row.id },
        include: {
          user: true,
          items: {
            include: {
              variant: { include: { product: true } },
              units: { orderBy: { id: "asc" } },
            },
          },
        },
      });
    });

    res.json(ok(release, "Stock released to shop"));
  } catch (e) {
    res.status(400).json(fail(e instanceof Error ? e.message : "Release failed"));
  }
});

router.get("/store-release/get-by-id/:id", requireAuth, async (req, res) => {
  const row = await prisma.stockRelease.findUnique({
    where: { id: parseId(req.params.id) },
    include: {
      user: true,
      items: {
        include: {
          variant: { include: { product: true } },
          units: { orderBy: { id: "asc" } },
        },
      },
    },
  });
  if (!row) return res.status(404).json(fail("Release not found", 404));
  res.json(ok(row));
});

router.get("/analytics/dashboard", requireAuth, async (_req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 6);
    weekAgo.setHours(0, 0, 0, 0);

    // Keep Firestore-friendly: flat queries, no deep nested includes on huge sets.
    const [invoiceCount, productCount, customerCount, supplierCount, sessions, stocks, weekInvoices, expenses, recentInvoices, invoiceItems] =
      await Promise.all([
        prisma.invoice.count(),
        prisma.product.count({ where: { active: true } }),
        prisma.customer.count(),
        prisma.supplier.count(),
        prisma.posSession.count(),
        prisma.stock.findMany({
          take: 800,
          include: { variant: { include: { product: { select: { name: true, code: true } } } } },
        }),
        prisma.invoice.findMany({
          where: { createdAt: { gte: weekAgo } },
          orderBy: { createdAt: "desc" },
        }),
        prisma.cashMovement.aggregate({ where: { type: "OUT" }, _sum: { amount: true } }),
        prisma.invoice.findMany({
          orderBy: { id: "desc" },
          take: 8,
          select: {
            id: true,
            invoiceNo: true,
            total: true,
            paymentType: true,
            createdAt: true,
            customer: { select: { name: true } },
          },
        }),
        prisma.invoiceItem.findMany({
          take: 500,
          orderBy: { id: "desc" },
          select: { variantId: true, qty: true, price: true, discount: true, invoiceId: true },
        }),
      ]);

    const shopOrStore = stocks;
    const low = shopOrStore.filter((s) => s.quantity > 0 && s.quantity <= s.lowThreshold).length;
    const outOfStock = shopOrStore.filter((s) => s.quantity <= 0).length;
    const todayInvoices = weekInvoices.filter((i) => new Date(i.createdAt).getTime() >= startOfDay.getTime());
    const todaysSales = todayInvoices.reduce((s, i) => s + Number(i.total || 0), 0);
    const revenue = weekInvoices.reduce((s, i) => s + Number(i.total || 0), 0);
    const gross = weekInvoices.reduce((s, i) => s + Number(i.subtotal || 0), 0);
    const discounts = weekInvoices.reduce((s, i) => s + Number(i.discount || 0), 0);
    const misc = Number(expenses._sum.amount || 0);
    const netProfit = revenue - discounts - misc;

    const revenueSeries = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const dayTotal = weekInvoices
        .filter((inv) => new Date(inv.createdAt).toISOString().slice(0, 10) === key)
        .reduce((s, inv) => s + Number(inv.total || 0), 0);
      revenueSeries.push({
        date: key,
        label: d.toLocaleDateString(undefined, { weekday: "short" }),
        total: dayTotal,
      });
    }

    const salesByVariant = new Map<number, { qty: number; amount: number }>();
    const bumpSale = (rawVariantId: unknown, qty: unknown, price: unknown, discount: unknown) => {
      const vid = Number(rawVariantId);
      if (!Number.isFinite(vid) || vid <= 0) return;
      const q = Number(qty || 0);
      if (!Number.isFinite(q) || q === 0) return;
      const cur = salesByVariant.get(vid) || { qty: 0, amount: 0 };
      const line = Math.max(0, q * Number(price || 0) - Number(discount || 0));
      cur.qty += q;
      cur.amount += line;
      salesByVariant.set(vid, cur);
    };

    for (const it of invoiceItems as Array<{ variantId?: unknown; qty?: unknown; price?: unknown; discount?: unknown }>) {
      bumpSale(it.variantId, it.qty, it.price, it.discount);
    }

    // Fallback: if flat InvoiceItem scan was empty/filtered, pull line items via recent invoices.
    if (salesByVariant.size === 0 && weekInvoices.length > 0) {
      const recentInv = await prisma.invoice.findMany({
        orderBy: { id: "desc" },
        take: 80,
        include: { items: true },
      });
      for (const inv of recentInv as Array<{ items?: Array<{ variantId?: unknown; qty?: unknown; price?: unknown; discount?: unknown }> }>) {
        for (const it of inv.items || []) {
          bumpSale(it.variantId, it.qty, it.price, it.discount);
        }
      }
    }

    const topVariantIds = [...salesByVariant.entries()]
      .sort((a, b) => b[1].qty - a[1].qty)
      .slice(0, 6)
      .map(([id]) => id);

    const topVariants =
      topVariantIds.length > 0
        ? await prisma.productVariant.findMany({
            where: { id: { in: topVariantIds } },
            include: { product: { select: { name: true } } },
          })
        : [];
    const variantName = new Map<number, string>();
    for (const v of topVariants as Array<{
      id: number | string;
      name?: string;
      size?: string | null;
      color?: string | null;
      product?: { name?: string };
    }>) {
      const id = Number(v.id);
      const label =
        variantDisplayName({
          name: String(v.name || ""),
          size: v.size,
          color: v.color,
          product: { name: String(v.product?.name || "") },
        }) ||
        v.product?.name ||
        `Item #${id}`;
      variantName.set(id, String(label));
    }
    const popular = topVariantIds.map((id) => {
      const s = salesByVariant.get(id)!;
      return {
        name: String(variantName.get(id) || `Item #${id}`).slice(0, 40),
        sales: Math.round(s.qty * 100) / 100,
        amount: Math.round(s.amount),
      };
    });

    const lowStockItems = shopOrStore
      .filter((s) => s.quantity > 0 && s.quantity <= s.lowThreshold)
      .sort((a, b) => a.quantity - b.quantity)
      .slice(0, 8)
      .map((s) => ({
        name: variantDisplayName(s.variant) || s.variant?.product?.name || `Variant #${s.variantId}`,
        qty: s.quantity,
        threshold: s.lowThreshold,
        location: s.location || "store",
      }));

    const paymentMix = { Cash: 0, Card: 0, Bank: 0, Other: 0 };
    for (const inv of weekInvoices) {
      const t = String(inv.paymentType || "Cash");
      if (t === "Cash" || t === "Card" || t === "Bank") paymentMix[t] += Number(inv.total || 0);
      else paymentMix.Other += Number(inv.total || 0);
    }
    const paymentSeries = Object.entries(paymentMix)
      .filter(([, v]) => v > 0)
      .map(([name, total]) => ({ name, total: Math.round(total) }));

    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const cpus = os.cpus();
    const cpuLoad = Math.min(
      100,
      Math.round(
        cpus.reduce((s, c) => {
          const t = Object.values(c.times).reduce((a, b) => a + b, 0);
          return s + ((t - c.times.idle) / t) * 100;
        }, 0) / Math.max(1, cpus.length)
      )
    );

    res.json(
      ok({
        kpis: {
          todaysSales,
          invoicesToday: todayInvoices.length,
          invoices: invoiceCount,
          products: productCount,
          customers: customerCount,
          suppliers: supplierCount,
          lowStock: low,
          outOfStock,
        },
        revenue: { total: revenue, growth: 100, series: revenueSeries },
        popular,
        lowStockItems,
        recentInvoices: recentInvoices.map((inv) => ({
          id: inv.id,
          invoiceNo: inv.invoiceNo,
          total: Number(inv.total || 0),
          paymentType: inv.paymentType || "Cash",
          customer: inv.customer?.name || "Walk-in",
          createdAt: inv.createdAt,
        })),
        paymentSeries,
        financial: {
          grossSales: gross,
          discounts,
          netProfit,
          miscExpenses: misc,
          growth: 100,
        },
        sessions: { total: sessions, growth: 100 },
        resources: {
          cpu: cpuLoad,
          memory: totalMem ? Math.round((usedMem / totalMem) * 100) : 0,
          memoryDetail: `${(usedMem / 1e9).toFixed(1)}GB/${(totalMem / 1e9).toFixed(1)}GB`,
          storage: 69,
          storageDetail: "6.9GB/10.0GB",
        },
      })
    );
  } catch (e) {
    console.error("[dashboard]", e);
    res.status(500).json(fail(e instanceof Error ? e.message : "Dashboard failed", 500));
  }
});

// ---------- Employees ----------
router.get("/employees", requireAuth, async (_req, res) => {
  res.json(ok(await prisma.employee.findMany({ orderBy: { id: "desc" } })));
});

router.post("/employees", requireAuth, async (req, res) => {
  const fingerprintCode = req.body?.fingerprintCode != null ? String(req.body.fingerprintCode).trim() : "";
  if (fingerprintCode) {
    const clash = await prisma.employee.findFirst({ where: { fingerprintCode } });
    if (clash) return res.status(400).json(fail(`Fingerprint code already used by ${clash.name}`));
  }
  const row = await prisma.employee.create({
    data: {
      name: String(req.body?.name || ""),
      contact: req.body?.contact,
      email: req.body?.email,
      roleTitle: req.body?.roleTitle,
      salaryBase: Number(req.body?.salaryBase || 0),
      fingerprintCode: fingerprintCode || null,
    },
  });
  res.json(ok(row));
});

router.put("/employees/:id", requireAuth, async (req, res) => {
  const id = parseId(req.params.id);
  const fingerprintCode =
    req.body?.fingerprintCode != null ? String(req.body.fingerprintCode).trim() : undefined;
  if (fingerprintCode) {
    const clash = await prisma.employee.findFirst({
      where: { fingerprintCode, NOT: { id } },
    });
    if (clash) return res.status(400).json(fail(`Fingerprint code already used by ${clash.name}`));
  }
  const row = await prisma.employee.update({
    where: { id },
    data: {
      name: req.body?.name,
      contact: req.body?.contact,
      email: req.body?.email,
      roleTitle: req.body?.roleTitle,
      salaryBase: req.body?.salaryBase != null ? Number(req.body.salaryBase) : undefined,
      active: req.body?.active,
      ...(fingerprintCode !== undefined ? { fingerprintCode: fingerprintCode || null } : {}),
    },
  });
  res.json(ok(row));
});

router.get("/employees/attendance", requireAuth, async (_req, res) => {
  const rows = await prisma.attendance.findMany({
    include: { employee: true, user: true },
    orderBy: { id: "desc" },
  });
  res.json(ok(rows));
});

router.post("/employees/attendance", requireAuth, async (req, res) => {
  const employeeId = Number(req.body?.employeeId);
  if (!employeeId) return res.status(400).json(fail("employeeId required"));

  const day = req.body?.date ? new Date(String(req.body.date)) : new Date();
  if (Number.isNaN(day.getTime())) return res.status(400).json(fail("Invalid date"));
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(day);
  end.setHours(23, 59, 59, 999);

  const existing = await prisma.attendance.findFirst({
    where: { employeeId, date: { gte: start, lte: end } },
  });

  const payload = {
    checkIn: req.body?.checkIn != null ? String(req.body.checkIn) : existing?.checkIn || null,
    checkOut: req.body?.checkOut != null ? String(req.body.checkOut) : existing?.checkOut || null,
    note: req.body?.note != null ? String(req.body.note) : existing?.note || null,
    method: String(req.body?.method || existing?.method || "manual"),
    userId: req.user!.id,
  };

  const row = existing
    ? await prisma.attendance.update({
        where: { id: existing.id },
        data: payload,
        include: { employee: true, user: true },
      })
    : await prisma.attendance.create({
        data: {
          employeeId,
          date: start,
          ...payload,
        },
        include: { employee: true, user: true },
      });

  res.json(ok(row, existing ? "Attendance updated" : "Attendance marked"));
});

router.post("/employees/attendance/fingerprint", requireAuth, async (req, res) => {
  const enabledRow = await prisma.setting.findUnique({ where: { key: "fingerprint_attendance" } });
  let enabled = enabledRow?.value === "1";
  if (!enabled) {
    try {
      const fj = await prisma.setting.findUnique({ where: { key: "features_json" } });
      if (fj?.value) {
        const f = JSON.parse(fj.value) as { fingerprintAttendance?: boolean };
        enabled = Boolean(f.fingerprintAttendance);
      }
    } catch {
      /* ignore */
    }
  }
  if (!enabled) {
    return res.status(403).json(fail("Fingerprint attendance is disabled by Master Admin"));
  }

  const code = String(req.body?.fingerprintCode || req.body?.code || "").trim();
  if (!code) return res.status(400).json(fail("fingerprintCode required"));

  const employee = await prisma.employee.findFirst({
    where: { fingerprintCode: code, active: true },
  });
  if (!employee) return res.status(404).json(fail("Fingerprint not enrolled / employee not found", 404));

  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  const existing = await prisma.attendance.findFirst({
    where: { employeeId: employee.id, date: { gte: start, lte: end } },
  });

  let action: "check-in" | "check-out" = "check-in";
  let row;
  if (!existing || !existing.checkIn) {
    row = existing
      ? await prisma.attendance.update({
          where: { id: existing.id },
          data: { checkIn: time, method: "fingerprint", userId: req.user!.id },
          include: { employee: true, user: true },
        })
      : await prisma.attendance.create({
          data: {
            employeeId: employee.id,
            date: start,
            checkIn: time,
            method: "fingerprint",
            userId: req.user!.id,
          },
          include: { employee: true, user: true },
        });
    action = "check-in";
  } else if (!existing.checkOut) {
    row = await prisma.attendance.update({
      where: { id: existing.id },
      data: { checkOut: time, method: "fingerprint", userId: req.user!.id },
      include: { employee: true, user: true },
    });
    action = "check-out";
  } else {
    return res.status(400).json(
      fail(`${employee.name} already checked in (${existing.checkIn}) and out (${existing.checkOut}) today`)
    );
  }

  res.json(ok({ ...row, action }, `${employee.name} — ${action} at ${time}`));
});

router.get("/employees/salaries", requireAuth, async (_req, res) => {
  const rows = await prisma.salary.findMany({
    include: { employee: true, user: true },
    orderBy: { id: "desc" },
  });
  res.json(ok(rows));
});

router.post("/employees/salaries", requireAuth, async (req, res) => {
  const row = await prisma.salary.create({
    data: {
      employeeId: Number(req.body?.employeeId),
      userId: req.user!.id,
      month: String(req.body?.month || ""),
      amount: Number(req.body?.amount || 0),
      note: req.body?.note,
    },
  });
  res.json(ok(row));
});

// ---------- Accounts ----------
router.get("/accounts/movements", requireAuth, async (_req, res) => {
  const rows = await prisma.cashMovement.findMany({
    include: { user: true },
    orderBy: { id: "desc" },
  });
  const inn = rows.filter((r) => r.type === "IN").reduce((s, r) => s + r.amount, 0);
  const out = rows.filter((r) => r.type === "OUT").reduce((s, r) => s + r.amount, 0);
  res.json(ok({ rows, summary: { in: inn, out, balance: inn - out } }));
});

router.post("/accounts/movements", requireAuth, async (req, res) => {
  const row = await prisma.cashMovement.create({
    data: {
      type: String(req.body?.type || "IN").toUpperCase(),
      amount: Number(req.body?.amount || 0),
      note: req.body?.note,
      userId: req.user!.id,
    },
  });
  res.json(ok(row));
});

router.get("/accounts/sessions", requireAuth, async (_req, res) => {
  const sessions = await prisma.posSession.findMany({
    include: { user: true },
    orderBy: { id: "desc" },
  });
  const enriched = await Promise.all(
    sessions.map(async (s) => {
      const from = s.openedAt;
      const to = s.closedAt || new Date();
      const [invoices, movements] = await Promise.all([
        prisma.invoice.findMany({
          where: {
            userId: s.userId,
            createdAt: { gte: from, lte: to },
          },
        }),
        prisma.cashMovement.findMany({
          where: {
            userId: s.userId,
            createdAt: { gte: from, lte: to },
          },
        }),
      ]);
      const totalSales = invoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0);
      const cashIn = movements.filter((m) => m.type === "IN").reduce((sum, m) => sum + Number(m.amount || 0), 0);
      const cashOut = movements.filter((m) => m.type === "OUT").reduce((sum, m) => sum + Number(m.amount || 0), 0);
      const expected = Number(s.openingBalance || 0) + totalSales + cashIn - cashOut;
      return {
        ...s,
        totalSales,
        cashIn,
        cashOut,
        expected,
        status: s.closedAt ? "CLOSED" : "OPEN",
      };
    })
  );
  res.json(ok(enriched));
});

router.post("/accounts/sessions", requireAuth, async (req, res) => {
  const existing = await prisma.posSession.findFirst({
    where: { userId: req.user!.id, closedAt: null },
    orderBy: { id: "desc" },
  });
  if (existing) {
    return res.json(ok(existing, "Resumed open cash session"));
  }
  const row = await prisma.posSession.create({
    data: {
      userId: req.user!.id,
      counterName: String(req.body?.counterName || "Counter 1"),
      openingBalance: Number(req.body?.openingBalance || 0),
    },
  });
  res.json(ok(row, "Cash session started"));
});

router.post("/accounts/sessions/:id/close", requireAuth, async (req, res) => {
  const row = await prisma.posSession.update({
    where: { id: parseId(req.params.id) },
    data: { closingBalance: Number(req.body?.closingBalance || 0), closedAt: new Date() },
  });
  res.json(ok(row));
});

// ---------- Reports ----------
router.get("/reports/inventory", requireAuth, async (_req, res) => {
  const stocks = await prisma.stock.findMany({
    include: { variant: { include: { product: true } } },
  });
  res.json(
    ok(
      stocks.map((s) => ({
        product: s.variant.product.name,
        code: s.variant.product.code,
        qty: s.quantity,
        cost: s.variant.cost,
        value: s.quantity * s.variant.cost,
        price: s.variant.price,
      }))
    )
  );
});

router.get("/reports/inventory-analytics", requireAuth, async (req, res) => {
  const fromStr = String(req.query.from || "");
  const toStr = String(req.query.to || "");
  const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;
  const brandId = req.query.brandId ? Number(req.query.brandId) : undefined;
  const now = new Date();
  const from = fromStr ? new Date(fromStr) : new Date(now.getFullYear(), now.getMonth(), 1);
  from.setHours(0, 0, 0, 0);
  const to = toStr ? new Date(toStr) : now;
  to.setHours(23, 59, 59, 999);

  const stocks = await prisma.stock.findMany({
    include: {
      variant: {
        include: {
          product: { include: { category: true, brand: true, unit: true } },
        },
      },
    },
  });

  const filteredStocks = stocks.filter((s) => {
    const p = s.variant.product;
    if (categoryId && p.categoryId !== categoryId) return false;
    if (brandId && p.brandId !== brandId) return false;
    return true;
  });

  const invoiceItems = await prisma.invoiceItem.findMany({
    where: { invoice: { createdAt: { gte: from, lte: to } } },
    include: {
      invoice: true,
      variant: { include: { product: true } },
    },
  });

  const salesByVariant = new Map<
    number,
    { qty: number; revenue: number; lastSale: Date | null; name: string; productId: number }
  >();
  for (const it of invoiceItems) {
    const vid = it.variantId;
    const row = salesByVariant.get(vid) || {
      qty: 0,
      revenue: 0,
      lastSale: null as Date | null,
      name: it.variant.product.name,
      productId: it.variant.productId,
    };
    row.qty += Number(it.qty || 0);
    row.revenue += Number(it.qty || 0) * Number(it.price || 0);
    const d = it.invoice.createdAt;
    if (!row.lastSale || d > row.lastSale) row.lastSale = d;
    salesByVariant.set(vid, row);
  }

  // also include last sale outside range for deadstock days calculation
  const allSaleItems = await prisma.invoiceItem.findMany({
    select: { variantId: true, invoice: { select: { createdAt: true } } },
  });
  const lastSaleMap = new Map<number, Date>();
  for (const it of allSaleItems) {
    const prev = lastSaleMap.get(it.variantId);
    if (!prev || it.invoice.createdAt > prev) lastSaleMap.set(it.variantId, it.invoice.createdAt);
  }

  const inventoryValue = filteredStocks.reduce(
    (s, st) => s + Number(st.quantity || 0) * Number(st.variant.cost || 0),
    0
  );
  const productIds = new Set(filteredStocks.map((s) => s.variant.productId));
  const lowStock = filteredStocks.filter((s) => Number(s.quantity) <= Number(s.lowThreshold || 5));

  const deadstockRows = filteredStocks
    .map((s) => {
      const last = lastSaleMap.get(s.variantId) || null;
      const days = last ? Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24)) : 999;
      const soldInPeriod = salesByVariant.get(s.variantId)?.qty || 0;
      return {
        variantId: s.variantId,
        productId: s.variant.productId,
        name: s.variant.product.name,
        qty: Number(s.quantity || 0),
        value: Number(s.quantity || 0) * Number(s.variant.cost || 0),
        lastSaleDays: days,
        lastSaleAt: last,
        soldInPeriod,
        slow: soldInPeriod === 0 || days >= 7,
      };
    })
    .filter((r) => r.slow)
    .sort((a, b) => b.lastSaleDays - a.lastSaleDays);

  const deadstockValue = deadstockRows.reduce((s, r) => s + r.value, 0);

  const topSellers = Array.from(salesByVariant.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
    .map((r, idx) => ({
      rank: idx + 1,
      name: r.name,
      revenue: r.revenue,
      qty: r.qty,
      growth: 100,
    }));

  const volumeTrend = Array.from(salesByVariant.values())
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 8)
    .map((r) => ({ name: r.name, units: r.qty }));

  // low stock / critical reorder - try last supplier from GRN
  const grnItems = await prisma.grnItem.findMany({
    include: { grn: { include: { supplier: true } }, variant: true },
    orderBy: { id: "desc" },
  });
  const lastSupplierByVariant = new Map<number, { name: string; contact: string | null }>();
  for (const gi of grnItems) {
    if (lastSupplierByVariant.has(gi.variantId)) continue;
    lastSupplierByVariant.set(gi.variantId, {
      name: gi.grn.supplier?.name || "N/A",
      contact: gi.grn.supplier?.contact || null,
    });
  }

  const criticalReorder = lowStock.map((s) => {
    const qty = Number(s.quantity || 0);
    const supplier = lastSupplierByVariant.get(s.variantId);
    return {
      name: s.variant.product.name,
      inStock: qty,
      mrp: Number(s.variant.price || 0),
      cost: Number(s.variant.cost || 0),
      threshold: Number(s.lowThreshold || 5),
      supplier: supplier?.name || "N/A",
      contact: supplier?.contact || "N/A",
      status: qty <= 0 ? "OUT OF STOCK" : "LOW STOCK",
    };
  });

  const profitability = filteredStocks.map((s) => {
    const cost = Number(s.variant.cost || 0);
    const price = Number(s.variant.price || 0);
    const markup = cost > 0 ? ((price - cost) / cost) * 100 : 0;
    const gp = price > 0 ? ((price - cost) / price) * 100 : 0;
    return {
      name: s.variant.product.name,
      unitCost: cost,
      sellingPrice: price,
      markup,
      gp,
      status: gp >= 20 ? "HEALTHY" : "LOW MARGIN",
    };
  });

  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });
  const brands = await prisma.brand.findMany({ orderBy: { name: "asc" } });

  res.json(
    ok({
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      categories,
      brands,
      summary: {
        inventoryValue,
        totalProducts: productIds.size,
        lowStockCount: lowStock.length,
        deadstockValue,
      },
      volumeTrend,
      topSellers,
      deadstock: deadstockRows.slice(0, 20),
      criticalReorder,
      profitability,
    })
  );
});

router.get("/reports/tax", requireAuth, async (_req, res) => {
  const invoices = await prisma.invoice.findMany();
  const gross = invoices.reduce((s, i) => s + i.total, 0);
  res.json(ok({ gross, taxRate: 0, tax: 0, invoices: invoices.length }));
});

router.get("/reports/employee", requireAuth, async (_req, res) => {
  const employees = await prisma.employee.findMany({ include: { attendances: true, salaries: true } });
  res.json(ok(employees));
});

router.get("/reports/quotations", requireAuth, async (_req, res) => {
  const rows = await prisma.quotation.findMany({ include: { customer: true } });
  res.json(ok(rows));
});

router.get("/reports/financial", requireAuth, async (req, res) => {
  const fromStr = String(req.query.from || "");
  const toStr = String(req.query.to || "");
  const counter = String(req.query.counter || "");
  const now = new Date();
  const from = fromStr ? new Date(fromStr) : new Date(now.getFullYear(), now.getMonth(), 1);
  from.setHours(0, 0, 0, 0);
  const to = toStr ? new Date(toStr) : now;
  to.setHours(23, 59, 59, 999);

  const invoices = await prisma.invoice.findMany({
    where: { createdAt: { gte: from, lte: to } },
    include: {
      user: true,
      items: { include: { variant: true } },
      returns: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const returns = await prisma.return.findMany({
    where: { createdAt: { gte: from, lte: to } },
  });
  const movements = await prisma.cashMovement.findMany({
    where: { createdAt: { gte: from, lte: to } },
  });
  const sessions = await prisma.posSession.findMany({
    where: { openedAt: { gte: from, lte: to } },
    include: { user: true },
    orderBy: { openedAt: "desc" },
  });

  const filteredInvoices = counter
    ? invoices.filter((inv) => {
        // counter filter is approximate via matching open session counter for user/day
        return sessions.some(
          (s) =>
            s.userId === inv.userId &&
            s.counterName === counter &&
            inv.createdAt >= s.openedAt &&
            inv.createdAt <= (s.closedAt || to)
        );
      })
    : invoices;

  const grossSales = filteredInvoices.reduce((s, i) => s + Number(i.subtotal || i.total || 0), 0);
  const discounts = filteredInvoices.reduce((s, i) => s + Number(i.discount || 0), 0);
  const returnsTotal = returns.reduce((s, r) => s + Number(r.total || 0), 0);
  const netRevenue = filteredInvoices.reduce((s, i) => s + Number(i.total || 0), 0) - returnsTotal;
  const cogs = filteredInvoices.reduce(
    (s, inv) =>
      s +
      inv.items.reduce((is, it) => is + Number(it.qty || 0) * Number(it.variant?.cost || 0), 0),
    0
  );
  const expenses = cogs;
  const netProfit = netRevenue - expenses;
  const invoiceCount = filteredInvoices.length;

  // daily trend + ledger
  const byDay = new Map<
    string,
    { gross: number; discounts: number; returns: number; net: number; expenses: number; invoices: number }
  >();
  for (const inv of filteredInvoices) {
    const day = inv.createdAt.toISOString().slice(0, 10);
    const row = byDay.get(day) || { gross: 0, discounts: 0, returns: 0, net: 0, expenses: 0, invoices: 0 };
    row.gross += Number(inv.subtotal || inv.total || 0);
    row.discounts += Number(inv.discount || 0);
    row.net += Number(inv.total || 0);
    row.expenses += inv.items.reduce((is, it) => is + Number(it.qty || 0) * Number(it.variant?.cost || 0), 0);
    row.invoices += 1;
    byDay.set(day, row);
  }
  for (const r of returns) {
    const day = r.createdAt.toISOString().slice(0, 10);
    const row = byDay.get(day) || { gross: 0, discounts: 0, returns: 0, net: 0, expenses: 0, invoices: 0 };
    row.returns += Number(r.total || 0);
    row.net -= Number(r.total || 0);
    byDay.set(day, row);
  }

  const trend = Array.from(byDay.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => ({ date, total: v.net }));

  const ledger = Array.from(byDay.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, v], idx) => ({
      ledgerId: `aRFP-${String(idx + 1).padStart(3, "0")}`,
      grossSales: v.gross,
      discounts: v.discounts,
      returns: v.returns,
      netRevenue: v.net,
      expenses: v.expenses,
      netProfit: v.net - v.expenses,
      invoices: v.invoices,
      date,
    }));

  // payments breakdown
  const paymentBuckets: Record<string, { label: string; amount: number; txns: number }> = {
    Cash: { label: "Cash", amount: 0, txns: 0 },
    Card: { label: "Card Payments", amount: 0, txns: 0 },
    Digital: { label: "Digital/QR", amount: 0, txns: 0 },
  };
  for (const inv of filteredInvoices) {
    const pt = String(inv.paymentType || "Cash").toLowerCase();
    let key = "Cash";
    if (pt.includes("card")) key = "Card";
    else if (pt.includes("bank") || pt.includes("qr") || pt.includes("digital") || pt.includes("transfer")) key = "Digital";
    paymentBuckets[key].amount += Number(inv.total || 0);
    paymentBuckets[key].txns += 1;
  }
  const paymentsTotal = Object.values(paymentBuckets).reduce((s, b) => s + b.amount, 0) || 1;
  const payments = Object.values(paymentBuckets).map((b) => ({
    ...b,
    percent: (b.amount / paymentsTotal) * 100,
  }));

  // z-report
  const cashSales = paymentBuckets.Cash.amount;
  const cardPayments = paymentBuckets.Card.amount;
  const bankDeposit = paymentBuckets.Digital.amount;
  const cashIn = movements.filter((m) => m.type === "IN").reduce((s, m) => s + Number(m.amount || 0), 0);
  const cashOut = movements.filter((m) => m.type === "OUT").reduce((s, m) => s + Number(m.amount || 0), 0);
  const openingFloat = sessions.reduce((s, sess) => s + Number(sess.openingBalance || 0), 0) || 0;
  const expectedTaking = cashSales + cashIn - cashOut;

  // hourly trend for today within range (use to date day)
  const focusDay = to.toISOString().slice(0, 10);
  const hourly = Array.from({ length: 17 }, (_, i) => ({ hour: `${String(i).padStart(2, "0")}:00`, total: 0 }));
  for (const inv of filteredInvoices) {
    const day = inv.createdAt.toISOString().slice(0, 10);
    if (day !== focusDay) continue;
    const h = inv.createdAt.getHours();
    if (h >= 0 && h <= 16) hourly[h].total += Number(inv.total || 0);
  }

  const recentSessions = sessions.slice(0, 8).map((s, idx) => ({
    id: s.id,
    label: `${s.openedAt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} — Z-Report #${String(idx + 1).padStart(3, "0")}`,
    counter: s.counterName,
    cashier: s.user?.name || "-",
    openedAt: s.openedAt,
    amount: Number(s.closingBalance ?? s.openingBalance ?? 0),
  }));

  const counters = Array.from(new Set(sessions.map((s) => s.counterName).filter(Boolean)));

  res.json(
    ok({
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      counters,
      summary: {
        grossSales,
        netRevenue,
        netProfit,
        invoiceCount,
        discounts,
        returns: returnsTotal,
        expenses,
        growth: 100,
      },
      trend,
      ledger,
      payments: {
        total: Object.values(paymentBuckets).reduce((s, b) => s + b.amount, 0),
        channels: payments,
      },
      zReport: {
        openingFloat,
        cashSales,
        cardPayments,
        bankDeposit,
        cashIn,
        cashOut,
        expectedTaking,
        sessionCount: sessions.length,
        hourly,
        recentSessions,
      },
    })
  );
});

// ---------- Settings / Backup ----------
router.get("/settings", requireAuth, async (_req, res) => {
  const rows = await prisma.setting.findMany();
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  res.json(ok(map));
});

router.put("/settings", requireAuth, async (req, res) => {
  try {
    const entries = Object.entries(req.body || {});
    const failed: string[] = [];
    for (const [key, value] of entries) {
      const str = value == null ? "" : String(value);
      // Firestore doc limit ~1MB — oversized logos must be compressed on client
      if ((key === "store_logo" || key === "customer_logo") && str.length > 900_000) {
        failed.push(key);
        continue;
      }
      try {
        await prisma.setting.upsert({
          where: { key },
          create: { key, value: str },
          update: { value: str },
        });
      } catch (e) {
        console.error("[settings] upsert failed", key, e instanceof Error ? e.message : e);
        failed.push(key);
      }
    }
    if (failed.length) {
      return res.status(400).json(
        fail(
          `Could not save: ${failed.join(", ")}. Logo files are auto-compressed — try Save again or use a smaller image.`
        )
      );
    }
    res.json(ok(null, "Settings saved"));
  } catch (e) {
    res.status(500).json(fail(e instanceof Error ? e.message : "Settings save failed", 500));
  }
});

const BACKUP_RETENTION_DAYS = 7;

function backupDirPath() {
  if (process.env.BACKUP_DIR?.trim()) {
    const backupDir = path.resolve(process.env.BACKUP_DIR.trim());
    fs.mkdirSync(backupDir, { recursive: true });
    return backupDir;
  }
  if (process.env.ARCHIVES_DIR?.trim()) {
    const backupDir = path.resolve(process.env.ARCHIVES_DIR.trim());
    fs.mkdirSync(backupDir, { recursive: true });
    return backupDir;
  }
  const backupDir = process.env.VERCEL
    ? path.join("/tmp", "quantumexe-backups")
    : path.resolve(__dirname, "../../backups");
  fs.mkdirSync(backupDir, { recursive: true });
  return backupDir;
}

function isBackupFile(name: string) {
  return /\.(db|zip|json)$/i.test(name) && name.toLowerCase().startsWith("backup");
}

function listBackupFiles() {
  const backupDir = backupDirPath();
  const now = Date.now();
  const cutoff = now - BACKUP_RETENTION_DAYS * 86400000;

  for (const f of fs.readdirSync(backupDir)) {
    if (!isBackupFile(f)) continue;
    const full = path.join(backupDir, f);
    const st = fs.statSync(full);
    if (st.mtimeMs < cutoff) {
      try {
        fs.unlinkSync(full);
      } catch {
        /* ignore */
      }
    }
  }

  return fs
    .readdirSync(backupDir)
    .filter(isBackupFile)
    .map((f) => {
      const full = path.join(backupDir, f);
      const st = fs.statSync(full);
      return {
        file: f,
        path: full,
        size: st.size,
        size_mb: Number((st.size / (1024 * 1024)).toFixed(2)),
        created_at: st.mtime.toISOString(),
        mtime_ms: st.mtimeMs,
      };
    })
    .sort((a, b) => b.mtime_ms - a.mtime_ms);
}

router.post("/backup/export", requireAuth, async (_req, res) => {
  const backupDir = backupDirPath();
  const dest = path.join(backupDir, `backup_${Date.now()}.json`);
  const snapshot = {
    createdAt: new Date().toISOString(),
    settings: await prisma.setting.findMany(),
    license: await prisma.license.findFirst({ orderBy: { id: "desc" } }),
    counts: {
      products: await prisma.product.count(),
      customers: await prisma.customer.count(),
      invoices: await prisma.invoice.count(),
      users: await prisma.user.count(),
    },
  };
  fs.writeFileSync(dest, JSON.stringify(snapshot, null, 2), "utf8");
  const st = fs.statSync(dest);
  res.json(
    ok(
      {
        path: dest,
        file: path.basename(dest),
        size: st.size,
        size_mb: Number((st.size / (1024 * 1024)).toFixed(2)),
        created_at: st.mtime.toISOString(),
      },
      "Backup created"
    )
  );
});

router.get("/backup/list", requireAuth, async (_req, res) => {
  const files = listBackupFiles();
  const totalSize = files.reduce((s, f) => s + f.size, 0);
  const last = files[0];
  const {
    listSqliteArchives,
    getRetentionStatus,
    archivesSupported,
  } = await import("./retention/index.js");
  const sqliteArchives = listSqliteArchives();
  const retention = await getRetentionStatus();
  res.json(
    ok({
      files,
      sqliteArchives,
      retention,
      summary: {
        total_files: files.length,
        total_size: totalSize,
        total_size_mb: Number((totalSize / (1024 * 1024)).toFixed(2)),
        last_backup_at: last?.created_at || null,
        status: files.length > 0 || sqliteArchives.length > 0 ? "Protected" : "No backups",
        retention_days: BACKUP_RETENTION_DAYS,
        schedule: "Daily JSON + monthly SQLite archive",
        auto_backup: true,
        cloud_retention_months: retention.cloudRetentionMonths,
        last_cloud_purge_at: retention.lastCloudPurgeAt,
        archives_supported: archivesSupported(),
        sqlite_archive_count: sqliteArchives.length,
      },
    })
  );
});

router.post("/backup/archive", requireAuth, async (req, res) => {
  try {
    const kind = String(req.body?.kind || "monthly");
    const { createMonthlyArchive, createAnnualArchive } = await import("./retention/index.js");
    const info = kind === "annual" ? await createAnnualArchive() : await createMonthlyArchive();
    res.json(ok(info, "SQLite archive created"));
  } catch (e) {
    res.status(400).json(fail(e instanceof Error ? e.message : "Archive failed"));
  }
});

router.post("/backup/purge-cloud", requireAuth, async (_req, res) => {
  try {
    const { purgeCloudOlderThanRetention } = await import("./retention/index.js");
    const result = await purgeCloudOlderThanRetention({ forceArchive: true });
    res.json(ok(result, result.skipped ? `Purge skipped (${result.reason})` : "Cloud purge completed"));
  } catch (e) {
    res.status(400).json(fail(e instanceof Error ? e.message : "Purge failed"));
  }
});

router.get("/backup/archives/:kind/:file", requireAuth, async (req, res) => {
  const kind = String(req.params.kind || "");
  const file = path.basename(String(req.params.file || ""));
  if (!["monthly", "annual"].includes(kind) || !/\.sqlite$/i.test(file)) {
    return res.status(400).json(fail("Invalid archive path"));
  }
  const { resolveArchiveDownloadPath } = await import("./retention/index.js");
  const full = resolveArchiveDownloadPath(`${kind}/${file}`);
  if (!full) return res.status(404).json(fail("Archive not found", 404));
  res.download(full, file);
});

router.get("/archive/search", requireAuth, async (req, res) => {
  try {
    const q = String(req.query.q || "");
    const from = req.query.from ? String(req.query.from) : null;
    const to = req.query.to ? String(req.query.to) : null;
    const includeArchives = String(req.query.includeArchives ?? "1") !== "0";
    const { searchLiveAndArchives } = await import("./retention/index.js");
    const result = await searchLiveAndArchives({ q, from, to, includeArchives });
    res.json(ok(result));
  } catch (e) {
    res.status(400).json(fail(e instanceof Error ? e.message : "Archive search failed"));
  }
});

router.get("/retention/status", requireAuth, async (_req, res) => {
  const { getRetentionStatus, listSqliteArchives } = await import("./retention/index.js");
  res.json(ok({ ...(await getRetentionStatus()), archives: listSqliteArchives() }));
});

router.delete("/backup/:file", requireAuth, async (req, res) => {
  const raw = req.params.file;
  const file = path.basename(Array.isArray(raw) ? raw[0] : String(raw || ""));
  if (!isBackupFile(file)) return res.status(400).json(fail("Invalid backup file"));
  const full = path.join(backupDirPath(), file);
  if (!fs.existsSync(full)) return res.status(404).json(fail("Backup not found", 404));
  fs.unlinkSync(full);
  res.json(ok(null, "Backup deleted"));
});

router.post("/backup/restore", requireAuth, async (req, res) => {
  const file = String(req.body?.file || "");
  const src = path.join(backupDirPath(), path.basename(file));
  if (!fs.existsSync(src)) return res.status(404).json(fail("Backup not found", 404));
  if (!src.endsWith(".json")) {
    return res.status(400).json(fail("Only JSON snapshot backups can be restored on this host"));
  }
  const snapshot = JSON.parse(fs.readFileSync(src, "utf8")) as {
    settings?: Array<{ key: string; value: string }>;
  };
  if (Array.isArray(snapshot.settings)) {
    for (const row of snapshot.settings) {
      await prisma.setting.upsert({
        where: { key: row.key },
        create: { key: row.key, value: row.value },
        update: { value: row.value },
      });
    }
  }
  res.json(ok(null, "Settings restored from snapshot"));
});

export default router;
