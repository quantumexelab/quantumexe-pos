import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, CheckCircle2, Info, Loader2, X, XCircle } from "lucide-react";
import { createPortal } from "react-dom";

export type ToastKind = "success" | "error" | "warning" | "info" | "loading";

export type ToastItem = {
  id: string;
  kind: ToastKind;
  title?: string;
  message: string;
  duration: number; // 0 = sticky
};

type NotifyApi = {
  push: (kind: ToastKind, message: string, opts?: { title?: string; duration?: number }) => string;
  success: (message: string, opts?: { title?: string; duration?: number }) => string;
  error: (message: string, opts?: { title?: string; duration?: number }) => string;
  warning: (message: string, opts?: { title?: string; duration?: number }) => string;
  info: (message: string, opts?: { title?: string; duration?: number }) => string;
  loading: (message: string, opts?: { title?: string }) => string;
  dismiss: (id: string) => void;
  busy: (on: boolean, message?: string) => void;
};

const DEFAULT_DURATION: Record<ToastKind, number> = {
  success: 3200,
  error: 5200,
  warning: 4500,
  info: 3800,
  loading: 0,
};

let apiRef: NotifyApi | null = null;

function ensureApi(): NotifyApi {
  if (!apiRef) {
    // Fallback before provider mounts (queues nothing; no-op safe)
    return {
      push: () => "",
      success: () => "",
      error: () => "",
      warning: () => "",
      info: () => "",
      loading: () => "",
      dismiss: () => undefined,
      busy: () => undefined,
    };
  }
  return apiRef;
}

/** Call from anywhere (pages, api helpers) — animated popups. */
export const notify: NotifyApi = {
  push: (kind, message, opts) => ensureApi().push(kind, message, opts),
  success: (message, opts) => ensureApi().success(message, opts),
  error: (message, opts) => ensureApi().error(message, opts),
  warning: (message, opts) => ensureApi().warning(message, opts),
  info: (message, opts) => ensureApi().info(message, opts),
  loading: (message, opts) => ensureApi().loading(message, opts),
  dismiss: (id) => ensureApi().dismiss(id),
  busy: (on, message) => ensureApi().busy(on, message),
};

const NotifyContext = createContext<NotifyApi | null>(null);

export function useNotify() {
  const ctx = useContext(NotifyContext);
  return ctx || notify;
}

const KIND_META: Record<
  ToastKind,
  { icon: typeof CheckCircle2; bar: string; bg: string; title: string }
> = {
  success: {
    icon: CheckCircle2,
    bar: "bg-emerald-500",
    bg: "from-emerald-50 to-white",
    title: "Success",
  },
  error: {
    icon: XCircle,
    bar: "bg-rose-500",
    bg: "from-rose-50 to-white",
    title: "Error",
  },
  warning: {
    icon: AlertTriangle,
    bar: "bg-amber-500",
    bg: "from-amber-50 to-white",
    title: "Warning",
  },
  info: {
    icon: Info,
    bar: "bg-sky-500",
    bg: "from-sky-50 to-white",
    title: "Info",
  },
  loading: {
    icon: Loader2,
    bar: "bg-emerald-500",
    bg: "from-emerald-50 to-white",
    title: "Please wait",
  },
};

function uid() {
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function NotifyProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [busy, setBusy] = useState<{ on: boolean; message: string }>({ on: false, message: "Saving…" });
  const timers = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    const t = timers.current.get(id);
    if (t) window.clearTimeout(t);
    timers.current.delete(id);
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string, opts?: { title?: string; duration?: number }) => {
      const trimmed = String(message || "").trim();
      if (!trimmed) return "";
      const id = uid();
      const duration = opts?.duration ?? DEFAULT_DURATION[kind];
      const item: ToastItem = {
        id,
        kind,
        title: opts?.title,
        message: trimmed,
        duration,
      };
      setToasts((prev) => {
        // Dedupe identical open toasts
        const dup = prev.find((p) => p.kind === kind && p.message === trimmed);
        if (dup) return prev;
        return [...prev.slice(-4), item];
      });
      if (duration > 0) {
        const handle = window.setTimeout(() => dismiss(id), duration);
        timers.current.set(id, handle);
      }
      return id;
    },
    [dismiss]
  );

  const api = useMemo<NotifyApi>(
    () => ({
      push,
      success: (message, opts) => push("success", message, opts),
      error: (message, opts) => push("error", message, opts),
      warning: (message, opts) => push("warning", message, opts),
      info: (message, opts) => push("info", message, opts),
      loading: (message, opts) => push("loading", message, { ...opts, duration: 0 }),
      dismiss,
      busy: (on, message = "Saving…") => setBusy({ on, message }),
    }),
    [push, dismiss]
  );

  useEffect(() => {
    apiRef = api;
    return () => {
      if (apiRef === api) apiRef = null;
    };
  }, [api]);

  return (
    <NotifyContext.Provider value={api}>
      {children}
      {createPortal(
        <>
          <div className="qx-toast-stack" aria-live="polite" aria-relevant="additions">
            {toasts.map((t) => {
              const meta = KIND_META[t.kind];
              const Icon = meta.icon;
              return (
                <div key={t.id} className={`qx-toast qx-toast-${t.kind}`} role="status">
                  <div className={`qx-toast-bar ${meta.bar}`} />
                  <div className={`qx-toast-body bg-gradient-to-br ${meta.bg}`}>
                    <div
                      className={`qx-toast-icon ${
                        t.kind === "loading" ? "text-emerald-600" : ""
                      }`}
                    >
                      <Icon
                        size={20}
                        className={t.kind === "loading" ? "animate-spin" : undefined}
                        strokeWidth={2.25}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-gray-900 leading-tight">
                        {t.title || meta.title}
                      </div>
                      <div className="text-sm text-gray-600 mt-0.5 leading-snug break-words">
                        {t.message}
                      </div>
                    </div>
                    {t.kind !== "loading" ? (
                      <button
                        type="button"
                        className="qx-toast-close"
                        aria-label="Dismiss"
                        onClick={() => dismiss(t.id)}
                      >
                        <X size={16} />
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {busy.on ? (
            <div className="qx-busy-overlay" role="alert" aria-busy="true">
              <div className="qx-busy-card">
                <div className="qx-busy-spinner" />
                <div className="text-sm font-semibold text-gray-800">{busy.message}</div>
                <div className="text-xs text-gray-500">Please wait a moment</div>
              </div>
            </div>
          ) : null}
        </>,
        document.body
      )}
    </NotifyContext.Provider>
  );
}

/** Show animated busy overlay while `busy` is true. */
export function useBusyOverlay(busy: boolean, message = "Saving…") {
  useEffect(() => {
    notify.busy(busy, message);
    return () => {
      if (busy) notify.busy(false);
    };
  }, [busy, message]);
}
