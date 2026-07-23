import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  CloudUpload,
  Database,
  FileArchive,
  Plus,
  RefreshCw,
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

type Summary = {
  total_files: number;
  total_size_mb: number;
  last_backup_at: string | null;
  status: string;
  retention_days: number;
  schedule: string;
  auto_backup: boolean;
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
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/backup/list");
      const payload = data.data || {};
      setFiles(payload.files || []);
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
        label: "Total Files",
        value: String(summary?.total_files ?? 0),
        icon: FileArchive,
        iconClass: "text-sky-600 bg-sky-50",
      },
      {
        label: "Status",
        value: summary?.status || "—",
        icon: ShieldCheck,
        iconClass: "text-sky-600 bg-sky-50",
        valueClass: "text-emerald-600",
      },
    ],
    [summary]
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">System Backup</h1>
        <p className="text-sm text-gray-500 mt-1">Manage automated backups and download your database archives.</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <CloudUpload size={18} className="text-emerald-600" />
              <div className="text-sm font-bold text-gray-900">Create Backup</div>
            </div>
            <p className="text-sm text-gray-500">Generate a complete database backup on-demand.</p>
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
                  <span className="text-emerald-800"> — Daily automated backup is enabled.</span>
                  <div className="mt-2 text-xs font-semibold tracking-wide text-emerald-800 space-y-1">
                    <div>SCHEDULE: {summary?.schedule || "Daily at 5:00 PM"}</div>
                    <div>NEXT RUN: {nextDailyRun(17)}</div>
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
                    — System keeps backups for {summary?.retention_days ?? 7} days. Older backups will be automatically
                    purged to save storage space.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileArchive size={18} className="text-gray-600" />
              <div className="text-sm font-bold text-gray-900">Available Archives</div>
            </div>
            <span className="text-[11px] font-bold tracking-wide text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              {files.length} FILES
            </span>
          </div>

          <div className="divide-y divide-gray-100 max-h-[560px] overflow-auto">
            {files.length === 0 && (
              <div className="px-5 py-10 text-center text-sm text-gray-500">No backup archives yet.</div>
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
      </div>
    </div>
  );
}
