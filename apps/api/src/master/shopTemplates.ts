import { prisma } from "../lib.js";
import { runWithShop } from "../shopContext.js";
import { warmShopFirestore } from "./shopFirebase.js";
import type { ShopRecord } from "./shopRegistry.js";

export const SHOP_TYPES = [
  "clothing",
  "restaurant",
  "grocery",
  "pharmacy",
  "electronics",
  "general",
] as const;

export type ShopTypeId = (typeof SHOP_TYPES)[number];

export function isShopType(v: unknown): v is ShopTypeId {
  return typeof v === "string" && (SHOP_TYPES as readonly string[]).includes(v);
}

export const SHOP_TYPE_LABELS: Record<ShopTypeId, string> = {
  clothing: "Clothing / Fashion",
  restaurant: "Restaurant / Cafe",
  grocery: "Grocery / Mini mart",
  pharmacy: "Pharmacy",
  electronics: "Electronics",
  general: "General retail",
};

/** Nav module ids matching AppLayout. */
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
  quickSaleMode: boolean;
  expireStockEmphasis: boolean;
  showBrand: boolean;
};

export type ShopTemplate = {
  id: ShopTypeId;
  label: string;
  features: ShopFeatures;
  categories: string[];
  brands: string[];
  units: string[];
  productTypes: string[];
};

const CORE: NavModuleId[] = [
  "dashboard",
  "sales",
  "products",
  "stock",
  "customer",
  "users",
  "accounts",
  "reports",
  "settings",
  "backup",
];

export const SHOP_TEMPLATES: Record<ShopTypeId, ShopTemplate> = {
  clothing: {
    id: "clothing",
    label: SHOP_TYPE_LABELS.clothing,
    features: {
      modules: [...CORE, "quotation", "grn", "supplier"],
      quickSaleMode: false,
      expireStockEmphasis: false,
      showBrand: true,
    },
    categories: ["Men", "Women", "Kids", "Accessories", "Footwear"],
    brands: ["House Brand", "Local", "Import"],
    units: ["Pcs", "Pair", "Set"],
    productTypes: ["Apparel", "Footwear", "Accessory"],
  },
  restaurant: {
    id: "restaurant",
    label: SHOP_TYPE_LABELS.restaurant,
    features: {
      modules: [...CORE, "grn", "supplier"],
      quickSaleMode: true,
      expireStockEmphasis: false,
      showBrand: false,
    },
    categories: ["Meals", "Beverages", "Desserts", "Snacks", "Extras"],
    brands: [],
    units: ["Portion", "Plate", "Cup", "Pcs"],
    productTypes: ["Food", "Drink", "Combo"],
  },
  grocery: {
    id: "grocery",
    label: SHOP_TYPE_LABELS.grocery,
    features: {
      modules: [...CORE, "quotation", "grn", "supplier"],
      quickSaleMode: false,
      expireStockEmphasis: true,
      showBrand: true,
    },
    categories: ["Rice & Grains", "Dairy", "Beverages", "Snacks", "Household", "Personal Care"],
    brands: ["Local", "Import"],
    units: ["Pcs", "Kg", "g", "L", "ml", "Pack"],
    productTypes: ["Grocery", "Perishable", "Non-food"],
  },
  pharmacy: {
    id: "pharmacy",
    label: SHOP_TYPE_LABELS.pharmacy,
    features: {
      modules: [...CORE, "grn", "supplier"],
      quickSaleMode: false,
      expireStockEmphasis: true,
      showBrand: true,
    },
    categories: ["OTC", "Prescription", "Vitamins", "First Aid", "Personal Care"],
    brands: ["Generic", "Branded"],
    units: ["Pcs", "Strip", "Bottle", "Pack"],
    productTypes: ["Medicine", "Supplement", "Device"],
  },
  electronics: {
    id: "electronics",
    label: SHOP_TYPE_LABELS.electronics,
    features: {
      modules: [...CORE, "quotation", "grn", "supplier"],
      quickSaleMode: false,
      expireStockEmphasis: false,
      showBrand: true,
    },
    categories: ["Mobiles", "Accessories", "Computers", "Audio", "Home Appliances"],
    brands: ["Local", "Import"],
    units: ["Pcs", "Set"],
    productTypes: ["Device", "Accessory", "Spare"],
  },
  general: {
    id: "general",
    label: SHOP_TYPE_LABELS.general,
    features: {
      modules: [...CORE, "quotation", "grn", "supplier"],
      quickSaleMode: false,
      expireStockEmphasis: false,
      showBrand: true,
    },
    categories: ["General", "Misc"],
    brands: ["House Brand"],
    units: ["Pcs", "Pack", "Kg"],
    productTypes: ["Retail"],
  },
};

async function upsertSetting(key: string, value: string) {
  await prisma.setting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

async function seedNamed(
  model: "category" | "brand" | "unit" | "productType",
  names: string[],
  shopId: string
) {
  if (!names.length) return;
  const existing = await (prisma as any)[model].findMany();
  if ((existing as unknown[]).length > 0) return;

  for (const name of names) {
    try {
      await (prisma as any)[model].create({
        data: shopId ? { name, shopId } : { name },
      });
    } catch {
      /* unique / schema drift */
    }
  }
}

/** Apply feature flags + starter catalog into the shop's POS database. */
export async function applyShopTemplate(shop: ShopRecord, shopType: ShopTypeId): Promise<void> {
  const template = SHOP_TEMPLATES[shopType];
  await warmShopFirestore(shop.shopId);

  await runWithShop(shop.shopId, async () => {
    await upsertSetting("shop_type", shopType);
    await upsertSetting("shop_type_label", template.label);
    await upsertSetting("features_json", JSON.stringify(template.features));
    await upsertSetting("quick_sale_mode", template.features.quickSaleMode ? "1" : "0");
    await upsertSetting(
      "expire_stock_emphasis",
      template.features.expireStockEmphasis ? "1" : "0"
    );
    await upsertSetting("show_brand", template.features.showBrand ? "1" : "0");
    await upsertSetting("shop_name", shop.shopName);
    await upsertSetting("business_name", shop.shopName);

    await seedNamed("category", template.categories, shop.shopId);
    await seedNamed("brand", template.brands, shop.shopId);
    await seedNamed("unit", template.units, shop.shopId);
    await seedNamed("productType", template.productTypes, shop.shopId);
  });
}
