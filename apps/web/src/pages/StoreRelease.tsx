import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { ErrorBox, PageHeader } from "../components/ui";
import { printProductLabels, type LabelItem } from "../print/label";

type StoreStockRow = {
  variantId: number;
  displayName: string;
  productName?: string;
  productCode: string;
  barcode?: string | null;
  price?: number;
  size?: string | null;
  color?: string | null;
  variantName?: string | null;
  storeQty: number;
  shopQty: number;
  unit: string;
};

type ReleaseLine = StoreStockRow & { qty: string };

function labelsFromReleaseItems(items: any[]): LabelItem[] {
  const labels: LabelItem[] = [];
  for (const i of items || []) {
    const v = i.variant || {};
    const product = v.product || {};
    const units = Array.isArray(i.units) ? i.units : [];
    const base = {
      productName: product.name || "Item",
      size: v.size,
      color: v.color,
      variantName: v.name,
      price: Number(v.price || 0),
      code: product.code,
    };
    if (units.length) {
      for (const u of units) {
        labels.push({
          ...base,
          barcode: String(u.unitCode || ""),
          copies: 1,
        });
      }
    } else {
      labels.push({
        ...base,
        barcode: v.barcode || product.code || `V${v.id || i.variantId}`,
        copies: Math.max(1, Math.floor(Number(i.qty) || 1)),
      });
    }
  }
  return labels;
}

function labelsFromLines(lines: ReleaseLine[]): LabelItem[] {
  // Fallback only — prefer API unit codes after release
  return lines.map((l) => ({
    productName: l.productName || l.displayName,
    size: l.size,
    color: l.color,
    variantName: l.variantName,
    barcode: l.barcode || l.productCode || `V${l.variantId}`,
    price: Number(l.price || 0),
    code: l.productCode,
    copies: Math.max(1, Math.floor(Number(l.qty) || 1)),
  }));
}

export function StoreReleaseHome() {
  return (
    <div>
      <PageHeader title="Store Release" subtitle="Move stock from warehouse to shop floor" />
      <div className="grid sm:grid-cols-2 gap-3 max-w-2xl">
        <Link className="card hover:border-emerald-300 transition block" to="/store-release/create">
          <div className="font-bold text-lg">Create Release</div>
          <div className="text-sm text-gray-500 mt-1">Transfer items from store to shop for POS sales</div>
        </Link>
        <Link className="card hover:border-emerald-300 transition block" to="/store-release/list">
          <div className="font-bold text-lg">Release History</div>
          <div className="text-sm text-gray-500 mt-1">View past store → shop transfers</div>
        </Link>
      </div>
    </div>
  );
}

export function CreateStoreRelease() {
  const [catalog, setCatalog] = useState<StoreStockRow[]>([]);
  const [lines, setLines] = useState<ReleaseLine[]>([]);
  const [query, setQuery] = useState("");
  const [note, setNote] = useState("");
  const [printLabels, setPrintLabels] = useState(true);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void api.get("/store-release/store-stock", { params: { limit: 300 } }).then((r) => {
      setCatalog(r.data.data || []);
    });
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalog.slice(0, 20);
    return catalog
      .filter(
        (r) =>
          r.displayName.toLowerCase().includes(q) ||
          r.productCode.toLowerCase().includes(q) ||
          String(r.barcode || "").includes(q)
      )
      .slice(0, 20);
  }, [catalog, query]);

  const stickerCount = useMemo(
    () => lines.reduce((s, l) => s + Math.max(0, Math.floor(Number(l.qty) || 0)), 0),
    [lines]
  );

  function addLine(row: StoreStockRow) {
    if (lines.some((l) => l.variantId === row.variantId)) return;
    setLines((prev) => [...prev, { ...row, qty: "1" }]);
  }

  function updateQty(variantId: number, qty: string) {
    setLines((prev) => prev.map((l) => (l.variantId === variantId ? { ...l, qty } : l)));
  }

  function removeLine(variantId: number) {
    setLines((prev) => prev.filter((l) => l.variantId !== variantId));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setOkMsg("");
    const items = lines
      .map((l) => ({ variantId: l.variantId, qty: Number(l.qty) }))
      .filter((i) => i.qty > 0);
    if (!items.length) {
      setError("Add at least one item with quantity");
      return;
    }
    const labelPayload = labelsFromLines(lines.filter((l) => Number(l.qty) > 0));
    setSaving(true);
    try {
      const { data } = await api.post("/store-release/add", { items, note: note.trim() || undefined });
      if (data?.success === false) throw new Error(data.message || "Release failed");
      const release = data?.data;
      setOkMsg(data?.message || "Stock released to shop");
      setLines([]);
      setNote("");
      const refreshed = await api.get("/store-release/store-stock", { params: { limit: 300 } });
      setCatalog(refreshed.data.data || []);

      if (printLabels) {
        const fromApi = release?.items?.length ? labelsFromReleaseItems(release.items) : labelPayload;
        await printProductLabels(fromApi);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Release failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs text-gray-500 mb-1">Store Release &gt; Create Release</div>
        <h1 className="text-2xl font-bold text-gray-800">Release to Shop</h1>
        <p className="text-sm text-gray-500">
          Move stock from warehouse to shop floor — print barcode + price stickers for POS scan
        </p>
      </div>
      {error && <ErrorBox text={error} />}
      {okMsg && <div className="text-green-700 text-sm font-semibold">{okMsg}</div>}

      <form onSubmit={submit} className="grid lg:grid-cols-2 gap-4">
        <div className="card space-y-3">
          <div className="font-semibold">Find products (store stock)</div>
          <input
            className="input"
            placeholder="Search name, code, barcode…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            data-page-search
          />
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
            {filtered.map((r) => (
              <button
                key={r.variantId}
                type="button"
                className="w-full text-left py-2 hover:bg-gray-50 px-1"
                onClick={() => addLine(r)}
              >
                <div className="font-medium text-sm">{r.displayName}</div>
                <div className="text-xs text-gray-500">
                  Store: {r.storeQty} · Shop: {r.shopQty} {r.unit}
                  {r.price != null ? ` · Rs. ${Number(r.price).toFixed(2)}` : ""}
                </div>
              </button>
            ))}
            {!filtered.length && <div className="text-sm text-gray-500 py-4">No products found</div>}
          </div>
        </div>

        <div className="card space-y-3">
          <div className="font-semibold">Release items</div>
          {!lines.length && <div className="text-sm text-gray-500">Select products from the left</div>}
          <div className="space-y-2">
            {lines.map((l) => (
              <div
                key={l.variantId}
                className="flex items-center gap-3 border border-gray-200 rounded-xl p-3 bg-gray-50/60"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate">{l.displayName}</div>
                  <div className="text-xs text-gray-500 mt-0.5">Available: {l.storeQty}</div>
                  {l.barcode ? <div className="text-[11px] text-gray-400 font-mono truncate mt-0.5">{l.barcode}</div> : null}
                  {l.price != null ? (
                    <div className="text-xs font-medium text-emerald-700 mt-0.5">Rs. {Number(l.price).toFixed(2)}</div>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex flex-col items-stretch gap-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 text-center">Qty</span>
                    <input
                      className="input w-20 shrink-0 text-center px-2"
                      type="number"
                      min={1}
                      max={l.storeQty}
                      value={l.qty}
                      onChange={(e) => updateQty(l.variantId, e.target.value)}
                      aria-label={`Quantity for ${l.displayName}`}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-muted px-2 h-[42px] mt-4"
                    onClick={() => removeLine(l.variantId)}
                    aria-label="Remove item"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
          <label className="block text-sm">
            <span className="text-gray-600">Note (optional)</span>
            <input className="input mt-1" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={printLabels}
              onChange={(e) => setPrintLabels(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span>
              Print unique unit stickers (one barcode per piece)
              {stickerCount > 0 ? ` — ${stickerCount} sticker${stickerCount === 1 ? "" : "s"}` : ""}
            </span>
          </label>
          <button type="submit" className="btn btn-primary w-full" disabled={saving || !lines.length}>
            {saving ? "Releasing…" : printLabels ? "Release & Print Stickers" : "Release to Shop"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function StoreReleaseList() {
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/store-release/list", { params: { limit: 200 } });
      setRows(data.data || []);
    } catch (e: any) {
      setError(e.message || "Failed to load releases");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function printStickers(release: any) {
    const labels = labelsFromReleaseItems(release?.items || []);
    if (!labels.length) {
      alert("No items to print");
      return;
    }
    void printProductLabels(labels);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs text-gray-500 mb-1">Store Release &gt; History</div>
          <h1 className="text-2xl font-bold text-gray-800">Release History</h1>
        </div>
        <Link className="btn btn-primary" to="/store-release/create">
          Create Release
        </Link>
      </div>
      {error && <ErrorBox text={error} />}
      {loading && <div className="text-gray-500 text-sm">Loading…</div>}

      <div className="card overflow-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Release No</th>
              <th>Date</th>
              <th>By</th>
              <th>Items</th>
              <th>Total Qty</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="font-semibold">{r.releaseNo}</td>
                <td>{new Date(r.createdAt).toLocaleString()}</td>
                <td>{r.user?.name || "-"}</td>
                <td>{r.items?.length || 0}</td>
                <td>{(r.items || []).reduce((s: number, i: any) => s + Number(i.qty || 0), 0)}</td>
                <td className="flex gap-2">
                  <button type="button" className="btn btn-muted text-xs" onClick={() => setSelected(r)}>
                    View
                  </button>
                  <button type="button" className="btn btn-primary text-xs" onClick={() => printStickers(r)}>
                    Print stickers
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length && !loading && (
              <tr>
                <td colSpan={6} className="text-center text-gray-500 py-6">
                  No releases yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-xl w-full max-w-lg p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="text-lg font-bold">{selected.releaseNo}</div>
            <div className="text-sm text-gray-500">
              {new Date(selected.createdAt).toLocaleString()} · {selected.user?.name || "-"}
            </div>
            {selected.note && <div className="text-sm">Note: {selected.note}</div>}
            <div className="max-h-64 overflow-y-auto">
              <table className="table text-sm">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Barcode</th>
                    <th>Price</th>
                    <th>Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {(selected.items || []).map((i: any) => (
                    <tr key={i.id}>
                      <td>
                        <div>{i.variant?.product?.name || "-"}</div>
                        {Array.isArray(i.units) && i.units.length > 0 ? (
                          <div className="text-[10px] font-mono text-gray-400 mt-0.5">
                            {i.units.map((u: any) => u.unitCode).join(", ")}
                          </div>
                        ) : null}
                      </td>
                      <td className="font-mono text-xs">
                        {Array.isArray(i.units) && i.units.length
                          ? `${i.units.length} unit IDs`
                          : i.variant?.barcode || "-"}
                      </td>
                      <td>Rs. {Number(i.variant?.price || 0).toFixed(2)}</td>
                      <td>{i.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn btn-primary flex-1" onClick={() => printStickers(selected)}>
                Print barcode stickers
              </button>
              <button type="button" className="btn btn-muted flex-1" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
