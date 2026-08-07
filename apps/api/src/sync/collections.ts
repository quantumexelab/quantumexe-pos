/** Collections mirrored to Firestore (same names as fsdb). Local-only tables excluded. */
export const SYNC_COLLECTIONS = [
  "Role",
  "Status",
  "Category",
  "Brand",
  "Unit",
  "ProductType",
  "DamageReason",
  "ReturnStatus",
  "Company",
  "Bank",
  "User",
  "Product",
  "ProductVariant",
  "Stock",
  "Supplier",
  "Customer",
  "Employee",
  "Setting",
  "License",
  "Grn",
  "GrnItem",
  "SupplierPayment",
  "Invoice",
  "InvoiceItem",
  "Return",
  "ReturnItem",
  "Quotation",
  "QuotationItem",
  "Attendance",
  "Salary",
  "CashMovement",
  "PosSession",
  "StockRelease",
  "StockReleaseItem",
  "StockUnit",
  "DamagedStock",
] as const;

export type SyncCollection = (typeof SYNC_COLLECTIONS)[number];

/** Prisma delegate name for each collection. */
export const PRISMA_DELEGATE: Record<SyncCollection, string> = {
  Role: "role",
  Status: "status",
  Category: "category",
  Brand: "brand",
  Unit: "unit",
  ProductType: "productType",
  DamageReason: "damageReason",
  ReturnStatus: "returnStatus",
  Company: "company",
  Bank: "bank",
  User: "user",
  Product: "product",
  ProductVariant: "productVariant",
  Stock: "stock",
  Supplier: "supplier",
  Customer: "customer",
  Employee: "employee",
  Setting: "setting",
  License: "license",
  Grn: "grn",
  GrnItem: "grnItem",
  SupplierPayment: "supplierPayment",
  Invoice: "invoice",
  InvoiceItem: "invoiceItem",
  Return: "return",
  ReturnItem: "returnItem",
  Quotation: "quotation",
  QuotationItem: "quotationItem",
  Attendance: "attendance",
  Salary: "salary",
  CashMovement: "cashMovement",
  PosSession: "posSession",
  StockRelease: "stockRelease",
  StockReleaseItem: "stockReleaseItem",
  StockUnit: "stockUnit",
  DamagedStock: "damagedStock",
};

export function toFirestoreDoc(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v instanceof Date) out[k] = v.toISOString();
    else if (v === undefined) continue;
    else out[k] = v;
  }
  return out;
}

export function fromFirestoreDoc(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
      const d = new Date(v);
      out[k] = Number.isNaN(d.getTime()) ? v : d;
    } else if (v && typeof v === "object" && "_seconds" in (v as object)) {
      const t = v as { _seconds: number; _nanoseconds?: number };
      out[k] = new Date(t._seconds * 1000);
    } else {
      out[k] = v;
    }
  }
  return out;
}
