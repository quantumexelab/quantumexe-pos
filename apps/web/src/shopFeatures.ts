/** Shared shop-type feature helpers for POS UI (matches API shopTemplates). */

export type NavModuleId =
  | "dashboard"
  | "sales"
  | "quotation"
  | "stock"
  | "grn"
  | "products"
  | "supplier"
  | "customer"
  | "users"
  | "accounts"
  | "reports"
  | "settings"
  | "backup";

export type ShopFeatures = {
  modules: NavModuleId[];
  quickSaleMode?: boolean;
  expireStockEmphasis?: boolean;
  showBrand?: boolean;
};

export const SHOP_TYPE_OPTIONS = [
  { id: "clothing", label: "Clothing / Fashion", hint: "Sizes, brands, apparel categories" },
  { id: "restaurant", label: "Restaurant / Cafe", hint: "Fast sale, meals & drinks" },
  { id: "grocery", label: "Grocery / Mini mart", hint: "Expiry stock, bulk units" },
  { id: "pharmacy", label: "Pharmacy", hint: "Expiry focus, medicine categories" },
  { id: "electronics", label: "Electronics", hint: "Brands, devices & accessories" },
  { id: "general", label: "General retail", hint: "Full menu, light starter data" },
] as const;

export const SHOP_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  SHOP_TYPE_OPTIONS.map((o) => [o.id, o.label])
);

const DEFAULT_MODULES: NavModuleId[] = [
  "dashboard",
  "sales",
  "quotation",
  "stock",
  "grn",
  "products",
  "supplier",
  "customer",
  "users",
  "accounts",
  "reports",
  "settings",
  "backup",
];

export function parseFeatures(raw: unknown): ShopFeatures | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      return parseFeatures(JSON.parse(raw));
    } catch {
      return null;
    }
  }
  if (typeof raw === "object" && raw !== null && Array.isArray((raw as ShopFeatures).modules)) {
    return raw as ShopFeatures;
  }
  return null;
}

export function modulesForShop(features: ShopFeatures | null | undefined): Set<string> {
  const list = features?.modules?.length ? features.modules : DEFAULT_MODULES;
  return new Set(list);
}

const FEATURES_KEY = "qx_shop_features";
const TYPE_KEY = "qx_shop_type";

export function cacheShopFeatures(shopType: string | null | undefined, features: ShopFeatures | null | undefined) {
  try {
    if (shopType) sessionStorage.setItem(TYPE_KEY, shopType);
    else sessionStorage.removeItem(TYPE_KEY);
    if (features) sessionStorage.setItem(FEATURES_KEY, JSON.stringify(features));
    else sessionStorage.removeItem(FEATURES_KEY);
  } catch {
    /* ignore */
  }
}

export function readCachedShopType(): string | null {
  try {
    return sessionStorage.getItem(TYPE_KEY);
  } catch {
    return null;
  }
}

export function readCachedFeatures(): ShopFeatures | null {
  try {
    return parseFeatures(sessionStorage.getItem(FEATURES_KEY));
  } catch {
    return null;
  }
}
