import admin from "firebase-admin";
import crypto from "crypto";
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
  let k = String(key || "")
    .replace(/^\uFEFF/, "")
    .trim();

  // Strip wrapping quotes if user pasted "-----BEGIN..."
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1).trim();
  }

  // JSON-escaped newlines → real newlines (may need multiple passes)
  for (let i = 0; i < 3; i++) {
    if (k.includes("\\n")) k = k.replace(/\\n/g, "\n");
    if (k.includes("\\r")) k = k.replace(/\\r/g, "\r");
  }
  k = k.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();

  // Soft line-wraps / spaces mangled into the PEM body
  if (k.includes("BEGIN") && k.includes("PRIVATE KEY")) {
    const beginMatch = k.match(/-----BEGIN ([A-Z0-9 ]+)-----/);
    const endMatch = k.match(/-----END ([A-Z0-9 ]+)-----/);
    if (beginMatch && endMatch) {
      const label = beginMatch[1];
      const beginTag = `-----BEGIN ${label}-----`;
      const endTag = `-----END ${label}-----`;
      const start = k.indexOf(beginTag) + beginTag.length;
      const end = k.indexOf(endTag);
      if (end > start) {
        const body = k
          .slice(start, end)
          .replace(/[^A-Za-z0-9+/=]/g, "");
        const lines: string[] = [];
        for (let i = 0; i < body.length; i += 64) lines.push(body.slice(i, i + 64));
        k = `${beginTag}\n${lines.join("\n")}\n${endTag}\n`;
      }
    }
  }

  // Re-export via Node crypto so OpenSSL 3 accepts the key (PKCS#8 PEM)
  try {
    const parsed = crypto.createPrivateKey(k);
    k = parsed.export({ type: "pkcs8", format: "pem" }).toString();
  } catch (e) {
    throw new Error(
      `Failed to parse private key: ${e instanceof Error ? e.message : String(e)}. Paste the full service-account JSON file (Ctrl+A / Ctrl+C), not a partial key.`
    );
  }

  return k.trim().endsWith("END PRIVATE KEY-----") ? `${k.trim()}\n` : `${k.trim()}\n`;
}

/** Parse pasted service-account JSON (full file or messy copy/paste). */
export function parseServiceAccountJson(raw: string): {
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
} {
  let text = String(raw || "")
    .replace(/^\uFEFF/, "")
    .trim();
  if (!text) throw new Error("Empty service account JSON");

  // Smart quotes / Word paste
  text = text
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'");

  // If user pasted extra text around the JSON, extract the object
  if (!text.startsWith("{")) {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) text = text.slice(start, end + 1);
  }

  let sa: Record<string, unknown>;
  try {
    sa = JSON.parse(text) as Record<string, unknown>;
  } catch (e) {
    throw new Error(
      `Invalid service account JSON — paste the full downloaded .json file (must start with { ). ${
        e instanceof Error ? e.message : ""
      }`.trim()
    );
  }

  const projectId = String(sa.project_id || sa.projectId || "").trim() || undefined;
  const clientEmail = String(sa.client_email || sa.clientEmail || "").trim() || undefined;
  let privateKey = String(sa.private_key || sa.privateKey || "").trim() || undefined;
  if (privateKey) privateKey = normalizePrivateKey(privateKey);

  if (!privateKey) {
    throw new Error("JSON is missing private_key — download a new service account key from Firebase");
  }
  return { projectId, clientEmail, privateKey };
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
