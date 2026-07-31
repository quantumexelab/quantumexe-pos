import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRightLeft,
  Boxes,
  ClipboardList,
  Package,
  PackageMinus,
  ShoppingBag,
  Truck,
} from "lucide-react";
import api from "../api";

type StockLine = {
  variantId: number;
  name: string;
  qty: number;
  threshold?: number;
  location?: string;
};

type ReadyLine = {
  variantId: number;
  name: string;
  storeQty: number;
  shopQty: number;
};

type StoreDash = {
  kpis: {
    storeQty: number;
    shopQty: number;
    storeSkus: number;
    shopSkus: number;
    storeLow: number;
    storeOut: number;
    shopLow: number;
    shopOut: number;
    grnCount: number;
    releaseCount: number;
    todayGrns: number;
    todayReleases: number;
  };
  storeLowItems?: StockLine[];
  shopLowItems?: StockLine[];
  shopOutItems?: StockLine[];
  readyToRelease?: ReadyLine[];
  recentGrns?: Array<{
    id: number;
    billNo: string;
    supplierName: string;
    totalAmount: number;
    itemCount: number;
    createdAt: string;
  }>;
  recentReleases: Array<{
    id: number;
    releaseNo: string;
    createdAt: string;
    userName: string;
    itemCount: number;
    totalQty: number;
  }>;
};

function money(n: number) {
  return `Rs. ${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function EmptyList({ text }: { text: string }) {
  return <div className="py-6 text-center text-sm text-gray-500">{text}</div>;
}

export default function StorekeeperDashboard() {
  const [data, setData] = useState<StoreDash | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/analytics/store-dashboard")
      .then((r) => setData(r.data.data))
      .catch((e) => setError(e.message || "Failed to load store dashboard"));
  }, []);

  const balance = useMemo(() => {
    if (!data) return { storePct: 50, shopPct: 50, total: 0 };
    const total = Math.max(1, data.kpis.storeQty + data.kpis.shopQty);
    return {
      total,
      storePct: Math.round((data.kpis.storeQty / total) * 100),
      shopPct: Math.round((data.kpis.shopQty / total) * 100),
    };
  }, [data]);

  if (error) return <div className="text-red-600">{error}</div>;
  if (!data) return <div className="text-gray-500">Loading store dashboard...</div>;

  const kpis = [
    {
      label: "Store Stock (Warehouse)",
      value: String(Math.round(data.kpis.storeQty)),
      sub: `${data.kpis.storeSkus} SKUs`,
      tone: "emerald",
    },
    {
      label: "Shop Stock (Floor)",
      value: String(Math.round(data.kpis.shopQty)),
      sub: `${data.kpis.shopSkus} SKUs`,
      tone: "sky",
    },
    { label: "Store Low Stock", value: String(data.kpis.storeLow), tone: "amber" },
    { label: "Shop Low Stock", value: String(data.kpis.shopLow), tone: "amber" },
    { label: "GRN Today", value: String(data.kpis.todayGrns), sub: `${data.kpis.grnCount} total`, tone: "slate" },
    {
      label: "Releases Today",
      value: String(data.kpis.todayReleases),
      sub: `${data.kpis.releaseCount} total`,
      tone: "slate",
    },
  ];

  const shortcuts = [
    { to: "/grn/create-grn", label: "Create GRN", desc: "Receive supplier goods", icon: ClipboardList, color: "bg-emerald-600" },
    { to: "/store-release/create", label: "Release to Shop", desc: "Move warehouse → floor", icon: ArrowRightLeft, color: "bg-sky-600" },
    { to: "/stock/stock-list", label: "Stock List", desc: "All warehouse & shop qty", icon: Package, color: "bg-slate-700" },
    { to: "/stock/low-stock", label: "Low Stock", desc: "Items needing refill", icon: AlertTriangle, color: "bg-amber-600" },
    { to: "/products/product-list", label: "Products", desc: "Catalog & barcodes", icon: Boxes, color: "bg-violet-600" },
    { to: "/supplier/manage-supplier", label: "Suppliers", desc: "Supplier contacts", icon: Truck, color: "bg-orange-600" },
  ];

  const attention = [
    ...(data.storeLowItems || []).map((x) => ({ ...x, kind: "Store low" as const })),
    ...(data.shopLowItems || []).map((x) => ({ ...x, kind: "Shop low" as const })),
    ...(data.shopOutItems || []).slice(0, 4).map((x) => ({ ...x, kind: "Shop out" as const })),
  ].slice(0, 10);

  return (
    <div className="space-y-4 pb-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Store Dashboard</h1>
          <p className="text-sm text-gray-500">Warehouse stock, shop releases, and inventory overview</p>
        </div>
        <div className="flex gap-2">
          <Link className="btn btn-muted" to="/grn/create-grn">
            Create GRN
          </Link>
          <Link className="btn btn-primary" to="/store-release/create">
            Release to Shop
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {shortcuts.map((s) => (
          <Link
            key={s.to}
            to={s.to}
            className="rounded-xl border border-gray-200 bg-white p-3 hover:border-emerald-300 hover:shadow-sm transition group"
          >
            <div className={`w-9 h-9 rounded-lg ${s.color} text-white grid place-items-center mb-2`}>
              <s.icon size={18} />
            </div>
            <div className="text-sm font-bold text-gray-900 group-hover:text-emerald-700">{s.label}</div>
            <div className="text-[11px] text-gray-500 mt-0.5">{s.desc}</div>
          </Link>
        ))}
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

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <div className="font-semibold text-gray-900">Stock balance</div>
            <div className="text-xs text-gray-500">
              Warehouse vs shop floor · {Math.round(data.kpis.storeQty + data.kpis.shopQty)} pcs total
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs font-semibold">
            <span className="text-emerald-700">Store {balance.storePct}%</span>
            <span className="text-sky-700">Shop {balance.shopPct}%</span>
          </div>
        </div>
        <div className="h-4 rounded-full bg-gray-100 overflow-hidden flex">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${balance.storePct}%` }} />
          <div className="h-full bg-sky-500 transition-all" style={{ width: `${balance.shopPct}%` }} />
        </div>
        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3">
            <div className="text-xs text-emerald-700 font-semibold">Store qty</div>
            <div className="text-lg font-bold text-emerald-900">{Math.round(data.kpis.storeQty)}</div>
          </div>
          <div className="rounded-lg bg-sky-50 border border-sky-100 p-3">
            <div className="text-xs text-sky-700 font-semibold">Shop qty</div>
            <div className="text-lg font-bold text-sky-900">{Math.round(data.kpis.shopQty)}</div>
          </div>
          <div className="rounded-lg bg-amber-50 border border-amber-100 p-3">
            <div className="text-xs text-amber-700 font-semibold">Store out</div>
            <div className="text-lg font-bold text-amber-900">{data.kpis.storeOut}</div>
          </div>
          <div className="rounded-lg bg-rose-50 border border-rose-100 p-3">
            <div className="text-xs text-rose-700 font-semibold">Shop out</div>
            <div className="text-lg font-bold text-rose-900">{data.kpis.shopOut}</div>
          </div>
        </div>
        {data.kpis.shopQty === 0 && data.kpis.storeQty > 0 && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 flex flex-wrap items-center justify-between gap-2">
            <span>
              Shop floor is empty — release stock from warehouse before POS sales.
            </span>
            <Link className="font-bold text-emerald-800 hover:underline" to="/store-release/create">
              Release now →
            </Link>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-600" />
              Needs attention
            </div>
            <Link className="text-sm text-emerald-700 font-semibold" to="/stock/low-stock">
              View low stock
            </Link>
          </div>
          {!attention.length ? (
            <EmptyList text="No low / out-of-stock alerts right now." />
          ) : (
            <div className="divide-y divide-gray-100 max-h-72 overflow-auto">
              {attention.map((row) => (
                <div key={`${row.kind}-${row.variantId}`} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900 truncate">{row.name}</div>
                    <div className="text-[11px] text-gray-500">{row.kind}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-amber-700">{row.qty}</div>
                    {row.threshold != null && (
                      <div className="text-[10px] text-gray-400">min {row.threshold}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold flex items-center gap-2">
              <ShoppingBag size={16} className="text-sky-600" />
              Ready to release (top store qty)
            </div>
            <Link className="text-sm text-emerald-700 font-semibold" to="/store-release/create">
              Release
            </Link>
          </div>
          {!(data.readyToRelease || []).length ? (
            <EmptyList text="No warehouse stock to release. Create a GRN first." />
          ) : (
            <div className="divide-y divide-gray-100 max-h-72 overflow-auto">
              {(data.readyToRelease || []).map((row) => (
                <div key={row.variantId} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900 truncate">{row.name}</div>
                    <div className="text-[11px] text-gray-500">Shop floor: {row.shopQty}</div>
                  </div>
                  <div className="text-right shrink-0 font-bold text-emerald-700">{row.storeQty} in store</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold flex items-center gap-2">
              <ClipboardList size={16} className="text-emerald-600" />
              Recent GRNs
            </div>
            <Link className="text-sm text-emerald-700 font-semibold" to="/grn/grn-list">
              View all
            </Link>
          </div>
          {!(data.recentGrns || []).length ? (
            <EmptyList text="No GRNs yet. Receive stock from suppliers." />
          ) : (
            <div className="divide-y divide-gray-100">
              {(data.recentGrns || []).map((g) => (
                <div key={g.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900 truncate">{g.billNo}</div>
                    <div className="text-[11px] text-gray-500">
                      {g.supplierName} · {new Date(g.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-semibold">{money(g.totalAmount)}</div>
                    <div className="text-[11px] text-gray-500">{g.itemCount} lines</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold flex items-center gap-2">
              <PackageMinus size={16} className="text-sky-600" />
              Recent releases
            </div>
            <Link className="text-sm text-emerald-700 font-semibold" to="/store-release/list">
              View all
            </Link>
          </div>
          {!data.recentReleases.length ? (
            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center">
              <div className="text-sm text-gray-600 mb-3">
                No releases yet. Move stock from store to shop before selling.
              </div>
              <Link className="btn btn-primary inline-flex" to="/store-release/create">
                Release to Shop
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {data.recentReleases.map((r) => (
                <div key={r.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                  <div>
                    <div className="font-semibold">{r.releaseNo}</div>
                    <div className="text-[11px] text-gray-500">
                      {new Date(r.createdAt).toLocaleString()} · {r.userName}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{r.totalQty} pcs</div>
                    <div className="text-[11px] text-gray-500">{r.itemCount} item(s)</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="font-semibold mb-3">Stock flow</div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
          <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold">Supplier</span>
          <span className="text-gray-400">→</span>
          <span className="rounded-full bg-emerald-100 text-emerald-800 px-3 py-1 font-semibold">GRN</span>
          <span className="text-gray-400">→</span>
          <span className="rounded-full bg-emerald-600 text-white px-3 py-1 font-semibold">Store</span>
          <span className="text-gray-400">→</span>
          <span className="rounded-full bg-sky-100 text-sky-800 px-3 py-1 font-semibold">Release</span>
          <span className="text-gray-400">→</span>
          <span className="rounded-full bg-sky-600 text-white px-3 py-1 font-semibold">Shop</span>
          <span className="text-gray-400">→</span>
          <span className="rounded-full bg-violet-100 text-violet-800 px-3 py-1 font-semibold">POS sale</span>
        </div>
      </div>
    </div>
  );
}
