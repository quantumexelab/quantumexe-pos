type BrandLogoProps = {
  variant?: "light" | "dark";
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
  className?: string;
  /** Show hexagonal QE mark beside the wordmark */
  showMark?: boolean;
};

const sizes = {
  sm: { main: "text-lg", tag: "text-[8px] tracking-[0.28em]", mark: "h-8 w-8" },
  md: { main: "text-xl", tag: "text-[9px] tracking-[0.32em]", mark: "h-10 w-10" },
  lg: { main: "text-5xl xl:text-6xl", tag: "text-sm tracking-[0.42em]", mark: "h-16 w-16" },
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
  const accent = variant === "dark" ? "text-[#3b9eff]" : "text-sky-500";

  return (
    <div className={`leading-none ${className}`}>
      <div className="flex items-center gap-3 sm:gap-3.5">
        {showMark && (
          <img
            src="/qe-logo.png?v=2"
            alt="QUANTUMEXE"
            className={`${s.mark} shrink-0 object-contain select-none drop-shadow-[0_0_12px_rgba(43,140,255,0.35)]`}
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
