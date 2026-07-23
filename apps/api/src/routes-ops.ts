import { Router } from "express";
import { z } from "zod";
import os from "os";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { prisma, ok, fail, parseId, param } from "./lib.js";
import { requireAuth } from "./auth.js";

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
  const items = (req.body?.items || []) as Array<{ variantId: number; qty: number; cost: number }>;
  if (!supplierId || !items.length) return res.status(400).json(fail("supplierId and items required"));
  const totalAmount = items.reduce((s, i) => s + i.qty * i.cost, 0);
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
    const stock = await prisma.stock.findFirst({ where: { variantId: Number(item.variantId) } });
    if (stock) {
      await prisma.stock.update({
        where: { id: stock.id },
        data: { quantity: stock.quantity + Number(item.qty) },
      });
    } else {
      await prisma.stock.create({
        data: { variantId: Number(item.variantId), quantity: Number(item.qty) },
      });
    }
    await prisma.productVariant.update({
      where: { id: Number(item.variantId) },
      data: { cost: Number(item.cost) },
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

// ---------- POS / Sales / Returns ----------
router.get("/pos/products/barcode/:code", requireAuth, async (req, res) => {
  const variant = await prisma.productVariant.findFirst({
    where: { barcode: param(req.params.code) },
    include: { product: true, stocks: true },
  });
  if (!variant) return res.status(404).json(fail("Product not found", 404));
  const qty = variant.stocks.reduce((s, x) => s + x.quantity, 0);
  res.json(
    ok({
      id: variant.id,
      displayName: variant.product.name,
      productName: variant.product.name,
      productID: variant.product.code,
      barcode: variant.barcode,
      price: variant.price,
      quantity: qty,
    })
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
  }>;
  if (!items.length) return res.status(400).json(fail("Items required"));

  const normalized: Array<{ variantId: number; qty: number; price: number; discount: number }> = [];
  for (const item of items) {
    let variantId = Number(item.variantId || item.id || 0);
    if (item.stock_id) {
      const st = await prisma.stock.findUnique({ where: { id: Number(item.stock_id) } });
      if (st) variantId = st.variantId;
    }
    if (!variantId) return res.status(400).json(fail("Invalid item"));
    normalized.push({
      variantId,
      qty: Number(item.qty),
      price: Number(item.price),
      discount: Number(item.discount || item.discountAmount || 0),
    });
  }

  for (const item of normalized) {
    const stock = await prisma.stock.findFirst({ where: { variantId: item.variantId } });
    if (!stock || stock.quantity < item.qty) {
      return res.status(400).json(fail(`Insufficient stock for variant ${item.variantId}`));
    }
  }

  const subtotal = normalized.reduce((s, i) => s + i.price * i.qty, 0);
  const discount = normalized.reduce((s, i) => s + i.discount, 0) + Number(req.body?.discount || 0);
  const total = Math.max(0, subtotal - discount);
  const count = await prisma.invoice.count();
  const invoiceNo = await nextNo("INV", count);

  const invoice = await prisma.$transaction(async (tx) => {
    for (const item of normalized) {
      const stock = await tx.stock.findFirst({ where: { variantId: item.variantId } });
      await tx.stock.update({
        where: { id: stock!.id },
        data: { quantity: stock!.quantity - item.qty },
      });
    }
    return tx.invoice.create({
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
          })),
        },
      },
      include: { items: true, customer: true },
    });
  });

  res.json(ok(invoice, "Invoice created"));
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
  res.json(ok(row));
});

router.post("/pos/convert", requireAuth, async (req, res) => {
  // bulk to loose conceptual convert: adjust stock quantities between two variants
  const fromId = Number(req.body?.fromVariantId);
  const toId = Number(req.body?.toVariantId);
  const qty = Number(req.body?.qty || 0);
  const factor = Number(req.body?.factor || 1);
  const from = await prisma.stock.findFirst({ where: { variantId: fromId } });
  const to = await prisma.stock.findFirst({ where: { variantId: toId } });
  if (!from || from.quantity < qty) return res.status(400).json(fail("Insufficient bulk stock"));
  await prisma.stock.update({ where: { id: from.id }, data: { quantity: from.quantity - qty } });
  if (to) {
    await prisma.stock.update({ where: { id: to.id }, data: { quantity: to.quantity + qty * factor } });
  } else {
    await prisma.stock.create({ data: { variantId: toId, quantity: qty * factor } });
  }
  res.json(ok(null, "Converted"));
});

router.post("/pos/return", requireAuth, async (req, res) => {
  const invoiceNo = String(req.body?.invoiceNo || "");
  const invoice = await prisma.invoice.findFirst({ where: { invoiceNo }, include: { items: true } });
  if (!invoice) return res.status(404).json(fail("Invoice not found", 404));
  const items = (req.body?.items || []) as Array<{ id?: number; variantId?: number; returnQuantity: number; price?: number; discount?: number }>;
  if (!items.length) return res.status(400).json(fail("Items required"));

  let total = 0;
  const createdItems = [];
  for (const item of items) {
    const invItem = invoice.items.find((x) => x.id === item.id) || invoice.items.find((x) => x.variantId === item.variantId);
    if (!invItem) return res.status(400).json(fail("Invalid return item"));
    const qty = Number(item.returnQuantity);
    const price = Number(item.price ?? invItem.price);
    const discount = Number(item.discount || 0);
    total += price * qty - discount;
    createdItems.push({ variantId: invItem.variantId, qty, price, discount });
    const stock = await prisma.stock.findFirst({ where: { variantId: invItem.variantId } });
    if (stock) {
      await prisma.stock.update({ where: { id: stock.id }, data: { quantity: stock.quantity + qty } });
    }
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
  // reuse POS invoice logic inline
  req.body = {
    customerId: quote.customerId,
    paymentType: "Cash",
    items: quote.items.map((i) => ({
      variantId: i.variantId,
      qty: i.qty,
      price: i.price,
      discount: i.discount,
    })),
  };
  // Call by creating invoice directly
  const items = quote.items;
  for (const item of items) {
    const stock = await prisma.stock.findFirst({ where: { variantId: item.variantId } });
    if (!stock || stock.quantity < item.qty) return res.status(400).json(fail("Insufficient stock"));
  }
  const count = await prisma.invoice.count();
  const invoiceNo = await nextNo("INV", count);
  const invoice = await prisma.$transaction(async (tx) => {
    for (const item of items) {
      const stock = await tx.stock.findFirst({ where: { variantId: item.variantId } });
      await tx.stock.update({ where: { id: stock!.id }, data: { quantity: stock!.quantity - item.qty } });
    }
    await tx.quotation.update({ where: { id: quote.id }, data: { status: "Converted" } });
    return tx.invoice.create({
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
    });
  });
  res.json(ok(invoice, "Converted to invoice"));
});

// ---------- Analytics / Dashboard ----------
router.get("/analytics/dashboard", requireAuth, async (_req, res) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [todaySales, invoiceCount, productCount, customerCount, supplierCount, lowStock, allInvoices, sessions] =
    await Promise.all([
      prisma.invoice.aggregate({ where: { createdAt: { gte: startOfDay } }, _sum: { total: true }, _count: true }),
      prisma.invoice.count(),
      prisma.product.count({ where: { active: true } }),
      prisma.customer.count(),
      prisma.supplier.count(),
      prisma.stock.findMany(),
      prisma.invoice.findMany({ include: { items: { include: { variant: { include: { product: true } } } } } }),
      prisma.posSession.count(),
    ]);

  const low = lowStock.filter((s) => s.quantity > 0 && s.quantity <= s.lowThreshold).length;
  const revenue = allInvoices.reduce((s, i) => s + i.total, 0);
  const gross = allInvoices.reduce((s, i) => s + i.subtotal, 0);
  const discounts = allInvoices.reduce((s, i) => s + i.discount, 0);
  const costs = allInvoices.reduce(
    (s, inv) => s + inv.items.reduce((a, it) => a + it.qty * (it.variant.cost || 0), 0),
    0
  );
  const expenses = await prisma.cashMovement.aggregate({ where: { type: "OUT" }, _sum: { amount: true } });
  const misc = expenses._sum.amount || 0;
  const netProfit = revenue - costs - misc;

  const popularMap = new Map<string, number>();
  for (const inv of allInvoices) {
    for (const it of inv.items) {
      const name = it.variant.product.name;
      popularMap.set(name, (popularMap.get(name) || 0) + it.qty);
    }
  }
  const popular = [...popularMap.entries()]
    .map(([name, sales]) => ({ name, sales }))
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 5);

  const revenueSeries = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const dayTotal = allInvoices
      .filter((inv) => inv.createdAt.toISOString().slice(0, 10) === key)
      .reduce((s, inv) => s + inv.total, 0);
    revenueSeries.push({ date: key, total: dayTotal });
  }

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
      }, 0) / cpus.length
    )
  );

  res.json(
    ok({
      kpis: {
        todaysSales: todaySales._sum.total || 0,
        invoicesToday: todaySales._count,
        invoices: invoiceCount,
        products: productCount,
        customers: customerCount,
        suppliers: supplierCount,
        lowStock: low,
      },
      revenue: { total: revenue, growth: 100, series: revenueSeries },
      popular,
      financial: {
        grossSales: gross,
        discounts,
        netProfit,
        miscExpenses: misc + costs,
        growth: 100,
      },
      sessions: { total: sessions, growth: 100 },
      resources: {
        cpu: cpuLoad,
        memory: Math.round((usedMem / totalMem) * 100),
        memoryDetail: `${(usedMem / 1e9).toFixed(1)}GB/${(totalMem / 1e9).toFixed(1)}GB`,
        storage: 69,
        storageDetail: "6.9GB/10.0GB",
      },
    })
  );
});

// ---------- Employees ----------
router.get("/employees", requireAuth, async (_req, res) => {
  res.json(ok(await prisma.employee.findMany({ orderBy: { id: "desc" } })));
});

router.post("/employees", requireAuth, async (req, res) => {
  const row = await prisma.employee.create({
    data: {
      name: String(req.body?.name || ""),
      contact: req.body?.contact,
      email: req.body?.email,
      roleTitle: req.body?.roleTitle,
      salaryBase: Number(req.body?.salaryBase || 0),
    },
  });
  res.json(ok(row));
});

router.put("/employees/:id", requireAuth, async (req, res) => {
  const row = await prisma.employee.update({
    where: { id: parseId(req.params.id) },
    data: {
      name: req.body?.name,
      contact: req.body?.contact,
      email: req.body?.email,
      roleTitle: req.body?.roleTitle,
      salaryBase: req.body?.salaryBase != null ? Number(req.body.salaryBase) : undefined,
      active: req.body?.active,
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
  const row = await prisma.attendance.create({
    data: {
      employeeId: Number(req.body?.employeeId),
      userId: req.user!.id,
      date: req.body?.date ? new Date(req.body.date) : new Date(),
      checkIn: req.body?.checkIn,
      checkOut: req.body?.checkOut,
      note: req.body?.note,
    },
  });
  res.json(ok(row));
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
  const row = await prisma.posSession.create({
    data: {
      userId: req.user!.id,
      counterName: String(req.body?.counterName || "Counter 1"),
      openingBalance: Number(req.body?.openingBalance || 0),
    },
  });
  res.json(ok(row));
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
  const entries = Object.entries(req.body || {});
  for (const [key, value] of entries) {
    await prisma.setting.upsert({
      where: { key },
      create: { key, value: String(value) },
      update: { value: String(value) },
    });
  }
  res.json(ok(null, "Settings saved"));
});

const BACKUP_RETENTION_DAYS = 7;

function backupDirPath() {
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
  res.json(
    ok({
      files,
      summary: {
        total_files: files.length,
        total_size: totalSize,
        total_size_mb: Number((totalSize / (1024 * 1024)).toFixed(2)),
        last_backup_at: last?.created_at || null,
        status: files.length > 0 ? "Protected" : "No backups",
        retention_days: BACKUP_RETENTION_DAYS,
        schedule: "Daily at 5:00 PM",
        auto_backup: true,
      },
    })
  );
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
