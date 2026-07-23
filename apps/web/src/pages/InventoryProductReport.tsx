import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, Download, Lock, RefreshCw } from "lucide-react";
import api from "../api";
import { ErrorBox } from "../components/ui";

type Tab = "top" | "low" | "profit" | "soh";

function lkr(n: number, digits = 0) {
  return `LKR ${Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export default function InventoryProductReport() {
  const [tab, setTab] = useState<Tab>("top");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<any>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  async function load(e?: FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data: res } = await api.get("/reports/inventory-analytics", {
        params: {
          from: fromDate,
          to: toDate,
          categoryId: categoryId || undefined,
        },
      });
      setData(res.data);
      setPage(1);
    } catch (err: any) {
      setError(err.message || "Failed to load inventory report");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const summary = data?.summary || {
    inventoryValue: 0,
    totalProducts: 0,
    lowStockCount: 0,
    deadstockValue: 0,
  };
  const categories = data?.categories || [];
  const volumeTrend = data?.volumeTrend || [];
  const topSellers = data?.topSellers || [];
  const deadstock = data?.deadstock || [];
  const criticalReorder = data?.criticalReorder || [];
  const profitability = data?.profitability || [];

  const profitPages = Math.max(1, Math.ceil(profitability.length / pageSize));
  const profitPage = Math.min(page, profitPages);
  const profitRows = profitability.slice((profitPage - 1) * pageSize, profitPage * pageSize);

  const cards = useMemo(
    () => [
      {
        label: "Total Inventory Value",
        value: lkr(summary.inventoryValue),
        hint: "+100%",
        green: false,
      },
      {
        label: "Total Products",
        value: String(summary.totalProducts),
        hint: "CURRENT SNAPSHOT",
        green: true,
      },
      {
        label: "Low Stock Items",
        value: String(summary.lowStockCount),
        hint: `${summary.lowStockCount} items`,
        green: false,
      },
      {
        label: "Deadstock Value",
        value: lkr(summary.deadstockValue),
        hint: "+100%",
        green: false,
      },
    ],
    [summary]
  );

  const tabs: { id: Tab; label: string; soon?: boolean }[] = [
    { id: "top", label: "Top Sellers & Deadstock" },
    { id: "low", label: "Low Stock Alerts" },
    { id: "profit", label: "Profit Analysis (BETA)" },
    { id: "soh", label: "Stock on Hand", soon: true },
  ];

  function exportCsv() {
    const rows =
      tab === "low"
        ? [
            ["Product", "In Stock", "MRP", "Supplier", "Contact", "Status"],
            ...criticalReorder.map((r: any) => [r.name, r.inStock, r.mrp, r.supplier, r.contact, r.status]),
          ]
        : tab === "profit"
          ? [
              ["Product", "Unit Cost", "Selling Price", "Markup %", "GP %", "Status"],
              ...profitability.map((r: any) => [
                r.name,
                r.unitCost,
                r.sellingPrice,
                r.markup.toFixed(1),
                r.gp.toFixed(1),
                r.status,
              ]),
            ]
          : [
              ["Rank", "Product", "Revenue", "Units"],
              ...topSellers.map((r: any) => [r.rank, r.name, r.revenue, r.qty]),
            ];
    const blob = new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory-${tab}-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs text-gray-500 mb-1">Reports &gt; Inventory &amp; Products</div>
        <h1 className="text-2xl font-bold text-gray-900">Inventory &amp; Product Reports</h1>
      </div>
      {error && <ErrorBox text={error} />}

      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            disabled={t.soon}
            onClick={() => !t.soon && setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold border inline-flex items-center gap-2 ${
              t.soon
                ? "bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed"
                : tab === t.id
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
            }`}
          >
            {t.id === "low" && tab === "low" && <AlertTriangle size={14} />}
            {t.label}
            {t.soon && (
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">
                <Lock size={10} /> SOON
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className={`rounded-xl p-4 border ${
              c.green ? "bg-emerald-600 text-white border-emerald-600" : "bg-white border-gray-200"
            }`}
          >
            <div className={`text-xs font-semibold tracking-wide ${c.green ? "text-emerald-100" : "text-gray-500"}`}>
              {c.label}
            </div>
            <div className="mt-2 text-2xl font-bold">{c.value}</div>
            <div className={`mt-2 text-xs font-semibold ${c.green ? "text-emerald-100" : "text-emerald-600"}`}>
              {c.hint}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={load} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-[1.3fr_1fr_1fr_auto_auto] gap-3 items-end">
          <div>
            <label className="text-xs font-semibold text-gray-600">Category / Brand</label>
            <select className="input mt-1" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">All Categories</option>
              {categories.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">From Date</label>
            <input className="input mt-1" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">To Date</label>
            <input className="input mt-1" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary h-[42px] px-5 inline-flex items-center gap-2">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> GENERATE
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className="h-[42px] w-[42px] rounded-lg border border-gray-200 grid place-items-center text-gray-600 hover:bg-gray-50"
            title="Export"
          >
            <Download size={16} />
          </button>
        </div>
      </form>

      {tab === "top" && (
        <>
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="text-sm font-bold text-gray-800">Sales Volume Trend</div>
            <div className="text-xs text-gray-500 mb-3">Top performing products by units sold</div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={volumeTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="units" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="text-sm font-bold text-gray-800 mb-3">Top Performing Products</div>
              <div className="space-y-2">
                {topSellers.map((r: any) => (
                  <div key={r.rank} className="flex items-center justify-between gap-3 py-2 border-b border-gray-100 last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold grid place-items-center">
                        {r.rank}
                      </span>
                      <div>
                        <div className="font-semibold text-gray-800">{r.name}</div>
                        <div className="text-xs text-gray-500">{r.qty} units</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-emerald-700">{lkr(r.revenue)}</div>
                      <div className="text-[11px] text-emerald-600 font-semibold">+{r.growth}%</div>
                    </div>
                  </div>
                ))}
                {!topSellers.length && (
                  <div className="text-sm text-gray-400 py-8 text-center">No sales in this period.</div>
                )}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="text-sm font-bold text-gray-800">Deadstock (Slow Moving)</div>
                <button type="button" className="px-3 py-1.5 rounded-md bg-red-600 text-white text-xs font-bold">
                  CLEARANCE ALERT
                </button>
              </div>
              <div className="space-y-2">
                {deadstock.map((r: any) => (
                  <div key={r.variantId} className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0">
                    <button type="button" className="mt-0.5 w-7 h-7 rounded-full bg-gray-100 text-gray-500 grid place-items-center">
                      <RefreshCw size={12} />
                    </button>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-800">{r.name}</div>
                      <div className="text-xs text-gray-500">
                        Last sale {r.lastSaleDays >= 999 ? "never" : `${r.lastSaleDays} days ago`} · Qty: {r.qty}
                      </div>
                    </div>
                    <div className="font-bold text-gray-800">{lkr(r.value)}</div>
                  </div>
                ))}
                {!deadstock.length && (
                  <div className="text-sm text-gray-400 py-8 text-center">No deadstock detected.</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {tab === "low" && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold tracking-wide text-gray-800">CRITICAL REORDER LIST</div>
              <div className="text-xs text-gray-500">Items that have slipped below safety thresholds</div>
            </div>
            <button type="button" className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700">
              Generate Purchase Order
            </button>
          </div>
          <div className="overflow-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-emerald-700 text-white">
                  {["PRODUCT NAME", "IN STOCK", "ALERT LEVEL", "LAST SUPPLIER", "CONTACT", "STATUS"].map((h) => (
                    <th key={h} className="text-left font-semibold px-3 py-3 whitespace-nowrap text-xs tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {criticalReorder.map((r: any, idx: number) => (
                  <tr key={`${r.name}-${idx}`} className={idx % 2 === 0 ? "bg-white" : "bg-red-50/30"}>
                    <td className="px-3 py-3 font-semibold text-gray-800">{r.name}</td>
                    <td className="px-3 py-3 font-bold text-red-600">{r.inStock}</td>
                    <td className="px-3 py-3 text-gray-600">MRP: {lkr(r.mrp)}</td>
                    <td className="px-3 py-3 text-gray-700">{r.supplier}</td>
                    <td className="px-3 py-3 text-gray-600">{r.contact}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide ${
                          r.status === "OUT OF STOCK"
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {!criticalReorder.length && (
                  <tr>
                    <td colSpan={6} className="px-3 py-12 text-center text-gray-400">
                      {loading ? "Loading..." : "No low stock items."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "profit" && (
        <>
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="text-sm font-bold text-gray-800">Cost vs. Selling Price</div>
            <div className="text-xs text-gray-500 mb-3">Unit cost compared to selling price</div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={profitability.slice(0, 8)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any) => lkr(Number(v))} />
                  <Legend />
                  <Bar dataKey="unitCost" name="Unit Cost" fill="#9ca3af" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="sellingPrice" name="Selling Price" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-gray-100 text-sm font-bold tracking-wide text-gray-800">
              PRODUCT PROFITABILITY ANALYSIS
            </div>
            <div className="overflow-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-emerald-700 text-white">
                    {["PRODUCT", "UNIT COST", "SELLING PRICE", "MARKUP %", "GP %", "STATUS"].map((h) => (
                      <th key={h} className="text-left font-semibold px-3 py-3 whitespace-nowrap text-xs tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {profitRows.map((r: any, idx: number) => (
                    <tr key={`${r.name}-${idx}`} className={idx % 2 === 0 ? "bg-white" : "bg-emerald-50/30"}>
                      <td className="px-3 py-3 font-semibold text-gray-800">{r.name}</td>
                      <td className="px-3 py-3">{lkr(r.unitCost)}</td>
                      <td className="px-3 py-3">{lkr(r.sellingPrice)}</td>
                      <td className="px-3 py-3">{Number(r.markup || 0).toFixed(1)}%</td>
                      <td className="px-3 py-3">{Number(r.gp || 0).toFixed(1)}%</td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide ${
                            r.status === "HEALTHY"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!profitRows.length && (
                    <tr>
                      <td colSpan={6} className="px-3 py-12 text-center text-gray-400">
                        {loading ? "Loading..." : "No products found."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500">
              <div>
                Page {profitPage} of {profitPages} | Total {profitability.length} products
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-md border border-gray-200 disabled:opacity-40"
                  disabled={profitPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <button type="button" className="w-8 h-8 rounded-full bg-emerald-600 text-white text-sm">
                  {profitPage}
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-md border border-gray-200 disabled:opacity-40"
                  disabled={profitPage >= profitPages}
                  onClick={() => setPage((p) => Math.min(profitPages, p + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
