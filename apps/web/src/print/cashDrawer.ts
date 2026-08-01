/**
 * Cash drawer kick via receipt printer (ESC/POS).
 * Hardware: RJ11/RJ12 from drawer → printer DK port (e.g. XP-Q80T).
 * Software: Desktop app sends raw pulse to the Windows printer name.
 */

import { loadPrintSettings } from "./settings";

export type CashDrawerResult = {
  ok: boolean;
  message: string;
  via?: "desktop" | "none";
};

declare global {
  interface Window {
    quantumexeDesktop?: {
      isDesktop?: boolean;
      openCashDrawer?: (opts?: { printerName?: string; pin?: number }) => Promise<{
        ok: boolean;
        message?: string;
      }>;
      listPrinters?: () => Promise<string[]>;
    };
  }
}

function on(v: string | undefined) {
  return v === "1" || v?.toLowerCase() === "true";
}

/** Resolve Windows printer share/name for raw ESC/POS. */
export function resolveCashDrawerPrinterName(settings: {
  cash_drawer_printer?: string;
  bill_printer?: string;
}): string {
  const custom = String(settings.cash_drawer_printer || "").trim();
  if (custom) return custom;
  // Common XP-Q80T Windows printer names — user can override in Settings
  return "XP-Q80T";
}

export function shouldOpenCashDrawerOnSale(
  settings: { cash_drawer_enabled?: string; cash_drawer_on_cash?: string; cash_drawer_on_any?: string },
  paymentType: string
): boolean {
  if (!on(settings.cash_drawer_enabled)) return false;
  if (on(settings.cash_drawer_on_any)) return true;
  if (on(settings.cash_drawer_on_cash ?? "1")) {
    return String(paymentType || "").toLowerCase() === "cash";
  }
  return false;
}

export async function openCashDrawer(opts?: {
  force?: boolean;
  printerName?: string;
  pin?: number;
}): Promise<CashDrawerResult> {
  const settings = await loadPrintSettings(true);
  if (!opts?.force && !on(settings.cash_drawer_enabled)) {
    return { ok: false, message: "Cash drawer is disabled in Settings → Print", via: "none" };
  }

  const printerName = opts?.printerName || resolveCashDrawerPrinterName(settings);
  const pin = opts?.pin ?? (Number(settings.cash_drawer_pin) === 1 ? 1 : 0);

  const desktop = typeof window !== "undefined" ? window.quantumexeDesktop : undefined;
  if (desktop?.openCashDrawer) {
    try {
      const res = await desktop.openCashDrawer({ printerName, pin });
      return {
        ok: !!res?.ok,
        message: res?.message || (res?.ok ? "Cash drawer opened" : "Failed to open cash drawer"),
        via: "desktop",
      };
    } catch (e) {
      return {
        ok: false,
        message: e instanceof Error ? e.message : "Desktop cash drawer failed",
        via: "desktop",
      };
    }
  }

  return {
    ok: false,
    message:
      "Cash drawer needs the QUANTUMEXE desktop app. Connect drawer RJ11 cable to XP-Q80T DK port, then open POS desktop and try again.",
    via: "none",
  };
}
