import api from "../api";

export type PrintSettings = {
  shop_name: string;
  shop_display_name: string;
  store_address: string;
  store_phone: string;
  store_email: string;
  currency: string;
  receipt_header: string;
  receipt_footer: string;
  show_logo: string;
  show_barcode: string;
  show_qr: string;
  store_logo: string;
  bill_printer: string;
  label_printer: string;
  print_date: string;
  print_time: string;
  merchant_qr: string;
  cash_drawer_enabled: string;
  cash_drawer_on_cash: string;
  cash_drawer_on_any: string;
  cash_drawer_printer: string;
  cash_drawer_pin: string;
};

const PRINT_DEFAULTS: PrintSettings = {
  shop_name: "My POS Store",
  shop_display_name: "",
  store_address: "",
  store_phone: "",
  store_email: "",
  currency: "Rs.",
  receipt_header: "WELCOME TO OUR STORE",
  receipt_footer: "Thank you for your purchase!",
  show_logo: "1",
  show_barcode: "1",
  show_qr: "0",
  store_logo: "",
  bill_printer: "xp-q80t",
  label_printer: "xp-361",
  print_date: "1",
  print_time: "1",
  merchant_qr: "",
  cash_drawer_enabled: "1",
  cash_drawer_on_cash: "1",
  cash_drawer_on_any: "0",
  cash_drawer_printer: "XP-Q80T",
  cash_drawer_pin: "0",
};

let cachedSettings: PrintSettings | null = null;
let cachedAt = 0;

export async function loadPrintSettings(force = false): Promise<PrintSettings> {
  if (!force && cachedSettings && Date.now() - cachedAt < 60_000) return cachedSettings;
  try {
    const { data } = await api.get("/settings");
    const map = (data?.data || {}) as Record<string, string>;
    cachedSettings = { ...PRINT_DEFAULTS, ...map } as PrintSettings;
  } catch {
    cachedSettings = { ...PRINT_DEFAULTS };
  }
  cachedAt = Date.now();
  return cachedSettings;
}

export function money(n: number, currency = "Rs.") {
  return `${currency} ${Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function openPrintWindow(title: string, bodyHtml: string, width = 420) {
  const w = window.open("", "_blank", `width=${width},height=900`);
  if (!w) {
    alert("Allow pop-ups to print");
    return null;
  }
  w.document.write(bodyHtml);
  w.document.close();
  w.focus();
  // Wait for images/fonts then print
  setTimeout(() => {
    try {
      w.print();
    } catch {
      /* ignore */
    }
  }, 350);
  return w;
}

/** Escapes text for HTML. */
export function esc(s: unknown) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function itemDisplayName(it: {
  variant?: {
    name?: string;
    size?: string | null;
    color?: string | null;
    barcode?: string | null;
    product?: { name?: string; code?: string };
  };
  displayName?: string;
  productName?: string;
  size?: string | null;
  color?: string | null;
}): string {
  const product = it.variant?.product?.name || it.productName || it.displayName || "Item";
  const size = (it.variant?.size || it.size)?.trim();
  const color = (it.variant?.color || it.color)?.trim();
  const vname = it.variant?.name?.trim();
  const parts = [product];
  if (size) parts.push(`Size ${size}`);
  if (color) parts.push(color);
  if (!size && !color && vname && vname.toLowerCase() !== "default" && vname !== product) parts.push(vname);
  return parts.join(" · ");
}

export function isThermalReceiptPrinter(billPrinter: string | undefined) {
  const v = (billPrinter || "xp-q80t").toLowerCase();
  return v.includes("thermal") || v.includes("xp-q80") || v === "xp-q80t" || v === "";
}

export function receiptPrinterLabel(billPrinter: string | undefined) {
  const v = (billPrinter || "xp-q80t").toLowerCase();
  if (v.includes("a4")) return "A4 Printer";
  if (v.includes("xp-q80") || v === "xp-q80t") return "Xprinter XP-Q80T (80mm)";
  if (v.includes("thermal")) return "Thermal Receipt Printer (80mm)";
  return "Xprinter XP-Q80T (80mm)";
}

export function labelPrinterLabel(labelPrinter: string | undefined) {
  const v = (labelPrinter || "xp-361").toLowerCase();
  if (v.includes("361") || v === "xp-361") return "Xprinter XP-361 (80mm)";
  return "Xprinter XP-361 (80mm)";
}
