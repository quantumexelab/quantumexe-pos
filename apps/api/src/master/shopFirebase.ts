import admin from "firebase-admin";
import type { Firestore } from "firebase-admin/firestore";
import type { ShopRecord } from "./shopRegistry.js";

export type ShopFirebaseCreds = {
  firebaseProjectId: string;
  firebaseClientEmail: string;
  firebasePrivateKey: string;
};

const appCache = new Map<string, admin.app.App>();
const dbCache = new Map<string, Firestore>();

export function shopHasFirebase(shop: Pick<ShopRecord, "firebaseProjectId" | "firebaseClientEmail" | "firebasePrivateKey"> | null | undefined): boolean {
  return Boolean(
    shop?.firebaseProjectId?.trim() &&
      shop?.firebaseClientEmail?.trim() &&
      shop?.firebasePrivateKey?.trim()
  );
}

function appName(shopId: string) {
  return `shop_${shopId}`;
}

function normalizePrivateKey(key: string) {
  return key.replace(/\\n/g, "\n").trim();
}

/** Init (or reuse) Admin SDK app for a shop's dedicated Firebase project. */
export function getShopFirestoreFromCreds(shopId: string, creds: ShopFirebaseCreds): Firestore {
  const cached = dbCache.get(shopId);
  if (cached) return cached;

  const name = appName(shopId);
  let app = appCache.get(shopId);
  if (!app) {
    const existing = admin.apps.find((a) => a?.name === name);
    if (existing) {
      app = existing;
    } else {
      app = admin.initializeApp(
        {
          credential: admin.credential.cert({
            projectId: creds.firebaseProjectId.trim(),
            clientEmail: creds.firebaseClientEmail.trim(),
            privateKey: normalizePrivateKey(creds.firebasePrivateKey),
          }),
          projectId: creds.firebaseProjectId.trim(),
        },
        name
      );
    }
    appCache.set(shopId, app);
  }

  const db = app.firestore();
  dbCache.set(shopId, db);
  return db;
}

export function clearShopFirebaseCache(shopId?: string) {
  if (shopId) {
    dbCache.delete(shopId);
    const app = appCache.get(shopId);
    appCache.delete(shopId);
    if (app) {
      void app.delete().catch(() => undefined);
    }
    return;
  }
  for (const id of [...appCache.keys()]) clearShopFirebaseCache(id);
}

/** Cached shop DB if already warmed; otherwise null (caller uses control DB). */
export function getCachedShopFirestore(shopId: string | null | undefined): Firestore | null {
  if (!shopId) return null;
  return dbCache.get(shopId) || null;
}

export async function warmShopFirestore(shopId: string | null | undefined): Promise<Firestore | null> {
  if (!shopId) return null;
  if (dbCache.has(shopId)) return dbCache.get(shopId)!;
  const { getShop } = await import("./shopRegistry.js");
  const shop = await getShop(shopId);
  if (!shopHasFirebase(shop)) return null;
  return getShopFirestoreFromCreds(shopId, {
    firebaseProjectId: shop!.firebaseProjectId!,
    firebaseClientEmail: shop!.firebaseClientEmail!,
    firebasePrivateKey: shop!.firebasePrivateKey!,
  });
}

export async function testShopFirebase(creds: ShopFirebaseCreds): Promise<{ ok: boolean; message: string }> {
  const tempName = `shop_test_${Date.now().toString(36)}`;
  try {
    const app = admin.initializeApp(
      {
        credential: admin.credential.cert({
          projectId: creds.firebaseProjectId.trim(),
          clientEmail: creds.firebaseClientEmail.trim(),
          privateKey: normalizePrivateKey(creds.firebasePrivateKey),
        }),
        projectId: creds.firebaseProjectId.trim(),
      },
      tempName
    );
    const db = app.firestore();
    await db.collection("_qx_ping").doc("ping").set({ t: Date.now() }, { merge: true });
    await app.delete();
    return { ok: true, message: "Connected — Firestore reachable" };
  } catch (e) {
    try {
      const existing = admin.apps.find((a) => a?.name === tempName);
      if (existing) await existing.delete();
    } catch {
      /* ignore */
    }
    return { ok: false, message: e instanceof Error ? e.message : "Connection failed" };
  }
}

/** Seed Role / Status / Super Admin user into a brand-new shop Firebase project. */
export async function provisionShopDatabase(shop: ShopRecord): Promise<void> {
  if (!shopHasFirebase(shop)) throw new Error("Shop Firebase credentials not set");
  const db = getShopFirestoreFromCreds(shop.shopId, {
    firebaseProjectId: shop.firebaseProjectId!,
    firebaseClientEmail: shop.firebaseClientEmail!,
    firebasePrivateKey: shop.firebasePrivateKey!,
  });

  const ensureDoc = async (col: string, id: string, data: Record<string, unknown>) => {
    const ref = db.collection(col).doc(id);
    const snap = await ref.get();
    if (!snap.exists) await ref.set(data);
  };

  await ensureDoc("Role", "1", { id: 1, name: "Admin" });
  await ensureDoc("Role", "2", { id: 2, name: "Cashier" });
  await ensureDoc("Status", "1", { id: 1, name: "Active" });
  await ensureDoc("Status", "2", { id: 2, name: "Inactive" });
  await db.collection("counters").doc("Role").set({ value: 2 }, { merge: true });
  await db.collection("counters").doc("Status").set({ value: 2 }, { merge: true });

  const users = await db.collection("User").where("contact", "==", shop.phone).limit(1).get();
  if (users.empty) {
    const counterRef = db.collection("counters").doc("User");
    const nextId = await db.runTransaction(async (tx) => {
      const snap = await tx.get(counterRef);
      const current = snap.exists ? Number(snap.data()?.value || 0) : 0;
      const next = current + 1;
      tx.set(counterRef, { value: next }, { merge: true });
      return next;
    });
    await db
      .collection("User")
      .doc(String(nextId))
      .set({
        id: nextId,
        name: shop.ownerName,
        email: shop.email,
        contact: shop.phone,
        passwordHash: shop.passwordHash,
        roleId: 1,
        statusId: 1,
        shopId: shop.shopId,
        createdAt: new Date(),
      });
  }

  const settingsSnap = await db.collection("Setting").where("key", "==", "shop_name").limit(1).get();
  if (settingsSnap.empty) {
    const counterRef = db.collection("counters").doc("Setting");
    const nextId = await db.runTransaction(async (tx) => {
      const snap = await tx.get(counterRef);
      const current = snap.exists ? Number(snap.data()?.value || 0) : 0;
      const next = current + 1;
      tx.set(counterRef, { value: next }, { merge: true });
      return next;
    });
    await db.collection("Setting").doc(String(nextId)).set({
      id: nextId,
      key: "shop_name",
      value: shop.shopName,
      shopId: shop.shopId,
    });
  }

  await db.collection("_qx_meta").doc("shop").set(
    {
      shopId: shop.shopId,
      shopName: shop.shopName,
      provisionedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}
