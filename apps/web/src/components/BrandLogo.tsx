type BrandLogoProps = {
  variant?: "light" | "dark";
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
  className?: string;
};

const sizes = {
  sm: { main: "text-lg", tag: "text-[8px] tracking-[0.28em]" },
  md: { main: "text-xl", tag: "text-[9px] tracking-[0.32em]" },
  lg: { main: "text-4xl", tag: "text-xs tracking-[0.4em]" },
};

/** QUANTUMEXE Technologies wordmark */
export function BrandLogo({
  variant = "light",
  size = "md",
  showTagline = false,
  className = "",
}: BrandLogoProps) {
  const s = sizes[size];
  const quantum = variant === "dark" ? "text-white" : "text-slate-900";
  const accent = variant === "dark" ? "text-sky-400" : "text-sky-500";

  return (
    <div className={`leading-none ${className}`}>
      <div className={`font-black uppercase ${s.main} tracking-tight`}>
        <span className={quantum}>QUANTUM</span>
        <span className={accent}>EXE</span>
      </div>
      {showTagline && (
        <div className={`mt-1 font-semibold uppercase ${accent} ${s.tag}`}>TECHNOLOGIES</div>
      )}
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
