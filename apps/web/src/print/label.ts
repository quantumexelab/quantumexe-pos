import JsBarcode from "jsbarcode";
import { esc, loadPrintSettings, money, openPrintWindow } from "./settings";

export type LabelItem = {
  productName: string;
  size?: string | null;
  variantName?: string | null;
  barcode: string;
  price: number;
  code?: string | null;
};

function barcodeSvg(text: string, height = 36) {
  try {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    JsBarcode(svg, text, {
      format: "CODE128",
      width: 1.2,
      height,
      displayValue: true,
      fontSize: 10,
      margin: 2,
      background: "#ffffff",
    });
    return svg.outerHTML;
  } catch {
    return `<div style="font-family:monospace;font-size:10px;text-align:center">${esc(text)}</div>`;
  }
}

export async function printProductLabels(items: LabelItem[], copies = 1) {
  if (!items.length) {
    alert("No items to print");
    return;
  }
  const settings = await loadPrintSettings();
  const shop = settings.shop_display_name || settings.shop_name || "QUANTUMEXE";
  const cur = settings.currency || "Rs.";

  const cards: string[] = [];
  for (const it of items) {
    for (let c = 0; c < Math.max(1, copies); c++) {
      const sizeLine = it.size
        ? `Size: ${esc(it.size)}`
        : it.variantName && it.variantName.toLowerCase() !== "default"
          ? esc(it.variantName)
          : "";
      cards.push(`
        <div class="label">
          <div class="shop">${esc(shop)}</div>
          <div class="name">${esc(it.productName)}</div>
          ${sizeLine ? `<div class="size">${sizeLine}</div>` : ""}
          <div class="price">${money(it.price, cur)}</div>
          <div class="bc">${barcodeSvg(it.barcode || it.code || "NO-BARCODE")}</div>
        </div>`);
    }
  }

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Labels</title>
<style>
  @page { margin: 4mm; }
  body { margin: 0; font-family: Arial, sans-serif; }
  .wrap { display: flex; flex-wrap: wrap; gap: 6mm; padding: 4mm; }
  .label {
    width: 50mm;
    min-height: 30mm;
    border: 1px dashed #999;
    padding: 3mm;
    page-break-inside: avoid;
    text-align: center;
  }
  .shop { font-size: 9px; color: #555; text-transform: uppercase; letter-spacing: 0.06em; }
  .name { font-size: 12px; font-weight: 800; margin-top: 2px; line-height: 1.2; }
  .size { font-size: 11px; margin-top: 2px; }
  .price { font-size: 14px; font-weight: 800; margin: 4px 0; }
  .bc svg { max-width: 100%; height: auto; }
  @media print { .label { border-color: #ccc; } }
</style></head>
<body><div class="wrap">${cards.join("")}</div></body></html>`;

  openPrintWindow("Product Labels", html, 700);
}
