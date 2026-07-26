import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Eye,
  FileText,
  Printer,
  RefreshCw,
  Search,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import api from "../api";
import { ErrorBox, PageHeader, SubNav } from "../components/ui";

function lkr(n: number) {
  return `LKR ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDt(v: string | Date) {
  const d = new Date(v);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function MiniSpark({ stroke = "#16a34a" }: { stroke?: string }) {
  return (
    <svg width="72" height="28" viewBox="0 0 72 28" className="opacity-80">
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        points="0,20 10,18 20,22 30,12 40,16 50,8 60,14 72,6"
      />
    </svg>
  );
}

export function SalesHome() {
  return (
    <div>
      <PageHeader title="Sales" subtitle="Invoices, user sales and returns" />
      <SubNav
        items={[
          { to: "/sales/manage-invoice", label: "Manage Invoice" },
          { to: "/sales/manage-user-sales", label: "User Sales" },
          { to: "/sales/return-history", label: "Return History" },
        ]}
      />
    </div>
  );
}

export function ManageInvoice() {
  const [rows, setRows] = useState<any[]>([]);
  const [returns, setReturns] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<any | null>(null);
  const [cursor, setCursor] = useState(0);
  const pageSize = 10;

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [inv, ret] = await Promise.all([api.get("/sales/invoices"), api.get("/pos/returns")]);
      setRows(inv.data.data || []);
      setReturns(ret.data.data || []);
    } catch (e: any) {
      setError(e.message || "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const refundByInvoice = useMemo(() => {
    const map = new Map<number, number>();
    for (const r of returns) {
      const id = r.invoiceId || r.invoice?.id;
      if (!id) continue;
      map.set(id, (map.get(id) || 0) + Number(r.total || 0));
    }
    return map;
  }, [returns]);

  const enriched = useMemo(() => {
    return rows.map((r) => {
      const refund = refundByInvoice.get(r.id) || 0;
      const balance = Math.max(0, Number(r.total || 0) - Number(r.paidAmount || 0));
      return { ...r, refund, balance };
    });
  }, [rows, refundByInvoice]);

  const filtered = useMemo(() => {
    return enriched.filter((r) => {
      if (invoiceNo && !String(r.invoiceNo).toLowerCase().includes(invoiceNo.toLowerCase())) return false;
      const created = new Date(r.createdAt);
      if (fromDate) {
        const from = new Date(fromDate);
        from.setHours(0, 0, 0, 0);
        if (created < from) return false;
      }
      if (toDate) {
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);
        if (created > to) return false;
      }
      return true;
    });
  }, [enriched, invoiceNo, fromDate, toDate]);

  const stats = useMemo(() => {
    const today = new Date();
    const todayRows = enriched.filter((r) => isSameDay(new Date(r.createdAt), today));
    const todaySales = todayRows.reduce((s, r) => s + Number(r.total || 0), 0);
    const todayRefunded = todayRows.reduce((s, r) => s + Number(r.refund || 0), 0);
    const todayProfit = todayRows.reduce((s, r) => {
      const cost = (r.items || []).reduce(
        (a: number, it: any) => a + Number(it.qty || 0) * Number(it.variant?.cost || 0),
        0
      );
      return s + Number(r.total || 0) - cost;
    }, 0);
    return {
      todaySales,
      totalInvoices: enriched.length,
      todayInvoices: todayRows.length,
      todayProfit,
      todayRefunded,
    };
  }, [enriched]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const showingFrom = filtered.length ? (currentPage - 1) * pageSize + 1 : 0;
  const showingTo = Math.min(currentPage * pageSize, filtered.length);
  const activeRow = pageRows[Math.min(cursor, Math.max(0, pageRows.length - 1))] || null;

  useEffect(() => {
    setCursor(0);
  }, [currentPage, invoiceNo, fromDate, toDate, filtered.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      const typing = tag === "input" || tag === "textarea" || tag === "select" || (e.target as HTMLElement)?.isContentEditable;
      if (e.key === "Escape" && selected) {
        e.preventDefault();
        setSelected(null);
        return;
      }
      if (typing && e.key !== "Escape") return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => Math.min(pageRows.length - 1, c + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => Math.max(0, c - 1));
      } else if (e.key === "Enter" && activeRow) {
        e.preventDefault();
        setSelected(activeRow);
      } else if ((e.key === "p" || e.key === "P") && activeRow) {
        e.preventDefault();
        printInvoice(activeRow);
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        const el = document.querySelector<HTMLInputElement>("[data-page-search]");
        el?.focus();
        el?.select();
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        resetFilters();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pageRows, activeRow, selected]);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    setPage(1);
  }

  function resetFilters() {
    setInvoiceNo("");
    setFromDate("");
    setToDate("");
    setPage(1);
    setCursor(0);
    void load();
  }

  function printInvoice(row: any) {
    const w = window.open("", "_blank", "width=720,height=900");
    if (!w) return;
    w.document.write(`
      <html><head><title>${row.invoiceNo}</title>
      <style>body{font-family:Arial;padding:24px}h1{margin:0 0 8px}table{width:100%;border-collapse:collapse;margin-top:16px}
      th,td{border-bottom:1px solid #ddd;padding:8px;text-align:left}</style></head>
      <body>
        <h1>QUANTUMEXE Invoice</h1>
        <div>${row.invoiceNo}</div>
        <div>Customer: ${row.customer?.name || "Guest"}</div>
        <div>Cashier: ${row.user?.name || "-"}</div>
        <div>Date: ${formatDt(row.createdAt)}</div>
        <table><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
        <tbody>
          ${(row.items || [])
            .map(
              (it: any) =>
                `<tr><td>${it.variant?.product?.name || it.variantId}</td><td>${it.qty}</td><td>${it.price}</td><td>${
                  it.qty * it.price - (it.discount || 0)
                }</td></tr>`
            )
            .join("")}
        </tbody></table>
        <h3>Net Total: ${lkr(row.total)}</h3>
      </body></html>
    `);
    w.document.close();
    w.focus();
    w.print();
  }

  const cards = [
    {
      label: "Today Sales",
      value: lkr(stats.todaySales),
      badge: "+12.5%",
      up: true,
      tag: "TOTAL VOLUME",
      highlight: true,
    },
    { label: "Total Invoices Count", value: String(stats.totalInvoices), tag: "STATS" },
    { label: "Today Invoices", value: String(stats.todayInvoices), tag: "STATS" },
    {
      label: "Today Profit",
      value: lkr(stats.todayProfit),
      badge: "-5.4%",
      up: false,
      tag: "STATS",
    },
    { label: "Today Refunded", value: lkr(stats.todayRefunded), tag: "STATS" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Manage Invoices</h1>
        </div>
        <div className="text-[11px] text-gray-500 flex flex-wrap gap-x-3 gap-y-1">
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-gray-100 border text-gray-700">↑↓</kbd> Navigate
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-gray-100 border text-gray-700">Enter</kbd> View
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-gray-100 border text-gray-700">P</kbd> Print
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-gray-100 border text-gray-700">F</kbd> Search
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-gray-100 border text-gray-700">R</kbd> Reset
          </span>
        </div>
      </div>

      {error && <ErrorBox text={error} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className={`rounded-xl border p-4 relative overflow-hidden ${
              c.highlight ? "bg-green-600 text-white border-green-600" : "bg-white border-gray-200"
            }`}
          >
            <div className={`text-xs font-medium ${c.highlight ? "text-green-100" : "text-gray-500"}`}>{c.label}</div>
            <div className="mt-1 flex items-start justify-between gap-2">
              <div className="text-xl font-bold leading-tight">{c.value}</div>
              {c.badge && (
                <span
                  className={`inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${
                    c.up ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                  } ${c.highlight ? "!bg-white/20 !text-white" : ""}`}
                >
                  {c.up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                  {c.badge}
                </span>
              )}
            </div>
            <div className="mt-3 flex items-end justify-between">
              <div className={`text-[10px] font-semibold tracking-wide ${c.highlight ? "text-green-100" : "text-gray-400"}`}>
                {c.tag}
              </div>
              <MiniSpark stroke={c.highlight ? "#ffffff" : "#16a34a"} />
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={onSearch} className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr_1fr_auto_auto] gap-3 items-end">
          <div>
            <label className="text-xs font-semibold text-gray-600">Invoice Number</label>
            <input
              data-page-search
              className="input mt-1"
              placeholder="Search invoice #"
              value={invoiceNo}
              onChange={(e) => setInvoiceNo(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">From Date</label>
            <input type="date" className="input mt-1" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">To Date</label>
            <input type="date" className="input mt-1" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary h-[42px] px-5">
            <Search size={16} /> SEARCH
          </button>
          <button
            type="button"
            onClick={resetFilters}
            className="h-[42px] w-[42px] rounded-full bg-gray-800 text-white grid place-items-center hover:bg-gray-700"
            title="Refresh / Reset"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </form>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="text-sm font-bold tracking-wide text-gray-800">INVOICE MATRIX</div>
        </div>
        <div className="overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-green-700 text-white">
                {["ID", "Invoice Number", "Customer", "Net Total", "Date & Time", "Balance", "Refund", "Cashier", "Action"].map(
                  (h) => (
                    <th key={h} className="text-left font-semibold px-3 py-3 whitespace-nowrap">
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r, idx) => (
                <tr
                  key={r.id}
                  onClick={() => setCursor(idx)}
                  className={`${idx === cursor ? "bg-emerald-100 ring-1 ring-inset ring-emerald-300" : idx % 2 === 0 ? "bg-green-50/40" : "bg-white"} cursor-pointer`}
                >
                  <td className="px-3 py-3 font-semibold text-gray-700">#{r.id}</td>
                  <td className="px-3 py-3">
                    <div className="font-semibold text-gray-800">{r.invoiceNo}</div>
                    <button
                      type="button"
                      className="text-[10px] font-bold tracking-wide text-green-700 hover:underline"
                      onClick={() => setSelected(r)}
                    >
                      TRANSACTION LOG
                    </button>
                  </td>
                  <td className="px-3 py-3 text-gray-700">{r.customer?.name || "Guest"}</td>
                  <td className="px-3 py-3 font-semibold text-green-700">{lkr(r.total)}</td>
                  <td className="px-3 py-3 text-gray-600 whitespace-nowrap">{formatDt(r.createdAt)}</td>
                  <td className="px-3 py-3 text-gray-700">{lkr(r.balance)}</td>
                  <td className="px-3 py-3 text-gray-700">{lkr(r.refund)}</td>
                  <td className="px-3 py-3">
                    <div className="inline-flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-gray-700">{r.user?.name || "-"}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        title="View"
                        onClick={() => setSelected(r)}
                        className="w-8 h-8 rounded-full bg-blue-500 text-white grid place-items-center hover:bg-blue-600"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        type="button"
                        title="Print"
                        onClick={() => printInvoice(r)}
                        className="w-8 h-8 rounded-full bg-green-500 text-white grid place-items-center hover:bg-green-600"
                      >
                        <Printer size={14} />
                      </button>
                      <button
                        type="button"
                        title="Log"
                        onClick={() => setSelected(r)}
                        className="w-8 h-8 rounded-full bg-slate-700 text-white grid place-items-center hover:bg-slate-800"
                      >
                        <FileText size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!pageRows.length && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-gray-500">
                    No invoices found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-gray-500">
            Showing {showingFrom} to {showingTo} of {filtered.length} results
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="px-3 py-1.5 text-sm rounded-md border border-gray-200 disabled:opacity-40"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .slice(0, 5)
              .map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  className={`w-8 h-8 text-sm rounded-md border ${
                    n === currentPage ? "bg-green-600 text-white border-green-600" : "border-gray-200 text-gray-700"
                  }`}
                >
                  {n}
                </button>
              ))}
            <button
              type="button"
              className="px-3 py-1.5 text-sm rounded-md border border-gray-200 disabled:opacity-40"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-xl w-full max-w-lg p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-bold">{selected.invoiceNo}</div>
                <div className="text-sm text-gray-500">{formatDt(selected.createdAt)}</div>
              </div>
              <button className="btn btn-muted" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
            <div className="text-sm space-y-1">
              <div>Customer: <strong>{selected.customer?.name || "Guest"}</strong></div>
              <div>Cashier: <strong>{selected.user?.name || "-"}</strong></div>
              <div>Payment: <strong>{selected.paymentType}</strong></div>
              <div>Net Total: <strong className="text-green-700">{lkr(selected.total)}</strong></div>
              <div>Balance: <strong>{lkr(selected.balance)}</strong></div>
              <div>Refund: <strong>{lkr(selected.refund)}</strong></div>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <table className="table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {(selected.items || []).map((it: any) => (
                    <tr key={it.id}>
                      <td>{it.variant?.product?.name || `Variant #${it.variantId}`}</td>
                      <td>{it.qty}</td>
                      <td>{lkr(it.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className="btn btn-primary" onClick={() => printInvoice(selected)}>
              <Printer size={16} /> Print
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function UserSales() {
  const [rows, setRows] = useState<any[]>([]);
  const [cashiers, setCashiers] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [invoiceId, setInvoiceId] = useState("");
  const [cashierId, setCashierId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<any | null>(null);
  const pageSize = 10;

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [inv, users] = await Promise.all([api.get("/sales/invoices"), api.get("/users/all")]);
      setRows(inv.data.data || []);
      setCashiers(users.data.data || []);
    } catch (e: any) {
      setError(e.message || "Failed to load user sales");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const enriched = useMemo(() => {
    return rows.map((r) => {
      const gross = Number(r.subtotal ?? r.total ?? 0);
      const discount = Number(r.discount || 0);
      const net = Number(r.total || 0);
      const profit = (r.items || []).reduce((a: number, it: any) => {
        const line = Number(it.qty || 0) * Number(it.price || 0) - Number(it.discount || 0);
        const cost = Number(it.qty || 0) * Number(it.variant?.cost || 0);
        return a + (line - cost);
      }, 0);
      const balance = Math.max(0, net - Number(r.paidAmount || 0));
      return { ...r, gross, discount, net, profit, balance };
    });
  }, [rows]);

  const filtered = useMemo(() => {
    return enriched.filter((r) => {
      if (invoiceId) {
        const q = invoiceId.toLowerCase();
        if (!String(r.invoiceNo).toLowerCase().includes(q) && !String(r.id).includes(q)) return false;
      }
      if (cashierId && String(r.userId) !== String(cashierId)) return false;
      const created = new Date(r.createdAt);
      if (fromDate) {
        const from = new Date(fromDate);
        from.setHours(0, 0, 0, 0);
        if (created < from) return false;
      }
      if (toDate) {
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);
        if (created > to) return false;
      }
      return true;
    });
  }, [enriched, invoiceId, cashierId, fromDate, toDate]);

  const stats = useMemo(() => {
    const today = new Date();
    const todayRows = enriched.filter((r) => isSameDay(new Date(r.createdAt), today));
    return {
      todaySales: todayRows.reduce((s, r) => s + Number(r.net || r.total || 0), 0),
      totalInvoices: enriched.length,
      todayInvoices: todayRows.length,
      todayProfit: todayRows.reduce((s, r) => s + Number(r.profit || 0), 0),
      todayRefunded: 0,
    };
  }, [enriched]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const showingFrom = filtered.length ? (currentPage - 1) * pageSize + 1 : 0;
  const showingTo = Math.min(currentPage * pageSize, filtered.length);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    setPage(1);
  }

  function resetFilters() {
    setInvoiceId("");
    setCashierId("");
    setFromDate("");
    setToDate("");
    setPage(1);
    load();
  }

  function printInvoice(row: any) {
    const w = window.open("", "_blank", "width=720,height=900");
    if (!w) return;
    w.document.write(`
      <html><head><title>${row.invoiceNo}</title>
      <style>body{font-family:Arial;padding:24px}table{width:100%;border-collapse:collapse;margin-top:16px}
      th,td{border-bottom:1px solid #ddd;padding:8px;text-align:left}</style></head>
      <body>
        <h1>QUANTUMEXE User Sale</h1>
        <div>${row.invoiceNo}</div>
        <div>Customer: ${row.customer?.name || "Guest"}</div>
        <div>Cashier: ${row.user?.name || "-"}</div>
        <div>Date: ${formatDt(row.createdAt)}</div>
        <h3>Net Total: ${lkr(row.net ?? row.total)}</h3>
      </body></html>
    `);
    w.document.close();
    w.focus();
    w.print();
  }

  const cards = [
    {
      label: "TODAY SALES",
      value: lkr(stats.todaySales),
      badge: "+12.5%",
      up: true,
      tag: "TOTAL VOLUME",
      highlight: true,
    },
    { label: "TOTAL INVOICES COUNT", value: String(stats.totalInvoices), tag: "Total", badgeRight: "Total" },
    { label: "TODAY INVOICES", value: String(stats.todayInvoices), tag: "Today", badgeRight: "Today" },
    {
      label: "TODAY PROFIT",
      value: lkr(stats.todayProfit),
      badge: "+5.4%",
      up: true,
      tag: "STATS",
    },
    { label: "TODAY REFUNDED", value: lkr(stats.todayRefunded), tag: "Today", badgeRight: "Today" },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-800">User Sales Management</h1>
      {error && <ErrorBox text={error} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className={`rounded-xl border p-4 relative overflow-hidden ${
              c.highlight ? "bg-emerald-500 text-white border-emerald-500" : "bg-white border-gray-200"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className={`text-[11px] font-semibold tracking-wide ${c.highlight ? "text-emerald-50" : "text-gray-500"}`}>
                {c.label}
              </div>
              {c.badgeRight && !c.highlight && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{c.badgeRight}</span>
              )}
              {c.badge && (
                <span
                  className={`inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${
                    c.highlight ? "bg-white/20 text-white" : c.up ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                  }`}
                >
                  {c.up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                  {c.badge}
                </span>
              )}
            </div>
            <div className="mt-2 text-xl font-bold">{c.value}</div>
            <div className="mt-3 flex items-end justify-between">
              <div className={`text-[10px] font-semibold tracking-wide ${c.highlight ? "text-emerald-50" : "text-gray-400"}`}>
                {c.tag}
              </div>
              <MiniSpark stroke={c.highlight ? "#ffffff" : "#10b981"} />
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={onSearch} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <div className="text-[11px] text-gray-500 flex flex-wrap gap-x-3 gap-y-1 justify-end">
          <span><kbd className="px-1.5 py-0.5 rounded bg-gray-100 border">N</kbd> Navigate</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-gray-100 border">Enter</kbd> View</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-gray-100 border">P</kbd> Print</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-gray-100 border">F</kbd> Search</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-gray-100 border">R</kbd> Reset</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_1fr_auto_auto] gap-3 items-end">
          <div>
            <label className="text-xs font-semibold text-gray-600">INVOICE ID</label>
            <input
              className="input mt-1"
              placeholder="Invoice ID"
              value={invoiceId}
              onChange={(e) => setInvoiceId(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">CASHIER NAME</label>
            <select className="input mt-1" value={cashierId} onChange={(e) => setCashierId(e.target.value)}>
              <option value="">All Cashiers</option>
              {cashiers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">FROM DATE</label>
            <input type="date" className="input mt-1" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">TO DATE</label>
            <input type="date" className="input mt-1" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary h-[42px] px-5">
            <Search size={16} /> SEARCH
          </button>
          <button
            type="button"
            onClick={resetFilters}
            className="h-[42px] w-[42px] rounded-full bg-gray-800 text-white grid place-items-center hover:bg-gray-700"
            title="Reset"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </form>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="text-sm font-bold tracking-wide text-gray-800">USER SALES MATRIX</div>
        </div>
        <div className="overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-emerald-600 text-white">
                {[
                  "ID",
                  "CUSTOMER",
                  "GROSS",
                  "DISCOUNT",
                  "NET TOTAL",
                  "PROFIT",
                  "BALANCE",
                  "CASHIER",
                  "DATE & TIME",
                  "ACTION",
                ].map((h) => (
                  <th key={h} className="text-left font-semibold px-3 py-3 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r, idx) => (
                <tr key={r.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="px-3 py-3">
                    <div className="font-semibold text-gray-800">#{r.id}</div>
                    <div className="text-[11px] text-gray-500">{r.invoiceNo}</div>
                  </td>
                  <td className="px-3 py-3 text-gray-700">{r.customer?.name || "Guest"}</td>
                  <td className="px-3 py-3 text-gray-700">{lkr(r.gross)}</td>
                  <td className="px-3 py-3 text-gray-700">{lkr(r.discount)}</td>
                  <td className="px-3 py-3 font-semibold text-gray-800">{lkr(r.net)}</td>
                  <td className="px-3 py-3 font-semibold text-blue-600">{lkr(r.profit)}</td>
                  <td className="px-3 py-3 text-gray-700">{lkr(r.balance)}</td>
                  <td className="px-3 py-3">
                    <div className="inline-flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      <span>{r.user?.name || "-"}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-gray-600 whitespace-nowrap">{formatDt(r.createdAt)}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        title="View"
                        onClick={() => setSelected(r)}
                        className="w-8 h-8 rounded-full bg-blue-500 text-white grid place-items-center hover:bg-blue-600"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        type="button"
                        title="Print"
                        onClick={() => printInvoice(r)}
                        className="w-8 h-8 rounded-full bg-blue-500 text-white grid place-items-center hover:bg-blue-600"
                      >
                        <Printer size={14} />
                      </button>
                      <button
                        type="button"
                        title="Details"
                        onClick={() => setSelected(r)}
                        className="w-8 h-8 rounded-full bg-blue-500 text-white grid place-items-center hover:bg-blue-600"
                      >
                        <FileText size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!pageRows.length && (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-gray-500">
                    No user sales found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-gray-500">
            Showing {showingFrom} to {showingTo} of {filtered.length} results
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="px-3 py-1.5 text-sm rounded-md border border-gray-200 disabled:opacity-40"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .slice(0, 5)
              .map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  className={`w-8 h-8 text-sm rounded-md border ${
                    n === currentPage ? "bg-emerald-600 text-white border-emerald-600" : "border-gray-200 text-gray-700"
                  }`}
                >
                  {n}
                </button>
              ))}
            <button
              type="button"
              className="px-3 py-1.5 text-sm rounded-md border border-gray-200 disabled:opacity-40"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-xl w-full max-w-lg p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-bold">#{selected.id} · {selected.invoiceNo}</div>
                <div className="text-sm text-gray-500">{formatDt(selected.createdAt)}</div>
              </div>
              <button className="btn btn-muted" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
            <div className="text-sm space-y-1">
              <div>Customer: <strong>{selected.customer?.name || "Guest"}</strong></div>
              <div>Cashier: <strong>{selected.user?.name || "-"}</strong></div>
              <div>Gross: <strong>{lkr(selected.gross)}</strong></div>
              <div>Discount: <strong>{lkr(selected.discount)}</strong></div>
              <div>Net Total: <strong>{lkr(selected.net)}</strong></div>
              <div>Profit: <strong className="text-blue-600">{lkr(selected.profit)}</strong></div>
            </div>
            <button className="btn btn-primary" onClick={() => printInvoice(selected)}>
              <Printer size={16} /> Print
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ReturnHistory() {
  const [rows, setRows] = useState<any[]>([]);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [invoice, setInvoice] = useState<any>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  async function load() {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/pos/returns");
      setRows(data.data || []);
    } catch (e: any) {
      setError(e.message || "Failed to load returns");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const inv = String(r.invoice?.invoiceNo || "");
      if (invoiceNo && !inv.toLowerCase().includes(invoiceNo.toLowerCase())) return false;
      const created = new Date(r.createdAt);
      if (fromDate) {
        const from = new Date(fromDate);
        from.setHours(0, 0, 0, 0);
        if (created < from) return false;
      }
      if (toDate) {
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);
        if (created > to) return false;
      }
      return true;
    });
  }, [rows, invoiceNo, fromDate, toDate]);

  const stats = useMemo(() => {
    const totalReturns = filtered.length;
    const returnValue = filtered.reduce((s, r) => s + Number(r.total || 0), 0);
    const users = new Set(filtered.map((r) => r.userId || r.user?.id).filter(Boolean));
    return {
      totalReturns,
      returnValue,
      totalRefunded: returnValue,
      avgReturnTime: totalReturns ? "Recent" : "-",
      activeUsers: users.size,
    };
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const showingFrom = filtered.length ? (currentPage - 1) * pageSize + 1 : 0;
  const showingTo = Math.min(currentPage * pageSize, filtered.length);

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    setPage(1);
    if (!invoiceNo.trim()) return;
    try {
      const { data } = await api.get(`/pos/invoice/${invoiceNo.trim()}`);
      setInvoice(data.data);
      setMsg("");
    } catch {
      setInvoice(null);
    }
  }

  function resetFilters() {
    setInvoiceNo("");
    setFromDate("");
    setToDate("");
    setInvoice(null);
    setPage(1);
    load();
  }

  async function processReturn() {
    if (!invoice) return;
    try {
      const { data } = await api.post("/pos/return", {
        invoiceNo: invoice.invoiceNo,
        items: invoice.items.map((i: any) => ({
          id: i.id,
          variantId: i.variantId,
          returnQuantity: i.qty,
          price: i.price,
          discount: i.discount,
        })),
      });
      if (!data.success) throw new Error(data.message);
      setMsg("Return processed");
      setInvoice(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Return failed");
    }
  }

  const cards = [
    { label: "Total Returns", value: String(stats.totalReturns), tag: "GLOBAL STATS", badge: "All Time", highlight: true },
    { label: "Return Value", value: lkr(stats.returnValue), tag: "RECORDS", badge: "This Year" },
    { label: "Total Refunded", value: lkr(stats.totalRefunded), tag: "RECORDS", badge: "Cash Out" },
    { label: "Avg Return Time", value: stats.avgReturnTime, tag: "RECORDS", badge: "Recent" },
    { label: "Active Users", value: String(stats.activeUsers), tag: "RECORDS", badge: "Users" },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-red-600">Return History</h1>
      {error && <ErrorBox text={error} />}
      {msg && <div className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">{msg}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className={`rounded-xl border p-4 relative overflow-hidden ${
              c.highlight ? "bg-red-600 text-white border-red-600" : "bg-white border-red-200"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className={`text-xs font-medium ${c.highlight ? "text-red-100" : "text-gray-500"}`}>{c.label}</div>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  c.highlight ? "bg-white/20 text-white" : "bg-red-50 text-red-600"
                }`}
              >
                {c.badge}
              </span>
            </div>
            <div className="mt-2 text-xl font-bold">{c.value}</div>
            <div className="mt-3 flex items-end justify-between">
              <div className={`text-[10px] font-semibold tracking-wide ${c.highlight ? "text-red-100" : "text-gray-400"}`}>
                {c.tag}
              </div>
              <MiniSpark stroke={c.highlight ? "#fecaca" : "#ef4444"} />
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={onSearch} className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr_auto_auto] gap-3 items-end">
          <div>
            <label className="text-xs font-semibold text-gray-600">Invoice Number</label>
            <div className="relative mt-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="input pl-9"
                placeholder="Search Invoice... (F)"
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">From Date</label>
            <input type="date" className="input mt-1" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">To Date</label>
            <input type="date" className="input mt-1" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <button type="submit" className="h-[42px] px-5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold inline-flex items-center justify-center gap-2">
            <Search size={16} /> Search
          </button>
          <button
            type="button"
            onClick={resetFilters}
            className="h-[42px] w-[42px] rounded-full bg-gray-800 text-white grid place-items-center hover:bg-gray-700"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </form>

      {invoice && (
        <div className="bg-white border border-red-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            Process return for <strong>{invoice.invoiceNo}</strong> ({invoice.customer?.name || "Guest"}) —{" "}
            <strong className="text-red-600">{lkr(invoice.total)}</strong>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-muted" onClick={() => setInvoice(null)}>
              Cancel
            </button>
            <button className="h-10 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold" onClick={processReturn}>
              Process Return
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <div className="text-sm font-bold tracking-wide text-gray-800">RETURN DIRECTORY</div>
        </div>
        <div className="overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-red-600 text-white">
                {["RETURN ID", "INVOICE NO", "CUSTOMER", "RETURN VALUE", "REFUNDED", "DATE & TIME", "USER"].map((h) => (
                  <th key={h} className="text-left font-semibold px-3 py-3 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r, idx) => (
                <tr key={r.id} className={idx % 2 === 0 ? "bg-white" : "bg-red-50/50"}>
                  <td className="px-3 py-3 font-semibold text-gray-800">#{r.id}</td>
                  <td className="px-3 py-3 text-gray-700">{r.invoice?.invoiceNo || "-"}</td>
                  <td className="px-3 py-3 text-gray-700">{r.invoice?.customer?.name || "Guest"}</td>
                  <td className="px-3 py-3 font-semibold text-red-600">{lkr(r.total)}</td>
                  <td className="px-3 py-3 font-semibold text-green-600">{lkr(r.total)}</td>
                  <td className="px-3 py-3 text-gray-600 whitespace-nowrap">
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-3 uppercase text-gray-700">{r.user?.name || "-"}</td>
                </tr>
              ))}
              {!pageRows.length && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-gray-500">
                    No returns found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-gray-500">
            Showing {showingFrom} to {showingTo} of {filtered.length} results
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="px-3 py-1.5 text-sm rounded-md border border-gray-200 disabled:opacity-40"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .slice(0, 5)
              .map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  className={`w-8 h-8 text-sm rounded-md border ${
                    n === currentPage ? "bg-red-600 text-white border-red-600" : "border-gray-200 text-gray-700"
                  }`}
                >
                  {n}
                </button>
              ))}
            <button
              type="button"
              className="px-3 py-1.5 text-sm rounded-md border border-gray-200 disabled:opacity-40"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

