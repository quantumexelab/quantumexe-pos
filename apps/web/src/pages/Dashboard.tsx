import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Package,
  ShoppingCart,
  TrendingUp,
  Users,
} from "lucide-react";
import api from "../api";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Dash = {
  kpis: {
    todaysSales: number;
    invoices: number;
    invoicesToday?: number;
    products: number;
    customers: number;
    suppliers: number;
    lowStock: number;
    outOfStock?: number;
  };
  revenue: { total: number; growth: number; series: { date: string; label?: string; total: number }[] };
  popular: { name: string; sales: number; amount?: number }[];
  lowStockItems?: { name: string; qty: number; threshold: number; location: string }[];
  recentInvoices?: {
    id: number;
    invoiceNo: string;
    total: number;
    paymentType: string;
    customer: string;
    createdAt: string;
  }[];
  paymentSeries?: { name: string; total: number }[];
  financial: { grossSales: number; discounts: number; netProfit: number; miscExpenses: number; growth: number };
  sessions: { total: number; growth: number };
  resources: { cpu: number; memory: number; memoryDetail: string; storage: number; storageDetail: string };
};

const PAY_COLORS = ["#16a34a", "#0ea5e9", "#f59e0b", "#94a3b8"];

function money(n: number) {
  if (n >= 1000) return `Rs. ${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
  return `Rs. ${Number(n || 0).toFixed(0)}`;
}

function moneyFull(n: number) {
  return `Rs. ${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default function Dashboard() {
  const [data, setData] = useState<Dash | null>(null);
  const [error, setError] = useState("");
  const [chartKey, setChartKey] = useState(0);

  useEffect(() => {
    api
      .get("/analytics/dashboard")
      .then((r) => {
        setData(r.data.data);
        setChartKey((k) => k + 1);
      })
      .catch((e) => setError(e.message || "Failed to load"));
  }, []);

  if (error) return <div className="text-red-600">{error}</div>;
  if (!data) return <div className="text-gray-500">Loading dashboard...</div>;

  const popular = data.popular || [];
  const maxPopular = Math.max(1, ...popular.map((p) => Number(p.sales || 0)));
  const lowItems = data.lowStockItems || [];
  const recent = data.recentInvoices || [];
  const payments = data.paymentSeries || [];

  const kpis = [
    {
      label: "Today's Sales",
      value: money(data.kpis.todaysSales),
      sub: moneyFull(data.kpis.todaysSales),
      icon: TrendingUp,
      tone: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Invoices",
      value: String(data.kpis.invoices),
      sub: data.kpis.invoicesToday != null ? `${data.kpis.invoicesToday} today` : undefined,
      icon: ShoppingCart,
      tone: "bg-sky-50 text-sky-700",
    },
    {
      label: "Products",
      value: String(data.kpis.products),
      icon: Package,
      tone: "bg-violet-50 text-violet-700",
    },
    {
      label: "Customers",
      value: String(data.kpis.customers),
      icon: Users,
      tone: "bg-amber-50 text-amber-700",
    },
    {
      label: "Suppliers",
      value: String(data.kpis.suppliers),
      icon: Package,
      tone: "bg-teal-50 text-teal-700",
    },
    {
      label: "Low Stock",
      value: String(data.kpis.lowStock),
      sub: data.kpis.outOfStock != null ? `${data.kpis.outOfStock} out` : undefined,
      icon: AlertTriangle,
      tone: "bg-red-50 text-red-700",
    },
  ];

  return (
    <div className="space-y-4 pb-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">System Overview</h1>
          <p className="text-sm text-gray-500">Sales, stock alerts, and recent activity</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="btn btn-primary text-sm" to="/pos">
            Open POS
          </Link>
          <Link className="btn btn-muted text-sm" to="/stock/low-stock">
            Low stock
          </Link>
          <Link className="btn btn-muted text-sm" to="/sales/manage-invoice">
            Invoices
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="card !p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="text-xs text-gray-500">{k.label}</div>
                <span className={`w-7 h-7 rounded-lg grid place-items-center ${k.tone}`}>
                  <Icon size={14} />
                </span>
              </div>
              <div className="text-xl font-bold mt-1 text-gray-900">{k.value}</div>
              {k.sub && <div className="text-[11px] text-gray-400 mt-0.5">{k.sub}</div>}
            </div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card lg:col-span-2">
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="font-semibold text-gray-800">Revenue (last 7 days)</div>
              <div className="text-2xl font-bold text-gray-900">{moneyFull(data.revenue.total)}</div>
              <div className="text-xs text-emerald-600 font-semibold">Week total vs prior period +{data.revenue.growth.toFixed(0)}%</div>
            </div>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart key={chartKey} data={data.revenue.series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={40} />
                <Tooltip formatter={(v: number) => moneyFull(v)} />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#16a34a"
                  fill="#bbf7d0"
                  isAnimationActive
                  animationDuration={1200}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card flex flex-col">
          <div className="font-semibold text-gray-800 mb-1">Popular products</div>
          <div className="text-xs text-gray-500 mb-3">By quantity sold (recent)</div>
          {popular.length ? (
            <div className="space-y-2.5 flex-1">
              {popular.map((p, i) => (
                <div key={`${p.name}-${i}`}>
                  <div className="flex justify-between text-sm gap-2 mb-1">
                    <span className="font-medium text-gray-800 truncate">{p.name}</span>
                    <span className="text-xs text-gray-500 shrink-0">{p.sales} sold</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${Math.max(8, (Number(p.sales) / maxPopular) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 grid place-items-center text-center text-sm text-gray-400 py-8">
              <div>
                <Package className="mx-auto mb-2 text-gray-300" size={28} />
                No sales yet — popular items appear after POS invoices.
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card">
          <div className="font-semibold text-gray-800">Financial overview</div>
          <div className="text-xs text-gray-500 mb-3">This week</div>
          <div className="text-2xl font-bold text-emerald-700">{moneyFull(data.financial.netProfit)}</div>
          <div className="text-xs text-emerald-600 mb-3">Net after discounts & expenses</div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-600">Gross Sales</span><span className="font-semibold">{moneyFull(data.financial.grossSales)}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Discounts</span><span className="font-semibold">{moneyFull(data.financial.discounts)}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Expenses</span><span className="font-semibold">{moneyFull(data.financial.miscExpenses)}</span></div>
            <div className="flex justify-between border-t border-gray-100 pt-2"><span className="text-gray-800 font-semibold">Net</span><span className="font-bold text-emerald-700">{moneyFull(data.financial.netProfit)}</span></div>
          </div>
          {payments.length > 0 && (
            <div className="mt-4 h-36">
              <div className="text-xs font-semibold text-gray-500 mb-1">Payment mix</div>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={payments} dataKey="total" nameKey="name" innerRadius={36} outerRadius={58} paddingAngle={2}>
                    {payments.map((_, i) => (
                      <Cell key={i} fill={PAY_COLORS[i % PAY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => moneyFull(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="card flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-semibold text-gray-800">Stock alerts</div>
              <div className="text-xs text-gray-500">{data.kpis.lowStock} low · {data.kpis.outOfStock ?? 0} out</div>
            </div>
            <Link to="/stock/low-stock" className="text-xs font-semibold text-emerald-700 inline-flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          {lowItems.length ? (
            <div className="space-y-2 flex-1 overflow-auto max-h-72">
              {lowItems.map((item, i) => (
                <div key={`${item.name}-${i}`} className="flex items-center justify-between gap-2 rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">{item.name}</div>
                    <div className="text-[11px] text-gray-500 capitalize">{item.location} · threshold {item.threshold}</div>
                  </div>
                  <span className="text-sm font-bold text-amber-700 shrink-0">{item.qty}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 grid place-items-center text-sm text-gray-400 py-10 text-center">
              Stock levels look healthy — no low-stock alerts.
            </div>
          )}
        </div>

        <div className="card flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-semibold text-gray-800">Recent invoices</div>
              <div className="text-xs text-gray-500">Latest POS / sales bills</div>
            </div>
            <Link to="/sales/manage-invoice" className="text-xs font-semibold text-emerald-700 inline-flex items-center gap-1">
              All <ArrowRight size={12} />
            </Link>
          </div>
          {recent.length ? (
            <div className="space-y-2 flex-1 overflow-auto max-h-72">
              {recent.map((inv) => (
                <div key={inv.id} className="rounded-lg border border-gray-100 px-3 py-2 hover:bg-gray-50">
                  <div className="flex justify-between gap-2">
                    <span className="text-sm font-semibold text-gray-900">{inv.invoiceNo}</span>
                    <span className="text-sm font-bold text-emerald-700">{moneyFull(inv.total)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-gray-500 mt-0.5">
                    <span className="truncate">{inv.customer}</span>
                    <span>
                      {inv.paymentType} · {new Date(inv.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 grid place-items-center text-sm text-gray-400 py-10 text-center">
              No invoices yet. Start a sale from POS.
            </div>
          )}
        </div>
      </div>

      {(payments.length > 0 || popular.length > 0) && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="card">
            <div className="font-semibold text-gray-800 mb-2">Daily sales bars</div>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.revenue.series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={36} />
                  <Tooltip formatter={(v: number) => moneyFull(v)} />
                  <Bar dataKey="total" fill="#86efac" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="card">
            <div className="font-semibold text-gray-800 mb-1">Quick links</div>
            <div className="text-xs text-gray-500 mb-3">Jump to common tasks</div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { to: "/pos", label: "New sale" },
                { to: "/grn/create-grn", label: "Create GRN" },
                { to: "/store-release/create", label: "Release to shop" },
                { to: "/products/create-product", label: "Add product" },
                { to: "/stock/stock-list", label: "Stock list" },
                { to: "/reports", label: "Reports" },
              ].map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-semibold text-gray-700 hover:border-emerald-300 hover:bg-emerald-50"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
