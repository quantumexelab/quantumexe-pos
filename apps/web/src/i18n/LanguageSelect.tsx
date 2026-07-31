import { Languages } from "lucide-react";
import { useI18n, type Lang } from "./index";

/** Language switcher — always shows globe icon + native language name. */
export function LanguageSelect({
  className = "",
  size = "sm",
  showIcon = true,
}: {
  className?: string;
  size?: "sm" | "md";
  showIcon?: boolean;
}) {
  const { lang, setLang, options, t } = useI18n();
  return (
    <label
      className={`inline-flex items-center gap-1.5 ${className}`}
      title={t("lang.label")}
    >
      {showIcon && (
        <Languages
          size={size === "md" ? 18 : 16}
          className="text-emerald-700 shrink-0"
          aria-hidden
        />
      )}
      <span className="sr-only">{t("lang.label")}</span>
      <select
        className={`rounded-lg border border-emerald-300 bg-white text-gray-800 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/40 cursor-pointer ${
          size === "md" ? "h-10 pl-2 pr-8 text-sm" : "h-8 pl-2 pr-7 text-xs"
        }`}
        value={lang}
        onChange={(e) => setLang(e.target.value as Lang)}
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
