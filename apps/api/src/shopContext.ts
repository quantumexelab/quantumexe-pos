import { AsyncLocalStorage } from "node:async_hooks";
import { getCachedShopFirestore } from "./master/shopFirebase.js";

type ShopStore = { shopId: string | null };

const shopStorage = new AsyncLocalStorage<ShopStore>();

/** Demo / legacy shared cloud data lives under this shop id. */
export const DEMO_SHOP_ID = "shop_demo_quantumexe";

export function runWithShop<T>(shopId: string | null, fn: () => T): T {
  return shopStorage.run({ shopId }, fn);
}

export function getShopId(): string | null {
  return shopStorage.getStore()?.shopId ?? null;
}

export function tenancyEnabled() {
  return process.env.USE_FIRESTORE === "1";
}

/** Shared reference data — not filtered by shop. */
export const GLOBAL_MODELS = new Set(["Role", "Status"]);

export function rowBelongsToShop(
  model: string,
  row: Record<string, unknown> | null | undefined,
  shopId: string | null
): boolean {
  if (!tenancyEnabled()) return true;
  if (!shopId) return true; // system / master / login
  if (GLOBAL_MODELS.has(model)) return true;
  // Dedicated shop Firebase = whole DB is that shop
  if (getCachedShopFirestore(shopId)) return true;
  if (!row) return false;
  const rowShop = row.shopId == null || row.shopId === "" ? null : String(row.shopId);
  if (rowShop == null) {
    // Untagged legacy demo documents → only the demo shop can see them
    return shopId === DEMO_SHOP_ID;
  }
  return rowShop === shopId;
}
