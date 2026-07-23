import { useEffect, useState } from "react";
import api from "../api";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Dash = {
  kpis: {
    todaysSales: number;
    invoices: number;
    products: number;
    customers: number;
    suppliers: number;
    lowStock: number;
  };
  revenue: { total: number; growth: number; series: { date: string; total: number }[] };
  popular: { name: string; sales: number }[];
  financial: { grossSales: number; discounts: number; netProfit: number; miscExpenses: number; growth: number };
  sessions: { total: number; growth: number };
  resources: { cpu: number; memory: number; memoryDetail: string; storage: number; storageDetail: string };
};

function money(n: number) {
  if (n >= 1000) return `Rs. ${(n / 1000).toFixed(0)}K`;
  return `Rs. ${n.toFixed(0)}`;
}

function Gauge({ value, label, detail }: { value: number; label: string; detail?: string }) {
  return (
    <div className="flex flex-col items-center">
      <div
        className="w-24 h-24 rounded-full grid place-items-center"
        style={{
          background: `conic-gradient(#16a34a ${value}%, #e5e7eb 0)`,
        }}
      >
        <div className="w-16 h-16 rounded-full bg-white grid place-items-center font-bold">{value}%</div>
      </div>
      <div className="mt-2 text-sm font-semibold">{label}</div>
      {detail && <div className="text-xs text-gray-500">{detail}</div>}
    </div>
  );
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

  const kpis = [
    { label: "Today's Sales", value: money(data.kpis.todaysSales), sub: `Rs. ${data.kpis.todaysSales.toFixed(2)}` },
    { label: "Invoices", value: String(data.kpis.invoices) },
    { label: "Products", value: String(data.kpis.products) },
    { label: "Customers", value: String(data.kpis.customers) },
    { label: "Suppliers", value: String(data.kpis.suppliers) },
    { label: "Low Stock", value: String(data.kpis.lowStock) },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">System Overview</h1>
        <p className="text-sm text-gray-500">Real-time business intelligence and performance metrics</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="card">
            <div className="text-xs text-gray-500">{k.label}</div>
            <div className="text-xl font-bold mt-1">{k.value}</div>
            {k.sub && <div className="text-[11px] text-gray-400">{k.sub}</div>}
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card lg:col-span-2">
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="font-semibold">Total Revenue</div>
              <div className="text-2xl font-bold">Rs. {data.revenue.total.toLocaleString()}</div>
              <div className="text-xs text-green-600 font-semibold">+{data.revenue.growth.toFixed(1)}% vs last month</div>
            </div>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart key={chartKey} data={data.revenue.series}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" hide />
                <YAxis />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#16a34a"
                  fill="#bbf7d0"
                  isAnimationActive
                  animationBegin={80}
                  animationDuration={1500}
                  animationEasing="ease-in-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="font-semibold mb-3">Popular Product</div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart key={`pop-${chartKey}`} data={data.popular} layout="vertical" margin={{ left: 40 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar
                  dataKey="sales"
                  fill="#22c55e"
                  radius={4}
                  isAnimationActive
                  animationDuration={1200}
                  animationEasing="ease-out"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card">
          <div className="font-semibold">Financial Overview</div>
          <div className="text-xs text-gray-500 mb-3">Monthly Summary</div>
          <div className="text-2xl font-bold text-green-700">Rs. {data.financial.netProfit.toLocaleString()}</div>
          <div className="text-xs text-green-600 mb-3">+{data.financial.growth.toFixed(2)}% growth</div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Gross Sales</span><span>Rs. {data.financial.grossSales.toLocaleString()}</span></div>
            <div className="flex justify-between"><span>Total Discounts</span><span>Rs. {data.financial.discounts.toLocaleString()}</span></div>
            <div className="flex justify-between"><span>Net Profit</span><span>Rs. {data.financial.netProfit.toLocaleString()}</span></div>
            <div className="flex justify-between"><span>Misc. Expenses</span><span>Rs. {data.financial.miscExpenses.toLocaleString()}</span></div>
          </div>
        </div>

        <div className="card">
          <div className="font-semibold mb-1">Total Sessions</div>
          <div className="text-3xl font-bold">{data.sessions.total}</div>
          <div className="text-xs text-green-600 mb-3">+{data.sessions.growth.toFixed(1)}% vs last month</div>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[{ name: "Sessions", total: data.sessions.total }]}>
                <Bar dataKey="total" fill="#86efac" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="font-semibold mb-4">Resource Utilization</div>
          <div className="flex justify-around">
            <Gauge value={data.resources.cpu} label="CPU Load" />
            <Gauge value={data.resources.memory} label="Memory" detail={data.resources.memoryDetail} />
            <Gauge value={data.resources.storage} label="Storage" detail={data.resources.storageDetail} />
          </div>
        </div>
      </div>
    </div>
  );
}
