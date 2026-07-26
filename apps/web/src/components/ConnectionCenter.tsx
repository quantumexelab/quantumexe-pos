import { useCallback, useEffect, useState } from "react";
import {
  Cloud,
  CloudOff,
  Database,
  RefreshCw,
  Wifi,
  WifiOff,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { syncApi, type SyncStatus } from "../api";
import { ErrorBox } from "./ui";

function Switch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-50 ${
        checked ? "bg-emerald-600" : "bg-slate-300"
      }`}
    >
      <span
        className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition ${
          checked ? "translate-x-7" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function formatWhen(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export default function ConnectionCenter() {
  const [sync, setSync] = useState<SyncStatus | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const s = await syncApi.status();
      setSync(s);
      setCheckedAt(new Date());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load sync status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const t = setInterval(() => void refresh(), 30_000);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      clearInterval(t);
    };
  }, [refresh]);

  async function toggleAuto(enabled: boolean) {
    setToggling(true);
    setError("");
    setMsg("");
    try {
      const s = await syncApi.setAuto(enabled);
      setSync(s);
      setMsg(enabled ? "Cloud auto-sync is ON — local data will push to the web backup." : "Cloud auto-sync is OFF — app stays local only.");
      setCheckedAt(new Date());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to update sync");
      await refresh();
    } finally {
      setToggling(false);
    }
  }

  async function syncNow() {
    setSyncing(true);
    setError("");
    setMsg("");
    try {
      await syncApi.push();
      await refresh();
      setMsg("Manual sync completed.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Sync failed");
      await refresh();
    } finally {
      setSyncing(false);
    }
  }

  const credentials = sync?.credentialsConfigured === true;
  const autoOn = sync?.enabled === true;
  const cloudOk = sync?.cloudReachable === true;
  const modeLabel = !credentials ? "Not configured" : autoOn ? "Auto-sync" : "Offline";
  const internetLabel = !online ? "Offline" : cloudOk ? "Good" : credentials ? "Limited" : "Online";

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="relative bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 px-5 py-5 text-white">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold tracking-[0.2em] text-emerald-300/90">CONNECTION CENTER</div>
            <h2 className="mt-1 text-xl font-bold tracking-tight">Database Connection Manager</h2>
            <p className="mt-1 max-w-xl text-sm text-slate-300">
              Turn cloud auto-sync on or off. When ON, this PC keeps pushing sales and users to the web backup.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold">
              {autoOn ? <CheckCircle2 size={12} className="text-emerald-300" /> : <CloudOff size={12} />}
              {autoOn ? "Auto-sync on" : "Local / offline mode"}
            </span>
            {credentials && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold">
                <Clock size={12} /> Every {sync?.intervalMinutes ?? 5} min
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {error && <ErrorBox text={error} />}
        {msg && (
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{msg}</div>
        )}

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
            <div className="flex items-start justify-between">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  online ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                }`}
              >
                {online ? <Wifi size={20} /> : <WifiOff size={20} />}
              </div>
              <button
                type="button"
                onClick={() => void refresh()}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-700"
                title="Refresh"
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
            <div className="mt-3 text-lg font-bold text-slate-900">
              Internet <span className="text-slate-500">{internetLabel}</span>
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {checkedAt ? `Checked ${checkedAt.toLocaleTimeString()}` : "Not checked yet"}
            </div>
            <p className="mt-2 text-sm text-slate-600">
              {online
                ? cloudOk
                  ? "Browser online and cloud reachable."
                  : credentials
                    ? "Browser online; cloud ping pending or unreachable."
                    : "Browser online."
                : "No network — sales still save on this PC."}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-200 text-slate-700">
              {autoOn ? <Cloud size={20} className="text-emerald-700" /> : <CloudOff size={20} />}
            </div>
            <div className="mt-3 text-lg font-bold text-slate-900">
              Current mode <span className="text-slate-500">{modeLabel}</span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-white bg-white px-3 py-2.5">
              <div>
                <div className="text-sm font-semibold text-slate-800">Cloud auto-sync</div>
                <div className="text-xs text-slate-500">
                  {autoOn ? "Entries sync to web backup" : "Entries stay on this PC only"}
                </div>
              </div>
              <Switch checked={autoOn} disabled={toggling || !credentials} onChange={(v) => void toggleAuto(v)} />
            </div>
            {!credentials && (
              <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-700">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                Add Firebase keys in desktop.env, restart the app, then turn this ON.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                credentials ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
              }`}
            >
              <Database size={20} />
            </div>
            <div className="mt-3 text-lg font-bold text-slate-900">
              Online DB <span className="text-slate-500">{credentials ? "Configured" : "Not configured"}</span>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              {credentials
                ? `Project: ${sync?.projectId || "quantumexe-pos-test"}`
                : "Add connection details to enable sync."}
            </p>
            {sync?.lastError && (
              <p className="mt-2 text-xs text-red-600" title={sync.lastError}>
                Last error: {sync.lastError.slice(0, 120)}
              </p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-slate-900">Sync overview</div>
              <div className="text-xs text-slate-500">Live counters from this shop PC</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void refresh()}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh data
              </button>
              <button
                type="button"
                disabled={!autoOn || syncing || !online}
                onClick={() => void syncNow()}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <Cloud size={14} className={syncing ? "animate-pulse" : ""} />
                {syncing ? "Syncing…" : "Sync now"}
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3">
              <div className="text-2xl font-bold text-amber-800">{sync?.pendingOutbox ?? 0}</div>
              <div className="text-xs font-semibold text-amber-900/80">Pending sync</div>
              <div className="mt-1 text-[11px] text-amber-800/70">Queued changes waiting</div>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
              <div className="text-2xl font-bold text-emerald-800">
                {sync?.status === "ok" || sync?.lastPushAt ? "OK" : "—"}
              </div>
              <div className="text-xs font-semibold text-emerald-900/80">Sync health</div>
              <div className="mt-1 text-[11px] text-emerald-800/70">{sync?.status || "idle"}</div>
            </div>
            <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-3">
              <div className="truncate text-lg font-bold text-sky-900">{formatWhen(sync?.lastPushAt)}</div>
              <div className="text-xs font-semibold text-sky-900/80">Last push</div>
              <div className="mt-1 text-[11px] text-sky-800/70">Local → cloud</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="truncate text-lg font-bold text-slate-800">{formatWhen(sync?.lastPullAt)}</div>
              <div className="text-xs font-semibold text-slate-700">Last pull</div>
              <div className="mt-1 text-[11px] text-slate-500">Cloud → local</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
