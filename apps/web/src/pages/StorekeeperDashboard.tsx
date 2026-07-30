import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";

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
  recentReleases: Array<{
    id: number;
    releaseNo: string;
    createdAt: string;
    userName: string;
    itemCount: number;
    totalQty: number;
  }>;
};

export default function StorekeeperDashboard() {
  const [data, setData] = useState<StoreDash | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/analytics/store-dashboard")
      .then((r) => setData(r.data.data))
      .catch((e) => setError(e.message || "Failed to load store dashboard"));
  }, []);

  if (error) return <div className="text-red-600">{error}</div>;
  if (!data) return <div className="text-gray-500">Loading store dashboard...</div>;

  const kpis = [
    { label: "Store Stock (Warehouse)", value: String(Math.round(data.kpis.storeQty)), sub: `${data.kpis.storeSkus} SKUs` },
    { label: "Shop Stock (Floor)", value: String(Math.round(data.kpis.shopQty)), sub: `${data.kpis.shopSkus} SKUs` },
    { label: "Store Low Stock", value: String(data.kpis.storeLow) },
    { label: "Shop Low Stock", value: String(data.kpis.shopLow) },
    { label: "GRN Today", value: String(data.kpis.todayGrns), sub: `${data.kpis.grnCount} total` },
    { label: "Releases Today", value: String(data.kpis.todayReleases), sub: `${data.kpis.releaseCount} total` },
  ];

  return (
    <div className="space-y-4">
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
        {kpis.map((k) => (
          <div key={k.label} className="card">
            <div className="text-xs text-gray-500">{k.label}</div>
            <div className="text-xl font-bold mt-1">{k.value}</div>
            {k.sub && <div className="text-[11px] text-gray-400">{k.sub}</div>}
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card">
          <div className="font-semibold mb-3">Stock flow</div>
          <div className="space-y-2 text-sm text-gray-700">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-600" />
              Supplier → GRN → <strong>Store (warehouse)</strong>
            </div>
            <div className="pl-3 text-gray-400">↓ Store Release</div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-sky-600" />
              <strong>Shop (floor)</strong> → POS sale
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3">
              <div className="text-xs text-emerald-700 font-semibold">Store out of stock</div>
              <div className="text-lg font-bold text-emerald-900">{data.kpis.storeOut}</div>
            </div>
            <div className="rounded-lg bg-sky-50 border border-sky-100 p-3">
              <div className="text-xs text-sky-700 font-semibold">Shop out of stock</div>
              <div className="text-lg font-bold text-sky-900">{data.kpis.shopOut}</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold">Recent releases</div>
            <Link className="text-sm text-emerald-700 font-semibold" to="/store-release/list">
              View all
            </Link>
          </div>
          {!data.recentReleases.length && (
            <div className="text-sm text-gray-500">
              No releases yet. Release stock from store to shop before selling.
            </div>
          )}
          <div className="space-y-2">
            {data.recentReleases.map((r) => (
              <div key={r.id} className="flex items-center justify-between border-b border-gray-100 pb-2 text-sm">
                <div>
                  <div className="font-semibold">{r.releaseNo}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(r.createdAt).toLocaleString()} · {r.userName}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{r.totalQty} pcs</div>
                  <div className="text-xs text-gray-500">{r.itemCount} item(s)</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
