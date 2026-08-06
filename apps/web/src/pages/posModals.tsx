import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  X,
  Search,
  ArrowLeftRight,
  RotateCcw,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
  Pause,
} from "lucide-react";
import api from "../api";
import { ErrorBox } from "../components/ui";

function money(n: number, currency = "Rs") {
  return `${currency} ${Number(n || 0).toFixed(2)}`;
}

export type HeldBillRow = {
  id: string;
  savedAt: string;
  cart: Array<{ displayName: string; price: number; qty: number; discount: number }>;
  customerQuery?: string;
};

type CashManageProps = {
  open: boolean;
  onClose: () => void;
  session: { id: number; openingBalance: number; openedAt?: string } | null;
  currency: string;
  onMessage: (msg: string) => void;
};

export function CashManageModal({ open, onClose, session, currency, onMessage }: CashManageProps) {
  const [type, setType] = useState<"IN" | "OUT">("OUT");
  const [amount, setAmount] = useState("0.00");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState(0);
  const [cashSales, setCashSales] = useState(0);
  const [exchange, setExchange] = useState(0);
  const [returnsTotal, setReturnsTotal] = useState(0);
  const [cashIn, setCashIn] = useState(0);
  const [cashOut, setCashOut] = useState(0);
  const [recent, setRecent] = useState<Array<{ id: number; type: string; amount: number; note?: string | null; createdAt: string }>>([]);

  async function load() {
    if (!session) return;
    setLoading(true);
    setError("");
    try {
      const openedAt = session.openedAt ? new Date(session.openedAt) : null;
      const [movRes, invRes, retRes, sessRes] = await Promise.all([
        api.get("/accounts/movements"),
        api.get("/sales/invoices"),
        api.get("/pos/returns"),
        api.get("/accounts/sessions"),
      ]);
      const sessRow = ((sessRes.data?.data || []) as Array<{ id: number; openingBalance: number; openedAt?: string }>).find(
        (s) => s.id === session.id
      );
      const openBal = Number(sessRow?.openingBalance ?? session.openingBalance ?? 0);
      const from = openedAt || (sessRow?.openedAt ? new Date(sessRow.openedAt) : new Date(0));

      const movements = (movRes.data?.data?.rows || []) as Array<{
        id: number;
        type: string;
        amount: number;
        note?: string | null;
        createdAt: string;
      }>;
      const inSession = movements.filter((m) => new Date(m.createdAt) >= from);
      const inn = inSession.filter((m) => String(m.type).toUpperCase() === "IN").reduce((s, m) => s + Number(m.amount), 0);
      const out = inSession.filter((m) => String(m.type).toUpperCase() === "OUT").reduce((s, m) => s + Number(m.amount), 0);

      const invoices = (invRes.data?.data || []) as Array<{ createdAt: string; total: number; paymentType?: string }>;
      const sales = invoices
        .filter((inv) => new Date(inv.createdAt) >= from)
        .filter((inv) => !inv.paymentType || String(inv.paymentType).toLowerCase().includes("cash") || inv.paymentType === "Cash")
        .reduce((s, inv) => s + Number(inv.total || 0), 0);

      const returns = (retRes.data?.data || []) as Array<{ createdAt: string; total: number; note?: string | null }>;
      const retSum = returns.filter((r) => new Date(r.createdAt) >= from).reduce((s, r) => s + Number(r.total || 0), 0);
      const exch = returns
        .filter((r) => new Date(r.createdAt) >= from && String(r.note || "").toLowerCase().includes("exchange"))
        .reduce((s, r) => s + Number(r.total || 0), 0);

      setOpening(openBal);
      setCashSales(sales);
      setReturnsTotal(retSum);
      setExchange(exch);
      setCashIn(inn);
      setCashOut(out);
      setRecent(inSession.slice(0, 8));
    } catch (err) {
      const ax = err as { response?: { data?: { message?: string } }; message?: string };
      setError(ax.response?.data?.message || ax.message || "Failed to load cash session");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) {
      setType("OUT");
      setAmount("0.00");
      setNote("");
      setError("");
      void load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, session?.id]);

  const currentBalance = opening + cashSales + cashIn - cashOut - returnsTotal;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      setError("Amount is required");
      return;
    }
    if (!note.trim()) {
      setError("Description is required");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/accounts/movements", {
        type,
        amount: amt,
        note: note.trim(),
      });
      if (!data?.success) throw new Error(data?.message || "Failed");
      onMessage(`Cash ${type === "IN" ? "In" : "Out"} ${money(amt, currency)} recorded`);
      setAmount("0.00");
      setNote("");
      await load();
    } catch (err) {
      const ax = err as { response?: { data?: { message?: string } }; message?: string };
      setError(ax.response?.data?.message || ax.message || "Failed to record");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/45 grid place-items-center p-4" onClick={() => !busy && onClose()}>
      <form
        onSubmit={submit}
        className="bg-white rounded-2xl w-full max-w-xl shadow-2xl border border-gray-100 overflow-hidden max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-4 pb-2 flex items-start justify-between">
          <div className="text-[11px] font-bold tracking-[0.14em] text-slate-700">RECORD CASH TRANSACTIONS</div>
          <button type="button" className="h-8 w-8 rounded-lg hover:bg-gray-100 grid place-items-center" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="px-5 pb-5 overflow-auto space-y-4">
          {error && <ErrorBox text={error} />}
          {loading && <div className="text-xs text-gray-500">Loading session…</div>}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="rounded-xl bg-sky-50 border border-sky-100 p-3">
              <div className="text-[10px] font-bold text-sky-700 tracking-wide">OPENING</div>
              <div className="text-sm font-bold text-sky-950 mt-1">{money(opening, currency)}</div>
            </div>
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
              <div className="text-[10px] font-bold text-emerald-700 tracking-wide">CASH SALES</div>
              <div className="text-sm font-bold text-emerald-950 mt-1">{money(cashSales, currency)}</div>
            </div>
            <div className="rounded-xl bg-violet-50 border border-violet-100 p-3">
              <div className="text-[10px] font-bold text-violet-700 tracking-wide">EXCHANGE</div>
              <div className="text-sm font-bold text-violet-950 mt-1">{money(exchange, currency)}</div>
            </div>
            <div className="rounded-xl bg-rose-50 border border-rose-100 p-3">
              <div className="text-[10px] font-bold text-rose-700 tracking-wide">RETURNS</div>
              <div className="text-sm font-bold text-rose-950 mt-1">{money(returnsTotal, currency)}</div>
            </div>
          </div>

          <div className="rounded-xl bg-emerald-800 text-white px-4 py-3 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold tracking-wide text-emerald-100">CURRENT BALANCE</div>
              <div className="text-2xl font-bold mt-0.5">{money(currentBalance, currency)}</div>
            </div>
            <div className="h-10 w-10 rounded-full bg-white/15 grid place-items-center text-lg font-bold">$</div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setType("OUT")}
              className={`h-11 rounded-xl font-bold text-sm border inline-flex items-center justify-center gap-2 ${
                type === "OUT" ? "bg-white border-slate-800 text-slate-900" : "bg-gray-100 border-transparent text-gray-500"
              }`}
            >
              <ArrowDownLeft size={16} className="text-rose-500" /> CASH OUT
            </button>
            <button
              type="button"
              onClick={() => setType("IN")}
              className={`h-11 rounded-xl font-bold text-sm border inline-flex items-center justify-center gap-2 ${
                type === "IN" ? "bg-white border-slate-800 text-slate-900" : "bg-gray-100 border-transparent text-gray-500"
              }`}
            >
              <ArrowUpRight size={16} className="text-emerald-500" /> CASH IN
            </button>
          </div>

          <div>
            <label className="text-[11px] font-bold tracking-wide text-gray-600">
              AMOUNT (RS) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              className="input mt-1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-[11px] font-bold tracking-wide text-gray-600">
              DESCRIPTION <span className="text-red-500">*</span>
            </label>
            <textarea
              className="input mt-1 min-h-[72px]"
              placeholder="E.g., Added to cash drawer, Paid for supplies..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              required
            />
          </div>

          <div>
            <div className="text-[11px] font-bold tracking-wide text-gray-600 inline-flex items-center gap-1.5 mb-2">
              <Clock size={12} /> RECENT ACTIVITY
            </div>
            <div className="space-y-2 max-h-36 overflow-auto">
              {recent.map((m) => {
                const out = String(m.type).toUpperCase() === "OUT";
                return (
                  <div key={m.id} className="flex items-center gap-2 text-sm border border-gray-100 rounded-lg px-3 py-2">
                    <span className={`h-7 w-7 rounded-full grid place-items-center ${out ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"}`}>
                      {out ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium text-gray-800">{m.note || `Cash ${m.type}`}</div>
                      <div className="text-[11px] text-gray-400">{new Date(m.createdAt).toLocaleString()}</div>
                    </div>
                    <div className={`font-bold ${out ? "text-rose-600" : "text-emerald-600"}`}>
                      {out ? "-" : "+"}
                      {money(m.amount, currency)}
                    </div>
                  </div>
                );
              })}
              {!recent.length && <div className="text-xs text-gray-400 text-center py-4">No cash movements yet</div>}
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className={`w-full h-12 rounded-xl font-bold text-white ${
              type === "OUT" ? "bg-rose-400 hover:bg-rose-500" : "bg-emerald-600 hover:bg-emerald-700"
            } disabled:opacity-60`}
          >
            {busy ? "Saving…" : type === "OUT" ? "CONFIRM CASH OUT" : "CONFIRM CASH IN"}
          </button>
        </div>
      </form>
    </div>
  );
}

type StockProduct = {
  id: number;
  displayName: string;
  barcode?: string;
  code?: string;
  quantity: number;
  price: number;
};

type BulkConvertProps = {
  open: boolean;
  onClose: () => void;
  products: StockProduct[];
  onDone: (msg: string) => void;
};

export function BulkConvertModal({ open, onClose, products, onDone }: BulkConvertProps) {
  const [sourceQ, setSourceQ] = useState("");
  const [destQ, setDestQ] = useState("");
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [bulkQty, setBulkQty] = useState(1);
  const [yieldUnit, setYieldUnit] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setSourceQ("");
    setDestQ("");
    setFromId("");
    setToId("");
    setBulkQty(1);
    setYieldUnit(1);
    setError("");
  }, [open]);

  const sourceList = useMemo(() => {
    const q = sourceQ.trim().toLowerCase();
    const rows = products.filter((p) => p.quantity > 0);
    if (!q) return rows.slice(0, 8);
    return rows
      .filter(
        (p) =>
          p.displayName?.toLowerCase().includes(q) ||
          p.barcode?.toLowerCase().includes(q) ||
          p.code?.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [products, sourceQ]);

  const destList = useMemo(() => {
    const q = destQ.trim().toLowerCase();
    if (!q) return products.slice(0, 8);
    return products
      .filter(
        (p) =>
          p.displayName?.toLowerCase().includes(q) ||
          p.barcode?.toLowerCase().includes(q) ||
          p.code?.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [products, destQ]);

  const from = products.find((p) => String(p.id) === fromId);
  const to = products.find((p) => String(p.id) === toId);
  const yieldPreview = Math.max(0, Number(bulkQty) * Number(yieldUnit));

  async function execute(e: FormEvent) {
    e.preventDefault();
    if (!fromId || !toId) {
      setError("Select source and destination products");
      return;
    }
    if (fromId === toId) {
      setError("Source and destination must be different");
      return;
    }
    if (!(bulkQty > 0) || !(yieldUnit > 0)) {
      setError("Bulk qty and yield must be greater than 0");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/pos/convert", {
        fromVariantId: Number(fromId),
        toVariantId: Number(toId),
        qty: Number(bulkQty),
        factor: Number(yieldUnit),
      });
      if (!data?.success) throw new Error(data?.message || "Conversion failed");
      onDone(`Converted ${bulkQty} → ${yieldPreview} units`);
      onClose();
    } catch (err) {
      const ax = err as { response?: { data?: { message?: string } }; message?: string };
      setError(ax.response?.data?.message || ax.message || "Conversion failed");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/45 grid place-items-center p-4" onClick={() => !busy && onClose()}>
      <form
        onSubmit={execute}
        className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-gray-100 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-100 flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-700 grid place-items-center shrink-0">
            <ArrowLeftRight size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-gray-900">Bulk Conversion</h2>
            <div className="text-[11px] font-bold tracking-wide text-gray-500">SPLIT STOCK FROM CURRENT BATCHES</div>
          </div>
          <button type="button" className="h-8 w-8 rounded-lg hover:bg-gray-100 grid place-items-center" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && <ErrorBox text={error} />}

          <div>
            <div className="text-[11px] font-bold tracking-wide text-gray-600 mb-2">SOURCE STOCK (AVAILABLE)</div>
            <div className="relative">
              <Search size={14} className="input-icon" />
              <input
                className="input has-icon"
                placeholder="Search current stock (name, code, barcode)..."
                value={sourceQ}
                onChange={(e) => setSourceQ(e.target.value)}
              />
            </div>
            <div className="mt-2 max-h-28 overflow-auto border border-gray-100 rounded-lg">
              {sourceList.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`w-full text-left px-3 py-2 text-sm border-b border-gray-50 last:border-0 ${
                    String(p.id) === fromId ? "bg-emerald-50" : "hover:bg-gray-50"
                  }`}
                  onClick={() => {
                    setFromId(String(p.id));
                    setSourceQ(p.displayName);
                  }}
                >
                  <div className="font-medium">{p.displayName}</div>
                  <div className="text-xs text-gray-500">Qty {p.quantity}</div>
                </button>
              ))}
              {!sourceList.length && <div className="px-3 py-2 text-xs text-gray-400">No stock</div>}
            </div>
            {from && <div className="text-xs text-emerald-700 mt-1 font-semibold">Selected: {from.displayName}</div>}
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end">
            <div>
              <label className="text-[11px] font-bold tracking-wide text-gray-600">BULK QTY</label>
              <div className="flex mt-1">
                <button type="button" className="h-10 w-10 border border-gray-200 rounded-l-lg" onClick={() => setBulkQty((n) => Math.max(1, n - 1))}>
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  className="input rounded-none border-x-0 text-center"
                  value={bulkQty}
                  onChange={(e) => setBulkQty(Math.max(1, Number(e.target.value) || 1))}
                />
                <button type="button" className="h-10 w-10 border border-gray-200 rounded-r-lg" onClick={() => setBulkQty((n) => n + 1)}>
                  +
                </button>
              </div>
            </div>
            <div className="h-10 w-10 mb-0.5 rounded-full bg-emerald-50 text-emerald-700 grid place-items-center">
              <ArrowLeftRight size={16} />
            </div>
            <div>
              <label className="text-[11px] font-bold tracking-wide text-gray-600">YIELD / UNIT</label>
              <div className="flex mt-1">
                <button type="button" className="h-10 w-10 border border-gray-200 rounded-l-lg" onClick={() => setYieldUnit((n) => Math.max(1, n - 1))}>
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  className="input rounded-none border-x-0 text-center"
                  value={yieldUnit}
                  onChange={(e) => setYieldUnit(Math.max(1, Number(e.target.value) || 1))}
                />
                <button type="button" className="h-10 w-10 border border-gray-200 rounded-r-lg" onClick={() => setYieldUnit((n) => n + 1)}>
                  +
                </button>
              </div>
            </div>
          </div>

          <div>
            <div className="text-[11px] font-bold tracking-wide text-gray-600 mb-2">DESTINATION PRODUCT</div>
            <div className="relative">
              <Search size={14} className="input-icon" />
              <input
                className="input has-icon"
                placeholder="Search ALL products to convert into..."
                value={destQ}
                onChange={(e) => setDestQ(e.target.value)}
              />
            </div>
            <div className="mt-2 max-h-28 overflow-auto border border-gray-100 rounded-lg">
              {destList.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`w-full text-left px-3 py-2 text-sm border-b border-gray-50 last:border-0 ${
                    String(p.id) === toId ? "bg-sky-50" : "hover:bg-gray-50"
                  }`}
                  onClick={() => {
                    setToId(String(p.id));
                    setDestQ(p.displayName);
                  }}
                >
                  <div className="font-medium">{p.displayName}</div>
                  <div className="text-xs text-gray-500">{p.barcode || p.code || p.id}</div>
                </button>
              ))}
            </div>
            {to && <div className="text-xs text-sky-700 mt-1 font-semibold">Selected: {to.displayName}</div>}
          </div>

          <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wide text-emerald-800">YIELD PREVIEW</span>
            <span className="text-xl font-bold text-emerald-900">{yieldPreview} Units</span>
          </div>

          <button type="submit" disabled={busy || !fromId || !toId} className="w-full h-12 rounded-xl bg-slate-700 hover:bg-slate-800 text-white font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50">
            <ArrowLeftRight size={16} />
            {busy ? "Converting…" : "EXECUTE CONVERSION"}
          </button>
        </div>
      </form>
    </div>
  );
}

type ReturnModalProps = {
  open: boolean;
  onClose: () => void;
  currency: string;
  onDone: (msg: string) => void;
};

export function ReturnRefundModal({ open, onClose, currency, onDone }: ReturnModalProps) {
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoice, setInvoice] = useState<any>(null);
  const [qtyMap, setQtyMap] = useState<Record<number, number>>({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setInvoiceNo("");
    setInvoice(null);
    setQtyMap({});
    setError("");
  }, [open]);

  async function loadInvoice(e?: FormEvent) {
    e?.preventDefault();
    if (!invoiceNo.trim()) {
      setError("Enter an invoice number");
      return;
    }
    setLoading(true);
    setError("");
    setInvoice(null);
    try {
      const { data } = await api.get(`/pos/invoice/${encodeURIComponent(invoiceNo.trim())}`);
      if (!data?.success) throw new Error(data?.message || "Not found");
      const inv = data.data;
      setInvoice(inv);
      const next: Record<number, number> = {};
      for (const it of inv.items || []) {
        next[it.id] = 0;
      }
      setQtyMap(next);
    } catch (err) {
      const ax = err as { response?: { data?: { message?: string } }; message?: string };
      setError(ax.response?.data?.message || ax.message || "Invoice not found");
    } finally {
      setLoading(false);
    }
  }

  async function processReturn(mode: "return" | "exchange") {
    if (!invoice) return;
    const items = (invoice.items || [])
      .map((i: any) => ({
        id: i.id,
        variantId: i.variantId,
        returnQuantity: Number(qtyMap[i.id] || 0),
        price: i.price,
      }))
      .filter((i: any) => i.returnQuantity > 0);
    if (!items.length) {
      setError("Select at least one item quantity to return");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/pos/return", {
        invoiceNo: invoice.invoiceNo,
        items,
        note: mode === "exchange" ? "Exchange" : "Return",
      });
      if (!data?.success) throw new Error(data?.message || "Return failed");
      onDone(mode === "exchange" ? `Exchange processed for ${invoice.invoiceNo}` : `Return processed for ${invoice.invoiceNo}`);
      onClose();
    } catch (err) {
      const ax = err as { response?: { data?: { message?: string } }; message?: string };
      setError(ax.response?.data?.message || ax.message || "Return failed");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/45 grid place-items-center p-4" onClick={() => !busy && onClose()}>
      <div
        className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-gray-100 overflow-hidden max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-100 flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-amber-100 text-amber-700 grid place-items-center shrink-0">
            <RotateCcw size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-gray-900">Return / Refund</h2>
            <div className="text-[11px] font-bold tracking-wide text-gray-500">ENTER INVOICE NUMBER TO PROCESS RETURN</div>
          </div>
          <button type="button" className="h-8 w-8 rounded-lg hover:bg-gray-100 grid place-items-center" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-auto">
          {error && <ErrorBox text={error} />}
          <form onSubmit={loadInvoice} className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-[11px] font-bold tracking-wide text-gray-600">INVOICE NUMBER</label>
              <div className="relative mt-1">
                <Search size={14} className="input-icon" />
                <input
                  className="input has-icon border-amber-300 focus:border-amber-500"
                  placeholder="Scan or enter invoice number..."
                  value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading || !invoiceNo.trim()}
              className="h-10 px-4 rounded-lg bg-slate-700 text-white font-bold text-sm disabled:bg-gray-200 disabled:text-gray-500"
            >
              {loading ? "Loading…" : "LOAD INVOICE"}
            </button>
          </form>

          {!invoice ? (
            <div className="min-h-[220px] border border-dashed border-gray-200 rounded-xl grid place-items-center text-center p-8">
              <div>
                <div className="mx-auto h-12 w-12 rounded-full bg-gray-50 text-gray-400 grid place-items-center mb-3">
                  <FileText size={22} />
                </div>
                <div className="font-semibold text-gray-700">No Invoice Loaded</div>
                <div className="text-sm text-gray-500 mt-1">Enter or scan an invoice number above to start the return process.</div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm text-gray-600">
                <span className="font-bold text-gray-900">{invoice.invoiceNo}</span>
                {" · "}
                {money(invoice.total, currency)}
                {invoice.customer?.name ? ` · ${invoice.customer.name}` : ""}
              </div>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-800 text-white text-left">
                      <th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2">Sold</th>
                      <th className="px-3 py-2">Left</th>
                      <th className="px-3 py-2">Return qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(invoice.items || []).map((it: any) => (
                      <tr key={it.id} className="border-b border-gray-100">
                        <td className="px-3 py-2 font-medium">
                          {it.variant?.product?.name || `Item ${it.variantId}`}
                        </td>
                        <td className="px-3 py-2">{it.qty}</td>
                        <td className="px-3 py-2">{it.remainingQty ?? it.qty}</td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={0}
                            max={Number(it.remainingQty ?? it.qty)}
                            className="input !h-9 w-24"
                            value={qtyMap[it.id] ?? 0}
                            onChange={(e) =>
                              setQtyMap((prev) => ({
                                ...prev,
                                [it.id]: Math.max(0, Math.min(Number(it.remainingQty ?? it.qty), Number(e.target.value) || 0)),
                              }))
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void processReturn("return")}
                  className="flex-1 h-11 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold"
                >
                  {busy ? "Processing…" : "Process Return"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void processReturn("exchange")}
                  className="flex-1 h-11 rounded-xl bg-slate-700 hover:bg-slate-800 text-white font-bold"
                >
                  Exchange
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type HeldDrawerProps = {
  open: boolean;
  onClose: () => void;
  bills: HeldBillRow[];
  currency: string;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
};

export function HeldBillsDrawer({ open, onClose, bills, currency, onRestore, onDelete }: HeldDrawerProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="relative w-full max-w-md h-full bg-white shadow-2xl border-l border-gray-100 flex flex-col animate-in slide-in-from-right">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Held Bills</h2>
            <div className="text-[11px] font-bold tracking-wide text-pink-600">{bills.length} BILLS ON HOLD</div>
          </div>
          <button type="button" className="h-8 w-8 rounded-lg hover:bg-gray-100 grid place-items-center" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4 space-y-2">
          {bills.map((b) => {
            const total = b.cart.reduce((s, i) => s + i.price * i.qty - i.discount, 0);
            return (
              <div key={b.id} className="border border-gray-200 rounded-xl p-3">
                <div className="flex items-start gap-2">
                  <div className="h-9 w-9 rounded-lg bg-pink-50 text-pink-600 grid place-items-center shrink-0">
                    <Pause size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm">{b.id}</div>
                    <div className="text-xs text-gray-500">
                      {new Date(b.savedAt).toLocaleString()} · {b.cart.length} lines
                      {b.customerQuery ? ` · ${b.customerQuery}` : ""}
                    </div>
                    <div className="text-sm font-semibold text-emerald-700 mt-1">{money(total, currency)}</div>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button type="button" className="btn btn-primary flex-1 text-xs !py-2" onClick={() => onRestore(b.id)}>
                    Restore
                  </button>
                  <button type="button" className="btn btn-muted text-xs !py-2 text-red-600" onClick={() => onDelete(b.id)}>
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
          {!bills.length && (
            <div className="min-h-[240px] grid place-items-center text-center p-6">
              <div>
                <div className="mx-auto h-12 w-12 rounded-full bg-pink-50 text-pink-500 grid place-items-center mb-3">
                  <Pause size={22} />
                </div>
                <div className="font-semibold text-gray-700">No bills on hold</div>
                <div className="text-sm text-gray-500 mt-1">Hold a bill using the button in the header or press F4.</div>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
