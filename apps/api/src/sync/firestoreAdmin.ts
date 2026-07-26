import admin from "firebase-admin";
import type { Firestore } from "firebase-admin/firestore";

const PREF_KEY = "cloud_sync_enabled";

/** Cached Super-Admin preference. null = not loaded yet (fall back to env). */
let userEnabledCache: boolean | null = null;

export function credentialsConfigured(): boolean {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()) return true;
  const email = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const key = process.env.FIREBASE_PRIVATE_KEY?.trim();
  return Boolean(email && key);
}

export function getUserSyncPreferenceCached(): boolean | null {
  return userEnabledCache;
}

/** Effective auto-sync: Firebase keys present AND Super-Admin switch ON. */
export function syncEnabled(): boolean {
  if (!credentialsConfigured()) return false;
  if (userEnabledCache === null) return process.env.SYNC_TO_FIRESTORE === "1";
  return userEnabledCache;
}

export async function loadUserSyncPreference(): Promise<boolean> {
  const { prisma } = await import("../lib.js");
  const row = await prisma.setting.findUnique({ where: { key: PREF_KEY } });
  if (row) {
    userEnabledCache = row.value === "1" || row.value.toLowerCase() === "true";
  } else {
    userEnabledCache = process.env.SYNC_TO_FIRESTORE === "1";
  }
  return userEnabledCache;
}

export async function persistUserSyncPreference(enabled: boolean): Promise<void> {
  const { prisma } = await import("../lib.js");
  await prisma.setting.upsert({
    where: { key: PREF_KEY },
    create: { key: PREF_KEY, value: enabled ? "1" : "0" },
    update: { value: enabled ? "1" : "0" },
  });
  // Keep license panel labels in sync with mode
  for (const [key, value] of [
    ["online_access", enabled ? "Yes" : "No"],
    ["db_type", enabled ? "hybrid-cloud" : "offline"],
  ] as const) {
    await prisma.setting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }
  userEnabledCache = enabled;
}

let db: Firestore | null = null;

/** Lazily init Admin SDK for hybrid backup sync (does not switch app off SQLite). */
export function getSyncFirestore(): Firestore {
  if (!credentialsConfigured()) {
    throw new Error("Cloud credentials not configured (FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY)");
  }
  if (db) return db;

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || "quantumexe-pos-test";
  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!admin.apps.length) {
    if (saJson) {
      const cred = JSON.parse(saJson) as admin.ServiceAccount;
      admin.initializeApp({
        credential: admin.credential.cert(cred),
        projectId: (cred as { project_id?: string }).project_id || cred.projectId || projectId,
      });
    } else if (clientEmail && privateKey) {
      admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
        projectId,
      });
    } else {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId,
      });
    }
  }

  db = admin.firestore();
  return db;
}

export async function pingFirestore(): Promise<boolean> {
  if (!credentialsConfigured()) return false;
  try {
    const fs = getSyncFirestore();
    await fs.collection("_sync").doc("ping").set({ t: Date.now() }, { merge: true });
    return true;
  } catch {
    return false;
  }
}
