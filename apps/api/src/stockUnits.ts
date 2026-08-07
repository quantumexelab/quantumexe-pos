import { LOC_SHOP, LOC_STORE } from "./stockLocations.js";

export const UNIT_AVAILABLE = "available";
export const UNIT_SOLD = "sold";
export const UNIT_DAMAGED = "damaged";

type Tx = {
  productVariant: {
    findUnique: (args: any) => Promise<any>;
  };
  stockUnit: {
    findMany: (args: any) => Promise<any[]>;
    findFirst: (args: any) => Promise<any>;
    create: (args: any) => Promise<any>;
    update: (args: any) => Promise<any>;
    count: (args: any) => Promise<number>;
  };
};

export type StockUnitRow = {
  id: number;
  unitCode: string;
  variantId: number;
  location: string;
  status: string;
  releaseItemId?: number | null;
  invoiceItemId?: number | null;
};

function padSeq(n: number) {
  return String(n).padStart(4, "0");
}

async function nextUnitSeq(db: Tx, variantId: number): Promise<number> {
  const count = await db.stockUnit.count({ where: { variantId } });
  return count + 1;
}

async function codePrefix(db: Tx, variantId: number): Promise<string> {
  const variant = await db.productVariant.findUnique({ where: { id: variantId } });
  const bc = String(variant?.barcode || "").trim();
  if (bc) return bc;
  return `V${variantId}`;
}

/** Create N available units at a location. Returns created rows. */
export async function createStockUnits(
  db: Tx,
  variantId: number,
  qty: number,
  location: string = LOC_STORE
): Promise<StockUnitRow[]> {
  const n = Math.max(0, Math.floor(Number(qty) || 0));
  if (!n) return [];
  const prefix = await codePrefix(db, variantId);
  let seq = await nextUnitSeq(db, variantId);
  const created: StockUnitRow[] = [];
  for (let i = 0; i < n; i++) {
    let unitCode = `${prefix}-${padSeq(seq)}`;
    // Collision-safe: bump seq until unique (rare)
    for (let attempt = 0; attempt < 20; attempt++) {
      const clash = await db.stockUnit.findFirst({ where: { unitCode } });
      if (!clash) break;
      seq += 1;
      unitCode = `${prefix}-${padSeq(seq)}`;
    }
    const row = await db.stockUnit.create({
      data: {
        unitCode,
        variantId,
        location,
        status: UNIT_AVAILABLE,
      },
    });
    created.push(row);
    seq += 1;
  }
  return created;
}

/** Ensure at least `needed` available units exist at location (bootstrap legacy stock). */
export async function ensureAvailableUnits(
  db: Tx,
  variantId: number,
  location: string,
  needed: number
): Promise<void> {
  const n = Math.max(0, Math.floor(Number(needed) || 0));
  if (!n) return;
  const have = await db.stockUnit.count({
    where: { variantId, location, status: UNIT_AVAILABLE },
  });
  if (have < n) {
    await createStockUnits(db, variantId, n - have, location);
  }
}

/**
 * Move FIFO available units from → to.
 * Sets releaseItemId when provided.
 */
export async function moveStockUnits(
  db: Tx,
  variantId: number,
  qty: number,
  from: string,
  to: string,
  releaseItemId?: number | null
): Promise<StockUnitRow[]> {
  const n = Math.max(0, Math.floor(Number(qty) || 0));
  if (!n) return [];
  await ensureAvailableUnits(db, variantId, from, n);
  const units = await db.stockUnit.findMany({
    where: { variantId, location: from, status: UNIT_AVAILABLE },
    orderBy: { id: "asc" },
    take: n,
  });
  if (units.length < n) {
    throw new Error(`Insufficient units for variant ${variantId} at ${from} (need ${n}, have ${units.length})`);
  }
  const moved: StockUnitRow[] = [];
  for (const u of units) {
    const row = await db.stockUnit.update({
      where: { id: u.id },
      data: {
        location: to,
        ...(releaseItemId != null ? { releaseItemId } : {}),
      },
    });
    moved.push(row);
  }
  return moved;
}

/** Pick one available shop unit FIFO (optionally a specific id). */
export async function allocateShopUnit(
  db: Tx,
  variantId: number,
  stockUnitId?: number | null
): Promise<StockUnitRow | null> {
  if (stockUnitId) {
    const u = await db.stockUnit.findFirst({
      where: {
        id: Number(stockUnitId),
        variantId,
        location: LOC_SHOP,
        status: UNIT_AVAILABLE,
      },
    });
    return u;
  }
  await ensureAvailableUnits(db, variantId, LOC_SHOP, 1);
  const u = await db.stockUnit.findFirst({
    where: { variantId, location: LOC_SHOP, status: UNIT_AVAILABLE },
    orderBy: { id: "asc" },
  });
  return u;
}

/** Mark N shop units sold and attach to invoice item. */
export async function sellShopUnits(
  db: Tx,
  variantId: number,
  qty: number,
  invoiceItemId: number,
  preferredUnitId?: number | null
): Promise<StockUnitRow[]> {
  const n = Math.max(0, Math.floor(Number(qty) || 0));
  if (!n) return [];
  const sold: StockUnitRow[] = [];
  const now = new Date();

  if (preferredUnitId && n === 1) {
    const u = await allocateShopUnit(db, variantId, preferredUnitId);
    if (!u) throw new Error(`Unit ${preferredUnitId} not available in shop`);
    const row = await db.stockUnit.update({
      where: { id: u.id },
      data: { status: UNIT_SOLD, soldAt: now, invoiceItemId },
    });
    return [row];
  }

  await ensureAvailableUnits(db, variantId, LOC_SHOP, n);
  let remaining = n;
  if (preferredUnitId) {
    const preferred = await allocateShopUnit(db, variantId, preferredUnitId);
    if (preferred) {
      const row = await db.stockUnit.update({
        where: { id: preferred.id },
        data: { status: UNIT_SOLD, soldAt: now, invoiceItemId },
      });
      sold.push(row);
      remaining -= 1;
    }
  }
  if (remaining > 0) {
    const units = await db.stockUnit.findMany({
      where: {
        variantId,
        location: LOC_SHOP,
        status: UNIT_AVAILABLE,
        ...(sold.length ? { id: { notIn: sold.map((s) => s.id) } } : {}),
      },
      orderBy: { id: "asc" },
      take: remaining,
    });
    if (units.length < remaining) {
      throw new Error(`Insufficient shop units for variant ${variantId}`);
    }
    for (const u of units) {
      const row = await db.stockUnit.update({
        where: { id: u.id },
        data: { status: UNIT_SOLD, soldAt: now, invoiceItemId },
      });
      sold.push(row);
    }
  }
  return sold;
}

/** Restore sold units linked to invoice items back to shop available. */
export async function restoreSoldUnits(
  db: Tx,
  invoiceItemIds: number[],
  qty: number
): Promise<number> {
  const n = Math.max(0, Math.floor(Number(qty) || 0));
  if (!n || !invoiceItemIds.length) return 0;
  const units = await db.stockUnit.findMany({
    where: {
      invoiceItemId: { in: invoiceItemIds },
      status: UNIT_SOLD,
    },
    orderBy: { id: "desc" },
    take: n,
  });
  for (const u of units) {
    await db.stockUnit.update({
      where: { id: u.id },
      data: {
        status: UNIT_AVAILABLE,
        location: LOC_SHOP,
        soldAt: null,
        invoiceItemId: null,
      },
    });
  }
  return units.length;
}

export async function findUnitByCode(db: Tx, code: string): Promise<StockUnitRow | null> {
  return db.stockUnit.findFirst({ where: { unitCode: String(code || "").trim() } });
}
