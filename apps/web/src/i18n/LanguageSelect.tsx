import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Languages } from "lucide-react";
import { useI18n, type Lang } from "./index";

/** Modern pill language switcher (custom menu, no nested native-select chrome). */
export function LanguageSelect({
  className = "",
  size = "sm",
}: {
  className?: string;
  size?: "sm" | "md";
  showIcon?: boolean;
}) {
  const { lang, setLang, options, t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const current = options.find((o) => o.id === lang) || options[0];
  const compact = size === "sm";

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(id: Lang) {
    setLang(id);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("lang.label")}
        title={t("lang.label")}
        onClick={() => setOpen((v) => !v)}
        className={`group inline-flex items-center gap-1.5 rounded-full border border-slate-200/90 bg-white/90 text-slate-700 shadow-sm backdrop-blur-sm transition
          hover:border-emerald-300 hover:bg-emerald-50/80 hover:text-emerald-900
          focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40
          ${open ? "border-emerald-400 bg-emerald-50 text-emerald-900 shadow-md" : ""}
          ${compact ? "h-8 pl-2.5 pr-2 text-xs" : "h-10 pl-3 pr-2.5 text-sm"}`}
      >
        <span
          className={`grid place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm ${
            compact ? "h-5 w-5" : "h-6 w-6"
          }`}
        >
          <Languages size={compact ? 11 : 13} strokeWidth={2.25} />
        </span>
        <span className="font-semibold tracking-tight max-w-[5.5rem] truncate">{current.native}</span>
        <ChevronDown
          size={compact ? 14 : 16}
          className={`text-slate-400 transition group-hover:text-emerald-600 ${open ? "rotate-180 text-emerald-600" : ""}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={t("lang.label")}
          className="absolute right-0 top-[calc(100%+6px)] z-50 min-w-[11rem] overflow-hidden rounded-2xl border border-slate-200/80 bg-white py-1.5 shadow-xl shadow-slate-900/10 ring-1 ring-black/5"
        >
          <div className="px-3 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {t("lang.label")}
          </div>
          {options.map((o) => {
            const active = o.id === lang;
            return (
              <button
                key={o.id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => pick(o.id)}
                className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition ${
                  active
                    ? "bg-emerald-50 text-emerald-900"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span
                  className={`grid h-7 w-7 place-items-center rounded-full text-[11px] font-bold ${
                    active
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {o.id.toUpperCase()}
                </span>
                <span className="flex-1 font-semibold">{o.native}</span>
                {active ? <Check size={16} className="text-emerald-600 shrink-0" /> : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
