import { prisma } from "../lib.js";
import { credentialsConfigured, getSyncFirestore, syncEnabled } from "../sync/firestoreAdmin.js";
import { SYNC_COLLECTIONS, type SyncCollection } from "../sync/collections.js";
import { ensurePeriodArchives, monthlyArchiveExists, previousYearMonth } from "./archives.js";
import { archivesSupported } from "./paths.js";

/** Never purge these from cloud (config / access). */
const PURGE_EXCLUDE: ReadonlySet<string> = new Set([
  "Role",
  "Status",
  "License",
  "Setting",
  "SyncState",
  "SyncOutbox",
]);

export function retentionCutoff(months: number, from = new Date()): Date {
  // Start of month, N months ago
  return new Date(from.getFullYear(), from.getMonth() - months, 1, 0, 0, 0, 0);
}

export async function getCloudRetentionMonths(): Promise<number> {
  const row = await prisma.setting.findUnique({ where: { key: "cloud_retention_months" } });
  if (!row) return 12;
  const n = Number(row.value);
  if (![0, 3, 6, 12, 24].includes(n)) return 12;
  return n;
}

async function setSetting(key: string, value: string) {
  await prisma.setting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

async function deleteOlderThan(collection: SyncCollection, cutoffIso: string): Promise<number> {
  const db = getSyncFirestore();
  let deleted = 0;
  // Firestore Timestamps / ISO strings both work with string comparison for ISO dates
  for (;;) {
    const snap = await db.collection(collection).where("createdAt", "<", cutoffIso).limit(400).get();
    if (snap.empty) break;
    const batch = db.batch();
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
    deleted += snap.size;
    if (snap.size < 400) break;
  }
  return deleted;
}

export type PurgeResult = {
  skipped: boolean;
  reason?: string;
  months: number;
  cutoff: string | null;
  deleted: Record<string, number>;
  totalDeleted: number;
};

/**
 * Archive gate then purge Firestore docs older than retention window.
 * Never deletes local SQLite rows.
 */
export async function purgeCloudOlderThanRetention(opts?: {
  forceArchive?: boolean;
}): Promise<PurgeResult> {
  const months = await getCloudRetentionMonths();
  if (months === 0) {
    return { skipped: true, reason: "retention_off", months, cutoff: null, deleted: {}, totalDeleted: 0 };
  }
  if (!credentialsConfigured()) {
    return { skipped: true, reason: "no_credentials", months, cutoff: null, deleted: {}, totalDeleted: 0 };
  }

  // Safety: require previous month's archive on shop PC (or current month for new installs)
  if (archivesSupported()) {
    if (opts?.forceArchive !== false) {
      await ensurePeriodArchives();
    }
    const { yearMonthKey } = await import("./paths.js");
    const prev = previousYearMonth();
    const cur = yearMonthKey();
    if (!monthlyArchiveExists(prev) && !monthlyArchiveExists(cur)) {
      await setSetting("last_cloud_purge_error", `Missing monthly archive for ${prev}`);
      return {
        skipped: true,
        reason: `archive_missing:${prev}`,
        months,
        cutoff: null,
        deleted: {},
        totalDeleted: 0,
      };
    }
  } else {
    return { skipped: true, reason: "archives_not_supported_on_host", months, cutoff: null, deleted: {}, totalDeleted: 0 };
  }

  const cutoff = retentionCutoff(months);
  const cutoffIso = cutoff.toISOString();
  const deleted: Record<string, number> = {};
  let totalDeleted = 0;

  for (const col of SYNC_COLLECTIONS) {
    if (PURGE_EXCLUDE.has(col)) continue;
    try {
      const n = await deleteOlderThan(col, cutoffIso);
      if (n > 0) {
        deleted[col] = n;
        totalDeleted += n;
      }
    } catch (e) {
      console.warn(`[retention] purge ${col} failed:`, e instanceof Error ? e.message : e);
      deleted[col] = -1;
    }
  }

  const now = new Date().toISOString();
  await setSetting("last_cloud_purge_at", now);
  await setSetting("last_cloud_purge_cutoff", cutoffIso);
  await setSetting("last_cloud_purge_count", String(totalDeleted));
  await setSetting("last_cloud_purge_error", "");

  console.log(`[retention] Purged ${totalDeleted} cloud docs older than ${cutoffIso}`);
  return { skipped: false, months, cutoff: cutoffIso, deleted, totalDeleted };
}

export async function getRetentionStatus() {
  const months = await getCloudRetentionMonths();
  const keys = [
    "last_cloud_purge_at",
    "last_cloud_purge_cutoff",
    "last_cloud_purge_count",
    "last_cloud_purge_error",
    "last_sqlite_archive_at",
    "last_sqlite_archive_period",
  ];
  const rows = await prisma.setting.findMany({ where: { key: { in: keys } } });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const cutoff = months > 0 ? retentionCutoff(months).toISOString() : null;
  return {
    cloudRetentionMonths: months,
    retentionOff: months === 0,
    archivesSupported: archivesSupported(),
    syncEnabled: syncEnabled(),
    credentialsConfigured: credentialsConfigured(),
    cutoffPreview: cutoff,
    lastCloudPurgeAt: map.last_cloud_purge_at || null,
    lastCloudPurgeCutoff: map.last_cloud_purge_cutoff || null,
    lastCloudPurgeCount: map.last_cloud_purge_count ? Number(map.last_cloud_purge_count) : null,
    lastCloudPurgeError: map.last_cloud_purge_error || null,
    lastSqliteArchiveAt: map.last_sqlite_archive_at || null,
    lastSqliteArchivePeriod: map.last_sqlite_archive_period || null,
    previousMonthArchiveReady: archivesSupported() ? monthlyArchiveExists(previousYearMonth()) : false,
  };
}
