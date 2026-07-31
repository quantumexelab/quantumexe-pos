import { useI18n, type Lang } from "./index";

/** Compact language switcher for header / sign-in / settings. */
export function LanguageSelect({
  className = "",
  size = "sm",
}: {
  className?: string;
  size?: "sm" | "md";
}) {
  const { lang, setLang, options, t } = useI18n();
  return (
    <label className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className="sr-only">{t("lang.label")}</span>
      <select
        className={`rounded-lg border border-gray-200 bg-white text-gray-700 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/30 ${
          size === "md" ? "h-10 px-3 text-sm" : "h-8 px-2 text-xs"
        }`}
        value={lang}
        onChange={(e) => setLang(e.target.value as Lang)}
        title={t("lang.label")}
        aria-label={t("lang.label")}
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.native}
          </option>
        ))}
      </select>
    </label>
  );
}
