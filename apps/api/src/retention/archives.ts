import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { prisma } from "../lib.js";
import {
  annualArchivePath,
  archivesRoot,
  archivesSupported,
  liveSqlitePath,
  monthlyArchivePath,
  previousYearMonth,
  yearMonthKey,
} from "./paths.js";

export type ArchiveFileInfo = {
  kind: "monthly" | "annual";
  file: string;
  relative: string;
  path: string;
  size: number;
  size_mb: number;
  created_at: string;
  period: string;
};

function copySqliteFile(src: string, dest: string) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  return prisma
    .$executeRawUnsafe(`VACUUM INTO '${dest.replace(/\\/g, "/").replace(/'/g, "''")}'`)
    .then(() => {
      if (!fs.existsSync(dest) || fs.statSync(dest).size < 1024) {
        throw new Error("VACUUM INTO produced empty file");
      }
    })
    .catch(() => {
      fs.copyFileSync(src, dest);
      for (const suffix of ["-wal", "-shm"]) {
        const side = src + suffix;
        if (fs.existsSync(side)) {
          try {
            fs.copyFileSync(side, dest + suffix);
          } catch {
            /* ignore */
          }
        }
      }
      if (!fs.existsSync(dest) || fs.statSync(dest).size < 1024) {
        throw new Error("SQLite copy failed");
      }
    });
}

export async function createMonthlyArchive(period?: string): Promise<ArchiveFileInfo> {
  if (!archivesSupported()) {
    throw new Error("SQLite archives are only available on the shop PC (not Vercel cloud demo)");
  }
  const ym = period || yearMonthKey();
  if (!/^\d{4}-\d{2}$/.test(ym)) throw new Error("Invalid period (YYYY-MM)");
  const dest = monthlyArchivePath(ym);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 1024) {
    return fileInfo("monthly", dest, ym);
  }
  const src = liveSqlitePath();
  if (!src || !fs.existsSync(src)) throw new Error("Live SQLite database not found");
  await copySqliteFile(src, dest);
  await prisma.setting.upsert({
    where: { key: "last_sqlite_archive_at" },
    create: { key: "last_sqlite_archive_at", value: new Date().toISOString() },
    update: { value: new Date().toISOString() },
  });
  await prisma.setting.upsert({
    where: { key: "last_sqlite_archive_period" },
    create: { key: "last_sqlite_archive_period", value: ym },
    update: { value: ym },
  });
  return fileInfo("monthly", dest, ym);
}

export async function createAnnualArchive(year?: number): Promise<ArchiveFileInfo> {
  if (!archivesSupported()) {
    throw new Error("SQLite archives are only available on the shop PC (not Vercel cloud demo)");
  }
  const y = year ?? new Date().getFullYear();
  const dest = annualArchivePath(y);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 1024) {
    return fileInfo("annual", dest, String(y));
  }
  const src = liveSqlitePath();
  if (!src || !fs.existsSync(src)) throw new Error("Live SQLite database not found");
  await copySqliteFile(src, dest);
  return fileInfo("annual", dest, String(y));
}

function fileInfo(kind: "monthly" | "annual", full: string, period: string): ArchiveFileInfo {
  const st = fs.statSync(full);
  const root = archivesRoot();
  return {
    kind,
    file: path.basename(full),
    relative: path.relative(root, full).replace(/\\/g, "/"),
    path: full,
    size: st.size,
    size_mb: Number((st.size / (1024 * 1024)).toFixed(2)),
    created_at: st.mtime.toISOString(),
    period,
  };
}

export function listSqliteArchives(): ArchiveFileInfo[] {
  if (!archivesSupported()) return [];
  const root = archivesRoot();
  const out: ArchiveFileInfo[] = [];
  for (const kind of ["monthly", "annual"] as const) {
    const dir = path.join(root, kind);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (!/\.sqlite$/i.test(name)) continue;
      const full = path.join(dir, name);
      const st = fs.statSync(full);
      const m = name.match(/backup_(\d{4}(?:-\d{2})?)/i);
      out.push({
        kind,
        file: name,
        relative: path.relative(root, full).replace(/\\/g, "/"),
        path: full,
        size: st.size,
        size_mb: Number((st.size / (1024 * 1024)).toFixed(2)),
        created_at: st.mtime.toISOString(),
        period: m?.[1] || name,
      });
    }
  }
  return out.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function monthlyArchiveExists(yearMonth: string): boolean {
  const p = monthlyArchivePath(yearMonth);
  return fs.existsSync(p) && fs.statSync(p).size > 1024;
}

/**
 * Ensure current month archive exists; on Jan (or first run of year) also annual.
 * Returns whether a new monthly archive was created this call.
 */
export async function ensurePeriodArchives(): Promise<{
  monthly: ArchiveFileInfo | null;
  annual: ArchiveFileInfo | null;
  createdMonthly: boolean;
}> {
  if (!archivesSupported()) {
    return { monthly: null, annual: null, createdMonthly: false };
  }
  const now = new Date();
  const ym = yearMonthKey(now);
  const hadMonthly = monthlyArchiveExists(ym);
  const monthly = await createMonthlyArchive(ym);
  let annual: ArchiveFileInfo | null = null;
  // Year-end snapshot: create/refresh annual for current year on Jan 1–7 or if missing
  if (now.getMonth() === 0 || !fs.existsSync(annualArchivePath(now.getFullYear()))) {
    try {
      annual = await createAnnualArchive(now.getFullYear());
    } catch (e) {
      console.warn("[archive] annual failed:", e instanceof Error ? e.message : e);
    }
  }
  return { monthly, annual, createdMonthly: !hadMonthly };
}

/** Open a short-lived read-only Prisma client against an archive SQLite file. */
export function openArchivePrisma(sqlitePath: string): PrismaClient {
  const normalized = path.resolve(sqlitePath).replace(/\\/g, "/");
  const url = `file:${normalized}?mode=ro`;
  return new PrismaClient({
    datasources: { db: { url } },
    log: [],
  });
}

export { previousYearMonth, yearMonthKey, monthlyArchivePath };
