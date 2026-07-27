import JsBarcode from "jsbarcode";
import {
  esc,
  itemDisplayName,
  loadPrintSettings,
  money,
  openPrintWindow,
  type PrintSettings,
} from "./settings";

export type ReceiptLine = {
  name: string;
  qty: number;
  price: number;
  discount?: number;
  size?: string | null;
  barcode?: string | null;
};

export type ReceiptData = {
  invoiceNo: string;
  createdAt?: string | Date | null;
  customerName?: string | null;
  cashierName?: string | null;
  paymentType?: string | null;
  paidAmount?: number | null;
  subtotal: number;
  discount: number;
  total: number;
  items: ReceiptLine[];
};

function on(v: string | undefined) {
  return v === "1" || v?.toLowerCase() === "true";
}

function formatWhen(iso: string | Date | null | undefined, settings: PrintSettings) {
  if (!iso) return "";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "";
  const date = on(settings.print_date) ? d.toLocaleDateString() : "";
  const time = on(settings.print_time) ? d.toLocaleTimeString() : "";
  return [date, time].filter(Boolean).join(" ");
}

function buildBarcodeSvg(text: string): string {
  try {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    JsBarcode(svg, text, {
      format: "CODE128",
      width: 1.4,
      height: 48,
      displayValue: true,
      fontSize: 11,
      margin: 0,
      background: "#ffffff",
    });
    return svg.outerHTML;
  } catch {
    return `<div style="text-align:center;font-family:monospace;font-size:11px">${esc(text)}</div>`;
  }
}

function thermalCss(isThermal: boolean) {
  const width = isThermal ? "80mm" : "720px";
  return `
    @page { size: ${isThermal ? "80mm auto" : "A4"}; margin: 4mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Courier New", Courier, monospace;
      font-size: 12px;
      color: #111;
      background: #fff;
    }
    .sheet {
      width: ${width};
      max-width: 100%;
      margin: 0 auto;
      padding: 6px 8px 12px;
    }
    .center { text-align: center; }
    .bold { font-weight: 700; }
    .shop { font-size: 15px; font-weight: 800; letter-spacing: 0.02em; }
    .muted { color: #333; font-size: 11px; }
    .dash { border: none; border-top: 1px dashed #222; margin: 8px 0; }
    .solid { border: none; border-top: 2px solid #111; margin: 6px 0; }
    .row { display: flex; justify-content: space-between; gap: 8px; }
    .cols { display: grid; grid-template-columns: 1fr 36px 64px 72px; gap: 2px; font-size: 11px; font-weight: 700; }
    .item-name { font-weight: 700; margin-top: 6px; }
    .item-meta { display: grid; grid-template-columns: 1fr 36px 64px 72px; gap: 2px; font-size: 11px; }
    .item-meta span:nth-child(n+2) { text-align: right; }
    .disc { font-size: 10px; color: #444; margin-left: 2px; }
    .tot-row { display: flex; justify-content: space-between; margin: 2px 0; }
    .grand { font-size: 14px; font-weight: 800; }
    .logo { max-height: 48px; max-width: 160px; margin: 0 auto 4px; display: block; }
    .barcode { margin-top: 8px; text-align: center; }
    .barcode svg { max-width: 100%; height: auto; }
    .soft { font-size: 10px; color: #555; margin-top: 8px; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  `;
}

export function buildReceiptHtml(data: ReceiptData, settings: PrintSettings): string {
  const isThermal = (settings.bill_printer || "thermal").toLowerCase().includes("thermal");
  const cur = settings.currency || "Rs.";
  const shopTitle = settings.shop_display_name || settings.shop_name || "QUANTUMEXE POS";
  const paid = Number(data.paidAmount ?? data.total);
  const balance = Math.max(0, paid - Number(data.total));
  const when = formatWhen(data.createdAt, settings);
  const barcodeSvg = on(settings.show_barcode) ? buildBarcodeSvg(data.invoiceNo) : "";

  const lines = data.items
    .map((it) => {
      const lineTotal = it.qty * it.price - (it.discount || 0);
      const disc =
        it.discount && it.discount > 0
          ? `<div class="disc">(Discount: -${Number(it.discount).toFixed(2)})</div>`
          : "";
      return `
        <div class="item-name">${esc(it.name)}</div>
        ${disc}
        <div class="item-meta">
          <span></span>
          <span>${esc(it.qty)}</span>
          <span>${Number(it.price).toFixed(2)}</span>
          <span>${lineTotal.toFixed(2)}</span>
        </div>`;
    })
    .join("");

  const logo =
    on(settings.show_logo) && settings.store_logo
      ? `<img class="logo" src="${esc(settings.store_logo)}" alt="logo" />`
      : "";

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>${esc(data.invoiceNo)}</title>
<style>${thermalCss(isThermal)}</style></head>
<body><div class="sheet">
  ${logo}
  <div class="center shop">${esc(shopTitle)}</div>
  ${settings.store_address ? `<div class="center muted">${esc(settings.store_address)}</div>` : ""}
  ${settings.store_phone ? `<div class="center muted">Tel: ${esc(settings.store_phone)}</div>` : ""}
  <hr class="dash"/>
  ${settings.receipt_header ? `<div class="center bold">${esc(settings.receipt_header)}</div>` : ""}
  <div class="row" style="margin-top:6px">
    <span>Inv: ${esc(data.invoiceNo)}</span>
    <span>${esc(when)}</span>
  </div>
  <div>Customer: ${esc(data.customerName || "Walking Customer")}</div>
  ${data.cashierName ? `<div>Cashier: ${esc(data.cashierName)}</div>` : ""}
  <hr class="dash"/>
  <div class="cols"><span>Item</span><span>Qty</span><span>Price</span><span>TOTAL</span></div>
  <hr class="solid"/>
  ${lines}
  <hr class="dash"/>
  <div class="tot-row"><span>Subtotal:</span><span>${Number(data.subtotal).toFixed(2)}</span></div>
  <div class="tot-row"><span>Discount:</span><span>-${Number(data.discount || 0).toFixed(2)}</span></div>
  <hr class="solid"/>
  <div class="tot-row grand"><span>TOTAL:</span><span>${Number(data.total).toFixed(2)}</span></div>
  <hr class="dash"/>
  <div class="tot-row"><span>${esc((data.paymentType || "CASH").toUpperCase())}:</span><span>${paid.toFixed(2)}</span></div>
  <div class="tot-row bold"><span>BALANCE:</span><span>${balance.toFixed(2)}</span></div>
  <hr class="solid"/>
  ${settings.receipt_footer ? `<div class="center" style="margin-top:8px">${esc(settings.receipt_footer)}</div>` : ""}
  ${barcodeSvg ? `<div class="barcode">${barcodeSvg}</div>` : ""}
  <div class="center soft">Software by QUANTUMEXE Technologies</div>
</div></body></html>`;
}

export function receiptFromInvoice(inv: any): ReceiptData {
  const items = (inv.items || []).map((it: any) => ({
    name: itemDisplayName(it),
    qty: Number(it.qty || 0),
    price: Number(it.price || 0),
    discount: Number(it.discount || 0),
    size: it.variant?.size,
    barcode: it.variant?.barcode,
  }));
  return {
    invoiceNo: inv.invoiceNo || `INV-${inv.id}`,
    createdAt: inv.createdAt || new Date().toISOString(),
    customerName: inv.customer?.name || null,
    cashierName: inv.user?.name || null,
    paymentType: inv.paymentType || "Cash",
    paidAmount: inv.paidAmount ?? inv.total,
    subtotal: Number(inv.subtotal ?? items.reduce((s: number, i: ReceiptLine) => s + i.qty * i.price, 0)),
    discount: Number(inv.discount || 0),
    total: Number(inv.total || 0),
    items,
  };
}

export async function printReceipt(invoiceOrData: any) {
  const settings = await loadPrintSettings();
  const data: ReceiptData =
    invoiceOrData?.items && (invoiceOrData.invoiceNo || invoiceOrData.id)
      ? receiptFromInvoice(invoiceOrData)
      : (invoiceOrData as ReceiptData);
  const html = buildReceiptHtml(data, settings);
  openPrintWindow(data.invoiceNo, html, settings.bill_printer?.includes("thermal") ? 380 : 720);
  return data;
}

export { money };
