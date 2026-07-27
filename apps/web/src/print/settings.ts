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
  print_date: string;
  print_time: string;
  merchant_qr: string;
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
  bill_printer: "thermal",
  print_date: "1",
  print_time: "1",
  merchant_qr: "",
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
    barcode?: string | null;
    product?: { name?: string; code?: string };
  };
  displayName?: string;
  productName?: string;
}): string {
  const product = it.variant?.product?.name || it.productName || it.displayName || "Item";
  const size = it.variant?.size?.trim();
  const vname = it.variant?.name?.trim();
  const parts = [product];
  if (size) parts.push(`Size ${size}`);
  else if (vname && vname.toLowerCase() !== "default" && vname !== product) parts.push(vname);
  return parts.join(" · ");
}
