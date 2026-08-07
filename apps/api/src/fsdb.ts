import admin from "firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { getShopId, rowBelongsToShop, tenancyEnabled, useShopFirebase } from "./shopContext.js";
import { getCachedShopFirestore } from "./master/shopFirebase.js";

type ModelName =
  | "Role"
  | "Status"
  | "User"
  | "Category"
  | "Brand"
  | "Unit"
  | "ProductType"
  | "Product"
  | "ProductVariant"
  | "Stock"
  | "DamagedStock"
  | "DamageReason"
  | "ReturnStatus"
  | "Company"
  | "Bank"
  | "Supplier"
  | "Customer"
  | "Grn"
  | "GrnItem"
  | "SupplierPayment"
  | "Invoice"
  | "InvoiceItem"
  | "Return"
  | "ReturnItem"
  | "Quotation"
  | "QuotationItem"
  | "Employee"
  | "Attendance"
  | "Salary"
  | "CashMovement"
  | "PosSession"
  | "Setting"
  | "StockRelease"
  | "StockReleaseItem"
  | "StockUnit"
  | "License";

type RelationDef =
  | { kind: "many-to-one"; model: ModelName; fk: string }
  | { kind: "one-to-many"; model: ModelName; fk: string };

const MODEL_DEFAULTS: Partial<Record<ModelName, Record<string, unknown>>> = {
  User: { createdAt: () => new Date() },
  Category: { createdAt: () => new Date() },
  Brand: { createdAt: () => new Date() },
  Unit: { createdAt: () => new Date() },
  ProductType: { createdAt: () => new Date() },
  Product: { active: true, createdAt: () => new Date() },
  ProductVariant: { price: 0, cost: 0 },
  Stock: { quantity: 0, lowThreshold: 5, location: "store" },
  StockRelease: { createdAt: () => new Date() },
  StockUnit: { status: "available", location: "store", createdAt: () => new Date() },
  Company: { createdAt: () => new Date() },
  Supplier: { createdAt: () => new Date() },
  Customer: { createdAt: () => new Date() },
  Grn: { totalAmount: 0, paidAmount: 0, createdAt: () => new Date() },
  SupplierPayment: { createdAt: () => new Date() },
  Invoice: {
    subtotal: 0,
    discount: 0,
    total: 0,
    paymentType: "Cash",
    paidAmount: 0,
    createdAt: () => new Date(),
  },
  InvoiceItem: { discount: 0 },
  Return: { total: 0, createdAt: () => new Date() },
  ReturnItem: { discount: 0 },
  Quotation: {
    subtotal: 0,
    discount: 0,
    total: 0,
    status: "Active",
    createdAt: () => new Date(),
  },
  QuotationItem: { discount: 0 },
  Employee: { salaryBase: 0, active: true, createdAt: () => new Date() },
  Attendance: { method: "manual" },
  Salary: { createdAt: () => new Date() },
  CashMovement: { createdAt: () => new Date() },
  PosSession: { counterName: "Counter 1", openingBalance: 0, openedAt: () => new Date() },
  License: { status: "VALID", createdAt: () => new Date() },
};

const UNIQUE_FIELDS: Partial<Record<ModelName, string[]>> = {
  Role: ["name"],
  Status: ["name"],
  User: ["contact", "username"],
  // Category / Brand / Unit / ProductType uniqueness is enforced in routes (case-insensitive, per-shop)
  Product: ["code"],
  ProductVariant: ["barcode"],
  StockUnit: ["unitCode"],
  DamageReason: ["name"],
  ReturnStatus: ["name"],
  Company: ["name"],
  Invoice: ["invoiceNo"],
  StockRelease: ["releaseNo"],
  Quotation: ["quoteNo"],
  Setting: ["key"],
  License: ["licenseKey"],
};

const RELATIONS: Partial<Record<ModelName, Record<string, RelationDef>>> = {
  User: {
    role: { kind: "many-to-one", model: "Role", fk: "roleId" },
    status: { kind: "many-to-one", model: "Status", fk: "statusId" },
    invoices: { kind: "one-to-many", model: "Invoice", fk: "userId" },
    quotations: { kind: "one-to-many", model: "Quotation", fk: "userId" },
    returns: { kind: "one-to-many", model: "Return", fk: "userId" },
    attendances: { kind: "one-to-many", model: "Attendance", fk: "userId" },
    salaries: { kind: "one-to-many", model: "Salary", fk: "userId" },
    cashMoves: { kind: "one-to-many", model: "CashMovement", fk: "userId" },
    sessions: { kind: "one-to-many", model: "PosSession", fk: "userId" },
    stockReleases: { kind: "one-to-many", model: "StockRelease", fk: "userId" },
  },
  Customer: {
    status: { kind: "many-to-one", model: "Status", fk: "statusId" },
    invoices: { kind: "one-to-many", model: "Invoice", fk: "customerId" },
    quotations: { kind: "one-to-many", model: "Quotation", fk: "customerId" },
  },
  Supplier: {
    company: { kind: "many-to-one", model: "Company", fk: "companyId" },
    bank: { kind: "many-to-one", model: "Bank", fk: "bankId" },
    status: { kind: "many-to-one", model: "Status", fk: "statusId" },
    grns: { kind: "one-to-many", model: "Grn", fk: "supplierId" },
    payments: { kind: "one-to-many", model: "SupplierPayment", fk: "supplierId" },
  },
  Product: {
    category: { kind: "many-to-one", model: "Category", fk: "categoryId" },
    brand: { kind: "many-to-one", model: "Brand", fk: "brandId" },
    unit: { kind: "many-to-one", model: "Unit", fk: "unitId" },
    productType: { kind: "many-to-one", model: "ProductType", fk: "productTypeId" },
    status: { kind: "many-to-one", model: "Status", fk: "statusId" },
    variants: { kind: "one-to-many", model: "ProductVariant", fk: "productId" },
  },
  ProductVariant: {
    product: { kind: "many-to-one", model: "Product", fk: "productId" },
    stocks: { kind: "one-to-many", model: "Stock", fk: "variantId" },
    stockUnits: { kind: "one-to-many", model: "StockUnit", fk: "variantId" },
    stockReleaseItems: { kind: "one-to-many", model: "StockReleaseItem", fk: "variantId" },
  },
  Stock: {
    variant: { kind: "many-to-one", model: "ProductVariant", fk: "variantId" },
    damaged: { kind: "one-to-many", model: "DamagedStock", fk: "stockId" },
  },
  StockUnit: {
    variant: { kind: "many-to-one", model: "ProductVariant", fk: "variantId" },
    releaseItem: { kind: "many-to-one", model: "StockReleaseItem", fk: "releaseItemId" },
    invoiceItem: { kind: "many-to-one", model: "InvoiceItem", fk: "invoiceItemId" },
  },
  DamagedStock: {
    stock: { kind: "many-to-one", model: "Stock", fk: "stockId" },
    reason: { kind: "many-to-one", model: "DamageReason", fk: "reasonId" },
    returnStatus: { kind: "many-to-one", model: "ReturnStatus", fk: "statusId" },
  },
  Grn: {
    supplier: { kind: "many-to-one", model: "Supplier", fk: "supplierId" },
    items: { kind: "one-to-many", model: "GrnItem", fk: "grnId" },
    payments: { kind: "one-to-many", model: "SupplierPayment", fk: "grnId" },
  },
  GrnItem: {
    grn: { kind: "many-to-one", model: "Grn", fk: "grnId" },
    variant: { kind: "many-to-one", model: "ProductVariant", fk: "variantId" },
  },
  SupplierPayment: {
    supplier: { kind: "many-to-one", model: "Supplier", fk: "supplierId" },
    grn: { kind: "many-to-one", model: "Grn", fk: "grnId" },
  },
  Invoice: {
    customer: { kind: "many-to-one", model: "Customer", fk: "customerId" },
    user: { kind: "many-to-one", model: "User", fk: "userId" },
    items: { kind: "one-to-many", model: "InvoiceItem", fk: "invoiceId" },
    returns: { kind: "one-to-many", model: "Return", fk: "invoiceId" },
  },
  InvoiceItem: {
    invoice: { kind: "many-to-one", model: "Invoice", fk: "invoiceId" },
    variant: { kind: "many-to-one", model: "ProductVariant", fk: "variantId" },
    units: { kind: "one-to-many", model: "StockUnit", fk: "invoiceItemId" },
  },
  Return: {
    invoice: { kind: "many-to-one", model: "Invoice", fk: "invoiceId" },
    user: { kind: "many-to-one", model: "User", fk: "userId" },
    items: { kind: "one-to-many", model: "ReturnItem", fk: "returnId" },
  },
  Quotation: {
    customer: { kind: "many-to-one", model: "Customer", fk: "customerId" },
    user: { kind: "many-to-one", model: "User", fk: "userId" },
    items: { kind: "one-to-many", model: "QuotationItem", fk: "quotationId" },
  },
  QuotationItem: {
    quotation: { kind: "many-to-one", model: "Quotation", fk: "quotationId" },
    variant: { kind: "many-to-one", model: "ProductVariant", fk: "variantId" },
  },
  Employee: {
    attendances: { kind: "one-to-many", model: "Attendance", fk: "employeeId" },
    salaries: { kind: "one-to-many", model: "Salary", fk: "employeeId" },
  },
  Attendance: {
    employee: { kind: "many-to-one", model: "Employee", fk: "employeeId" },
    user: { kind: "many-to-one", model: "User", fk: "userId" },
  },
  Salary: {
    employee: { kind: "many-to-one", model: "Employee", fk: "employeeId" },
    user: { kind: "many-to-one", model: "User", fk: "userId" },
  },
  CashMovement: {
    user: { kind: "many-to-one", model: "User", fk: "userId" },
  },
  PosSession: {
    user: { kind: "many-to-one", model: "User", fk: "userId" },
  },
  StockRelease: {
    user: { kind: "many-to-one", model: "User", fk: "userId" },
    items: { kind: "one-to-many", model: "StockReleaseItem", fk: "releaseId" },
  },
  StockReleaseItem: {
    release: { kind: "many-to-one", model: "StockRelease", fk: "releaseId" },
    variant: { kind: "many-to-one", model: "ProductVariant", fk: "variantId" },
    units: { kind: "one-to-many", model: "StockUnit", fk: "releaseItemId" },
  },
};

const CASCADE_DELETE: Partial<Record<ModelName, ModelName[]>> = {
  Product: ["ProductVariant"],
  ProductVariant: ["Stock", "StockUnit"],
  Invoice: ["InvoiceItem"],
  Quotation: ["QuotationItem"],
  Grn: ["GrnItem"],
  Return: ["ReturnItem"],
  StockRelease: ["StockReleaseItem"],
  Stock: ["DamagedStock"],
};

function initControlFirebase(): FirebaseFirestore.Firestore {
  if (!admin.apps.length) {
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || "quantumexe-pos";
    const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
    const onGoogleCloud = !!(process.env.FUNCTION_TARGET || process.env.K_SERVICE || process.env.FIREBASE_CONFIG);

    if (saJson) {
      const cred = JSON.parse(saJson) as admin.ServiceAccount;
      admin.initializeApp({
        credential: admin.credential.cert(cred),
        projectId: (cred as admin.ServiceAccount & { project_id?: string }).project_id || cred.projectId || projectId,
      });
    } else if (clientEmail && privateKey) {
      // Vercel-friendly: set FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY (+ PROJECT_ID)
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        projectId,
      });
    } else if (onGoogleCloud) {
      admin.initializeApp({ projectId });
    } else {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId,
      });
    }
  }
  return admin.firestore();
}

/** Control / registry Firebase (default app). Shop POS may use a dedicated project. */
const controlFirestore = initControlFirebase();

function activeDbTag(): string {
  const shopId = getShopId();
  if (shopId && useShopFirebase() && getCachedShopFirestore(shopId)) return `shop:${shopId}`;
  return "control";
}

function firestore(): FirebaseFirestore.Firestore {
  const shopId = getShopId();
  if (shopId && useShopFirebase()) {
    const shopDb = getCachedShopFirestore(shopId);
    if (shopDb) return shopDb;
  }
  return controlFirestore;
}

function isTimestamp(v: unknown): v is Timestamp {
  return v instanceof Timestamp || (typeof v === "object" && v !== null && "_seconds" in v);
}

function toJsValue(v: unknown): unknown {
  if (isTimestamp(v)) return v.toDate();
  if (Array.isArray(v)) return v.map(toJsValue);
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = toJsValue(val);
    return out;
  }
  return v;
}

function toFirestoreValue(v: unknown): unknown {
  if (v instanceof Date) return Timestamp.fromDate(v);
  if (Array.isArray(v)) return v.map(toFirestoreValue);
  if (v && typeof v === "object" && !(v instanceof Timestamp)) {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = toFirestoreValue(val);
    return out;
  }
  return v;
}

function docToRecord(data: FirebaseFirestore.DocumentData): Record<string, unknown> {
  return toJsValue(data) as Record<string, unknown>;
}

function isFieldFilter(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value as Record<string, unknown>);
  return keys.some((k) =>
    ["equals", "contains", "gte", "lte", "gt", "lt", "in", "not"].includes(k)
  );
}

function matchField(fieldValue: unknown, filter: unknown): boolean {
  if (filter === undefined) return true;
  if (filter === null) return fieldValue == null;
  if (!isFieldFilter(filter)) return fieldValue === filter;

  const f = filter as Record<string, unknown>;
  const ops = ["equals", "contains", "gte", "lte", "gt", "lt", "in", "not"] as const;
  const present = ops.filter((k) => k in f);
  if (!present.length) return fieldValue === filter;

  return present.every((op) => {
    if (op === "equals") return fieldValue === f.equals;
    if (op === "contains") {
      return String(fieldValue ?? "")
        .toLowerCase()
        .includes(String(f.contains).toLowerCase());
    }
    if (op === "in") {
      const arr = (f.in as unknown[]) || [];
      // Firestore ids / FKs may be number or string — loose match
      return arr.some((x) => x === fieldValue || String(x) === String(fieldValue) || Number(x) === Number(fieldValue));
    }
    if (op === "not") return !matchField(fieldValue, f.not);
    // Prisma: null never matches range comparisons
    if (fieldValue == null) return false;
    if (op === "gte") return compareValues(fieldValue, f.gte) >= 0;
    if (op === "lte") return compareValues(fieldValue, f.lte) <= 0;
    if (op === "gt") return compareValues(fieldValue, f.gt) > 0;
    if (op === "lt") return compareValues(fieldValue, f.lt) < 0;
    return true;
  });
}

function toComparable(v: unknown): unknown {
  if (v == null) return null;
  if (v instanceof Date) return v.getTime();
  if (isTimestamp(v)) return (v as Timestamp).toDate().getTime();
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const t = Date.parse(v);
    if (!Number.isNaN(t)) return t;
  }
  if (typeof v === "object" && v !== null && "toDate" in v && typeof (v as { toDate: unknown }).toDate === "function") {
    try {
      return (v as { toDate: () => Date }).toDate().getTime();
    } catch {
      /* ignore */
    }
  }
  return v;
}

function compareValues(a: unknown, b: unknown): number {
  const av = toComparable(a);
  const bv = toComparable(b);
  if (av == null || bv == null) return av == bv ? 0 : av == null ? -1 : 1;
  if (typeof av === "number" && typeof bv === "number") {
    if (av < bv) return -1;
    if (av > bv) return 1;
    return 0;
  }
  if (av < (bv as any)) return -1;
  if (av > (bv as any)) return 1;
  return 0;
}

class QueryContext {
  private cache = new Map<string, Record<string, unknown>>();

  constructor(private client: FirestoreClient) {}

  cacheKey(model: ModelName, id: number | string) {
    return `${activeDbTag()}:${model}:${id}`;
  }

  async getById(model: ModelName, id: number): Promise<Record<string, unknown> | null> {
    const key = this.cacheKey(model, id);
    let row: Record<string, unknown> | null;
    if (this.cache.has(key)) {
      row = this.cache.get(key)!;
    } else {
      const snap = await firestore().collection(model).doc(String(id)).get();
      if (!snap.exists) return null;
      row = { id: Number(snap.id), ...docToRecord(snap.data()!) };
      this.cache.set(key, row);
    }
    if (!rowBelongsToShop(model, row, getShopId())) return null;
    return row;
  }

  async loadAll(model: ModelName): Promise<Record<string, unknown>[]> {
    const cacheAllKey = `${activeDbTag()}:__all__:${model}`;
    let rows: Record<string, unknown>[];
    if (this.cache.has(cacheAllKey)) {
      rows = this.cache.get(cacheAllKey)! as unknown as Record<string, unknown>[];
    } else {
      const snap = await firestore().collection(model).get();
      rows = snap.docs.map((d) => {
        const row = { id: Number(d.id), ...docToRecord(d.data()) };
        this.cache.set(this.cacheKey(model, row.id as number), row);
        return row;
      });
      this.cache.set(cacheAllKey, rows as unknown as Record<string, unknown>);
    }
    const shopId = getShopId();
    return rows.filter((r) => rowBelongsToShop(model, r, shopId));
  }

  invalidate(model: ModelName) {
    const tag = activeDbTag();
    for (const key of [...this.cache.keys()]) {
      if (key.startsWith(`${tag}:${model}:`) || key === `${tag}:__all__:${model}`) this.cache.delete(key);
    }
  }

  invalidateAll() {
    this.cache.clear();
  }

  async loadRelation(
    model: ModelName,
    relName: string,
    record: Record<string, unknown>
  ): Promise<Record<string, unknown> | Record<string, unknown>[] | null> {
    const rel = RELATIONS[model]?.[relName];
    if (!rel) return null;
    if (rel.kind === "many-to-one") {
      const fk = record[rel.fk];
      if (fk == null) return null;
      return this.getById(rel.model, Number(fk));
    }
    const all = await this.loadAll(rel.model);
    return all.filter((r) => Number(r[rel.fk]) === Number(record.id));
  }

  async matchesWhere(model: ModelName, record: Record<string, unknown>, where?: Record<string, unknown>): Promise<boolean> {
    if (!where) return true;

    for (const [key, value] of Object.entries(where)) {
      if (key === "AND") {
        for (const w of value as Record<string, unknown>[]) {
          if (!(await this.matchesWhere(model, record, w))) return false;
        }
        continue;
      }
      if (key === "OR") {
        let matched = false;
        for (const w of value as Record<string, unknown>[]) {
          if (await this.matchesWhere(model, record, w)) {
            matched = true;
            break;
          }
        }
        if (!matched) return false;
        continue;
      }
      if (key === "NOT") {
        if (await this.matchesWhere(model, record, value as Record<string, unknown>)) return false;
        continue;
      }

      const rel = RELATIONS[model]?.[key];
      if (rel && value && typeof value === "object" && !isFieldFilter(value)) {
        const related = await this.loadRelation(model, key, record);
        if (rel.kind === "many-to-one") {
          if (!related || !(await this.matchesWhere(rel.model, related as Record<string, unknown>, value as Record<string, unknown>))) {
            return false;
          }
        } else {
          const arr = (related as Record<string, unknown>[]) || [];
          let any = false;
          for (const child of arr) {
            if (await this.matchesWhere(rel.model, child, value as Record<string, unknown>)) {
              any = true;
              break;
            }
          }
          if (!any) return false;
        }
        continue;
      }

      if (!matchField(record[key], value)) return false;
    }
    return true;
  }
}

function sortRows(rows: Record<string, unknown>[], orderBy?: Record<string, "asc" | "desc">): Record<string, unknown>[] {
  if (!orderBy) return rows;
  const [field, dir] = Object.entries(orderBy)[0];
  const mult = dir === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => compareValues(a[field], b[field]) * mult);
}

async function applyInclude(
  ctx: QueryContext,
  model: ModelName,
  record: Record<string, unknown>,
  include?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  if (!include) return record;
  const out = { ...record };
  for (const [relName, relArgs] of Object.entries(include)) {
    const rel = RELATIONS[model]?.[relName];
    if (!rel) continue;
    const related = await ctx.loadRelation(model, relName, record);
    if (rel.kind === "many-to-one") {
      let relRecord = related as Record<string, unknown> | null;
      if (relRecord && relArgs && typeof relArgs === "object") {
        if ("include" in (relArgs as Record<string, unknown>)) {
          relRecord = await applyInclude(ctx, rel.model, relRecord, (relArgs as Record<string, unknown>).include as Record<string, unknown>);
        } else if ("select" in (relArgs as Record<string, unknown>)) {
          relRecord = await applySelect(
            ctx,
            rel.model,
            relRecord,
            (relArgs as Record<string, unknown>).select as Record<string, unknown>
          );
        }
      }
      out[relName] = relRecord;
    } else {
      let arr = (related as Record<string, unknown>[]) || [];
      if (relArgs && typeof relArgs === "object") {
        if ("include" in (relArgs as Record<string, unknown>)) {
          arr = await Promise.all(
            arr.map((r) => applyInclude(ctx, rel.model, r, (relArgs as Record<string, unknown>).include as Record<string, unknown>))
          );
        } else if ("select" in (relArgs as Record<string, unknown>)) {
          arr = (
            await Promise.all(
              arr.map((r) =>
                applySelect(ctx, rel.model, r, (relArgs as Record<string, unknown>).select as Record<string, unknown>)
              )
            )
          ).filter(Boolean) as Record<string, unknown>[];
        }
      }
      out[relName] = arr;
    }
  }
  return out;
}

async function applySelect(
  ctx: QueryContext,
  model: ModelName,
  record: Record<string, unknown> | null,
  select?: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  if (!record || !select) return record;
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(select)) {
    if (val === true) {
      out[key] = record[key];
      continue;
    }
    if (!val || typeof val !== "object") continue;

    const rel = RELATIONS[model]?.[key];
    if (rel) {
      const related = await ctx.loadRelation(model, key, record);
      if (rel.kind === "many-to-one") {
        out[key] = related
          ? await applySelect(ctx, rel.model, related as Record<string, unknown>, val as Record<string, unknown>)
          : null;
      } else {
        const arr = ((related as Record<string, unknown>[]) || []).map((r) =>
          applySelect(ctx, rel.model, r, val as Record<string, unknown>)
        );
        out[key] = await Promise.all(arr);
      }
      continue;
    }

    const nested = record[key];
    if (Array.isArray(nested)) {
      out[key] = await Promise.all(
        nested.map((n) => applySelect(ctx, model, n as Record<string, unknown>, val as Record<string, unknown>))
      );
    } else if (nested && typeof nested === "object") {
      out[key] = await applySelect(ctx, model, nested as Record<string, unknown>, val as Record<string, unknown>);
    }
  }
  return out;
}

class ModelDelegate {
  constructor(
    private model: ModelName,
    private client: FirestoreClient
  ) {}

  private ctx() {
    return this.client.getContext();
  }

  private async allRows() {
    return this.ctx().loadAll(this.model);
  }

  async filterRows(where?: Record<string, unknown>) {
    const rows = await this.allRows();
    const out: Record<string, unknown>[] = [];
    for (const row of rows) {
      if (await this.ctx().matchesWhere(this.model, row, where)) out.push(row);
    }
    return out;
  }

  async findMany(args: {
    where?: Record<string, unknown>;
    include?: Record<string, unknown>;
    select?: Record<string, unknown>;
    orderBy?: Record<string, "asc" | "desc">;
    skip?: number;
    take?: number;
  } = {}) {
    let rows = await this.filterRows(args.where);
    rows = sortRows(rows, args.orderBy);
    if (args.skip) rows = rows.slice(args.skip);
    if (args.take != null) rows = rows.slice(0, args.take);

    if (args.select) {
      rows = (await Promise.all(rows.map((r) => applySelect(this.ctx(), this.model, r, args.select)))).filter(
        Boolean
      ) as Record<string, unknown>[];
    } else if (args.include) {
      rows = await Promise.all(rows.map((r) => applyInclude(this.ctx(), this.model, r, args.include)));
    }
    return rows;
  }

  async findFirst(args: {
    where?: Record<string, unknown>;
    include?: Record<string, unknown>;
    select?: Record<string, unknown>;
    orderBy?: Record<string, "asc" | "desc">;
  } = {}) {
    const rows = await this.findMany({ ...args, take: 1 });
    return rows[0] ?? null;
  }

  async findUnique(args: {
    where: Record<string, unknown>;
    include?: Record<string, unknown>;
    select?: Record<string, unknown>;
  }) {
    const where = args.where;
    if ("id" in where) {
      const row = await this.ctx().getById(this.model, Number(where.id));
      if (!row) return null;
      if (args.select) return applySelect(this.ctx(), this.model, row, args.select);
      if (args.include) return applyInclude(this.ctx(), this.model, row, args.include);
      return row;
    }

    for (const field of UNIQUE_FIELDS[this.model] || []) {
      if (field in where) {
        const rows = await this.filterRows({ [field]: where[field] });
        const row = rows[0] ?? null;
        if (!row) return null;
        if (args.select) return applySelect(this.ctx(), this.model, row, args.select);
        if (args.include) return applyInclude(this.ctx(), this.model, row, args.include);
        return row;
      }
    }

    const rows = await this.filterRows(where);
    const row = rows[0] ?? null;
    if (!row) return null;
    if (args.select) return applySelect(this.ctx(), this.model, row, args.select);
    if (args.include) return applyInclude(this.ctx(), this.model, row, args.include);
    return row;
  }

  async count(args: { where?: Record<string, unknown> } = {}) {
    const rows = await this.filterRows(args.where);
    return rows.length;
  }

  async aggregate(args: {
    where?: Record<string, unknown>;
    _sum?: Record<string, boolean>;
    _count?: boolean | Record<string, boolean>;
  } = {}) {
    const rows = await this.filterRows(args.where);
    const result: { _sum: Record<string, number | null>; _count: number } = { _sum: {}, _count: rows.length };
    if (args._sum) {
      for (const field of Object.keys(args._sum)) {
        result._sum[field] = rows.reduce((s, r) => s + Number(r[field] || 0), 0);
      }
    }
    return result;
  }

  async create(args: { data: Record<string, unknown>; include?: Record<string, unknown> }) {
    for (const field of UNIQUE_FIELDS[this.model] || []) {
      if (args.data[field] !== undefined && args.data[field] !== null) {
        const existing = await this.findFirst({ where: { [field]: args.data[field] } });
        if (existing) {
          throw new Error(`Unique constraint failed on ${this.model}.${field}`);
        }
      }
    }
    const id = await this.client.nextId(this.model);
    const data = await this.prepareCreateData(args.data, id);
    await firestore().collection(this.model).doc(String(id)).set(toFirestoreValue(data) as FirebaseFirestore.DocumentData);
    this.ctx().invalidate(this.model);
    let row: Record<string, unknown> = { id, ...data };
    if (args.include) row = await applyInclude(this.ctx(), this.model, row, args.include);
    return row;
  }

  private async prepareCreateData(data: Record<string, unknown>, parentId: number) {
    const out: Record<string, unknown> = {};
    const nestedCreates: Array<{ relName: string; items: Record<string, unknown>[] }> = [];

    for (const [key, val] of Object.entries(data)) {
      if (val && typeof val === "object" && "create" in (val as Record<string, unknown>)) {
        const createVal = (val as Record<string, unknown>).create;
        nestedCreates.push({
          relName: key,
          items: Array.isArray(createVal) ? (createVal as Record<string, unknown>[]) : [createVal as Record<string, unknown>],
        });
        continue;
      }
      if (val !== undefined) out[key] = val;
    }

    for (const [field, def] of Object.entries(MODEL_DEFAULTS[this.model] || {})) {
      if (out[field] === undefined) out[field] = typeof def === "function" ? def() : def;
    }

    // Multi-tenant stamp (Firestore cloud shared DB)
    if (tenancyEnabled() && out.shopId == null) {
      const shopId = getShopId();
      if (shopId) out.shopId = shopId;
    }

    for (const nested of nestedCreates) {
      const rel = RELATIONS[this.model]?.[nested.relName];
      if (!rel || rel.kind !== "one-to-many") continue;
      const delegate = this.client.delegate(rel.model);
      for (const item of nested.items) {
        await delegate.create({ data: { ...item, [rel.fk]: parentId } });
      }
    }

    return out;
  }

  async update(args: { where: { id: number }; data: Record<string, unknown>; include?: Record<string, unknown> }) {
    const id = Number(args.where.id);
    const existing = await this.ctx().getById(this.model, id);
    if (!existing) throw new Error(`${this.model} not found: ${id}`);

    const patch: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(args.data)) {
      if (val === undefined) continue;
      if (val && typeof val === "object" && "create" in (val as Record<string, unknown>)) {
        const rel = RELATIONS[this.model]?.[key];
        if (rel?.kind === "one-to-many") {
          const createVal = (val as Record<string, unknown>).create;
          const items = Array.isArray(createVal) ? createVal : [createVal];
          const delegate = this.client.delegate(rel.model);
          for (const item of items as Record<string, unknown>[]) {
            await delegate.create({ data: { ...item, [rel.fk]: id } });
          }
        }
        continue;
      }
      patch[key] = val;
    }

    const merged = { ...existing, ...patch };
    await firestore().collection(this.model).doc(String(id)).set(toFirestoreValue(merged) as FirebaseFirestore.DocumentData, { merge: false });
    this.ctx().invalidate(this.model);
    let row = merged;
    if (args.include) row = await applyInclude(this.ctx(), this.model, row, args.include);
    return row;
  }

  async delete(args: { where: { id: number } }) {
    const id = Number(args.where.id);
    await this.cascadeDelete(id);
    await firestore().collection(this.model).doc(String(id)).delete();
    this.ctx().invalidate(this.model);
  }

  async cascadeDelete(id: number) {
    const childModels = CASCADE_DELETE[this.model] || [];
    for (const childModel of childModels) {
      const relEntry = Object.entries(RELATIONS[this.model] || {}).find(([, rel]) => rel.model === childModel);
      if (!relEntry) continue;
      const [, rel] = relEntry;
      if (rel.kind !== "one-to-many") continue;
      const children = await this.client.delegate(childModel).filterRows({ [rel.fk]: id });
      for (const child of children) {
        await this.client.delegate(childModel).cascadeDelete(Number(child.id));
        await firestore().collection(childModel).doc(String(child.id)).delete();
        this.ctx().invalidate(childModel);
      }
    }
  }

  async deleteMany(args: { where?: Record<string, unknown> } = {}) {
    const rows = await this.filterRows(args.where);
    for (const row of rows) {
      await this.cascadeDelete(Number(row.id));
      await firestore().collection(this.model).doc(String(row.id)).delete();
    }
    this.ctx().invalidate(this.model);
    return { count: rows.length };
  }

  async createMany(args: { data: Record<string, unknown>[] }) {
    const created = [];
    for (const item of args.data) {
      created.push(await this.create({ data: item }));
    }
    return { count: created.length };
  }

  async upsert(args: { where: Record<string, unknown>; create: Record<string, unknown>; update: Record<string, unknown> }) {
    let existing = await this.findUnique({ where: args.where });
    if (existing) {
      return this.update({ where: { id: Number(existing.id) }, data: args.update });
    }
    return this.create({ data: { ...args.create, ...args.where } });
  }
}

class FirestoreClient {
  private context = new QueryContext(this);

  role = new ModelDelegate("Role", this);
  status = new ModelDelegate("Status", this);
  user = new ModelDelegate("User", this);
  category = new ModelDelegate("Category", this);
  brand = new ModelDelegate("Brand", this);
  unit = new ModelDelegate("Unit", this);
  productType = new ModelDelegate("ProductType", this);
  product = new ModelDelegate("Product", this);
  productVariant = new ModelDelegate("ProductVariant", this);
  stock = new ModelDelegate("Stock", this);
  damagedStock = new ModelDelegate("DamagedStock", this);
  damageReason = new ModelDelegate("DamageReason", this);
  returnStatus = new ModelDelegate("ReturnStatus", this);
  company = new ModelDelegate("Company", this);
  bank = new ModelDelegate("Bank", this);
  supplier = new ModelDelegate("Supplier", this);
  customer = new ModelDelegate("Customer", this);
  grn = new ModelDelegate("Grn", this);
  grnItem = new ModelDelegate("GrnItem", this);
  supplierPayment = new ModelDelegate("SupplierPayment", this);
  invoice = new ModelDelegate("Invoice", this);
  invoiceItem = new ModelDelegate("InvoiceItem", this);
  return = new ModelDelegate("Return", this);
  returnItem = new ModelDelegate("ReturnItem", this);
  quotation = new ModelDelegate("Quotation", this);
  quotationItem = new ModelDelegate("QuotationItem", this);
  employee = new ModelDelegate("Employee", this);
  attendance = new ModelDelegate("Attendance", this);
  salary = new ModelDelegate("Salary", this);
  cashMovement = new ModelDelegate("CashMovement", this);
  posSession = new ModelDelegate("PosSession", this);
  setting = new ModelDelegate("Setting", this);
  license = new ModelDelegate("License", this);
  stockRelease = new ModelDelegate("StockRelease", this);
  stockReleaseItem = new ModelDelegate("StockReleaseItem", this);
  stockUnit = new ModelDelegate("StockUnit", this);

  getContext() {
    return this.context;
  }

  delegate(model: ModelName) {
    const map: Record<ModelName, ModelDelegate> = {
      Role: this.role,
      Status: this.status,
      User: this.user,
      Category: this.category,
      Brand: this.brand,
      Unit: this.unit,
      ProductType: this.productType,
      Product: this.product,
      ProductVariant: this.productVariant,
      Stock: this.stock,
      DamagedStock: this.damagedStock,
      DamageReason: this.damageReason,
      ReturnStatus: this.returnStatus,
      Company: this.company,
      Bank: this.bank,
      Supplier: this.supplier,
      Customer: this.customer,
      Grn: this.grn,
      GrnItem: this.grnItem,
      SupplierPayment: this.supplierPayment,
      Invoice: this.invoice,
      InvoiceItem: this.invoiceItem,
      Return: this.return,
      ReturnItem: this.returnItem,
      Quotation: this.quotation,
      QuotationItem: this.quotationItem,
      Employee: this.employee,
      Attendance: this.attendance,
      Salary: this.salary,
      CashMovement: this.cashMovement,
      PosSession: this.posSession,
      Setting: this.setting,
      License: this.license,
      StockRelease: this.stockRelease,
      StockReleaseItem: this.stockReleaseItem,
      StockUnit: this.stockUnit,
    };
    return map[model];
  }

  async nextId(model: ModelName): Promise<number> {
    const db = firestore();
    const counterRef = db.collection("counters").doc(model);
    const id = await db.runTransaction(async (tx) => {
      const snap = await tx.get(counterRef);
      const current = snap.exists ? Number(snap.data()?.value || 0) : 0;
      const next = current + 1;
      tx.set(counterRef, { value: next }, { merge: true });
      return next;
    });
    return id;
  }

  async $transaction<T>(fn: (tx: FirestoreClient) => Promise<T>): Promise<T> {
    return fn(this);
  }

  async $disconnect() {
    // no-op for Firestore
  }
}

const ALL_MODELS: ModelName[] = [
  "ReturnItem",
  "Return",
  "InvoiceItem",
  "Invoice",
  "QuotationItem",
  "Quotation",
  "GrnItem",
  "Grn",
  "SupplierPayment",
  "DamagedStock",
  "Stock",
  "ProductVariant",
  "Product",
  "Attendance",
  "Salary",
  "Employee",
  "CashMovement",
  "PosSession",
  "StockReleaseItem",
  "StockRelease",
  "StockUnit",
  "Customer",
  "Supplier",
  "Bank",
  "Company",
  "User",
  "Category",
  "Brand",
  "Unit",
  "ProductType",
  "DamageReason",
  "ReturnStatus",
  "Role",
  "Status",
  "Setting",
  "License",
];

export const prisma: any = new FirestoreClient();
export const db: any = prisma;

export function invalidateFsCache() {
  try {
    prisma.getContext().invalidateAll();
  } catch {
    /* ignore */
  }
}

export async function resetFirestore() {
  for (const model of ALL_MODELS) {
    await prisma.delegate(model).deleteMany({});
  }
  const counters = await firestore().collection("counters").get();
  if (!counters.empty) {
    const batch = firestore().batch();
    for (const doc of counters.docs) batch.delete(doc.ref);
    await batch.commit();
  }
  prisma.getContext().invalidateAll();
}
