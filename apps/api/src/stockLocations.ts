import type { PrismaClient } from "@prisma/client";

export const LOC_STORE = "store";
export const LOC_SHOP = "shop";

type Db = Pick<
  PrismaClient,
  "stock" | "productVariant"
>;

export type StockRow = {
  id: number;
  variantId: number;
  quantity: number;
  lowThreshold: number;
  expireDate: Date | null;
  location: string | null;
};

export async function ensureStockPair(
  db: Db,
  variantId: number,
  defaults?: { lowThreshold?: number; expireDate?: Date | null }
): Promise<{ store: StockRow; shop: StockRow }> {
  const rows = await db.stock.findMany({ where: { variantId } });

  let store =
    rows.find((r) => r.location === LOC_STORE) ||
    rows.find((r) => !r.location || r.location === "") ||
    null;
  let shop = rows.find((r) => r.location === LOC_SHOP) || null;

  const orphans = rows.filter((r) => r.id !== store?.id && r.id !== shop?.id);

  if (store && (!store.location || store.location === "")) {
    store = await db.stock.update({
      where: { id: store.id },
      data: { location: LOC_STORE },
    });
  }

  if (orphans.length) {
    const extraQty = orphans.reduce((s, r) => s + Number(r.quantity || 0), 0);
    if (store) {
      store = await db.stock.update({
        where: { id: store.id },
        data: { quantity: Number(store.quantity) + extraQty },
      });
    } else if (extraQty > 0) {
      store = await db.stock.create({
        data: {
          variantId,
          quantity: extraQty,
          location: LOC_STORE,
          lowThreshold: defaults?.lowThreshold ?? 5,
          expireDate: defaults?.expireDate ?? null,
        },
      });
    }
    for (const o of orphans) {
      await db.stock.delete({ where: { id: o.id } });
    }
  }

  if (!store) {
    store = await db.stock.create({
      data: {
        variantId,
        quantity: 0,
        location: LOC_STORE,
        lowThreshold: defaults?.lowThreshold ?? 5,
        expireDate: defaults?.expireDate ?? null,
      },
    });
  }

  if (!shop) {
    shop = await db.stock.create({
      data: {
        variantId,
        quantity: 0,
        location: LOC_SHOP,
        lowThreshold: store.lowThreshold,
        expireDate: store.expireDate,
      },
    });
  }

  return { store: store as StockRow, shop: shop as StockRow };
}

export async function getStoreStock(db: Db, variantId: number) {
  const { store } = await ensureStockPair(db, variantId);
  return store;
}

export async function getShopStock(db: Db, variantId: number) {
  const { shop } = await ensureStockPair(db, variantId);
  return shop;
}

export async function addToStoreStock(
  db: Db,
  variantId: number,
  qty: number,
  defaults?: { lowThreshold?: number; expireDate?: Date | null }
) {
  const { store } = await ensureStockPair(db, variantId, defaults);
  return db.stock.update({
    where: { id: store.id },
    data: { quantity: Number(store.quantity) + qty },
  });
}

export async function setStoreStock(
  db: Db,
  variantId: number,
  qty: number,
  meta?: { lowThreshold?: number; expireDate?: Date | null }
) {
  const { store } = await ensureStockPair(db, variantId, meta);
  return db.stock.update({
    where: { id: store.id },
    data: {
      quantity: qty,
      ...(meta?.lowThreshold != null ? { lowThreshold: meta.lowThreshold } : {}),
      ...(meta?.expireDate !== undefined ? { expireDate: meta.expireDate } : {}),
    },
  });
}

export function variantDisplayName(variant: {
  name: string;
  size?: string | null;
  color?: string | null;
  product: { name: string };
}) {
  const size = variant.size;
  const color = variant.color;
  const vname = variant.name;
  const parts = [variant.product.name];
  if (size) parts.push(`Size ${size}`);
  if (color) parts.push(color);
  if (!size && !color && vname && vname.toLowerCase() !== "default") parts.push(vname);
  return parts.join(" · ");
}
