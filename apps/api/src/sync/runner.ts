import { prisma } from "../lib.js";
import {
  syncEnabled,
  pingFirestore,
  credentialsConfigured,
  getUserSyncPreferenceCached,
  loadUserSyncPreference,
  persistUserSyncPreference,
} from "./firestoreAdmin.js";
import { pushAllToFirestore } from "./push.js";
import { pullAllFromFirestore } from "./pull.js";
import { ensureSyncState, pendingOutboxCount } from "./outbox.js";

let intervalHandle: ReturnType<typeof setInterval> | null = null;
let pushInFlight = false;

export async function getSyncStatus() {
  if (getUserSyncPreferenceCached() === null) {
    await loadUserSyncPreference();
  }

  const credentials = credentialsConfigured();
  const userEnabled = getUserSyncPreferenceCached() === true;
  const enabled = syncEnabled();
  const state = await ensureSyncState().catch(() => null);
  const pending = await pendingOutboxCount().catch(() => 0);

  let cloudReachable: boolean | null = null;
  if (credentials) {
    cloudReachable = await pingFirestore();
  }

  let connectionMode: "not-configured" | "offline" | "auto-sync" = "not-configured";
  if (credentials) connectionMode = enabled ? "auto-sync" : "offline";

  return {
    enabled,
    credentialsConfigured: credentials,
    userEnabled,
    connectionMode,
    cloudReachable,
    pendingOutbox: pending,
    status: enabled ? state?.status ?? "idle" : "disabled",
    lastPushAt: state?.lastPushAt ?? null,
    lastPullAt: state?.lastPullAt ?? null,
    lastError: state?.lastError ?? null,
    intervalMinutes: Number(process.env.SYNC_INTERVAL_MINUTES || 5),
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || null,
  };
}

export async function setAutoSyncEnabled(enabled: boolean) {
  if (enabled && !credentialsConfigured()) {
    throw new Error(
      "Cloud credentials missing. Add FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY to desktop.env, then restart the app."
    );
  }
  await persistUserSyncPreference(enabled);
  if (enabled) {
    startSyncInterval({ forceRestart: true });
    // Immediate push so web sees new data without waiting for interval
    void runPush().catch((e) => console.error("[sync] Toggle push failed:", e instanceof Error ? e.message : e));
  } else {
    stopSyncInterval();
    await prisma.syncState
      .update({
        where: { id: 1 },
        data: { status: "disabled", lastError: null },
      })
      .catch(() => undefined);
  }
  return getSyncStatus();
}

export async function runPush() {
  if (!syncEnabled()) throw new Error("Cloud auto-sync is turned off");
  if (pushInFlight) throw new Error("Sync already in progress");
  pushInFlight = true;
  try {
    return await pushAllToFirestore();
  } finally {
    pushInFlight = false;
  }
}

export async function runPull(force = false) {
  if (!syncEnabled()) throw new Error("Cloud auto-sync is turned off");
  return pullAllFromFirestore({ force });
}

export function startSyncInterval(opts?: { forceRestart?: boolean }) {
  if (!syncEnabled()) return;
  if (intervalHandle) {
    if (!opts?.forceRestart) return;
    stopSyncInterval();
  }
  const minutes = Math.max(1, Number(process.env.SYNC_INTERVAL_MINUTES || 5));
  const ms = minutes * 60 * 1000;
  console.log(`[sync] Auto-push every ${minutes}m (cloud sync ON)`);
  intervalHandle = setInterval(() => {
    void (async () => {
      if (!syncEnabled()) return;
      try {
        const ok = await pingFirestore();
        if (!ok) {
          await prisma.syncState
            .update({
              where: { id: 1 },
              data: { status: "offline", lastError: "Cloud unreachable" },
            })
            .catch(() => undefined);
          return;
        }
        await runPush();
        console.log("[sync] Auto-push OK");
      } catch (e) {
        console.error("[sync] Auto-push failed:", e instanceof Error ? e.message : e);
      }
    })();
  }, ms);
  setTimeout(() => {
    if (!syncEnabled()) return;
    void runPush().catch((e) => console.error("[sync] Initial push failed:", e instanceof Error ? e.message : e));
  }, 15_000);
}

export function stopSyncInterval() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log("[sync] Auto-push stopped");
  }
}

export { loadUserSyncPreference };
