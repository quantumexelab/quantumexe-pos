import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  CloudUpload,
  Database,
  Download,
  FileArchive,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import api from "../api";
import { ErrorBox } from "../components/ui";

type BackupFile = {
  file: string;
  size: number;
  size_mb: number;
  created_at: string;
};

type SqliteArchive = {
  kind: "monthly" | "annual";
  file: string;
  relative: string;
  size_mb: number;
  created_at: string;
  period: string;
};

type Retention = {
  cloudRetentionMonths: number;
  retentionOff: boolean;
  archivesSupported: boolean;
  lastCloudPurgeAt: string | null;
  lastCloudPurgeCount: number | null;
  lastCloudPurgeError: string | null;
  lastSqliteArchiveAt: string | null;
  lastSqliteArchivePeriod: string | null;
  previousMonthArchiveReady: boolean;
  cutoffPreview: string | null;
};

type Summary = {
  total_files: number;
  total_size_mb: number;
  last_backup_at: string | null;
  status: string;
  retention_days: number;
  schedule: string;
  auto_backup: boolean;
  cloud_retention_months?: number;
  last_cloud_purge_at?: string | null;
  archives_supported?: boolean;
  sqlite_archive_count?: number;
};

type SearchHit = {
  source: string;
  kind: string;
  id: number | string;
  label: string;
  sub?: string;
  createdAt?: string | null;
};

function formatWhen(iso?: string | null) {
  if (!iso) return "Never";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function relativeAgo(iso?: string | null) {
  if (!iso) return "Never";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return formatWhen(iso);
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function nextDailyRun(hour = 17) {
  const next = new Date();
  next.setHours(hour, 0, 0, 0);
  if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);
  return next.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function BackupPage() {
  const [files, setFiles] = useState<BackupFile[]>([]);
  const [sqliteArchives, setSqliteArchives] = useState<SqliteArchive[]>([]);
  const [retention, setRetention] = useState<Retention | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [purging, setPurging] = useState(false);

  const [searchQ, setSearchQ] = useState("");
  const [searchFrom, setSearchFrom] = useState("");
  const [searchTo, setSearchTo] = useState("");
  const [includeArchives, setIncludeArchives] = useState(true);
  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [archivesScanned, setArchivesScanned] = useState(0);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/backup/list");
      const payload = data.data || {};
      setFiles(payload.files || []);
      setSqliteArchives(payload.sqliteArchives || []);
      setRetention(payload.retention || null);
      setSummary(payload.summary || null);
    } catch (e: any) {
      setError(e.message || "Failed to load backups");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createBackup() {
    setCreating(true);
    setError("");
    setMsg("");
    try {
      const { data } = await api.post("/backup/export");
      setMsg(data.message || "Backup created");
      await load();
    } catch (e: any) {
      setError(e.message || "Failed to create backup");
    } finally {
      setCreating(false);
    }
  }

  async function createSqliteArchive(kind: "monthly" | "annual") {
    setArchiving(true);
    setError("");
    setMsg("");
    try {
      const { data } = await api.post("/backup/archive", { kind });
      setMsg(data.message || "SQLite archive created");
      await load();
    } catch (e: any) {
      setError(e.message || "Failed to create SQLite archive");
    } finally {
      setArchiving(false);
    }
  }

  async function runCloudPurge() {
    if (!confirm("Purge cloud data older than the retention window? Local SQLite is not deleted.")) return;
    setPurging(true);
    setError("");
    setMsg("");
    try {
      const { data } = await api.post("/backup/purge-cloud");
      setMsg(data.message || "Purge done");
      await load();
    } catch (e: any) {
      setError(e.message || "Cloud purge failed");
    } finally {
      setPurging(false);
    }
  }

  async function removeBackup(file: string) {
    if (!confirm(`Delete ${file}?`)) return;
    setError("");
    setMsg("");
    try {
      await api.delete(`/backup/${encodeURIComponent(file)}`);
      setMsg("Backup deleted");
      await load();
    } catch (e: any) {
      setError(e.message || "Failed to delete backup");
    }
  }

  async function runArchiveSearch(e?: FormEvent) {
    e?.preventDefault();
    if (!searchQ.trim()) return;
    setSearching(true);
    setError("");
    try {
      const { data } = await api.get("/archive/search", {
        params: {
          q: searchQ.trim(),
          from: searchFrom || undefined,
          to: searchTo || undefined,
          includeArchives: includeArchives ? "1" : "0",
        },
      });
      setSearchHits(data.data?.hits || []);
      setArchivesScanned(data.data?.archivesScanned || 0);
      if (!data.data?.archivesSupported && includeArchives) {
        setMsg("Archive search runs on the shop Windows PC — cloud demo has no durable archives.");
      }
    } catch (err: any) {
      setError(err.message || "Archive search failed");
    } finally {
      setSearching(false);
    }
  }

  const cards = useMemo(
    () => [
      {
        label: "Last Backup",
        value: relativeAgo(summary?.last_backup_at),
        icon: Clock,
        iconClass: "text-sky-600 bg-sky-50",
      },
      {
        label: "Total Size",
        value: `${(summary?.total_size_mb ?? 0).toFixed(2)} MB`,
        icon: Database,
        iconClass: "text-emerald-600 bg-emerald-50",
      },
      {
        label: "SQLite Archives",
        value: String(sqliteArchives.length),
        icon: FileArchive,
        iconClass: "text-sky-600 bg-sky-50",
      },
      {
        label: "Cloud Retention",
        value:
          retention?.retentionOff || (retention?.cloudRetentionMonths ?? 12) === 0
            ? "Off"
            : `${retention?.cloudRetentionMonths ?? summary?.cloud_retention_months ?? 12} mo`,
        icon: ShieldCheck,
        iconClass: "text-sky-600 bg-sky-50",
        valueClass: "text-emerald-600",
      },
    ],
    [summary, sqliteArchives.length, retention]
  );

  const monthly = sqliteArchives.filter((a) => a.kind === "monthly");
  const annual = sqliteArchives.filter((a) => a.kind === "annual");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">System Backup</h1>
        <p className="text-sm text-gray-500 mt-1">
          JSON snapshots, monthly/annual SQLite archives, and cloud retention status.
        </p>
      </div>

      {error && <ErrorBox text={error} />}
      {msg && <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">{msg}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-3">
            <div className={`w-10 h-10 rounded-lg grid place-items-center shrink-0 ${c.iconClass}`}>
              <c.icon size={18} />
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-500">{c.label}</div>
              <div className={`mt-1 text-lg font-bold text-gray-900 ${c.valueClass || ""}`}>{c.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <div className="text-sm font-bold text-gray-900">Cloud retention status</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
          <div>
            <div className="text-xs text-gray-500">Keep cloud for</div>
            <div className="font-semibold">
              {(retention?.cloudRetentionMonths ?? 12) === 0
                ? "Forever (off)"
                : `${retention?.cloudRetentionMonths ?? 12} months`}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Last cloud purge</div>
            <div className="font-semibold">{formatWhen(retention?.lastCloudPurgeAt)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Docs removed (last)</div>
            <div className="font-semibold">{retention?.lastCloudPurgeCount ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Last SQLite archive</div>
            <div className="font-semibold">
              {retention?.lastSqliteArchivePeriod || "—"} · {relativeAgo(retention?.lastSqliteArchiveAt)}
            </div>
          </div>
        </div>
        {retention?.lastCloudPurgeError ? (
          <div className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            {retention.lastCloudPurgeError}
          </div>
        ) : null}
        {!retention?.archivesSupported ? (
          <div className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
            SQLite archives and cloud purge run on the shop Windows PC. Vercel cloud demo cannot store multi‑GB
            archives.
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={archiving || !retention?.archivesSupported}
            onClick={() => void createSqliteArchive("monthly")}
            className="h-9 px-3 rounded-lg border border-gray-200 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
          >
            Create monthly SQLite archive
          </button>
          <button
            type="button"
            disabled={archiving || !retention?.archivesSupported}
            onClick={() => void createSqliteArchive("annual")}
            className="h-9 px-3 rounded-lg border border-gray-200 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
          >
            Create annual SQLite archive
          </button>
          <button
            type="button"
            disabled={purging || !retention?.archivesSupported}
            onClick={() => void runCloudPurge()}
            className="h-9 px-3 rounded-lg border border-amber-200 text-amber-900 text-sm font-semibold hover:bg-amber-50 disabled:opacity-50"
          >
            {purging ? "Purging…" : "Run cloud purge now"}
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Search size={18} className="text-sky-600" />
          <div className="text-sm font-bold text-gray-900">Archive search</div>
        </div>
        <p className="text-sm text-gray-500">
          Search live database plus monthly/annual SQLite archives (invoices, customers, products, GRNs).
        </p>
        <form onSubmit={(e) => void runArchiveSearch(e)} className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[12rem]">
            <label className="text-xs text-gray-500">Query</label>
            <input
              className="input w-full"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Invoice no, name, phone, product code…"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">From</label>
            <input className="input" type="date" value={searchFrom} onChange={(e) => setSearchFrom(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500">To</label>
            <input className="input" type="date" value={searchTo} onChange={(e) => setSearchTo(e.target.value)} />
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700 h-10 px-2">
            <input
              type="checkbox"
              checked={includeArchives}
              onChange={(e) => setIncludeArchives(e.target.checked)}
            />
            Include archives
          </label>
          <button
            type="submit"
            disabled={searching || !searchQ.trim()}
            className="h-10 px-4 rounded-lg bg-sky-600 text-white text-sm font-semibold disabled:opacity-50"
          >
            {searching ? "Searching…" : "Search"}
          </button>
        </form>
        {archivesScanned > 0 && (
          <div className="text-xs text-gray-500">Scanned {archivesScanned} archive file(s)</div>
        )}
        <div className="divide-y divide-gray-100 max-h-72 overflow-auto border border-gray-100 rounded-lg">
          {searchHits.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-gray-500">No results yet.</div>
          )}
          {searchHits.map((h) => (
            <div key={`${h.source}-${h.kind}-${h.id}`} className="px-4 py-2.5 flex items-center gap-3 text-sm">
              <span
                className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0 ${
                  h.source === "live" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700"
                }`}
              >
                {h.source}
              </span>
              <span className="text-[10px] font-semibold text-gray-400 uppercase w-16 shrink-0">{h.kind}</span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-gray-900 truncate">{h.label}</div>
                {h.sub ? <div className="text-xs text-gray-500 truncate">{h.sub}</div> : null}
              </div>
              <div className="text-xs text-gray-400 shrink-0">{h.createdAt ? formatWhen(h.createdAt) : ""}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <CloudUpload size={18} className="text-emerald-600" />
              <div className="text-sm font-bold text-gray-900">Create Backup</div>
            </div>
            <p className="text-sm text-gray-500">Generate a JSON settings snapshot on-demand.</p>
            <button
              type="button"
              onClick={createBackup}
              disabled={creating}
              className="w-full h-11 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <Plus size={16} />
              {creating ? "Creating…" : "Create Backup Now"}
            </button>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="w-full h-11 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 inline-flex items-center justify-center gap-2 hover:bg-gray-50"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Refresh Status & List
            </button>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Clock size={18} className="text-orange-500" />
              <div className="text-sm font-bold text-gray-900">Automated Schedule</div>
            </div>

            <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
              <div className="flex items-start gap-2">
                <CheckCircle2 size={18} className="text-emerald-600 mt-0.5 shrink-0" />
                <div className="text-sm text-emerald-900">
                  <span className="font-bold">Auto-Backup Active</span>
                  <span className="text-emerald-800"> — Daily JSON + monthly SQLite archive on the shop PC.</span>
                  <div className="mt-2 text-xs font-semibold tracking-wide text-emerald-800 space-y-1">
                    <div>SCHEDULE: {summary?.schedule || "Daily JSON + monthly SQLite archive"}</div>
                    <div>NEXT JSON RUN: {nextDailyRun(17)}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
              <div className="flex items-start gap-2">
                <AlertTriangle size={18} className="text-amber-600 mt-0.5 shrink-0" />
                <div className="text-sm text-amber-900">
                  <span className="font-bold">Retention Policy</span>
                  <span className="text-amber-800">
                    {" "}
                    — JSON snapshots kept {summary?.retention_days ?? 7} days. Cloud data kept{" "}
                    {(retention?.cloudRetentionMonths ?? 12) === 0
                      ? "forever"
                      : `${retention?.cloudRetentionMonths ?? 12} months`}{" "}
                    after a successful local archive. Local SQLite history is never wiped by retention.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileArchive size={18} className="text-gray-600" />
                <div className="text-sm font-bold text-gray-900">JSON Snapshots</div>
              </div>
              <span className="text-[11px] font-bold tracking-wide text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                {files.length} FILES
              </span>
            </div>

            <div className="divide-y divide-gray-100 max-h-[280px] overflow-auto">
              {files.length === 0 && (
                <div className="px-5 py-10 text-center text-sm text-gray-500">No JSON backups yet.</div>
              )}
              {files.map((f) => (
                <div key={f.file} className="px-5 py-3.5 flex items-center gap-3 hover:bg-gray-50">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 grid place-items-center shrink-0">
                    <FileArchive size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-gray-900 truncate">{f.file}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {(f.size_mb ?? 0).toFixed(2)} MB • {formatWhen(f.created_at)}
                    </div>
                  </div>
                  <button
                    type="button"
                    title="Delete backup"
                    onClick={() => removeBackup(f.file)}
                    className="w-9 h-9 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 grid place-items-center"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Database size={18} className="text-gray-600" />
                <div className="text-sm font-bold text-gray-900">SQLite Archives</div>
              </div>
              <span className="text-[11px] font-bold tracking-wide text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                {sqliteArchives.length} FILES
              </span>
            </div>
            <div className="divide-y divide-gray-100 max-h-[320px] overflow-auto">
              {sqliteArchives.length === 0 && (
                <div className="px-5 py-10 text-center text-sm text-gray-500">
                  No monthly/annual SQLite archives yet.
                </div>
              )}
              {[...monthly, ...annual].map((a) => (
                <div key={a.relative} className="px-5 py-3.5 flex items-center gap-3 hover:bg-gray-50">
                  <div className="w-10 h-10 rounded-lg bg-sky-50 text-sky-600 grid place-items-center shrink-0">
                    <Database size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-gray-900 truncate">
                      {a.kind === "monthly" ? "Monthly" : "Annual"} · {a.period}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {a.file} · {(a.size_mb ?? 0).toFixed(2)} MB · {formatWhen(a.created_at)}
                    </div>
                  </div>
                  <a
                    href={`/api/backup/archives/${a.kind}/${encodeURIComponent(a.file)}`}
                    className="w-9 h-9 rounded-lg text-gray-400 hover:text-sky-600 hover:bg-sky-50 grid place-items-center"
                    title="Download"
                    onClick={(e) => {
                      e.preventDefault();
                      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
                      void api
                        .get(`/backup/archives/${a.kind}/${encodeURIComponent(a.file)}`, {
                          responseType: "blob",
                        })
                        .then((res) => {
                          const url = URL.createObjectURL(res.data);
                          const link = document.createElement("a");
                          link.href = url;
                          link.download = a.file;
                          link.click();
                          URL.revokeObjectURL(url);
                        })
                        .catch((err: any) => setError(err.message || "Download failed"));
                      void token;
                    }}
                  >
                    <Download size={16} />
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
