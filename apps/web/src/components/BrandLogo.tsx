type BrandLogoProps = {
  variant?: "light" | "dark";
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
  className?: string;
  /** Show hexagonal QE mark beside the wordmark */
  showMark?: boolean;
};

const sizes = {
  sm: { main: "text-lg", tag: "text-[8px] tracking-[0.28em]", mark: "h-7 w-7" },
  md: { main: "text-xl", tag: "text-[9px] tracking-[0.32em]", mark: "h-9 w-9" },
  lg: { main: "text-6xl", tag: "text-sm tracking-[0.42em]", mark: "h-14 w-14" },
};

/** QUANTUMEXE Technologies wordmark + official QE hex mark */
export function BrandLogo({
  variant = "light",
  size = "md",
  showTagline = false,
  showMark = true,
  className = "",
}: BrandLogoProps) {
  const s = sizes[size];
  const quantum = variant === "dark" ? "text-white" : "text-slate-900";
  const accent = variant === "dark" ? "text-sky-400" : "text-sky-500";

  return (
    <div className={`leading-none ${className}`}>
      <div className="flex items-center gap-2.5 sm:gap-3">
        {showMark && (
          <img
            src="/qe-logo.png"
            alt=""
            className={`${s.mark} shrink-0 object-contain select-none`}
            draggable={false}
          />
        )}
        <div>
          <div className={`font-black uppercase ${s.main} tracking-tight`}>
            <span className={quantum}>QUANTUM</span>
            <span className={accent}>EXE</span>
          </div>
          {showTagline && (
            <div className={`mt-1 font-semibold uppercase ${accent} ${s.tag}`}>TECHNOLOGIES</div>
          )}
        </div>
      </div>
    </div>
  );
}

export const BRAND = {
  name: "QUANTUMEXE",
  fullName: "QUANTUMEXE TECHNOLOGIES",
  product: "QUANTUMEXE POS System",
  developer: "QUANTUMEXE Technologies",
  site: "quantumexe.com",
  siteUrl: "https://quantumexe.com",
  receiptPrefix: "QX",
} as const;
