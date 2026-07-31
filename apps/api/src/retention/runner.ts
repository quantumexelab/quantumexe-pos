import { archivesSupported } from "./paths.js";
import { ensurePeriodArchives } from "./archives.js";
import { purgeCloudOlderThanRetention } from "./purgeCloud.js";

let intervalHandle: ReturnType<typeof setInterval> | null = null;
let running = false;

/**
 * Daily retention tick: ensure monthly/annual SQLite archives, then purge cloud.
 */
export async function runRetentionTick(): Promise<void> {
  if (running) return;
  if (!archivesSupported()) return;
  running = true;
  try {
    const arch = await ensurePeriodArchives();
    if (arch.createdMonthly) {
      console.log(`[retention] Created monthly archive ${arch.monthly?.period}`);
    }
    const purge = await purgeCloudOlderThanRetention({ forceArchive: false });
    if (!purge.skipped) {
      console.log(`[retention] Cloud purge removed ${purge.totalDeleted} docs (cutoff ${purge.cutoff})`);
    } else if (purge.reason && purge.reason !== "retention_off" && purge.reason !== "no_credentials") {
      console.log(`[retention] Purge skipped: ${purge.reason}`);
    }
  } catch (e) {
    console.error("[retention] tick failed:", e instanceof Error ? e.message : e);
  } finally {
    running = false;
  }
}

/** Run once shortly after boot, then every 6 hours (cheap checks). */
export function startRetentionInterval() {
  if (!archivesSupported()) {
    console.log("[retention] Archives disabled on this host (Vercel / cloud-only)");
    return;
  }
  if (intervalHandle) return;
  console.log("[retention] Local SQLite archive + cloud retention scheduler started");
  setTimeout(() => {
    void runRetentionTick();
  }, 45_000);
  intervalHandle = setInterval(() => {
    void runRetentionTick();
  }, 6 * 60 * 60 * 1000);
}

export function stopRetentionInterval() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
