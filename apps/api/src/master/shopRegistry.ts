import bcrypt from "bcryptjs";
import admin from "firebase-admin";
import { prisma } from "../lib.js";
import { credentialsConfigured, getSyncFirestore } from "../sync/firestoreAdmin.js";

export type ShopStatus = "pending" | "active" | "revoked" | "overdue";

export type ShopRecord = {
  shopId: string;
  shopName: string;
  ownerName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  nic: string;
  businessRegNo: string;
  passwordHash: string;
  status: ShopStatus;
  paymentNote: string;
  lastPaidAt: string | null;
  nextDueAt: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Dedicated Firebase project for this shop's POS data (Master-configured). */
  firebaseProjectId?: string;
  firebaseClientEmail?: string;
  firebasePrivateKey?: string;
  firebaseProvisionedAt?: string | null;
  /** Business template applied on approve (clothing, restaurant, …). */
  shopType?: string;
  /** Master toggle: allow fingerprint attendance at this shop. */
  fingerprintAttendance?: boolean;
};

const SHOPS_COL = "pos_shops";
const MASTER_COL = "pos_master_admins";
const LOCAL_SHOPS_KEY = "master_shops_json";
const LOCAL_MASTER_HASH_KEY = "master_password_hash";
const SHOP_ID_KEY = "shop_id";
const SHOP_STATUS_KEY = "shop_access_status";

const DEFAULT_MASTER_USER = "master";
const DEFAULT_MASTER_PASS = "Master@123";

function useCloud(): boolean {
  // Prefer dedicated registry collections whenever Admin SDK creds exist,
  // including Vercel USE_FIRESTORE=1 mode.
  return credentialsConfigured() || process.env.USE_FIRESTORE === "1";
}

function getDb() {
  // Prefer sync helper (inits Admin from env). If already inited by fsdb, reuse it.
  try {
    if (credentialsConfigured()) return getSyncFirestore();
  } catch {
    /* fall through */
  }
  if (admin.apps.length) return admin.firestore();
  throw new Error("Firebase Admin not initialized for shop registry");
}

function newShopId() {
  return `shop_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function readLocalShops(): Promise<Record<string, ShopRecord>> {
  const row = await prisma.setting.findUnique({ where: { key: LOCAL_SHOPS_KEY } });
  if (!row?.value) return {};
  try {
    return JSON.parse(row.value) as Record<string, ShopRecord>;
  } catch {
    return {};
  }
}

async function writeLocalShops(map: Record<string, ShopRecord>) {
  const value = JSON.stringify(map);
  await prisma.setting.upsert({
    where: { key: LOCAL_SHOPS_KEY },
    create: { key: LOCAL_SHOPS_KEY, value },
    update: { value },
  });
}

export async function ensureMasterAdmin() {
  const hash = await bcrypt.hash(DEFAULT_MASTER_PASS, 10);
  if (useCloud()) {
    try {
      const db = getDb();
      const ref = db.collection(MASTER_COL).doc(DEFAULT_MASTER_USER);
      const snap = await ref.get();
      if (!snap.exists) {
        await ref.set({
          username: DEFAULT_MASTER_USER,
          passwordHash: hash,
          name: "Master Admin",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        console.log("[master] Seeded cloud master admin (master / Master@123)");
      }
      return;
    } catch (e) {
      console.warn("[master] Cloud master seed failed, using local:", e instanceof Error ? e.message : e);
    }
  }
  const existing = await prisma.setting.findUnique({ where: { key: LOCAL_MASTER_HASH_KEY } });
  if (!existing) {
    await prisma.setting.create({
      data: {
        key: LOCAL_MASTER_HASH_KEY,
        value: hash,
      },
    });
    console.log("[master] Seeded local master admin (master / Master@123)");
  }
}

export async function verifyMasterLogin(username: string, password: string): Promise<boolean> {
  const u = username.trim().toLowerCase();
  if (u !== DEFAULT_MASTER_USER && u !== "masteradmin") return false;

  if (useCloud()) {
    try {
      const db = getDb();
      const snap = await db.collection(MASTER_COL).doc(DEFAULT_MASTER_USER).get();
      if (snap.exists) {
        const data = snap.data() as { passwordHash?: string };
        if (data.passwordHash && (await bcrypt.compare(password, data.passwordHash))) return true;
      }
    } catch {
      /* fall through to local */
    }
  }

  const row = await prisma.setting.findUnique({ where: { key: LOCAL_MASTER_HASH_KEY } });
  if (!row) {
    await ensureMasterAdmin();
    return password === DEFAULT_MASTER_PASS;
  }
  return bcrypt.compare(password, row.value);
}

export async function changeMasterPassword(current: string, next: string) {
  const ok = await verifyMasterLogin(DEFAULT_MASTER_USER, current);
  if (!ok) throw new Error("Current password is incorrect");
  const hash = await bcrypt.hash(next, 10);
  if (useCloud()) {
    try {
      const db = getDb();
      await db.collection(MASTER_COL).doc(DEFAULT_MASTER_USER).set(
        { passwordHash: hash, updatedAt: new Date().toISOString() },
        { merge: true }
      );
    } catch {
      /* local too */
    }
  }
  await prisma.setting.upsert({
    where: { key: LOCAL_MASTER_HASH_KEY },
    create: { key: LOCAL_MASTER_HASH_KEY, value: hash },
    update: { value: hash },
  });
}

export async function createShopRegistration(input: {
  shopName: string;
  ownerName: string;
  phone: string;
  email: string;
  password: string;
  address?: string;
  city?: string;
  nic?: string;
  businessRegNo?: string;
}): Promise<ShopRecord> {
  const phone = input.phone.trim();
  const existing = await findShopByPhone(phone);
  if (existing) throw new Error("A shop is already registered with this phone number");

  const now = new Date().toISOString();
  const shop: ShopRecord = {
    shopId: newShopId(),
    shopName: input.shopName.trim(),
    ownerName: input.ownerName.trim(),
    phone,
    email: input.email.trim(),
    address: (input.address || "").trim(),
    city: (input.city || "").trim(),
    nic: (input.nic || "").trim(),
    businessRegNo: (input.businessRegNo || "").trim(),
    passwordHash: await bcrypt.hash(input.password, 10),
    status: "pending",
    paymentNote: "",
    lastPaidAt: null,
    nextDueAt: null,
    approvedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  if (useCloud()) {
    try {
      await getDb().collection(SHOPS_COL).doc(shop.shopId).set(shop);
    } catch (e) {
      console.warn("[master] Cloud shop create failed, storing locally:", e instanceof Error ? e.message : e);
      const map = await readLocalShops();
      map[shop.shopId] = shop;
      await writeLocalShops(map);
    }
  } else {
    const map = await readLocalShops();
    map[shop.shopId] = shop;
    await writeLocalShops(map);
  }

  // Shared cloud (USE_FIRESTORE=1): never write a global shop_id Setting —
  // tenant is JWT/user.shopId. Local SQLite / desktop: bind this install.
  if (process.env.USE_FIRESTORE !== "1") {
    await prisma.setting.upsert({
      where: { key: SHOP_ID_KEY },
      create: { key: SHOP_ID_KEY, value: shop.shopId },
      update: { value: shop.shopId },
    });
    await setLocalShopStatus("pending");
  }
  return shop;
}

export async function findShopByPhone(phone: string): Promise<ShopRecord | null> {
  const p = phone.trim();
  if (useCloud()) {
    try {
      const snap = await getDb().collection(SHOPS_COL).where("phone", "==", p).limit(1).get();
      if (!snap.empty) return snap.docs[0].data() as ShopRecord;
    } catch {
      /* local */
    }
  }
  const map = await readLocalShops();
  return Object.values(map).find((s) => s.phone === p) || null;
}

export async function getShop(shopId: string): Promise<ShopRecord | null> {
  if (useCloud()) {
    try {
      const snap = await getDb().collection(SHOPS_COL).doc(shopId).get();
      if (snap.exists) return snap.data() as ShopRecord;
    } catch {
      /* local */
    }
  }
  const map = await readLocalShops();
  return map[shopId] || null;
}

export async function listShops(): Promise<ShopRecord[]> {
  if (useCloud()) {
    try {
      const snap = await getDb().collection(SHOPS_COL).orderBy("createdAt", "desc").get();
      return snap.docs.map((d) => d.data() as ShopRecord);
    } catch (e) {
      console.warn("[master] listShops cloud failed:", e instanceof Error ? e.message : e);
    }
  }
  const map = await readLocalShops();
  return Object.values(map).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function updateShop(
  shopId: string,
  patch: Partial<ShopRecord>
): Promise<ShopRecord> {
  const current = await getShop(shopId);
  if (!current) throw new Error("Shop not found");
  const next: ShopRecord = {
    ...current,
    ...patch,
    shopId: current.shopId,
    updatedAt: new Date().toISOString(),
  };
  if (useCloud()) {
    try {
      await getDb().collection(SHOPS_COL).doc(shopId).set(next, { merge: true });
    } catch {
      /* local */
    }
  }
  const map = await readLocalShops();
  map[shopId] = next;
  await writeLocalShops(map);
  return next;
}

export async function approveShop(
  shopId: string,
  opts: { paymentNote?: string; shopType?: string } | string = {}
) {
  const paymentNote =
    typeof opts === "string" ? opts : opts.paymentNote || "Payment confirmed";
  const shopType = typeof opts === "string" ? undefined : opts.shopType;

  const now = new Date();
  const nextDue = new Date(now.getTime() + 30 * 86400000);
  const patch: Partial<ShopRecord> = {
    status: "active",
    paymentNote,
    lastPaidAt: now.toISOString(),
    nextDueAt: nextDue.toISOString(),
    approvedAt: now.toISOString(),
  };
  if (shopType) patch.shopType = shopType;
  return updateShop(shopId, patch);
}

/** Set or change shop type and re-apply feature template (does not wipe products). */
export async function setShopType(shopId: string, shopType: string) {
  const { isShopType, applyShopTemplate } = await import("./shopTemplates.js");
  if (!isShopType(shopType)) throw new Error("Invalid shop type");
  const shop = await updateShop(shopId, { shopType });
  await applyShopTemplate(shop, shopType);
  return shop;
}

export async function revokeShop(shopId: string) {
  return updateShop(shopId, { status: "revoked" });
}

export async function resetShopPassword(shopId: string, newPassword: string) {
  const passwordHash = await bcrypt.hash(newPassword, 10);
  return updateShop(shopId, { passwordHash });
}

export async function getLocalShopId(): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key: SHOP_ID_KEY } });
  return row?.value || null;
}

export async function setLocalShopStatus(status: ShopStatus | string) {
  await prisma.setting.upsert({
    where: { key: SHOP_STATUS_KEY },
    create: { key: SHOP_STATUS_KEY, value: status },
    update: { value: status },
  });
}

/** Resolve access for a shop from the registry (cloud-safe; no global Setting). */
export async function resolveShopAccess(shopId: string | null | undefined): Promise<{
  shopId: string | null;
  status: ShopStatus | "unknown";
  shop: ShopRecord | null;
}> {
  if (!shopId) {
    return { shopId: null, status: "unknown", shop: null };
  }
  const shop = await getShop(shopId);
  if (!shop) return { shopId, status: "pending", shop: null };
  let status = shop.status;
  if (status === "active" && shop.nextDueAt && new Date(shop.nextDueAt).getTime() < Date.now()) {
    status = "overdue";
    await updateShop(shopId, { status: "overdue" });
  }
  return { shopId, status, shop };
}

export async function refreshLocalAccessFromRegistry(preferredShopId?: string | null): Promise<{
  shopId: string | null;
  status: ShopStatus | "unknown";
  shop: ShopRecord | null;
}> {
  const shopId = preferredShopId || (await getLocalShopId());
  if (!shopId) {
    // Demo installs without registration stay active
    const cached = await prisma.setting.findUnique({ where: { key: SHOP_STATUS_KEY } });
    const status = (cached?.value as ShopStatus) || "active";
    return { shopId: null, status, shop: null };
  }
  const access = await resolveShopAccess(shopId);
  const { status, shop } = access;

  // Local license mirror only for single-tenant SQLite / desktop
  if (process.env.USE_FIRESTORE !== "1") {
    await setLocalShopStatus(status === "unknown" ? "pending" : status);
    if (status === "active") {
      const expiry = shop?.nextDueAt ? new Date(shop.nextDueAt) : new Date(Date.now() + 30 * 86400000);
      const existing = await prisma.license.findFirst();
      if (existing) {
        await prisma.license.update({
          where: { id: existing.id },
          data: { status: "VALID", expiryDate: expiry },
        });
      } else {
        await prisma.license.create({
          data: {
            licenseKey: `QX-${shopId.slice(-8).toUpperCase()}`,
            status: "VALID",
            expiryDate: expiry,
          },
        });
      }
    } else if (status === "revoked" || status === "overdue" || status === "pending") {
      const existing = await prisma.license.findFirst();
      if (existing) {
        await prisma.license.update({
          where: { id: existing.id },
          data: { status: status === "pending" ? "PENDING" : "REVOKED" },
        });
      }
    }
  }
  return access;
}

/** Ensure demo shop is marked active for existing seeded installs (E1). */
export async function ensureDemoShopApproved() {
  const phone = "0771234567";
  let shop = await findShopByPhone(phone);
  if (!shop) {
    const now = new Date();
    const nextDue = new Date(now.getTime() + 365 * 86400000);
    shop = {
      shopId: "shop_demo_quantumexe",
      shopName: "QUANTUMEXE Demo Shop",
      ownerName: "Super Admin",
      phone,
      email: "admin@reox.com",
      address: "Demo Address",
      city: "Colombo",
      nic: "",
      businessRegNo: "",
      passwordHash: await bcrypt.hash("123456", 10),
      status: "active",
      paymentNote: "Demo seed — pre-approved",
      lastPaidAt: now.toISOString(),
      nextDueAt: nextDue.toISOString(),
      approvedAt: now.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    if (useCloud()) {
      try {
        await getDb().collection(SHOPS_COL).doc(shop.shopId).set(shop);
      } catch {
        const map = await readLocalShops();
        map[shop.shopId] = shop;
        await writeLocalShops(map);
      }
    } else {
      const map = await readLocalShops();
      map[shop.shopId] = shop;
      await writeLocalShops(map);
    }
  } else if (shop.status !== "active") {
    shop = await approveShop(shop.shopId, "Demo seed — pre-approved");
  }
  // Shared cloud: keep demo shop in registry only — do not overwrite global Setting.shop_id
  // (that would break multi-tenant web). Desktop/SQLite: bind install to demo.
  if (process.env.USE_FIRESTORE !== "1") {
    await prisma.setting.upsert({
      where: { key: SHOP_ID_KEY },
      create: { key: SHOP_ID_KEY, value: shop.shopId },
      update: { value: shop.shopId },
    });
    await setLocalShopStatus("active");
  }
}

export { DEFAULT_MASTER_USER, SHOP_ID_KEY, SHOP_STATUS_KEY };

/** Strip secrets for Master Admin API responses. */
export function toPublicShop(shop: ShopRecord) {
  const {
    passwordHash: _pw,
    firebasePrivateKey: _key,
    ...rest
  } = shop;
  return {
    ...rest,
    firebaseConfigured: Boolean(
      shop.firebaseProjectId?.trim() &&
        shop.firebaseClientEmail?.trim() &&
        shop.firebasePrivateKey?.trim()
    ),
    firebaseProvisionedAt: shop.firebaseProvisionedAt || null,
  };
}

export async function setShopFirebase(
  shopId: string,
  creds: {
    firebaseProjectId: string;
    firebaseClientEmail: string;
    firebasePrivateKey: string;
    provision?: boolean;
  }
) {
  const { clearShopFirebaseCache, provisionShopDatabase, shopHasFirebase, testShopFirebase } = await import(
    "./shopFirebase.js"
  );
  const test = await testShopFirebase(creds);
  if (!test.ok) throw new Error(test.message);

  clearShopFirebaseCache(shopId);
  const shop = await updateShop(shopId, {
    firebaseProjectId: creds.firebaseProjectId.trim(),
    firebaseClientEmail: creds.firebaseClientEmail.trim(),
    firebasePrivateKey: creds.firebasePrivateKey.replace(/\\n/g, "\n").trim(),
  });

  if (creds.provision !== false) {
    await provisionShopDatabase(shop);
    return updateShop(shopId, { firebaseProvisionedAt: new Date().toISOString() });
  }
  if (!shopHasFirebase(shop)) throw new Error("Firebase credentials incomplete");
  return shop;
}

export async function clearShopFirebase(shopId: string) {
  const { clearShopFirebaseCache } = await import("./shopFirebase.js");
  clearShopFirebaseCache(shopId);
  return updateShop(shopId, {
    firebaseProjectId: "",
    firebaseClientEmail: "",
    firebasePrivateKey: "",
    firebaseProvisionedAt: null,
  });
}
