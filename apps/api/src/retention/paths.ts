import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** True when running on ephemeral Vercel — archives cannot be stored durably. */
export function archivesSupported(): boolean {
  return process.env.VERCEL !== "1" && process.env.USE_FIRESTORE !== "1";
}

/**
 * Root for backups/archives.
 * Desktop can set BACKUP_DIR / ARCHIVES_DIR under userData.
 */
export function backupRoot(): string {
  if (process.env.ARCHIVES_DIR?.trim()) {
    const root = path.resolve(process.env.ARCHIVES_DIR.trim());
    fs.mkdirSync(root, { recursive: true });
    return root;
  }
  if (process.env.BACKUP_DIR?.trim()) {
    const root = path.resolve(process.env.BACKUP_DIR.trim());
    fs.mkdirSync(root, { recursive: true });
    return root;
  }
  if (process.env.VERCEL) {
    const root = path.join("/tmp", "quantumexe-backups");
    fs.mkdirSync(root, { recursive: true });
    return root;
  }
  const root = path.resolve(__dirname, "../../backups");
  fs.mkdirSync(root, { recursive: true });
  return root;
}

export function archivesRoot(): string {
  const root = path.join(backupRoot(), "archives");
  fs.mkdirSync(path.join(root, "monthly"), { recursive: true });
  fs.mkdirSync(path.join(root, "annual"), { recursive: true });
  return root;
}

export function monthlyArchivePath(yearMonth: string): string {
  return path.join(archivesRoot(), "monthly", `backup_${yearMonth}.sqlite`);
}

export function annualArchivePath(year: string | number): string {
  return path.join(archivesRoot(), "annual", `backup_${year}.sqlite`);
}

/** Resolve the live SQLite file from DATABASE_URL (file:…). */
export function liveSqlitePath(): string | null {
  const url = process.env.DATABASE_URL || "";
  if (!url.startsWith("file:")) return null;
  let filePart = url.slice("file:".length);
  // Prisma: file:./dev.db or file:C:/path or file:/absolute
  if (filePart.startsWith("//")) filePart = filePart.slice(2);
  if (process.platform === "win32" && /^\/[A-Za-z]:/.test(filePart)) {
    filePart = filePart.slice(1);
  }
  const resolved = path.resolve(
    filePart.startsWith(".")
      ? path.resolve(process.cwd(), filePart)
      : filePart
  );
  // Common monorepo default when URL is relative to prisma folder
  const candidates = [
    resolved,
    path.resolve(__dirname, "../../prisma/dev.db"),
    path.resolve(process.cwd(), "prisma/dev.db"),
    path.resolve(process.cwd(), "apps/api/prisma/dev.db"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return fs.existsSync(resolved) ? resolved : candidates[1];
}

export function yearMonthKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Previous calendar month as YYYY-MM. */
export function previousYearMonth(d = new Date()): string {
  const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  return yearMonthKey(prev);
}
