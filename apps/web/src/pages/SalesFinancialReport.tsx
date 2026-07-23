import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, Printer, RefreshCw } from "lucide-react";
import api from "../api";
import { ErrorBox } from "../components/ui";

type Tab = "summary" | "z-report" | "payments";

function lkr(n: number, digits = 2) {
  return `LKR ${Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

function rs(n: number) {
  return `Rs. ${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

const PIE_COLORS = ["#10b981", "#38bdf8", "#fbbf24"];

export default function SalesFinancialReport() {
  const [tab, setTab] = useState<Tab>("summary");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [counter, setCounter] = useState("");
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<any>(null);
  const [chartKey, setChartKey] = useState(0);

  async function load(e?: FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data: res } = await api.get("/reports/financial", {
        params: { from: fromDate, to: toDate, counter: counter || undefined },
      });
      setData(res.data);
      setChartKey((k) => k + 1);
    } catch (err: any) {
      setError(err.message || "Failed to load financial report");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const summary = data?.summary || {
    grossSales: 0,
    netRevenue: 0,
    netProfit: 0,
    invoiceCount: 0,
    growth: 0,
  };
  const trend = data?.trend || [];
  const ledger = data?.ledger || [];
  const payments = data?.payments || { total: 0, channels: [] };
  const zReport = data?.zReport || {
    openingFloat: 0,
    cashSales: 0,
    cardPayments: 0,
    bankDeposit: 0,
    cashIn: 0,
    cashOut: 0,
    expectedTaking: 0,
    sessionCount: 0,
    hourly: [],
    recentSessions: [],
  };
  const counters: string[] = data?.counters || [];

  const cards = useMemo(
    () => [
      { label: "Gross Sales", value: lkr(summary.grossSales), green: true },
      { label: "Net Revenue", value: lkr(summary.netRevenue), green: false },
      { label: "Net Profit / Loss", value: lkr(summary.netProfit), green: true },
      { label: "Invoice Count", value: `${summary.invoiceCount} Records`, green: false },
    ],
    [summary]
  );

  function printLedger() {
    window.print();
  }

  function downloadZReport() {
    const lines = [
      "Z-Report",
      `Period,${fromDate},${toDate}`,
      `Opening Float,${zReport.openingFloat}`,
      `Cash Sales,${zReport.cashSales}`,
      `Card Payments,${zReport.cardPayments}`,
      `Bank Deposit,${zReport.bankDeposit}`,
      `Cash In,${zReport.cashIn}`,
      `Cash Out,${zReport.cashOut}`,
      `Expected Taking,${zReport.expectedTaking}`,
      `Session Count,${zReport.sessionCount}`,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "z-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "summary", label: "Summary" },
    { id: "z-report", label: "Z-Report" },
    { id: "payments", label: "Payments" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs text-gray-500 mb-1">Reports &gt; Sales &amp; Financial</div>
        <h1 className="text-2xl font-bold text-gray-900">Sales &amp; Financial Reports</h1>
      </div>
      {error && <ErrorBox text={error} />}

      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold border ${
              tab === t.id
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
            }`}
          >
            {t.label}
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
              +{summary.growth || 100}%
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={load} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr_1fr_auto_auto] gap-3 items-end">
          <div>
            <label className="text-xs font-semibold text-gray-600">Select Counter</label>
            <select className="input mt-1" value={counter} onChange={(e) => setCounter(e.target.value)}>
              <option value="">All Counters</option>
              {counters.map((c) => (
                <option key={c} value={c}>
                  {c}
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
          {tab === "z-report" && (
            <button
              type="button"
              onClick={downloadZReport}
              className="h-[42px] w-[42px] rounded-lg bg-sky-600 text-white grid place-items-center hover:bg-sky-700"
              title="Download"
            >
              <Download size={16} />
            </button>
          )}
        </div>
      </form>

      {tab === "summary" && (
        <>
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-2 mb-3">
              <div>
                <div className="text-sm font-bold text-gray-800">Revenue Trend</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">{rs(summary.netRevenue)}</div>
                <div className="text-xs text-emerald-600 font-semibold">+{(summary.growth || 100).toFixed(1)}% vs last month</div>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart key={chartKey} data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid #e5e7eb",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                    }}
                    labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                    formatter={(v: any) => [rs(Number(v)), "total"]}
                    animationDuration={200}
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={false}
                    activeDot={{
                      r: 6,
                      fill: "#10b981",
                      stroke: "#ffffff",
                      strokeWidth: 2,
                    }}
                    isAnimationActive
                    animationBegin={100}
                    animationDuration={1600}
                    animationEasing="ease-in-out"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
              <div className="text-sm font-bold tracking-wide text-gray-800">TRANSACTION LEDGER</div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold">LIVE SYNC</span>
                <button
                  type="button"
                  onClick={printLedger}
                  className="w-8 h-8 rounded-full border border-gray-200 grid place-items-center text-gray-600 hover:bg-gray-50"
                >
                  <Printer size={14} />
                </button>
              </div>
            </div>
            <div className="overflow-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-emerald-700 text-white">
                    {[
                      "LEDGER ID",
                      "GROSS SALES",
                      "DISCOUNTS",
                      "RETURNS",
                      "NET REVENUE",
                      "EXPENSES",
                      "NET PROFIT",
                      "INVOICES",
                      "DATE",
                    ].map((h) => (
                      <th key={h} className="text-left font-semibold px-3 py-3 whitespace-nowrap text-xs tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((r: any, idx: number) => (
                    <tr key={r.ledgerId} className={idx % 2 === 0 ? "bg-white" : "bg-emerald-50/30"}>
                      <td className="px-3 py-3 font-semibold text-gray-800">{r.ledgerId}</td>
                      <td className="px-3 py-3">{rs(r.grossSales)}</td>
                      <td className="px-3 py-3">{rs(r.discounts)}</td>
                      <td className="px-3 py-3">{rs(r.returns)}</td>
                      <td className="px-3 py-3 font-semibold text-emerald-700">{rs(r.netRevenue)}</td>
                      <td className="px-3 py-3">{rs(r.expenses)}</td>
                      <td className="px-3 py-3 font-semibold text-sky-700">{rs(r.netProfit)}</td>
                      <td className="px-3 py-3">{r.invoices}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{r.date}</td>
                    </tr>
                  ))}
                  {!ledger.length && (
                    <tr>
                      <td colSpan={9} className="px-3 py-12 text-center text-gray-400">
                        {loading ? "Loading..." : "No ledger records for this period."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === "z-report" && (
        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-3">
            <div className="text-sm font-bold tracking-wide text-gray-800">Z-REPORT (DAILY SUMMARY)</div>
            <div className="text-xs text-gray-500">
              {fromDate} to {toDate}
            </div>
            <div className="space-y-2 text-sm">
              {[
                ["Opening Float", lkr(zReport.openingFloat)],
                ["Cash Sales", lkr(zReport.cashSales)],
                ["Card Payments", lkr(zReport.cardPayments)],
                ["Bank Deposit", lkr(zReport.bankDeposit)],
              ].map(([label, value]) => (
                <div key={label as string} className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">{label}</span>
                  <span className="font-semibold text-gray-800">{value}</span>
                </div>
              ))}
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Cash In</span>
                <span className="font-semibold text-emerald-600">+ {lkr(zReport.cashIn)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Cash Out</span>
                <span className="font-semibold text-red-600">- {lkr(zReport.cashOut)}</span>
              </div>
              <div className="flex items-center justify-between py-3 px-3 rounded-lg bg-emerald-50 border border-emerald-100">
                <span className="font-semibold text-emerald-800">Total Expected Taking</span>
                <span className="font-bold text-emerald-800">{lkr(zReport.expectedTaking)}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-gray-600">Session Count</span>
                <span className="font-semibold text-gray-800">{zReport.sessionCount}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={downloadZReport}
              className="w-full h-11 rounded-lg bg-slate-800 text-white font-semibold hover:bg-slate-900 inline-flex items-center justify-center gap-2"
            >
              <Download size={16} /> Download Z-Report
            </button>
          </div>

          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-bold text-gray-800">Today&apos;s Sales Trend</div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold">LIVE</span>
              </div>
              <div className="text-xs text-gray-500 mb-3">HOURLY COLUMN MOVEMENT</div>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart key={`hourly-${chartKey}`} data={zReport.hourly || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={3} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: any) => rs(Number(v))} />
                    <Bar
                      dataKey="total"
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                      isAnimationActive
                      animationDuration={1200}
                      animationEasing="ease-out"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="text-sm font-bold text-gray-800 mb-3">Recent Sessions History</div>
              <div className="space-y-2">
                {(zReport.recentSessions || []).map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 py-2 border-b border-gray-100 last:border-0">
                    <div>
                      <div className="text-sm font-semibold text-gray-800">{s.label}</div>
                      <div className="text-xs text-gray-500">
                        Counter: {s.cashier} · {s.openedAt ? new Date(s.openedAt).toLocaleTimeString() : ""}
                      </div>
                    </div>
                    <div className="text-sm font-bold text-emerald-700">{lkr(s.amount)}</div>
                  </div>
                ))}
                {!(zReport.recentSessions || []).length && (
                  <div className="text-sm text-gray-400 py-6 text-center">No sessions in this period.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "payments" && (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.2fr] gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="text-sm font-bold text-gray-800 mb-1">Revenue by Payment Method</div>
            <div className="text-xs text-gray-500 mb-3">Total Revenue {lkr(payments.total)}</div>
            <div className="h-64 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart key={`pie-${chartKey}`}>
                  <Pie
                    data={payments.channels || []}
                    dataKey="amount"
                    nameKey="label"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    isAnimationActive
                    animationBegin={80}
                    animationDuration={1200}
                    animationEasing="ease-out"
                  >
                    {(payments.channels || []).map((_: any, idx: number) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => lkr(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 grid place-items-center pointer-events-none">
                <div className="text-center">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wide">Total</div>
                  <div className="text-sm font-bold text-gray-800">{rs(payments.total)}</div>
                </div>
              </div>
            </div>
            <div className="mt-3 space-y-1">
              {(payments.channels || []).map((c: any, idx: number) => (
                <div key={c.label} className="flex items-center justify-between text-sm">
                  <span className="inline-flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[idx % PIE_COLORS.length] }} />
                    {c.label}
                  </span>
                  <span className="font-semibold text-gray-700">{Number(c.percent || 0).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-gray-100 text-sm font-bold tracking-wide text-gray-800">
              DETAILED BREAKDOWN BY PAYMENT CHANNEL
            </div>
            <div className="overflow-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-emerald-700 text-white">
                    {["CHANNEL", "SHARE", "TXNS", "TOTAL"].map((h) => (
                      <th key={h} className="text-left font-semibold px-3 py-3 text-xs tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(payments.channels || []).map((c: any, idx: number) => (
                    <tr key={c.label} className={idx % 2 === 0 ? "bg-white" : "bg-emerald-50/30"}>
                      <td className="px-3 py-3 font-semibold text-gray-800">{c.label}</td>
                      <td className="px-3 py-3">{Number(c.percent || 0).toFixed(1)}%</td>
                      <td className="px-3 py-3">{c.txns} TXNS</td>
                      <td className="px-3 py-3 font-semibold">{lkr(c.amount)}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-bold">
                    <td className="px-3 py-3">TOTAL</td>
                    <td className="px-3 py-3">100%</td>
                    <td className="px-3 py-3">
                      {(payments.channels || []).reduce((s: number, c: any) => s + Number(c.txns || 0), 0)} TXNS
                    </td>
                    <td className="px-3 py-3">{lkr(payments.total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
