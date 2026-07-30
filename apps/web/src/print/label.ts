import JsBarcode from "jsbarcode";
import { esc, loadPrintSettings, money, openPrintWindow } from "./settings";

export type LabelItem = {
  productName: string;
  size?: string | null;
  color?: string | null;
  variantName?: string | null;
  barcode: string;
  price: number;
  code?: string | null;
  /** Stickers for this line (e.g. released qty). Defaults to 1. */
  copies?: number;
};

/** Tuned for Xprinter XP-361 80mm thermal barcode printer. */
function barcodeSvg(text: string, height = 52) {
  try {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    JsBarcode(svg, text, {
      format: "CODE128",
      width: 1.6,
      height,
      displayValue: true,
      fontSize: 12,
      margin: 0,
      background: "#ffffff",
    });
    return svg.outerHTML;
  } catch {
    return `<div style="font-family:monospace;font-size:11px;text-align:center">${esc(text)}</div>`;
  }
}

/**
 * Product barcode stickers for Xprinter XP-361 (80mm thermal barcode printer).
 * Each sticker is one full-width 80mm strip: name + price + scannable barcode for POS.
 */
export async function printProductLabels(items: LabelItem[], copies = 1) {
  if (!items.length) {
    alert("No items to print");
    return;
  }
  const settings = await loadPrintSettings();
  const shop = settings.shop_display_name || settings.shop_name || "QUANTUMEXE";
  const cur = settings.currency || "Rs.";
  const printerHint =
    settings.label_printer === "xp-361" || !settings.label_printer
      ? "Xprinter XP-361 (80mm)"
      : settings.label_printer;

  const cards: string[] = [];
  for (const it of items) {
    const n = Math.max(1, Math.floor(Number(it.copies ?? copies) || 1));
    for (let c = 0; c < n; c++) {
      const meta = [it.size ? `Size ${esc(it.size)}` : "", it.color ? esc(it.color) : ""]
        .filter(Boolean)
        .join(" · ");
      const sizeLine =
        meta ||
        (it.variantName && it.variantName.toLowerCase() !== "default" ? esc(it.variantName) : "");
      const bc = String(it.barcode || it.code || "NO-BARCODE").trim();
      cards.push(`
        <div class="label">
          <div class="shop">${esc(shop)}</div>
          <div class="name">${esc(it.productName)}</div>
          ${sizeLine ? `<div class="size">${sizeLine}</div>` : ""}
          <div class="price">${money(it.price, cur)}</div>
          <div class="bc">${barcodeSvg(bc)}</div>
        </div>`);
    }
  }

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Labels — ${esc(printerHint)}</title>
<style>
  /* Xprinter XP-361 Thermal Barcode Printer — 80mm roll */
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    width: 80mm;
    background: #fff;
    font-family: Arial, Helvetica, sans-serif;
    color: #000;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .wrap { width: 80mm; margin: 0; padding: 0; }
  .label {
    width: 80mm;
    padding: 3mm 4mm 4mm;
    text-align: center;
    page-break-after: always;
    break-after: page;
  }
  .label:last-child {
    page-break-after: auto;
    break-after: auto;
  }
  .shop {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #222;
  }
  .name {
    font-size: 13px;
    font-weight: 800;
    margin-top: 2px;
    line-height: 1.15;
    max-height: 2.3em;
    overflow: hidden;
  }
  .size { font-size: 11px; margin-top: 2px; font-weight: 600; }
  .price {
    font-size: 18px;
    font-weight: 900;
    margin: 3px 0 4px;
    letter-spacing: 0.02em;
  }
  .bc { margin-top: 1px; }
  .bc svg { max-width: 72mm; height: auto; }
  @media print {
    .label { border: none; }
  }
</style></head>
<body>
  <div class="hint" style="display:none"></div>
  <div class="wrap">${cards.join("")}</div>
  <script>
    /* Remind operator to pick XP-361 in the Windows print dialog */
    document.title = ${JSON.stringify(`Labels — select ${printerHint}`)};
  </script>
</body></html>`;

  openPrintWindow(`Labels — ${printerHint}`, html, 360);
}
