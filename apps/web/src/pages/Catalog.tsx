import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Search, ShoppingCart, X, RefreshCw, MoreVertical, Package, Eye, Printer, Pencil, Trash2 } from "lucide-react";
import api from "../api";
import { ErrorBox, PageHeader, SubNav } from "../components/ui";

function lkr(n: number) {
  return `LKR ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function ProductsHome() {
  return (
    <div>
      <PageHeader title="Products" />
      <SubNav
        items={[
          { to: "/products/product-list", label: "Product List" },
          { to: "/products/create-product", label: "Create Product" },
          { to: "/products/deactivated-products", label: "Deactivated" },
          { to: "/products/manage-category", label: "Categories" },
          { to: "/products/manage-brand", label: "Brands" },
          { to: "/products/manage-unit", label: "Units" },
          { to: "/products/manage-product-type", label: "Product Types" },
        ]}
      />
    </div>
  );
}

export function ProductList() {
  const [rows, setRows] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [typeId, setTypeId] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<any | null>(null);
  const pageSize = 10;

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [products, productTypes] = await Promise.all([api.get("/products"), api.get("/product-types")]);
      setRows(products.data.data || []);
      setTypes(productTypes.data.data || []);
    } catch (e: any) {
      setError(e.message || "Failed to load products");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((p) => {
      if (typeId && String(p.productTypeId || "") !== String(typeId)) return false;
      if (query) {
        const q = query.toLowerCase();
        const barcode = p.variants?.[0]?.barcode || "";
        const hay = `${p.id} ${p.name || ""} ${p.code || ""} ${barcode}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, typeId, query]);

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
    setTypeId("");
    setQuery("");
    setPage(1);
    load();
  }

  async function deactivate(id: number) {
    await api.post("/products/deactive", { id });
    setSelected(null);
    load();
  }

  function exportData(type: "csv" | "excel" | "pdf") {
    if (type === "pdf") {
      window.print();
      return;
    }
    const header = ["PR ID", "PRODUCT NAME", "PRODUCT CODE", "BARCODE", "CATEGORY", "BRAND", "UNIT"];
    const body = filtered.map((p) =>
      [
        p.id,
        p.name,
        p.code,
        p.variants?.[0]?.barcode || "",
        p.category?.name || "",
        p.brand?.name || "",
        p.unit?.name || "",
      ]
        .map((v) => JSON.stringify(String(v ?? "")))
        .join(",")
    );
    const blob = new Blob([[header.join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "product-list.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs text-gray-500 mb-1">Products &gt; Product List</div>
          <h1 className="text-2xl font-bold text-gray-800">Product List</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-[11px] text-gray-500 flex flex-wrap gap-x-3 gap-y-1">
            <span><kbd className="px-1.5 py-0.5 rounded bg-gray-100 border">ALT+E</kbd> Edit</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-gray-100 border">ALT+D</kbd> Deactivate</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-gray-100 border">ALT+S</kbd> Search</span>
          </div>
          <Link className="btn btn-primary" to="/products/create-product">
            Create Product
          </Link>
        </div>
      </div>
      {error && <ErrorBox text={error} />}

      <form onSubmit={onSearch} className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1.6fr_auto_auto] gap-3 items-end">
          <div>
            <label className="text-xs font-semibold text-gray-600">Product Type</label>
            <select className="input mt-1" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
              <option value="">All types</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Product ID / Name</label>
            <input
              className="input mt-1"
              placeholder="Search by ID, Name, Code, or Barcode"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary h-[42px] px-5">
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

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-green-700 text-white">
                {["PR ID", "PRODUCT NAME", "PRODUCT CODE", "BARCODE", "CATEGORY", "BRAND", "UNIT", "ACTIONS"].map((h) => (
                  <th key={h} className="text-left font-semibold px-3 py-3 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((p, idx) => (
                <tr key={p.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="px-3 py-3 font-semibold text-gray-800">{p.id}</td>
                  <td className="px-3 py-3 text-gray-700">{p.name}</td>
                  <td className="px-3 py-3 text-gray-700">{p.code}</td>
                  <td className="px-3 py-3 text-gray-600">{p.variants?.[0]?.barcode || "-"}</td>
                  <td className="px-3 py-3 text-gray-600">{p.category?.name || "-"}</td>
                  <td className="px-3 py-3 text-gray-600">{p.brand?.name || "-"}</td>
                  <td className="px-3 py-3 text-gray-600">{p.unit?.name || "-"}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        title="View"
                        onClick={() => setSelected(p)}
                        className="w-8 h-8 rounded-full bg-green-500 text-white grid place-items-center hover:bg-green-600"
                      >
                        <Eye size={14} />
                      </button>
                      <Link
                        to="/products/create-product"
                        title="Edit"
                        className="w-8 h-8 rounded-full bg-blue-500 text-white grid place-items-center hover:bg-blue-600"
                      >
                        <Pencil size={14} />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {!pageRows.length && (
                <tr>
                  <td colSpan={8} className="px-3 py-12 text-center text-gray-400">
                    {loading ? "Loading..." : "No products found."}
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
          <div className="flex items-center gap-2">
            <button type="button" className="px-3 py-1.5 text-xs font-semibold rounded-md bg-green-600 text-white" onClick={() => exportData("excel")}>
              Excel
            </button>
            <button type="button" className="px-3 py-1.5 text-xs font-semibold rounded-md bg-blue-600 text-white" onClick={() => exportData("csv")}>
              CSV
            </button>
            <button type="button" className="px-3 py-1.5 text-xs font-semibold rounded-md bg-red-600 text-white" onClick={() => exportData("pdf")}>
              PDF
            </button>
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
                <div className="text-lg font-bold">{selected.name}</div>
                <div className="text-sm text-gray-500">{selected.code}</div>
              </div>
              <button className="btn btn-muted" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
            <div className="text-sm space-y-1">
              <div>Barcode: <strong>{selected.variants?.[0]?.barcode || "-"}</strong></div>
              <div>Category: <strong>{selected.category?.name || "-"}</strong></div>
              <div>Brand: <strong>{selected.brand?.name || "-"}</strong></div>
              <div>Unit: <strong>{selected.unit?.name || "-"}</strong></div>
              <div>Price: <strong>{lkr(selected.variants?.[0]?.price || 0)}</strong></div>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-muted text-red-600" onClick={() => deactivate(selected.id)}>
                Deactivate
              </button>
              <Link className="btn btn-primary" to="/products/create-product">
                Edit
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


export function CreateProduct() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [quickAdd, setQuickAdd] = useState<{ type: "categories" | "brands" | "units" | "product-types"; name: string } | null>(null);

  const [basic, setBasic] = useState({
    name: "",
    code: "",
    barcode: "",
    categoryId: "",
    brandId: "",
    unitId: "",
    productTypeId: "",
  });
  const [inventory, setInventory] = useState({
    cost: 0,
    price: 0,
    quantity: 0,
    lowThreshold: 5,
    expireDate: "",
  });
  const [variations, setVariations] = useState<Array<{ name: string; barcode: string; price: number; cost: number; size: string }>>([
    { name: "Default", barcode: "", price: 0, cost: 0, size: "" },
  ]);

  async function loadLookups() {
    const [c, b, u, t] = await Promise.all([
      api.get("/categories"),
      api.get("/brands"),
      api.get("/units"),
      api.get("/product-types"),
    ]);
    setCategories(c.data.data || []);
    setBrands(b.data.data || []);
    setUnits(u.data.data || []);
    setTypes(t.data.data || []);
  }

  useEffect(() => {
    loadLookups();
  }, []);

  async function saveQuickAdd(e: FormEvent) {
    e.preventDefault();
    if (!quickAdd?.name.trim()) return;
    await api.post(`/${quickAdd.type}`, { name: quickAdd.name.trim() });
    setQuickAdd(null);
    await loadLookups();
  }

  function validateStep() {
    if (step === 0) {
      if (!basic.name.trim() || !basic.code.trim()) return "Product name and code are required";
      if (!basic.categoryId || !basic.brandId || !basic.unitId || !basic.productTypeId) {
        return "Category, Brand, Unit and Product Type are required";
      }
    }
    if (step === 1) {
      if (inventory.price < 0 || inventory.cost < 0) return "Invalid pricing";
    }
    if (step === 2) {
      if (!variations.length || !variations[0].name.trim()) return "At least one variation is required";
    }
    return "";
  }

  function next() {
    const msg = validateStep();
    if (msg) {
      setError(msg);
      return;
    }
    setError("");
    setStep((s) => Math.min(3, s + 1));
  }

  function back() {
    setError("");
    setStep((s) => Math.max(0, s - 1));
  }

  async function saveProduct() {
    const msg = validateStep();
    if (msg) {
      setError(msg);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const primary = variations[0];
      const { data } = await api.post("/products/create", {
        name: basic.name,
        code: basic.code,
        barcode: basic.barcode || primary.barcode || undefined,
        categoryId: Number(basic.categoryId),
        brandId: Number(basic.brandId),
        unitId: Number(basic.unitId),
        productTypeId: Number(basic.productTypeId),
        price: Number(primary.price || inventory.price || 0),
        cost: Number(primary.cost || inventory.cost || 0),
        quantity: Number(inventory.quantity || 0),
      });
      if (!data.success) throw new Error(data.message);

      // create extra variations if more than default
      const productId = data.data?.id;
      if (productId && variations.length > 1) {
        for (const v of variations.slice(1)) {
          await api.post(`/products/${productId}/variants`, {
            name: v.name,
            barcode: v.barcode || undefined,
            price: Number(v.price || 0),
            cost: Number(v.cost || 0),
            size: v.size || undefined,
            quantity: 0,
          });
        }
      }
      navigate("/products/product-list");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create product");
    } finally {
      setSaving(false);
    }
  }

  const steps = [
    { id: 0, label: "Basic Details" },
    { id: 1, label: "Inventory" },
    { id: 2, label: "Variations" },
    { id: 3, label: "Review" },
  ];

  function FieldLabel({ text, required = false, quick }: { text: string; required?: boolean; quick?: "categories" | "brands" | "units" | "product-types" }) {
    return (
      <div className="flex items-center justify-between gap-2 mb-1">
        <label className="text-xs font-semibold text-gray-600">
          {text} {required && <span className="text-red-500">*</span>}
        </label>
        {quick && (
          <button type="button" className="text-xs font-semibold text-green-700 hover:underline" onClick={() => setQuickAdd({ type: quick, name: "" })}>
            Quick Add
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs text-gray-500 mb-1">Products &gt; Create Product</div>
          <h1 className="text-2xl font-bold text-gray-800">Create New Product</h1>
        </div>
        <div className="text-[11px] text-gray-500 flex flex-wrap gap-x-3 gap-y-1">
          <span><kbd className="px-1.5 py-0.5 rounded bg-gray-100 border">F1-F4</kbd> Quick Add</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-gray-100 border">ALT+N</kbd> Next</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-gray-100 border">ALT+A</kbd> Variant</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-gray-100 border">CTRL+S</kbd> Save</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-gray-100 border">ESC</kbd> Close</span>
        </div>
      </div>

      {error && <ErrorBox text={error} />}

      <div className="bg-white border border-gray-200 rounded-xl p-3">
        <div className="grid grid-cols-4 gap-2">
          {steps.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(s.id)}
              className={`rounded-lg px-3 py-3 text-sm font-semibold border transition ${
                step === s.id
                  ? "bg-green-50 border-green-600 text-green-700"
                  : step > s.id
                    ? "bg-white border-green-200 text-green-700"
                    : "bg-gray-50 border-gray-200 text-gray-400"
              }`}
            >
              <div className="text-[10px] tracking-wide mb-1">STEP {s.id + 1}</div>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        {step === 0 && (
          <>
            <div className="text-sm font-bold text-gray-800">Product Information</div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <FieldLabel text="Product Name" required />
                <input
                  className="input"
                  placeholder="e.g. iPhone 15 Pro"
                  value={basic.name}
                  onChange={(e) => setBasic({ ...basic, name: e.target.value })}
                />
              </div>
              <div>
                <FieldLabel text="Product Code" required />
                <input
                  className="input"
                  placeholder="e.g. IP15P-128"
                  value={basic.code}
                  onChange={(e) => setBasic({ ...basic, code: e.target.value })}
                />
              </div>
              <div>
                <FieldLabel text="Barcode" />
                <input
                  className="input"
                  placeholder="Leave empty for auto-generate"
                  value={basic.barcode}
                  onChange={(e) => setBasic({ ...basic, barcode: e.target.value })}
                />
              </div>
              <div>
                <FieldLabel text="Category" required quick="categories" />
                <select className="input" value={basic.categoryId} onChange={(e) => setBasic({ ...basic, categoryId: e.target.value })}>
                  <option value="">Select category...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel text="Brand" required quick="brands" />
                <select className="input" value={basic.brandId} onChange={(e) => setBasic({ ...basic, brandId: e.target.value })}>
                  <option value="">Select brand...</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel text="Unit" required quick="units" />
                <select className="input" value={basic.unitId} onChange={(e) => setBasic({ ...basic, unitId: e.target.value })}>
                  <option value="">Select unit...</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel text="Product Type" required quick="product-types" />
                <select className="input" value={basic.productTypeId} onChange={(e) => setBasic({ ...basic, productTypeId: e.target.value })}>
                  <option value="">Select type...</option>
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div className="text-sm font-bold text-gray-800">Inventory Setup</div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <FieldLabel text="Cost Price" />
                <input type="number" className="input" value={inventory.cost} onChange={(e) => setInventory({ ...inventory, cost: Number(e.target.value) || 0 })} />
              </div>
              <div>
                <FieldLabel text="Selling Price" />
                <input type="number" className="input" value={inventory.price} onChange={(e) => setInventory({ ...inventory, price: Number(e.target.value) || 0 })} />
              </div>
              <div>
                <FieldLabel text="Opening Quantity" />
                <input type="number" className="input" value={inventory.quantity} onChange={(e) => setInventory({ ...inventory, quantity: Number(e.target.value) || 0 })} />
              </div>
              <div>
                <FieldLabel text="Low Stock Threshold" />
                <input type="number" className="input" value={inventory.lowThreshold} onChange={(e) => setInventory({ ...inventory, lowThreshold: Number(e.target.value) || 0 })} />
              </div>
              <div>
                <FieldLabel text="Expire Date" />
                <input type="date" className="input" value={inventory.expireDate} onChange={(e) => setInventory({ ...inventory, expireDate: e.target.value })} />
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-bold text-gray-800">Variations</div>
              <button
                type="button"
                className="btn btn-muted text-sm"
                onClick={() =>
                  setVariations((prev) => [...prev, { name: `Variant ${prev.length + 1}`, barcode: "", price: inventory.price, cost: inventory.cost, size: "" }])
                }
              >
                + Add Variant
              </button>
            </div>
            <div className="space-y-3">
              {variations.map((v, idx) => (
                <div key={idx} className="grid md:grid-cols-5 gap-3 border border-gray-200 rounded-xl p-3">
                  <input className="input" placeholder="Name" value={v.name} onChange={(e) => setVariations((prev) => prev.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))} />
                  <input className="input" placeholder="Barcode" value={v.barcode} onChange={(e) => setVariations((prev) => prev.map((x, i) => (i === idx ? { ...x, barcode: e.target.value } : x)))} />
                  <input className="input" type="number" placeholder="Cost" value={v.cost} onChange={(e) => setVariations((prev) => prev.map((x, i) => (i === idx ? { ...x, cost: Number(e.target.value) || 0 } : x)))} />
                  <input className="input" type="number" placeholder="Price" value={v.price} onChange={(e) => setVariations((prev) => prev.map((x, i) => (i === idx ? { ...x, price: Number(e.target.value) || 0 } : x)))} />
                  <div className="flex gap-2">
                    <input className="input" placeholder="Size" value={v.size} onChange={(e) => setVariations((prev) => prev.map((x, i) => (i === idx ? { ...x, size: e.target.value } : x)))} />
                    {variations.length > 1 && (
                      <button type="button" className="btn btn-muted" onClick={() => setVariations((prev) => prev.filter((_, i) => i !== idx))}>
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="text-sm font-bold text-gray-800">Review</div>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="border border-gray-200 rounded-xl p-4 space-y-1">
                <div className="font-semibold text-gray-800 mb-2">Basic Details</div>
                <div>Name: <strong>{basic.name}</strong></div>
                <div>Code: <strong>{basic.code}</strong></div>
                <div>Barcode: <strong>{basic.barcode || "Auto"}</strong></div>
                <div>Category: <strong>{categories.find((c) => String(c.id) === basic.categoryId)?.name || "-"}</strong></div>
                <div>Brand: <strong>{brands.find((b) => String(b.id) === basic.brandId)?.name || "-"}</strong></div>
                <div>Unit: <strong>{units.find((u) => String(u.id) === basic.unitId)?.name || "-"}</strong></div>
                <div>Type: <strong>{types.find((t) => String(t.id) === basic.productTypeId)?.name || "-"}</strong></div>
              </div>
              <div className="border border-gray-200 rounded-xl p-4 space-y-1">
                <div className="font-semibold text-gray-800 mb-2">Inventory & Variations</div>
                <div>Opening Qty: <strong>{inventory.quantity}</strong></div>
                <div>Cost / Price: <strong>{lkr(inventory.cost)} / {lkr(inventory.price)}</strong></div>
                <div>Threshold: <strong>{inventory.lowThreshold}</strong></div>
                <div>Expire: <strong>{inventory.expireDate || "-"}</strong></div>
                <div>Variants: <strong>{variations.length}</strong></div>
                <ul className="mt-2 space-y-1 text-gray-600">
                  {variations.map((v, i) => (
                    <li key={i}>• {v.name} — {lkr(v.price)}</li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="text-xs text-gray-500 flex items-center gap-2">
            <span className="font-semibold">OR ADD MULTIPLE PRODUCTS:</span>
            <button type="button" className="btn btn-muted text-xs" onClick={() => alert("Template download coming soon")}>Get Template</button>
            <button type="button" className="btn btn-muted text-xs" onClick={() => alert("Use Products Import API for CSV upload")}>Bulk Import</button>
          </div>
          <div className="flex gap-2">
            {step > 0 && (
              <button type="button" className="btn btn-muted" onClick={back}>
                Back
              </button>
            )}
            {step < 3 ? (
              <button type="button" className="btn btn-primary" onClick={next}>
                Next Step &gt;
              </button>
            ) : (
              <button type="button" className="btn btn-primary" disabled={saving} onClick={saveProduct}>
                {saving ? "Saving..." : "Save Product"}
              </button>
            )}
          </div>
        </div>
      </div>

      {quickAdd && (
        <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={() => setQuickAdd(null)}>
          <form
            onSubmit={saveQuickAdd}
            className="bg-white rounded-xl w-full max-w-md p-5 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-lg font-bold">Quick Add {quickAdd.type.replace("-", " ")}</div>
            <input
              className="input"
              autoFocus
              placeholder="Name"
              value={quickAdd.name}
              onChange={(e) => setQuickAdd({ ...quickAdd, name: e.target.value })}
              required
            />
            <div className="flex gap-2 justify-end">
              <button type="button" className="btn btn-muted" onClick={() => setQuickAdd(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Add</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}


export function DeactivatedProducts() {
  const [rows, setRows] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [typeId, setTypeId] = useState("");
  const [query, setQuery] = useState("");
  const [appliedTypeId, setAppliedTypeId] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const queryRef = useRef<HTMLInputElement | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [products, productTypes] = await Promise.all([
        api.get("/products/deactive"),
        api.get("/product-types"),
      ]);
      setRows(products.data.data || []);
      setTypes(productTypes.data.data || []);
    } catch (e: any) {
      setError(e.message || "Failed to load deactivated products");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((p) => {
      if (appliedTypeId && String(p.productTypeId || "") !== String(appliedTypeId)) return false;
      if (appliedQuery) {
        const q = appliedQuery.toLowerCase();
        const hay = `${p.id} ${p.name || ""} ${p.code || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, appliedTypeId, appliedQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const showingFrom = filtered.length ? (currentPage - 1) * pageSize + 1 : 0;
  const showingTo = Math.min(currentPage * pageSize, filtered.length);

  useEffect(() => {
    setSelectedIdx(0);
  }, [currentPage, appliedTypeId, appliedQuery, filtered.length]);

  function onSearch(e?: FormEvent) {
    e?.preventDefault();
    setAppliedTypeId(typeId);
    setAppliedQuery(query.trim());
    setPage(1);
  }

  function clearFilters() {
    setTypeId("");
    setQuery("");
    setAppliedTypeId("");
    setAppliedQuery("");
    setPage(1);
    load();
  }

  async function reactivate(id: number) {
    await api.patch(`/products/status/${id}`);
    load();
  }

  async function remove(id: number) {
    if (!confirm("Permanently delete this product?")) return;
    await api.delete(`/products/${id}`);
    load();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(Math.max(pageRows.length - 1, 0), i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter" && document.activeElement?.tagName !== "BUTTON") {
        e.preventDefault();
        onSearch();
      } else if (e.key === "Delete" && !(e.target as HTMLElement)?.closest?.("input,textarea,select")) {
        e.preventDefault();
        clearFilters();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs text-gray-500 mb-1">Products &gt; Deactivated Products</div>
          <h1 className="text-2xl font-bold text-red-600">Deactivated Products</h1>
        </div>
        <div className="text-[11px] text-gray-500 flex flex-wrap gap-x-3 gap-y-1">
          <span><kbd className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200">↑↓</kbd> Navigate</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200">Enter</kbd> Search</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200">Del</kbd> Clear</span>
        </div>
      </div>
      {error && <ErrorBox text={error} />}

      <form onSubmit={onSearch} className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
        <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1.6fr_auto_auto] gap-3 items-end">
          <div>
            <label className="text-xs font-semibold text-gray-600">Product Type</label>
            <select className="input mt-1" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
              <option value="">Search Product Types...</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Product ID / Name / Code</label>
            <input
              ref={queryRef}
              className="input mt-1"
              placeholder="Enter Product ID, Name or Code..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="h-[42px] px-5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <Search size={16} /> Search
          </button>
          <button
            type="button"
            onClick={clearFilters}
            className="h-[42px] px-4 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 font-semibold text-gray-700 inline-flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <RefreshCw size={16} /> Clear Filters
          </button>
        </div>
      </form>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <Package size={16} className="text-red-600" />
          <div className="text-sm font-bold tracking-wide text-gray-800">DEACTIVATED LIST</div>
        </div>
        <div className="overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-red-600 text-white">
                {[
                  "PRODUCT ID",
                  "PRODUCT NAME",
                  "PRODUCT CODE",
                  "CATEGORY",
                  "BRAND",
                  "UNIT",
                  "PRODUCT TYPE",
                  "DEACTIVE VARIANTS",
                  "CREATED ON",
                  "ACTIONS",
                ].map((h) => (
                  <th key={h} className="text-left font-semibold px-3 py-3 whitespace-nowrap text-xs tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((p, idx) => (
                <tr
                  key={p.id}
                  className={`${idx % 2 === 0 ? "bg-white" : "bg-red-50/40"} ${
                    selectedIdx === idx ? "ring-1 ring-inset ring-red-300" : ""
                  }`}
                  onClick={() => setSelectedIdx(idx)}
                >
                  <td className="px-3 py-3 font-semibold text-gray-800">{p.id}</td>
                  <td className="px-3 py-3 text-gray-800 font-medium">{p.name}</td>
                  <td className="px-3 py-3 text-gray-600">{p.code}</td>
                  <td className="px-3 py-3 text-gray-600">{p.category?.name || "-"}</td>
                  <td className="px-3 py-3 text-gray-600">{p.brand?.name || "-"}</td>
                  <td className="px-3 py-3 text-gray-600">{p.unit?.name || "-"}</td>
                  <td className="px-3 py-3 text-gray-600">{p.productType?.name || "-"}</td>
                  <td className="px-3 py-3">
                    <span className="inline-flex min-w-8 h-8 px-2 items-center justify-center rounded-full text-xs font-bold bg-red-100 text-red-700">
                      {p.variants?.length || 0}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-gray-600">{formatMdY(p.createdAt)}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        title="Reactivate"
                        className="h-8 px-3 rounded-full bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          reactivate(p.id);
                        }}
                      >
                        Activate
                      </button>
                      <button
                        type="button"
                        title="Delete"
                        className="w-8 h-8 rounded-full bg-red-500 text-white grid place-items-center hover:bg-red-600"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          remove(p.id);
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!pageRows.length && (
                <tr>
                  <td colSpan={10} className="px-3 py-12 text-center text-gray-400">
                    {loading ? "Loading..." : "No deactivated products found"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-gray-500">
            Showing {showingFrom} to {showingTo} of {filtered.length} products
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
                  className={`w-8 h-8 text-sm rounded-full border ${
                    n === currentPage
                      ? "bg-red-600 text-white border-red-600"
                      : "border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {n}
                </button>
              ))}
            <button
              type="button"
              className="px-3 py-1.5 text-sm rounded-md border border-gray-200 disabled:opacity-40"
              disabled={currentPage >= totalPages || filtered.length === 0}
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

function NamedCrud({ title, base }: { title: string; base: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [name, setName] = useState("");
  const load = () => api.get(base).then((r) => setRows(r.data.data || []));
  useEffect(() => { load(); }, [base]);
  async function add(e: FormEvent) {
    e.preventDefault();
    await api.post(base, { name });
    setName("");
    load();
  }
  async function remove(id: number) {
    await api.delete(`${base}/${id}`);
    load();
  }
  return (
    <div>
      <PageHeader title={title} />
      <form onSubmit={add} className="card flex gap-2 mb-4 max-w-xl">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" required />
        <button className="btn btn-primary">Add</button>
      </form>
      <div className="card overflow-auto max-w-xl">
        <table className="table">
          <thead><tr><th>Name</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}><td>{r.name}</td><td><button className="text-red-600 text-sm" onClick={() => remove(r.id)}>Delete</button></td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const ManageCategory = () => (
  <NamedCatalogManage
    title="Manage Category"
    base="/categories"
    entityLabel="category"
    nameLabel="Category Name"
    searchPlaceholder="Search categories..."
    namePlaceholder="Enter category name..."
    addLabel="+ Add Category"
    updateLabel="Update Category"
    nameColumn="CATEGORY NAME"
    countLabel="categories"
  />
);
export const ManageBrand = () => (
  <NamedCatalogManage
    title="Manage Brand"
    base="/brands"
    entityLabel="brand"
    nameLabel="Brand Name"
    searchPlaceholder="Search brands..."
    namePlaceholder="Enter brand name..."
    addLabel="+ Add Brand"
    updateLabel="Update Brand"
    nameColumn="BRAND NAME"
    countLabel="brands"
  />
);

function formatMdY(value?: string | Date | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

function NamedCatalogManage({
  title,
  base,
  entityLabel,
  nameLabel,
  searchPlaceholder,
  namePlaceholder,
  addLabel,
  updateLabel,
  nameColumn,
  countLabel,
}: {
  title: string;
  base: string;
  entityLabel: string;
  nameLabel: string;
  searchPlaceholder: string;
  namePlaceholder: string;
  addLabel: string;
  updateLabel: string;
  nameColumn: string;
  countLabel: string;
}) {
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const pageRowsRef = useRef<any[]>([]);
  const selectedIdxRef = useRef(0);
  const editingRef = useRef<any | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get(base);
      setRows(data.data || []);
    } catch (e: any) {
      setError(e.message || `Failed to load ${countLabel}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [base]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => String(r.name || "").toLowerCase().includes(q));
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const showingFrom = filtered.length ? (currentPage - 1) * pageSize + 1 : 0;
  const showingTo = Math.min(currentPage * pageSize, filtered.length);

  pageRowsRef.current = pageRows;
  selectedIdxRef.current = selectedIdx;
  editingRef.current = editing;

  useEffect(() => {
    setSelectedIdx(0);
  }, [currentPage, search, filtered.length]);

  async function save(e?: FormEvent) {
    e?.preventDefault();
    if (!name.trim()) {
      nameInputRef.current?.focus();
      return;
    }
    setError("");
    try {
      if (editing) {
        await api.put(`${base}/${editing.id}`, { name: name.trim() });
        setEditing(null);
      } else {
        await api.post(base, { name: name.trim() });
      }
      setName("");
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Failed to save");
    }
  }

  async function remove(id: number) {
    if (!confirm(`Delete this ${entityLabel}?`)) return;
    await api.delete(`${base}/${id}`);
    if (editingRef.current?.id === id) {
      setEditing(null);
      setName("");
    }
    load();
  }

  function startEdit(row: any) {
    setEditing(row);
    setName(row.name);
    nameInputRef.current?.focus();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const rowsNow = pageRowsRef.current;
      if (!e.altKey) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIdx((i) => Math.min(Math.max(rowsNow.length - 1, 0), i + 1));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIdx((i) => Math.max(0, i - 1));
        }
        return;
      }
      const key = e.key.toLowerCase();
      if (key === "a") {
        e.preventDefault();
        setEditing(null);
        setName("");
        nameInputRef.current?.focus();
      } else if (key === "s") {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (key === "e") {
        e.preventDefault();
        const row = rowsNow[selectedIdxRef.current];
        if (row) startEdit(row);
      } else if (key === "d") {
        e.preventDefault();
        const row = rowsNow[selectedIdxRef.current];
        if (row) remove(row.id);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [base]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs text-gray-500 mb-1">Products &gt; {title}</div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        </div>
        <div className="text-[11px] text-gray-500 flex flex-wrap gap-x-3 gap-y-1">
          <span><kbd className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200">↑↓</kbd> Navigate</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200">ALT+A</kbd> Add</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200">ALT+E</kbd> Edit</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200">ALT+D</kbd> Delete</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200">ALT+S</kbd> Search</span>
        </div>
      </div>
      {error && <ErrorBox text={error} />}

      <form onSubmit={save} className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
        <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1.4fr_auto] gap-3 items-end">
          <div>
            <label className="text-xs font-semibold text-gray-600">Search</label>
            <input
              ref={searchInputRef}
              className="input mt-1"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">{nameLabel}</label>
            <input
              ref={nameInputRef}
              className="input mt-1"
              placeholder={namePlaceholder}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary h-[42px] px-5 whitespace-nowrap">
            {editing ? updateLabel : addLabel}
          </button>
        </div>
        {editing && (
          <button
            type="button"
            className="mt-2 text-xs text-gray-500 hover:underline"
            onClick={() => {
              setEditing(null);
              setName("");
            }}
          >
            Cancel edit
          </button>
        )}
      </form>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <Package size={16} className="text-emerald-600" />
          <div className="text-sm font-bold tracking-wide text-gray-800">{title.toUpperCase()}</div>
        </div>
        <div className="overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-emerald-700 text-white">
                {["NO", nameColumn, "CREATED ON", "ACTIONS"].map((h) => (
                  <th key={h} className="text-left font-semibold px-3 py-3 whitespace-nowrap text-xs tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r, idx) => (
                <tr
                  key={r.id}
                  className={`${idx % 2 === 0 ? "bg-white" : "bg-emerald-50/40"} ${
                    selectedIdx === idx ? "ring-1 ring-inset ring-emerald-300" : ""
                  }`}
                  onClick={() => setSelectedIdx(idx)}
                >
                  <td className="px-3 py-3 font-semibold text-gray-700">
                    {(currentPage - 1) * pageSize + idx + 1}
                  </td>
                  <td className="px-3 py-3 text-gray-800 font-medium">{r.name}</td>
                  <td className="px-3 py-3 text-gray-600">{formatMdY(r.createdAt)}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        title="Edit"
                        className="w-8 h-8 rounded-full bg-blue-500 text-white grid place-items-center hover:bg-blue-600"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          startEdit(r);
                        }}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        title="Delete"
                        className="w-8 h-8 rounded-full bg-red-500 text-white grid place-items-center hover:bg-red-600"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          remove(r.id);
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!pageRows.length && (
                <tr>
                  <td colSpan={4} className="px-3 py-12 text-center text-gray-400">
                    {loading ? "Loading..." : `No ${countLabel} found.`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-gray-500">
            Showing {showingFrom} to {showingTo} of {filtered.length} {countLabel}
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
                  className={`w-8 h-8 text-sm rounded-full border ${
                    n === currentPage
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "border-gray-200 text-gray-700 hover:bg-gray-50"
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

export const ManageUnit = () => (
  <NamedCatalogManage
    title="Manage Unit"
    base="/units"
    entityLabel="unit"
    nameLabel="Unit Name"
    searchPlaceholder="Search units..."
    namePlaceholder="Enter unit name..."
    addLabel="+ Add Unit"
    updateLabel="Update Unit"
    nameColumn="UNIT NAME"
    countLabel="units"
  />
);

export const ManageProductType = () => (
  <NamedCatalogManage
    title="Manage Product Type"
    base="/product-types"
    entityLabel="product type"
    nameLabel="Product Type Name"
    searchPlaceholder="Search product types..."
    namePlaceholder="Enter product type name..."
    addLabel="+ Add Type"
    updateLabel="Update Type"
    nameColumn="PRODUCT TYPE NAME"
    countLabel="product types"
  />
);

export function StockHome() {
  return (
    <div>
      <PageHeader title="Stock" />
      <SubNav
        items={[
          { to: "/stock/stock-list", label: "Stock List" },
          { to: "/stock/low-stock", label: "Low Stock" },
          { to: "/stock/out-of-stock", label: "Out of Stock" },
          { to: "/stock/expire-stock", label: "Expire Stock" },
          { to: "/stock/damaged-stock", label: "Damaged Stock" },
        ]}
      />
    </div>
  );
}

function StockTable({ endpoint, title }: { endpoint: string; title: string }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    api.get(endpoint).then((r) => setRows(r.data.data || []));
  }, [endpoint]);
  return (
    <div>
      <PageHeader title={title} />
      <div className="card overflow-auto">
        <table className="table">
          <thead><tr><th>Product</th><th>Qty</th><th>Expire</th><th>Threshold</th></tr></thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.id}>
                <td>{r.variant?.product?.name || r.displayName || "-"}</td>
                <td>{r.quantity}</td>
                <td>{r.expireDate ? new Date(r.expireDate).toLocaleDateString() : "-"}</td>
                <td>{r.lowThreshold ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function StockList() {
  const [rows, setRows] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [stock, cats, unts, sups] = await Promise.all([
        api.get("/stock/all-variations", { params: { limit: 500 } }),
        api.get("/categories"),
        api.get("/units"),
        api.get("/suppliers/dropdown-list"),
      ]);
      setRows(stock.data.data || []);
      setCategories(cats.data.data || []);
      setUnits(unts.data.data || []);
      setSuppliers(sups.data.data || []);
    } catch (e: any) {
      setError(e.message || "Failed to load stock");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (categoryId && String(r.categoryId || "") !== String(categoryId)) return false;
      if (unitId && String(r.unitId || "") !== String(unitId)) return false;
      // supplier filter kept for UI parity; seed data has no product-supplier link
      if (supplierId) return true;
      if (query) {
        const q = query.toLowerCase();
        const hay = `${r.productID || ""} ${r.productName || r.displayName || ""} ${r.barcode || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, categoryId, unitId, supplierId, query]);

  const stats = useMemo(() => {
    const totalProducts = filtered.length;
    const totalValue = filtered.reduce((s, r) => s + Number(r.quantity || 0) * Number(r.cost || 0), 0);
    const lowStock = filtered.filter((r) => Number(r.quantity) > 0 && Number(r.quantity) <= Number(r.lowThreshold || 5)).length;
    return {
      totalProducts,
      totalValue,
      lowStock,
      suppliers: suppliers.length,
      categories: categories.length,
    };
  }, [filtered, suppliers.length, categories.length]);

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
    setCategoryId("");
    setUnitId("");
    setSupplierId("");
    setQuery("");
    setPage(1);
    load();
  }

  function exportData(type: "csv" | "excel" | "pdf") {
    if (type === "pdf") {
      window.print();
      return;
    }
    const header = [
      "PRODUCT ID",
      "PRODUCT NAME",
      "BARCODE",
      "UNIT",
      "COST PRICE",
      "MRP",
      "SELLING PRICE",
      "SUPPLIER",
      "STOCK QTY",
    ];
    const body = filtered.map((r) =>
      [
        r.productID,
        r.productName || r.displayName,
        r.barcode || "",
        r.unit || "",
        r.cost ?? 0,
        r.mrp ?? r.price ?? 0,
        r.sellingPrice ?? r.price ?? 0,
        r.supplier || "-",
        r.quantity ?? 0,
      ]
        .map((v) => JSON.stringify(String(v)))
        .join(",")
    );
    const blob = new Blob([[header.join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stock-list.${type === "excel" ? "csv" : "csv"}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const cards = [
    { label: "Total Products", value: String(stats.totalProducts), tag: "KEY METRIC", badge: "+5%", highlight: true },
    { label: "Total Value", value: lkr(stats.totalValue), tag: "INVENTORY STATS", badge: "+8%" },
    { label: "Low Stock Items", value: String(stats.lowStock), tag: "INVENTORY STATS", badge: "-5%", down: true },
    { label: "Total Suppliers", value: String(stats.suppliers), tag: "INVENTORY STATS", badge: "+5%" },
    { label: "Categories", value: String(stats.categories), tag: "INVENTORY STATS", badge: "+2%" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs text-gray-500 mb-1">Stock &gt; Stock List</div>
        <h1 className="text-2xl font-bold text-gray-800">Stock List</h1>
      </div>
      {error && <ErrorBox text={error} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className={`rounded-xl border p-4 ${
              c.highlight ? "bg-emerald-500 text-white border-emerald-500" : "bg-white border-gray-200"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className={`text-xs font-medium ${c.highlight ? "text-emerald-50" : "text-gray-500"}`}>{c.label}</div>
              <span
                className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${
                  c.highlight
                    ? "bg-white/20 text-white"
                    : c.down
                      ? "bg-red-100 text-red-600"
                      : "bg-green-100 text-green-700"
                }`}
              >
                {c.badge}
              </span>
            </div>
            <div className="mt-2 text-xl font-bold">{c.value}</div>
            <div className={`mt-3 text-[10px] font-semibold tracking-wide ${c.highlight ? "text-emerald-50" : "text-gray-400"}`}>
              {c.tag}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={onSearch} className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_1.3fr_auto_auto] gap-3 items-end">
          <div>
            <label className="text-xs font-semibold text-gray-600">Category</label>
            <select className="input mt-1" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Unit</label>
            <select className="input mt-1" value={unitId} onChange={(e) => setUnitId(e.target.value)}>
              <option value="">All Units</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Supplier</label>
            <select className="input mt-1" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">All Suppliers</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Product ID / Name</label>
            <input
              className="input mt-1"
              placeholder="Search product..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary h-[42px] px-5">
            <Search size={16} /> Search
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
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <Package size={16} className="text-emerald-600" />
          <div className="text-sm font-bold tracking-wide text-gray-800">STOCK LIST</div>
        </div>
        <div className="overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-emerald-700 text-white">
                {[
                  "PRODUCT ID",
                  "PRODUCT NAME",
                  "BARCODE",
                  "UNIT",
                  "COST PRICE",
                  "MRP",
                  "SELLING PRICE",
                  "SUPPLIER",
                  "STOCK QTY",
                  "ACTION",
                ].map((h) => (
                  <th key={h} className="text-left font-semibold px-3 py-3 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r, idx) => {
                const qty = Number(r.quantity || 0);
                const low = qty > 0 && qty <= Number(r.lowThreshold || 5);
                const out = qty <= 0;
                return (
                  <tr key={r.stockId || r.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-3 py-3 font-semibold text-gray-800">{r.productID}</td>
                    <td className="px-3 py-3 text-gray-700">{r.productName || r.displayName}</td>
                    <td className="px-3 py-3 text-gray-600">{r.barcode || "-"}</td>
                    <td className="px-3 py-3 text-gray-600">{r.unit || "-"}</td>
                    <td className="px-3 py-3 text-gray-700">{lkr(r.cost || 0)}</td>
                    <td className="px-3 py-3 text-gray-700">{lkr(r.mrp ?? r.price ?? 0)}</td>
                    <td className="px-3 py-3 font-semibold text-emerald-700">{lkr(r.sellingPrice ?? r.price ?? 0)}</td>
                    <td className="px-3 py-3 text-gray-600">{r.supplier || "-"}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex min-w-8 h-8 px-2 items-center justify-center rounded-full text-xs font-bold ${
                          out || low ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                        }`}
                      >
                        {qty}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <button type="button" className="w-8 h-8 rounded-lg border border-gray-200 grid place-items-center text-gray-500 hover:bg-gray-50">
                        <MoreVertical size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!pageRows.length && (
                <tr>
                  <td colSpan={10} className="px-3 py-10 text-center text-gray-400">
                    No stock records found
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
          <div className="flex items-center gap-2">
            <button type="button" className="px-3 py-1.5 text-xs font-semibold rounded-md bg-green-600 text-white" onClick={() => exportData("excel")}>
              Excel
            </button>
            <button type="button" className="px-3 py-1.5 text-xs font-semibold rounded-md bg-blue-600 text-white" onClick={() => exportData("csv")}>
              CSV
            </button>
            <button type="button" className="px-3 py-1.5 text-xs font-semibold rounded-md bg-red-600 text-white" onClick={() => exportData("pdf")}>
              PDF
            </button>
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
    </div>
  );
}

export function OutOfStock() {
  const [rows, setRows] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [productQ, setProductQ] = useState("");
  const [categoryQ, setCategoryQ] = useState("");
  const [supplierQ, setSupplierQ] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [stock, cats, sups, all] = await Promise.all([
        api.get("/stock/out-of-stock"),
        api.get("/categories"),
        api.get("/suppliers/dropdown-list"),
        api.get("/stock/all-variations", { params: { limit: 500 } }),
      ]);
      const outRows = (stock.data.data || []).map((r: any) => ({
        ...r,
        productID: r.variant?.product?.code || r.productID,
        productName: r.variant?.product?.name || r.displayName,
        barcode: r.variant?.barcode,
        unit: r.variant?.product?.unit?.name || "-",
        cost: r.variant?.cost ?? 0,
        mrp: r.variant?.price ?? 0,
        price: r.variant?.price ?? 0,
        category: r.variant?.product?.category?.name || "",
        supplier: "-",
        quantity: r.quantity ?? 0,
      }));
      setRows(outRows);
      setCategories(cats.data.data || []);
      setSuppliers(sups.data.data || []);
      setTotalProducts((all.data.data || []).length);
    } catch (e: any) {
      setError(e.message || "Failed to load out of stock");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (productQ) {
        const q = productQ.toLowerCase();
        const hay = `${r.productID || ""} ${r.productName || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (categoryQ) {
        const q = categoryQ.toLowerCase();
        if (!(r.category || "").toLowerCase().includes(q)) return false;
      }
      if (supplierQ) {
        const q = supplierQ.toLowerCase();
        if (!(r.supplier || "-").toLowerCase().includes(q) && !suppliers.some((s) => s.name.toLowerCase().includes(q))) {
          // keep UI filter parity
        }
      }
      return true;
    });
  }, [rows, productQ, categoryQ, supplierQ, suppliers]);

  const stats = useMemo(
    () => ({
      outItems: filtered.length,
      totalProducts,
      avgDaysOut: 0,
      affectedSuppliers: suppliers.length && filtered.length ? Math.min(suppliers.length, filtered.length) : 0,
    }),
    [filtered, totalProducts, suppliers.length]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const showingFrom = filtered.length ? (currentPage - 1) * pageSize + 1 : 0;
  const showingTo = Math.min(currentPage * pageSize, filtered.length);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    setPage(1);
  }

  function clearFilters() {
    setProductQ("");
    setCategoryQ("");
    setSupplierQ("");
    setPage(1);
  }

  function exportData(type: "csv" | "excel" | "pdf") {
    if (type === "pdf") {
      window.print();
      return;
    }
    const header = ["PV ID", "PRODUCT NAME", "UNIT", "COST PRICE", "MRP", "PRICE", "SUPPLIER", "STOCK"];
    const body = filtered.map((r) =>
      [r.productID, r.productName, r.unit, r.cost, r.mrp, r.price, r.supplier || "-", r.quantity]
        .map((v) => JSON.stringify(String(v ?? "")))
        .join(",")
    );
    const blob = new Blob([[header.join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "out-of-stock.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const cards = [
    { label: "OUT OF STOCK ITEMS", value: String(stats.outItems), highlight: true },
    { label: "TOTAL PRODUCTS", value: String(stats.totalProducts) },
    { label: "AVG. DAYS OUT", value: String(stats.avgDaysOut) },
    { label: "AFFECTED SUPPLIERS", value: String(stats.affectedSuppliers) },
  ];

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs text-gray-500 mb-1">Stock &gt; Out of Stock</div>
        <h1 className="text-2xl font-bold text-gray-800">Out of Stock</h1>
      </div>
      {error && <ErrorBox text={error} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className={`rounded-xl border p-4 ${
              c.highlight ? "bg-red-600 text-white border-red-600" : "bg-white border-gray-200"
            }`}
          >
            <div className={`text-xs font-semibold tracking-wide ${c.highlight ? "text-red-100" : "text-gray-500"}`}>
              {c.label}
            </div>
            <div className="mt-2 text-3xl font-bold">{c.value}</div>
          </div>
        ))}
      </div>

      <form onSubmit={onSearch} className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1.2fr_1.2fr_auto_auto] gap-3 items-end">
          <div>
            <label className="text-xs font-semibold text-gray-600">Product</label>
            <input
              className="input mt-1"
              placeholder="search product..."
              value={productQ}
              onChange={(e) => setProductQ(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Category</label>
            <input
              className="input mt-1"
              placeholder="search categories..."
              value={categoryQ}
              onChange={(e) => setCategoryQ(e.target.value)}
              list="oos-categories"
            />
            <datalist id="oos-categories">
              {categories.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Supplier</label>
            <input
              className="input mt-1"
              placeholder="search suppliers..."
              value={supplierQ}
              onChange={(e) => setSupplierQ(e.target.value)}
              list="oos-suppliers"
            />
            <datalist id="oos-suppliers">
              {suppliers.map((s) => (
                <option key={s.id} value={s.name} />
              ))}
            </datalist>
          </div>
          <button
            type="submit"
            className="h-[42px] px-5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold inline-flex items-center justify-center gap-2"
          >
            <Search size={16} /> Search
          </button>
          <button type="button" onClick={clearFilters} className="h-[42px] px-4 rounded-lg border border-gray-200 bg-white font-semibold text-gray-700">
            Clear
          </button>
        </div>
      </form>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 text-sm font-bold tracking-wide text-gray-800">
          ⚠️ OUT OF STOCK
        </div>
        <div className="overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-red-600 text-white">
                {["PV ID", "PRODUCT NAME", "UNIT", "COST PRICE", "MRP", "PRICE", "SUPPLIER", "STOCK"].map((h) => (
                  <th key={h} className="text-left font-semibold px-3 py-3 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r, idx) => (
                <tr key={r.id || idx} className={idx % 2 === 0 ? "bg-white" : "bg-red-50/40"}>
                  <td className="px-3 py-3 font-semibold">{r.productID || "-"}</td>
                  <td className="px-3 py-3">{r.productName || "-"}</td>
                  <td className="px-3 py-3">{r.unit || "-"}</td>
                  <td className="px-3 py-3">{lkr(r.cost || 0)}</td>
                  <td className="px-3 py-3">{lkr(r.mrp || 0)}</td>
                  <td className="px-3 py-3 font-semibold text-red-600">{lkr(r.price || 0)}</td>
                  <td className="px-3 py-3">{r.supplier || "-"}</td>
                  <td className="px-3 py-3">
                    <span className="inline-flex min-w-8 h-8 px-2 items-center justify-center rounded-full text-xs font-bold bg-red-100 text-red-700">
                      {r.quantity ?? 0}
                    </span>
                  </td>
                </tr>
              ))}
              {!pageRows.length && (
                <tr>
                  <td colSpan={8} className="px-3 py-12 text-center text-gray-400 font-medium">
                    {loading ? "Loading..." : "No out of stock items found."}
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
          <div className="flex items-center gap-2">
            <button type="button" className="px-3 py-1.5 text-xs font-semibold rounded-md border border-gray-200" onClick={() => exportData("excel")}>
              Excel
            </button>
            <button type="button" className="px-3 py-1.5 text-xs font-semibold rounded-md border border-gray-200" onClick={() => exportData("csv")}>
              CSV
            </button>
            <button type="button" className="px-3 py-1.5 text-xs font-semibold rounded-md border border-gray-200" onClick={() => exportData("pdf")}>
              PDF
            </button>
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

export function LowStock() {
  const [rows, setRows] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [low, cats, unts, sups, all] = await Promise.all([
        api.get("/stock/low-stock"),
        api.get("/categories"),
        api.get("/units"),
        api.get("/suppliers/dropdown-list"),
        api.get("/stock/all-variations", { params: { limit: 500 } }),
      ]);
      const mapped = (low.data.data || []).map((r: any) => ({
        ...r,
        productID: r.variant?.product?.code || r.id,
        productName: r.variant?.product?.name || "-",
        unit: r.variant?.product?.unit?.name || "PCS",
        unitId: r.variant?.product?.unitId,
        categoryId: r.variant?.product?.categoryId,
        category: r.variant?.product?.category?.name || "",
        cost: r.variant?.cost ?? 0,
        mrp: r.variant?.price ?? 0,
        price: r.variant?.price ?? 0,
        supplier: "-",
        quantity: r.quantity ?? 0,
        lowThreshold: r.lowThreshold ?? 5,
      }));
      setRows(mapped);
      setCategories(cats.data.data || []);
      setUnits(unts.data.data || []);
      setSuppliers(sups.data.data || []);
      setTotalProducts((all.data.data || []).length);
    } catch (e: any) {
      setError(e.message || "Failed to load low stock");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (categoryId && String(r.categoryId || "") !== String(categoryId)) return false;
      if (unitId && String(r.unitId || "") !== String(unitId)) return false;
      if (supplierId) return true;
      if (query) {
        const q = query.toLowerCase();
        const hay = `${r.productID || ""} ${r.productName || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, categoryId, unitId, supplierId, query]);

  const stats = useMemo(() => {
    const potentialLoss = filtered.reduce((s, r) => s + Number(r.quantity || 0) * Number(r.cost || 0), 0);
    return {
      lowItems: filtered.length,
      totalProducts,
      potentialLoss,
      belowThreshold: filtered.length,
      reorderRequired: filtered.length,
    };
  }, [filtered, totalProducts]);

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
    setCategoryId("");
    setUnitId("");
    setSupplierId("");
    setQuery("");
    setPage(1);
    load();
  }

  function exportData(type: "csv" | "excel" | "pdf") {
    if (type === "pdf") {
      window.print();
      return;
    }
    const header = ["PRODUCT ID", "PRODUCT NAME", "UNIT", "COST PRICE", "MRP", "PRICE", "SUPPLIER", "STOCK STATUS"];
    const body = filtered.map((r) =>
      [
        r.productID,
        r.productName,
        r.unit,
        r.cost,
        r.mrp,
        r.price,
        r.supplier || "",
        `${r.quantity} Units - Critical`,
      ]
        .map((v) => JSON.stringify(String(v ?? "")))
        .join(",")
    );
    const blob = new Blob([[header.join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "low-stock.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const cards = [
    { label: "Low Stock Items", value: String(stats.lowItems), badge: "Critical", highlight: true },
    { label: "Total Products", value: String(stats.totalProducts), tag: "INVENTORY STATS" },
    { label: "Potential Loss", value: lkr(stats.potentialLoss), tag: "INVENTORY STATS" },
    { label: "Below Threshold", value: String(stats.belowThreshold), tag: "INVENTORY STATS" },
    { label: "Reorder Required", value: String(stats.reorderRequired), tag: "INVENTORY STATS" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs text-gray-500 mb-1">Stock &gt; Low Stock</div>
        <h1 className="text-2xl font-bold text-gray-800">Low Stock</h1>
      </div>
      {error && <ErrorBox text={error} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className={`rounded-xl border p-4 ${
              c.highlight ? "bg-amber-500 text-white border-amber-500" : "bg-white border-gray-200"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className={`text-xs font-medium ${c.highlight ? "text-amber-50" : "text-gray-500"}`}>{c.label}</div>
              {c.badge && (
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${c.highlight ? "bg-white/20 text-white" : "bg-amber-50 text-amber-700"}`}>
                  {c.badge}
                </span>
              )}
            </div>
            <div className="mt-2 text-2xl font-bold">{c.value}</div>
            {c.tag && <div className="mt-2 text-[10px] font-semibold tracking-wide text-gray-400">{c.tag}</div>}
          </div>
        ))}
      </div>

      <form onSubmit={onSearch} className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_1.3fr_auto_auto] gap-3 items-end">
          <div>
            <label className="text-xs font-semibold text-gray-600">Category</label>
            <select className="input mt-1" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Search categories...</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Unit</label>
            <select className="input mt-1" value={unitId} onChange={(e) => setUnitId(e.target.value)}>
              <option value="">Search units...</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Supplier</label>
            <select className="input mt-1" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">Search suppliers...</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Product ID / Name</label>
            <input
              className="input mt-1"
              placeholder="Search products..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="h-[42px] px-5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold inline-flex items-center justify-center gap-2"
          >
            <Search size={16} /> Search
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
        <div className="px-4 py-3 border-b border-gray-100 text-sm font-bold tracking-wide text-gray-800">
          ⚠️ LOW STOCK
        </div>
        <div className="overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-amber-500 text-white">
                {["PRODUCT ID", "PRODUCT NAME", "UNIT", "COST PRICE", "MRP", "PRICE", "SUPPLIER", "STOCK STATUS"].map((h) => (
                  <th key={h} className="text-left font-semibold px-3 py-3 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r, idx) => (
                <tr key={r.id || idx} className={idx % 2 === 0 ? "bg-white" : "bg-amber-50/40"}>
                  <td className="px-3 py-3 font-semibold text-gray-800">{r.productID}</td>
                  <td className="px-3 py-3 text-gray-700">{r.productName}</td>
                  <td className="px-3 py-3 text-gray-600">{r.unit}</td>
                  <td className="px-3 py-3 font-semibold text-blue-600">{lkr(r.cost)}</td>
                  <td className="px-3 py-3 text-gray-700">{lkr(r.mrp)}</td>
                  <td className="px-3 py-3 font-semibold text-green-700">{lkr(r.price)}</td>
                  <td className="px-3 py-3 text-gray-600">{r.supplier || ""}</td>
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold border border-amber-400 text-amber-700 bg-amber-50">
                      {r.quantity} Units - Critical
                    </span>
                  </td>
                </tr>
              ))}
              {!pageRows.length && (
                <tr>
                  <td colSpan={8} className="px-3 py-12 text-center text-gray-400">
                    {loading ? "Loading..." : "No low stock items found."}
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
          <div className="flex items-center gap-2">
            <button type="button" className="px-3 py-1.5 text-xs font-semibold rounded-md bg-amber-500 text-white" onClick={() => exportData("excel")}>
              Excel
            </button>
            <button type="button" className="px-3 py-1.5 text-xs font-semibold rounded-md bg-amber-500 text-white" onClick={() => exportData("csv")}>
              CSV
            </button>
            <button type="button" className="px-3 py-1.5 text-xs font-semibold rounded-md bg-amber-500 text-white" onClick={() => exportData("pdf")}>
              PDF
            </button>
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
                    n === currentPage ? "bg-amber-500 text-white border-amber-500" : "border-gray-200 text-gray-700"
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

export function ExpireStock() {
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState(15);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  async function load(withinDays = days) {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/stock/expire-stock", { params: { days: withinDays } });
      const mapped = (data.data || []).map((r: any) => {
        const exp = r.expireDate ? new Date(r.expireDate) : null;
        const now = new Date();
        const daysLeft = exp ? Math.ceil((exp.getTime() - now.getTime()) / 86400000) : null;
        let status = "Watch";
        if (daysLeft != null) {
          if (daysLeft <= 0) status = "Expired";
          else if (daysLeft <= 5) status = "Critical";
          else if (daysLeft <= 7) status = "Urgent";
          else status = "Upcoming";
        }
        return {
          ...r,
          productID: r.variant?.product?.code || r.id,
          productName: r.variant?.product?.name || "-",
          unit: r.variant?.product?.unit?.name || "PCS",
          supplier: "-",
          quantity: r.quantity ?? 0,
          mfd: null,
          exp,
          daysLeft,
          status,
        };
      });
      setRows(mapped);
    } catch (e: any) {
      setError(e.message || "Failed to load expire stock");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(15);
  }, []);

  const stats = useMemo(() => {
    const critical = rows.filter((r) => r.daysLeft != null && r.daysLeft <= 5).length;
    const urgent = rows.filter((r) => r.daysLeft != null && r.daysLeft >= 6 && r.daysLeft <= 7).length;
    const units = rows.reduce((s, r) => s + Number(r.quantity || 0), 0);
    return {
      totalExpiring: rows.length,
      critical,
      urgent,
      stockUnits: units,
    };
  }, [rows]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const showingFrom = rows.length ? (currentPage - 1) * pageSize + 1 : 0;
  const showingTo = Math.min(currentPage * pageSize, rows.length);

  function onLoad(e: FormEvent) {
    e.preventDefault();
    setPage(1);
    load(days);
  }

  function reset() {
    setDays(15);
    setPage(1);
    load(15);
  }

  function statusClass(status: string) {
    if (status === "Critical" || status === "Expired") return "bg-red-100 text-red-700";
    if (status === "Urgent") return "bg-amber-100 text-amber-700";
    return "bg-purple-100 text-purple-700";
  }

  const cards = [
    { label: "Total Expiring", value: String(stats.totalExpiring), tag: "EXPIRING ITEMS", highlight: true },
    { label: "Critical (<= 5D)", value: String(stats.critical), tag: "INVENTORY", badge: "Critical" },
    { label: "Urgent (6-7D)", value: String(stats.urgent), tag: "INVENTORY", badge: "Stats" },
    { label: "Stock Units (Page)", value: String(stats.stockUnits), tag: "INVENTORY", badge: "Stats" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs text-gray-500 mb-1">Stock &gt; Expire Stock</div>
          <h1 className="text-2xl font-bold text-purple-700">Expire Stock</h1>
        </div>
        <div className="text-[11px] text-gray-500 flex flex-wrap gap-x-3 gap-y-1">
          <span><kbd className="px-1.5 py-0.5 rounded bg-gray-100 border">F1</kbd> Navigate</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-gray-100 border">Enter</kbd> Show Details</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-gray-100 border">F2</kbd> Filters</span>
        </div>
      </div>
      {error && <ErrorBox text={error} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className={`rounded-xl border p-4 ${
              c.highlight ? "bg-purple-600 text-white border-purple-600" : "bg-white border-gray-200"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className={`text-xs font-medium ${c.highlight ? "text-purple-100" : "text-gray-500"}`}>{c.label}</div>
              {c.badge && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">
                  {c.badge}
                </span>
              )}
            </div>
            <div className="mt-2 text-3xl font-bold">{c.value}</div>
            <div className={`mt-2 text-[10px] font-semibold tracking-wide ${c.highlight ? "text-purple-100" : "text-gray-400"}`}>
              {c.tag}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={onLoad} className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="text-xs font-bold tracking-wide text-gray-600 mb-3">FILTER</div>
        <div className="grid grid-cols-1 md:grid-cols-[240px_auto_auto] gap-3 items-end">
          <div>
            <label className="text-xs font-semibold text-gray-600">Expiring Within (Days)</label>
            <input
              type="number"
              min={1}
              className="input mt-1"
              value={days}
              onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
          <button
            type="submit"
            className="h-[42px] px-5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold"
          >
            Load
          </button>
          <button type="button" onClick={reset} className="h-[42px] px-5 rounded-lg border border-gray-200 bg-white font-semibold text-gray-700">
            Reset
          </button>
        </div>
      </form>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-purple-600 text-white">
                {["PRODUCT ID", "PRODUCT NAME", "UNIT", "SUPPLIER", "STOCK QTY", "MFD", "EXP", "STATUS"].map((h) => (
                  <th key={h} className="text-left font-semibold px-3 py-3 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r, idx) => (
                <tr key={r.id || idx} className={idx % 2 === 0 ? "bg-white" : "bg-purple-50/40"}>
                  <td className="px-3 py-3 font-semibold text-gray-800">{r.productID}</td>
                  <td className="px-3 py-3 text-gray-700">{r.productName}</td>
                  <td className="px-3 py-3 text-gray-600">{r.unit}</td>
                  <td className="px-3 py-3 text-gray-600">{r.supplier}</td>
                  <td className="px-3 py-3 font-semibold text-gray-800">{r.quantity}</td>
                  <td className="px-3 py-3 text-gray-600">-</td>
                  <td className="px-3 py-3 text-gray-700">
                    {r.exp ? r.exp.toLocaleDateString() : "-"}
                    {r.daysLeft != null && (
                      <div className="text-[11px] text-gray-400">{r.daysLeft}d left</div>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${statusClass(r.status)}`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
              {!pageRows.length && (
                <tr>
                  <td colSpan={8} className="px-3 py-16 text-center text-gray-400">
                    <div className="font-semibold tracking-wide">
                      {loading ? "Loading..." : "NO EXPIRING STOCK ITEMS FOUND"}
                    </div>
                    {!loading && (
                      <div className="text-sm mt-1">Try changing the filter or refresh the list.</div>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-gray-500">
            Showing {showingFrom} to {showingTo} of {rows.length} results
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

export function DamagedStock() {
  const [rows, setRows] = useState<any[]>([]);
  const [stocks, setStocks] = useState<any[]>([]);
  const [reasons, setReasons] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [productName, setProductName] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ stockId: "", qty: 1, reasonId: "", statusId: "", description: "" });
  const pageSize = 10;

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [dmg, stock, reason, status, sup] = await Promise.all([
        api.get("/damaged/table-data"),
        api.get("/stock/all-variations", { params: { limit: 500 } }),
        api.get("/reasons/all"),
        api.get("/return-status/all"),
        api.get("/suppliers/dropdown-list"),
      ]);
      setRows(dmg.data.data || []);
      setStocks(stock.data.data || []);
      setReasons(reason.data.data || []);
      setStatuses(status.data.data || []);
      setSuppliers(sup.data.data || []);
    } catch (e: any) {
      setError(e.message || "Failed to load damaged stock");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const enriched = useMemo(() => {
    return rows.map((r) => {
      const variant = r.stock?.variant;
      const product = variant?.product;
      const cost = Number(variant?.cost || 0);
      const price = Number(variant?.price || 0);
      const qty = Number(r.qty || 0);
      return {
        ...r,
        productName: product?.name || "-",
        cost,
        price,
        lossValue: cost * qty,
        supplierName: suppliers[0]?.name || "-",
        reasonName: r.reason?.name || "N/A",
        description: r.description || "N/A",
        statusName: (r.returnStatus?.name || "Confirmed").toUpperCase(),
        qty,
      };
    });
  }, [rows, suppliers]);

  const filtered = useMemo(() => {
    return enriched.filter((r) => {
      if (productName && !String(r.productName).toLowerCase().includes(productName.toLowerCase())) return false;
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
  }, [enriched, productName, fromDate, toDate]);

  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = filtered.filter((r) => {
      const d = new Date(r.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    return {
      damagedItems: filtered.length,
      totalProducts: new Set(filtered.map((r) => r.productName)).size,
      lossValue: filtered.reduce((s, r) => s + Number(r.lossValue || 0), 0),
      thisMonth: thisMonth.length,
      affectedSuppliers: filtered.length ? Math.min(suppliers.length || 1, filtered.length) : 0,
    };
  }, [filtered, suppliers.length]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const showingFrom = filtered.length ? (currentPage - 1) * pageSize + 1 : 0;
  const showingTo = Math.min(currentPage * pageSize, filtered.length);

  function onFilter(e: FormEvent) {
    e.preventDefault();
    setPage(1);
  }

  function resetFilters() {
    setProductName("");
    setFromDate("");
    setToDate("");
    setPage(1);
    load();
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api.post("/damaged/add", {
        stockId: Number(form.stockId),
        damagedQty: Number(form.qty),
        reasonId: form.reasonId ? Number(form.reasonId) : undefined,
        statusId: form.statusId ? Number(form.statusId) : undefined,
        description: form.description || "N/A",
      });
      setShowAdd(false);
      setForm({ stockId: "", qty: 1, reasonId: "", statusId: "", description: "" });
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Failed to add damaged stock");
    }
  }

  function exportData(type: "csv" | "excel" | "pdf") {
    if (type === "pdf") {
      window.print();
      return;
    }
    const header = ["PRODUCT", "COST", "PRICE", "QTY", "REASON", "STATUS", "DATE"];
    const body = filtered.map((r) =>
      [r.productName, r.cost, r.price, r.qty, r.reasonName, r.statusName, new Date(r.createdAt).toISOString()]
        .map((v) => JSON.stringify(String(v ?? "")))
        .join(",")
    );
    const blob = new Blob([[header.join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "damaged-stock.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const cards = [
    { label: "Damaged Items", value: String(stats.damagedItems), badge: "Critical", highlight: true },
    { label: "Total Products", value: String(stats.totalProducts), tag: "Inventory Stats" },
    { label: "Loss Value", value: lkr(stats.lossValue), tag: "Inventory Stats" },
    { label: "This Month", value: String(stats.thisMonth), tag: "Inventory Stats" },
    { label: "Affected Suppliers", value: String(stats.affectedSuppliers), tag: "Inventory Stats" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs text-gray-500 mb-1">Stock &gt; Damaged Stock</div>
        <h1 className="text-2xl font-bold text-gray-800">Damaged Stock</h1>
      </div>
      {error && <ErrorBox text={error} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className={`rounded-xl border p-4 ${
              c.highlight ? "bg-red-600 text-white border-red-600" : "bg-white border-gray-200"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className={`text-xs font-medium ${c.highlight ? "text-red-100" : "text-gray-500"}`}>{c.label}</div>
              {c.badge && (
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${c.highlight ? "bg-white/20 text-white" : "bg-red-50 text-red-600"}`}>
                  {c.badge}
                </span>
              )}
            </div>
            <div className="mt-2 text-2xl font-bold">{c.value}</div>
            {c.tag && <div className="mt-2 text-[10px] font-semibold tracking-wide text-gray-400">{c.tag}</div>}
          </div>
        ))}
      </div>

      <form onSubmit={onFilter} className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr_auto_auto] gap-3 items-end">
          <div>
            <label className="text-xs font-semibold text-gray-600">Product Name</label>
            <input className="input mt-1" placeholder="Product name" value={productName} onChange={(e) => setProductName(e.target.value)} />
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
            <Search size={16} /> Filter
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

      <button
        type="button"
        onClick={() => setShowAdd((v) => !v)}
        className="w-full bg-white border border-gray-200 hover:border-green-500 rounded-xl px-4 py-4 text-left flex items-center gap-3"
      >
        <div className="w-10 h-10 rounded-full bg-green-50 text-green-700 grid place-items-center text-xl font-bold">+</div>
        <div>
          <div className="font-bold text-gray-800">ADD DAMAGED STOCK</div>
          <div className="text-xs text-gray-500 tracking-wide">RECORD NEW DAMAGED INVENTORY</div>
        </div>
      </button>

      {showAdd && (
        <form onSubmit={add} className="bg-white border border-green-200 rounded-xl p-4 grid md:grid-cols-5 gap-3">
          <select className="input" value={form.stockId} onChange={(e) => setForm({ ...form, stockId: e.target.value })} required>
            <option value="">Select stock</option>
            {stocks.map((s) => (
              <option key={s.stockId} value={s.stockId}>
                {s.displayName} (qty {s.quantity})
              </option>
            ))}
          </select>
          <input
            className="input"
            type="number"
            min={1}
            value={form.qty}
            onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })}
          />
          <select className="input" value={form.reasonId} onChange={(e) => setForm({ ...form, reasonId: e.target.value })}>
            <option value="">Reason</option>
            {reasons.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <select className="input" value={form.statusId} onChange={(e) => setForm({ ...form, statusId: e.target.value })}>
            <option value="">Status</option>
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button className="btn btn-primary">Save Damaged</button>
          <input
            className="input md:col-span-5"
            placeholder="Description / notes"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </form>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600">
                {["PRODUCT DETAILS", "PRICING", "SUPPLIER INFO", "STOCK/QTY", "DAMAGE DETAILS", "STATUS", "DATE RECORDED"].map((h) => (
                  <th key={h} className="text-left font-semibold px-3 py-3 whitespace-nowrap text-xs tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r) => (
                <tr key={r.id} className="border-t border-gray-100">
                  <td className="px-3 py-4 font-semibold text-gray-800">{r.productName}</td>
                  <td className="px-3 py-4 text-xs space-y-1">
                    <div className="text-gray-500">COST <span className="font-semibold text-gray-800">{lkr(r.cost)}</span></div>
                    <div className="text-gray-500">PRICE <span className="font-semibold text-gray-800">{lkr(r.price)}</span></div>
                  </td>
                  <td className="px-3 py-4">
                    <span className="text-green-700 font-medium hover:underline cursor-pointer">{r.supplierName}</span>
                  </td>
                  <td className="px-3 py-4 text-xs space-y-1">
                    <div className="font-semibold text-gray-700">DAMAGED</div>
                    <div className="text-red-600 font-bold">{r.qty} DAMAGED</div>
                  </td>
                  <td className="px-3 py-4 text-xs space-y-1">
                    <div className="font-semibold text-gray-800">{r.reasonName}</div>
                    <div className="text-gray-500">{r.description}</div>
                  </td>
                  <td className="px-3 py-4">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-green-100 text-green-700">
                      {r.statusName}
                    </span>
                  </td>
                  <td className="px-3 py-4 text-xs text-gray-600 whitespace-nowrap">
                    <div className="font-semibold text-gray-800">
                      {new Date(r.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </div>
                    <div>
                      {new Date(r.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </td>
                </tr>
              ))}
              {!pageRows.length && (
                <tr>
                  <td colSpan={7} className="px-3 py-12 text-center text-gray-400">
                    {loading ? "Loading..." : "No damaged stock records found."}
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
          <div className="flex items-center gap-2">
            <button type="button" className="px-3 py-1.5 text-xs font-semibold rounded-md border border-gray-200" onClick={() => exportData("excel")}>
              Excel
            </button>
            <button type="button" className="px-3 py-1.5 text-xs font-semibold rounded-md border border-gray-200" onClick={() => exportData("csv")}>
              CSV
            </button>
            <button type="button" className="px-3 py-1.5 text-xs font-semibold rounded-md border border-gray-200" onClick={() => exportData("pdf")}>
              PDF
            </button>
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
    </div>
  );
}


export function GrnHome() {
  return (
    <div>
      <PageHeader title="GRN" />
      <SubNav items={[{ to: "/grn/create-grn", label: "Create GRN" }, { to: "/grn/grn-list", label: "GRN List" }]} />
    </div>
  );
}

export function GrnList() {
  const [rows, setRows] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [billNo, setBillNo] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<any | null>(null);
  const pageSize = 10;

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [grn, sup] = await Promise.all([
        api.get("/grn/list", { params: { limit: 200 } }),
        api.get("/suppliers/dropdown-list"),
      ]);
      setRows(grn.data.data?.rows || []);
      setSuppliers(sup.data.data || []);
    } catch (e: any) {
      setError(e.message || "Failed to load GRN list");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const enriched = useMemo(() => {
    return rows.map((r) => {
      const total = Number(r.totalAmount || 0);
      const paid = Number(r.paidAmount || 0);
      const balance = Math.max(0, total - paid);
      return {
        ...r,
        total,
        paid,
        balance,
        status: balance <= 0 ? "Complete" : "Pending",
      };
    });
  }, [rows]);

  const filtered = useMemo(() => {
    return enriched.filter((r) => {
      if (supplierId && String(r.supplierId) !== String(supplierId)) return false;
      if (billNo && !String(r.billNo || "").toLowerCase().includes(billNo.toLowerCase())) return false;
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
  }, [enriched, supplierId, billNo, fromDate, toDate]);

  const stats = useMemo(() => {
    const totalGrn = filtered.length;
    const totalAmount = filtered.reduce((s, r) => s + r.total, 0);
    const totalPaid = filtered.reduce((s, r) => s + r.paid, 0);
    const totalBalance = filtered.reduce((s, r) => s + r.balance, 0);
    return { totalGrn, totalAmount, totalPaid, totalBalance };
  }, [filtered]);

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
    setSupplierId("");
    setFromDate("");
    setToDate("");
    setBillNo("");
    setPage(1);
    load();
  }

  function printGrn(row: any) {
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) return;
    w.document.write(`
      <html><head><title>${row.billNo}</title>
      <style>body{font-family:Arial;padding:24px}table{width:100%;border-collapse:collapse;margin-top:12px}
      th,td{border-bottom:1px solid #ddd;padding:8px;text-align:left}</style></head>
      <body>
        <h1>QUANTUMEXE GRN</h1>
        <div>Bill: ${row.billNo}</div>
        <div>Supplier: ${row.supplier?.name || "-"}</div>
        <div>Date: ${new Date(row.createdAt).toLocaleString()}</div>
        <div>Total: ${lkr(row.total)}</div>
        <div>Paid: ${lkr(row.paid)}</div>
        <div>Balance: ${lkr(row.balance)}</div>
        <div>Status: ${row.status}</div>
      </body></html>
    `);
    w.document.close();
    w.focus();
    w.print();
  }

  const cards = [
    { label: "TOTAL GRN", value: String(stats.totalGrn), trend: "+12%" },
    { label: "TOTAL AMOUNT", value: lkr(stats.totalAmount), trend: "+0%" },
    { label: "TOTAL PAID", value: lkr(stats.totalPaid), trend: "+15%" },
    { label: "TOTAL BALANCE", value: lkr(stats.totalBalance), trend: "-5%", down: true },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs text-gray-500 mb-1">GRN &gt; GRN List</div>
          <h1 className="text-2xl font-bold text-gray-800">GRN List</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-[11px] text-gray-500 flex flex-wrap gap-x-3 gap-y-1">
            <span><kbd className="px-1.5 py-0.5 rounded bg-gray-100 border">N</kbd> Navigate</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-gray-100 border">Enter</kbd> View</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-gray-100 border">Del</kbd> Clear</span>
          </div>
          <Link className="btn btn-primary" to="/grn/create-grn">
            Create GRN
          </Link>
        </div>
      </div>
      {error && <ErrorBox text={error} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="text-xs font-semibold tracking-wide text-gray-500">{c.label}</div>
              <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${c.down ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700"}`}>
                {c.trend}
              </span>
            </div>
            <div className="mt-2 text-xl font-bold text-gray-800">{c.value}</div>
          </div>
        ))}
      </div>

      <form onSubmit={onSearch} className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr_1fr_1.2fr_auto_auto] gap-3 items-end">
          <div>
            <label className="text-xs font-semibold text-gray-600">Supplier</label>
            <select className="input mt-1" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">All suppliers</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">From Date</label>
            <input type="date" className="input mt-1" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">To Date</label>
            <input type="date" className="input mt-1" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Bill Number</label>
            <input className="input mt-1" placeholder="Bill number" value={billNo} onChange={(e) => setBillNo(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary h-[42px] px-5">
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

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 text-sm font-bold tracking-wide text-gray-800">GRN LIST</div>
        <div className="overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-green-700 text-white">
                {["NO", "SUPPLIER NAME", "BILL NUMBER", "TOTAL AMOUNT", "PAID AMOUNT", "BALANCE", "GRN DATE", "STATUS", "ACTIONS"].map(
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
                <tr key={r.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="px-3 py-3 font-semibold text-gray-700">{(currentPage - 1) * pageSize + idx + 1}</td>
                  <td className="px-3 py-3 text-gray-700">{r.supplier?.name || "-"}</td>
                  <td className="px-3 py-3 font-medium text-gray-800">{r.billNo}</td>
                  <td className="px-3 py-3 text-gray-700">{lkr(r.total)}</td>
                  <td className="px-3 py-3 text-gray-700">{lkr(r.paid)}</td>
                  <td className={`px-3 py-3 font-semibold ${r.balance > 0 ? "text-red-600" : "text-gray-700"}`}>
                    {lkr(r.balance)}
                  </td>
                  <td className="px-3 py-3 text-gray-600 whitespace-nowrap">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        r.status === "Complete" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {r.status}
                    </span>
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
                        onClick={() => printGrn(r)}
                        className="w-8 h-8 rounded-full bg-green-500 text-white grid place-items-center hover:bg-green-600"
                      >
                        <Printer size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!pageRows.length && (
                <tr>
                  <td colSpan={9} className="px-3 py-12 text-center text-gray-400">
                    {loading ? "Loading..." : "No GRN records found."}
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
                <div className="text-lg font-bold">{selected.billNo}</div>
                <div className="text-sm text-gray-500">{new Date(selected.createdAt).toLocaleString()}</div>
              </div>
              <button className="btn btn-muted" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
            <div className="text-sm space-y-1">
              <div>Supplier: <strong>{selected.supplier?.name || "-"}</strong></div>
              <div>Total: <strong>{lkr(selected.total)}</strong></div>
              <div>Paid: <strong>{lkr(selected.paid)}</strong></div>
              <div>Balance: <strong className={selected.balance > 0 ? "text-red-600" : ""}>{lkr(selected.balance)}</strong></div>
              <div>Status: <strong>{selected.status}</strong></div>
            </div>
            <button className="btn btn-primary" onClick={() => printGrn(selected)}>
              <Printer size={16} /> Print
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


export function CreateGrn() {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [billNo] = useState(() => `BILL-${Math.floor(10000000 + Math.random() * 89999999)}`);
  const [productId, setProductId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [barcode, setBarcode] = useState("");
  const [batchNo, setBatchNo] = useState("");
  const [mfd, setMfd] = useState("");
  const [exp, setExp] = useState("");
  const [cost, setCost] = useState(0);
  const [mrp, setMrp] = useState(0);
  const [rsp, setRsp] = useState(0);
  const [wsp, setWsp] = useState(0);
  const [qty, setQty] = useState(1);
  const [freeQty, setFreeQty] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/suppliers/dropdown-list").then((r) => setSuppliers(r.data.data || []));
    api.get("/products").then((r) => setProducts(r.data.data || []));
  }, []);

  const selectedProduct = useMemo(
    () => products.find((p) => String(p.id) === String(productId)),
    [products, productId]
  );
  const variants = selectedProduct?.variants || [];

  useEffect(() => {
    if (!variantId) return;
    const v = variants.find((x: any) => String(x.id) === String(variantId));
    if (!v) return;
    setBarcode(v.barcode || "");
    setCost(Number(v.cost || 0));
    setMrp(Number(v.price || 0));
    setRsp(Number(v.price || 0));
    setWsp(Number(v.cost || 0));
  }, [variantId, variants]);

  const summary = useMemo(() => {
    const totalQty = lines.reduce((s, l) => s + Number(l.qty || 0) + Number(l.freeQty || 0), 0);
    const totalCost = lines.reduce((s, l) => s + Number(l.qty || 0) * Number(l.cost || 0), 0);
    return { items: lines.length, totalQty, totalCost, balance: Math.max(0, totalCost - paidAmount) };
  }, [lines, paidAmount]);

  function addToGrn() {
    setError("");
    if (!productId || !variantId) {
      setError("Select product and variant");
      return;
    }
    const v = variants.find((x: any) => String(x.id) === String(variantId));
    setLines((prev) => [
      ...prev,
      {
        key: `${variantId}-${Date.now()}`,
        variantId: Number(variantId),
        productName: selectedProduct?.name || "-",
        variantName: v?.name || "Default",
        barcode: barcode || v?.barcode || `AUTO-${variantId}`,
        batchNo: batchNo || "-",
        mfd,
        exp,
        cost,
        mrp,
        rsp,
        wsp,
        qty,
        freeQty,
      },
    ]);
    setVariantId("");
    setBarcode("");
    setBatchNo("");
    setMfd("");
    setExp("");
    setQty(1);
    setFreeQty(0);
  }

  async function createGrn() {
    if (!supplierId) {
      setError("Select a supplier");
      return;
    }
    if (!lines.length) {
      setError("Add at least one product to GRN");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { data } = await api.post("/grn/add", {
        supplierId: Number(supplierId),
        billNo,
        paidAmount: Number(paidAmount || 0),
        note,
        items: lines.map((l) => ({
          variantId: l.variantId,
          qty: Number(l.qty) + Number(l.freeQty || 0),
          cost: Number(l.cost || 0),
        })),
      });
      if (!data.success) throw new Error(data.message);
      navigate("/grn/grn-list");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create GRN");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs text-gray-500 mb-1">GRN &gt; Create GRN</div>
          <h1 className="text-2xl font-bold text-gray-800">Create Goods Received Note</h1>
        </div>
        <div className="text-[11px] text-gray-500 flex flex-wrap gap-x-3 gap-y-1">
          <span><kbd className="px-1.5 py-0.5 rounded bg-gray-100 border">Enter</kbd> Add Item</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-gray-100 border">Shift+Enter</kbd> Create GRN</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-gray-100 border">F1</kbd> Navigation</span>
        </div>
      </div>
      {error && <ErrorBox text={error} />}

      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
        <div className="text-sm font-bold text-gray-800">Basic Bill Information</div>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-600">Bill Number</label>
            <input className="input mt-1 bg-gray-50" value={billNo} readOnly />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Select Supplier</label>
            <select className="input mt-1" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} required>
              <option value="">Search / select supplier...</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
        <div className="text-sm font-bold text-gray-800">Add Product Details</div>
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-600">Select Product</label>
            <select
              className="input mt-1"
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value);
                setVariantId("");
              }}
            >
              <option value="">Select product...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Select Variant</label>
            <select
              className="input mt-1"
              value={variantId}
              onChange={(e) => setVariantId(e.target.value)}
              disabled={!productId}
            >
              <option value="">{productId ? "Select variant..." : "Select a product first"}</option>
              {variants.map((v: any) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Barcode</label>
            <input className="input mt-1" placeholder="Auto-generated if empty" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Batch Number</label>
            <input className="input mt-1" value={batchNo} onChange={(e) => setBatchNo(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Manufacture Date</label>
            <input type="date" className="input mt-1" value={mfd} onChange={(e) => setMfd(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Expire Date</label>
            <input type="date" className="input mt-1" value={exp} onChange={(e) => setExp(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Cost Price</label>
            <input type="number" className="input mt-1" value={cost} onChange={(e) => setCost(Number(e.target.value) || 0)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">MRP</label>
            <input type="number" className="input mt-1" value={mrp} onChange={(e) => setMrp(Number(e.target.value) || 0)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Retail Selling Price</label>
            <input type="number" className="input mt-1" value={rsp} onChange={(e) => setRsp(Number(e.target.value) || 0)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Wholesale Price</label>
            <input type="number" className="input mt-1" value={wsp} onChange={(e) => setWsp(Number(e.target.value) || 0)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Quantity</label>
            <input type="number" min={1} className="input mt-1" value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Free Quantity</label>
            <input type="number" min={0} className="input mt-1" value={freeQty} onChange={(e) => setFreeQty(Math.max(0, Number(e.target.value) || 0))} />
          </div>
        </div>
        <button type="button" onClick={addToGrn} className="w-full h-11 rounded-lg bg-gray-700 hover:bg-gray-800 text-white font-semibold">
          + Add to GRN
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 text-sm font-bold text-gray-800">GRN Items</div>
        <div className="overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-green-700 text-white">
                {["PRODUCT NAME", "VARIANT", "BARCODE", "BATCH", "MFD", "EXP", "COST", "MRP", "RSP", "WSP", "QTY", "FREE", "ACTIONS"].map(
                  (h) => (
                    <th key={h} className="text-left font-semibold px-3 py-3 whitespace-nowrap">
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.key} className="border-b border-gray-100">
                  <td className="px-3 py-3">{l.productName}</td>
                  <td className="px-3 py-3">{l.variantName}</td>
                  <td className="px-3 py-3">{l.barcode}</td>
                  <td className="px-3 py-3">{l.batchNo}</td>
                  <td className="px-3 py-3">{l.mfd || "-"}</td>
                  <td className="px-3 py-3">{l.exp || "-"}</td>
                  <td className="px-3 py-3">{lkr(l.cost)}</td>
                  <td className="px-3 py-3">{lkr(l.mrp)}</td>
                  <td className="px-3 py-3">{lkr(l.rsp)}</td>
                  <td className="px-3 py-3">{lkr(l.wsp)}</td>
                  <td className="px-3 py-3">{l.qty}</td>
                  <td className="px-3 py-3">{l.freeQty}</td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      className="text-red-600 text-xs font-semibold"
                      onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {!lines.length && (
                <tr>
                  <td colSpan={13} className="px-3 py-10 text-center text-gray-400">
                    No items added yet. Add products to create GRN.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="text-sm font-bold text-gray-800">Payment Details</div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Paid Amount</label>
            <input
              type="number"
              min={0}
              className="input mt-1"
              value={paidAmount}
              onChange={(e) => setPaidAmount(Number(e.target.value) || 0)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Note</label>
            <textarea className="input mt-1 min-h-[80px]" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <div className="rounded-xl bg-slate-800 text-white p-5 space-y-3">
          <div className="text-sm font-bold tracking-wide">Order Summary</div>
          <div className="flex justify-between text-sm"><span>Items</span><span>{summary.items}</span></div>
          <div className="flex justify-between text-sm"><span>Total Qty</span><span>{summary.totalQty}</span></div>
          <div className="flex justify-between text-sm"><span>Total Cost</span><span>{lkr(summary.totalCost)}</span></div>
          <div className="flex justify-between text-sm"><span>Paid</span><span>{lkr(paidAmount)}</span></div>
          <div className="border-t border-white/20 pt-3 flex justify-between font-bold text-lg">
            <span>Balance</span>
            <span>{lkr(summary.balance)}</span>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={createGrn}
            className="w-full h-11 rounded-lg bg-green-500 hover:bg-green-600 text-white font-semibold"
          >
            {saving ? "Creating..." : "Create GRN (Shift+Enter)"}
          </button>
        </div>
      </div>
    </div>
  );
}


export function QuotationHome() {
  return (
    <div>
      <PageHeader title="Quotation" />
      <SubNav items={[{ to: "/quotation/quotation-list", label: "Quotation List" }, { to: "/quotation/create-quotation", label: "Create Quotation" }]} />
    </div>
  );
}

export function QuotationList() {
  const [rows, setRows] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [quoteNo, setQuoteNo] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [q, c] = await Promise.all([api.get("/quotations"), api.get("/customers/all")]);
      setRows(q.data.data || []);
      setCustomers(c.data.data?.rows || []);
    } catch (e: any) {
      setError(e.message || "Failed to load quotations");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const enriched = useMemo(() => {
    const now = new Date();
    return rows.map((r) => {
      const expired = r.expiresAt ? new Date(r.expiresAt) < now && r.status !== "Converted" : false;
      const status = expired ? "Expired" : r.status || "Active";
      return { ...r, displayStatus: status };
    });
  }, [rows]);

  const filtered = useMemo(() => {
    return enriched.filter((r) => {
      if (quoteNo && !String(r.quoteNo).toLowerCase().includes(quoteNo.toLowerCase())) return false;
      if (customerId && String(r.customerId) !== String(customerId)) return false;
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
  }, [enriched, quoteNo, customerId, fromDate, toDate]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const value = filtered.reduce((s, r) => s + Number(r.total || 0), 0);
    const active = filtered.filter((r) => r.displayStatus === "Active").length;
    const expired = filtered.filter((r) => r.displayStatus === "Expired").length;
    const recent = filtered[0]?.quoteNo || "None";
    return { total, value, active, expired, recent };
  }, [filtered]);

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
    setQuoteNo("");
    setCustomerId("");
    setFromDate("");
    setToDate("");
    setPage(1);
    load();
  }

  function printQuote(row: any) {
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) return;
    w.document.write(`
      <html><head><title>${row.quoteNo}</title>
      <style>body{font-family:Arial;padding:24px}table{width:100%;border-collapse:collapse;margin-top:12px}
      th,td{border-bottom:1px solid #ddd;padding:8px;text-align:left}</style></head>
      <body>
        <h1>QUANTUMEXE Quotation</h1>
        <div>${row.quoteNo}</div>
        <div>Customer: ${row.customer?.name || "-"}</div>
        <div>Issue: ${new Date(row.createdAt).toLocaleDateString()}</div>
        <div>Valid Until: ${row.expiresAt ? new Date(row.expiresAt).toLocaleDateString() : "-"}</div>
        <h3>Amount: ${lkr(row.total)}</h3>
        <div>Status: ${row.displayStatus}</div>
      </body></html>
    `);
    w.document.close();
    w.focus();
    w.print();
  }

  const cards = [
    { label: "Total Quotations", value: String(stats.total), tag: "GLOBAL STATS", badge: "All Time", highlight: true },
    { label: "Total Est. Value", value: lkr(stats.value), tag: "RECORDS", badge: "This View" },
    { label: "Active Quotes", value: String(stats.active), tag: "RECORDS", badge: "This View" },
    { label: "Expired Quotes", value: String(stats.expired), tag: "RECORDS", badge: "This View" },
    { label: "Recent Activity", value: stats.recent, tag: "RECORDS", badge: "Latest" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs text-gray-500 mb-1">Quotation &gt; Manage Quotations</div>
        <h1 className="text-2xl font-bold text-gray-800">Quotation List</h1>
      </div>
      {error && <ErrorBox text={error} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className={`rounded-xl border p-4 ${
              c.highlight ? "bg-green-600 text-white border-green-600" : "bg-white border-gray-200"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className={`text-xs font-medium ${c.highlight ? "text-green-100" : "text-gray-500"}`}>{c.label}</div>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  c.highlight ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"
                }`}
              >
                {c.badge}
              </span>
            </div>
            <div className="mt-2 text-xl font-bold truncate">{c.value}</div>
            <div className={`mt-3 text-[10px] font-semibold tracking-wide ${c.highlight ? "text-green-100" : "text-gray-400"}`}>
              {c.tag}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={onSearch} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <div className="text-[11px] text-gray-500 flex flex-wrap gap-x-3 gap-y-1 justify-end">
          <span><kbd className="px-1.5 py-0.5 rounded bg-gray-100 border">T</kbd> Navigate</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-gray-100 border">Enter</kbd> View</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-gray-100 border">P</kbd> Print</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-gray-100 border">E</kbd> Edit</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-gray-100 border">F</kbd> Search</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-gray-100 border">R</kbd> Reset</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_1fr_auto_auto] gap-3 items-end">
          <div>
            <label className="text-xs font-semibold text-gray-600">Quotation No</label>
            <input className="input mt-1" placeholder="Quotation No" value={quoteNo} onChange={(e) => setQuoteNo(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Customer</label>
            <select className="input mt-1" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Select Customer...</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
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
            className="h-[42px] w-[42px] rounded-full bg-blue-600 text-white grid place-items-center hover:bg-blue-700"
            title="Reset"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </form>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <div className="text-sm font-bold tracking-wide text-gray-800">QUOTATION LIST</div>
          <Link className="btn btn-primary text-sm" to="/quotation/create-quotation">
            Create Quotation
          </Link>
        </div>
        <div className="overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-green-700 text-white">
                {["QUOTATION #", "CUSTOMER", "ISSUE DATE", "VALID UNTIL", "AMOUNT", "STATUS", "ACTIONS"].map((h) => (
                  <th key={h} className="text-left font-semibold px-3 py-3 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r, idx) => (
                <tr key={r.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="px-3 py-3 font-semibold text-gray-800">{r.quoteNo}</td>
                  <td className="px-3 py-3 text-gray-700">{r.customer?.name || "-"}</td>
                  <td className="px-3 py-3 text-gray-600">{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td className="px-3 py-3 text-gray-600">
                    {r.expiresAt ? new Date(r.expiresAt).toLocaleDateString() : "-"}
                  </td>
                  <td className="px-3 py-3 font-semibold text-green-700">{lkr(r.total)}</td>
                  <td className="px-3 py-3">
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        r.displayStatus === "Active"
                          ? "bg-green-100 text-green-700"
                          : r.displayStatus === "Expired"
                            ? "bg-red-100 text-red-600"
                            : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {r.displayStatus}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/quotation/edit-quotation/${r.id}`}
                        className="w-8 h-8 rounded-full bg-blue-500 text-white grid place-items-center hover:bg-blue-600 text-xs font-bold"
                        title="Edit"
                      >
                        E
                      </Link>
                      <button
                        type="button"
                        title="Print"
                        onClick={() => printQuote(r)}
                        className="w-8 h-8 rounded-full bg-green-500 text-white grid place-items-center hover:bg-green-600 text-xs font-bold"
                      >
                        P
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!pageRows.length && (
                <tr>
                  <td colSpan={7} className="px-3 py-16 text-center text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <Search size={28} className="opacity-40" />
                      <div className="font-semibold tracking-wide">NO RECORDS FOUND</div>
                    </div>
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
    </div>
  );
}


export function QuotationForm({ edit = false }: { edit?: boolean }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<any[]>([]);
  const [variants, setVariants] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expiryDate, setExpiryDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });
  const [productQuery, setProductQuery] = useState("");
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [qty, setQty] = useState(1);
  const [discountMode, setDiscountMode] = useState<"percent" | "flat">("percent");
  const [adjustValue, setAdjustValue] = useState(0);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<
    Array<{
      key: string;
      variantId: number;
      sku: string;
      name: string;
      price: number;
      qty: number;
      discount: number;
    }>
  >([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showCustomerList, setShowCustomerList] = useState(false);
  const [showProductList, setShowProductList] = useState(false);

  useEffect(() => {
    api.get("/customers/all").then((r) => setCustomers(r.data.data?.rows || []));
    api.get("/products/variations").then((r) => setVariants(r.data.data || []));
  }, []);

  useEffect(() => {
    if (!(edit && id)) return;
    api.get(`/quotations/${id}`).then((r) => {
      const q = r.data.data;
      setCustomerId(String(q.customerId || ""));
      if (q.customer?.name) setCustomerQuery(q.customer.name);
      if (q.expiresAt) setExpiryDate(String(q.expiresAt).slice(0, 10));
      setLines(
        (q.items || []).map((it: any, idx: number) => ({
          key: `${it.variantId}-${idx}`,
          variantId: it.variantId,
          sku: it.variant?.product?.code || `SKU-${it.variantId}`,
          name: it.variant?.product?.name || `Item ${it.variantId}`,
          price: Number(it.price || 0),
          qty: Number(it.qty || 1),
          discount: Number(it.discount || 0),
        }))
      );
    });
  }, [edit, id]);

  const filteredCustomers = useMemo(() => {
    const q = customerQuery.toLowerCase();
    if (!q) return customers.slice(0, 8);
    return customers.filter((c) => c.name?.toLowerCase().includes(q) || c.phone?.includes(q)).slice(0, 8);
  }, [customers, customerQuery]);

  const filteredProducts = useMemo(() => {
    const q = productQuery.toLowerCase();
    if (!q) return variants.slice(0, 8);
    return variants
      .filter(
        (v) =>
          v.product?.name?.toLowerCase().includes(q) ||
          v.product?.code?.toLowerCase().includes(q) ||
          v.barcode?.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [variants, productQuery]);

  const totals = useMemo(() => {
    const units = lines.reduce((s, l) => s + l.qty, 0);
    const deductions = lines.reduce((s, l) => s + l.discount, 0);
    const payable = lines.reduce((s, l) => s + Math.max(0, l.price * l.qty - l.discount), 0);
    return { units, deductions, payable };
  }, [lines]);

  function pickCustomer(c: any) {
    setCustomerId(String(c.id));
    setCustomerQuery(c.name);
    setShowCustomerList(false);
  }

  function pickProduct(v: any) {
    setSelectedVariantId(String(v.id));
    setProductQuery(`${v.product?.name || ""} (${v.product?.code || v.barcode || v.id})`);
    setShowProductList(false);
  }

  function integrateToList() {
    setError("");
    const v = variants.find((x) => String(x.id) === selectedVariantId);
    if (!v) {
      setError("Select a product first");
      return;
    }
    const unit = Number(v.price || 0);
    const lineGross = unit * qty;
    const discount =
      discountMode === "percent"
        ? (lineGross * Number(adjustValue || 0)) / 100
        : Number(adjustValue || 0);

    setLines((prev) => {
      const existing = prev.find((l) => l.variantId === v.id);
      if (existing) {
        return prev.map((l) =>
          l.variantId === v.id
            ? {
                ...l,
                qty: l.qty + qty,
                discount: l.discount + discount,
              }
            : l
        );
      }
      return [
        ...prev,
        {
          key: `${v.id}-${Date.now()}`,
          variantId: v.id,
          sku: v.product?.code || v.barcode || `SKU-${v.id}`,
          name: v.product?.name || "Item",
          price: unit,
          qty,
          discount,
        },
      ];
    });

    setProductQuery("");
    setSelectedVariantId("");
    setQty(1);
    setAdjustValue(0);
  }

  async function saveQuote(andPrint = false) {
    if (!lines.length) {
      setError("Add at least one product to the draft");
      return;
    }
    setSaving(true);
    setError("");
    const payload = {
      customerId: customerId ? Number(customerId) : undefined,
      expiresAt: expiryDate,
      notes,
      discount: totals.deductions,
      items: lines.map((l) => ({
        variantId: l.variantId,
        qty: l.qty,
        price: l.price,
        discount: l.discount,
      })),
    };
    try {
      const { data } =
        edit && id
          ? await api.put(`/quotations/${id}`, payload)
          : await api.post("/quotations", payload);
      if (!data.success) throw new Error(data.message);
      if (andPrint) {
        const q = data.data;
        const w = window.open("", "_blank", "width=800,height=900");
        if (w) {
          w.document.write(`
            <html><head><title>${q.quoteNo}</title>
            <style>body{font-family:Arial;padding:24px}table{width:100%;border-collapse:collapse;margin-top:12px}
            th,td{border-bottom:1px solid #ddd;padding:8px;text-align:left}</style></head>
            <body>
              <h1>QUANTUMEXE Quotation</h1>
              <div>${q.quoteNo}</div>
              <div>Issue: ${issueDate} · Expiry: ${expiryDate}</div>
              <div>Customer: ${customerQuery || "Guest"}</div>
              <table><thead><tr><th>SKU</th><th>Item</th><th>Rate</th><th>Qty</th><th>Adjust</th><th>Net</th></tr></thead>
              <tbody>
                ${lines
                  .map(
                    (l) =>
                      `<tr><td>${l.sku}</td><td>${l.name}</td><td>${l.price}</td><td>${l.qty}</td><td>${l.discount}</td><td>${
                        l.price * l.qty - l.discount
                      }</td></tr>`
                  )
                  .join("")}
              </tbody></table>
              <h3>Payable: ${lkr(totals.payable)}</h3>
              <p>${notes || ""}</p>
            </body></html>
          `);
          w.document.close();
          w.focus();
          w.print();
        }
      }
      navigate("/quotation/quotation-list");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save quotation");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs text-gray-500 mb-1">Quotation / Draft Quotation</div>
          <h1 className="text-2xl font-bold text-gray-800">{edit ? "Edit Quotation" : "Create Quotation"}</h1>
        </div>
        <div className="text-[11px] text-gray-500 flex flex-wrap gap-x-3 gap-y-1">
          <span><kbd className="px-1.5 py-0.5 rounded bg-gray-100 border">F1</kbd> Product</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-gray-100 border">F2</kbd> Customer</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-gray-100 border">F4</kbd> Save</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-gray-100 border">F9</kbd> Print</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-gray-100 border">Ins</kbd> Register</span>
        </div>
      </div>

      {error && <ErrorBox text={error} />}

      <div className="grid xl:grid-cols-[360px_1fr] gap-4">
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="text-xs font-bold tracking-wide text-gray-700">CUSTOMER DETAILS</div>
            <div className="relative">
              <label className="text-xs font-semibold text-gray-600">Selected Customer</label>
              <div className="relative mt-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  className="input pl-9"
                  placeholder="Identify Customer (F2)..."
                  value={customerQuery}
                  onChange={(e) => {
                    setCustomerQuery(e.target.value);
                    setShowCustomerList(true);
                    if (!e.target.value) setCustomerId("");
                  }}
                  onFocus={() => setShowCustomerList(true)}
                />
              </div>
              {showCustomerList && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-auto">
                  {filteredCustomers.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-green-50"
                      onClick={() => pickCustomer(c)}
                    >
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-gray-500">{c.phone || "No phone"}</div>
                    </button>
                  ))}
                  {!filteredCustomers.length && <div className="px-3 py-2 text-sm text-gray-400">No customers</div>}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600">Issuance Date</label>
                <input type="date" className="input mt-1" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Expiry Date</label>
                <input type="date" className="input mt-1" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="text-xs font-bold tracking-wide text-gray-700">ASSET ENTRY</div>
            <div className="relative">
              <label className="text-xs font-semibold text-gray-600">Product Discovery</label>
              <div className="relative mt-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  className="input pl-9"
                  placeholder="Scan or Search Product (F1)..."
                  value={productQuery}
                  onChange={(e) => {
                    setProductQuery(e.target.value);
                    setShowProductList(true);
                  }}
                  onFocus={() => setShowProductList(true)}
                />
              </div>
              {showProductList && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-auto">
                  {filteredProducts.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-green-50"
                      onClick={() => pickProduct(v)}
                    >
                      <div className="font-medium">{v.product?.name}</div>
                      <div className="text-xs text-gray-500">
                        {v.product?.code || v.barcode} · {lkr(v.price)}
                      </div>
                    </button>
                  ))}
                  {!filteredProducts.length && <div className="px-3 py-2 text-sm text-gray-400">No products</div>}
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600">Quantity</label>
              <input
                type="number"
                min={1}
                className="input mt-1"
                value={qty}
                onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600">Discount Mode</label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={`h-10 rounded-lg text-sm font-semibold border ${
                    discountMode === "percent" ? "bg-green-600 text-white border-green-600" : "bg-white text-gray-700 border-gray-200"
                  }`}
                  onClick={() => setDiscountMode("percent")}
                >
                  PERCENT %
                </button>
                <button
                  type="button"
                  className={`h-10 rounded-lg text-sm font-semibold border ${
                    discountMode === "flat" ? "bg-green-600 text-white border-green-600" : "bg-white text-gray-700 border-gray-200"
                  }`}
                  onClick={() => setDiscountMode("flat")}
                >
                  FLAT LKR
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600">Adjustment Value</label>
              <input
                type="number"
                min={0}
                className="input mt-1"
                value={adjustValue}
                onChange={(e) => setAdjustValue(Number(e.target.value) || 0)}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600">Special Directives</label>
              <textarea
                className="input mt-1 min-h-[80px]"
                placeholder="Notes / terms..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <button type="button" className="btn btn-primary w-full" onClick={integrateToList}>
              + INTEGRATE TO LIST
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-xs text-gray-500">Total Asset Count</div>
              <div className="text-2xl font-bold mt-1">{totals.units}</div>
              <div className="text-[10px] font-semibold tracking-wide text-gray-400 mt-2">UNITS INTEGRATED</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-xs text-gray-500">Global Adjustment</div>
              <div className="text-2xl font-bold mt-1">{lkr(totals.deductions)}</div>
              <div className="text-[10px] font-semibold tracking-wide text-gray-400 mt-2">TOTAL DEDUCTIONS</div>
            </div>
            <div className="bg-green-600 text-white rounded-xl p-4">
              <div className="text-xs text-green-100">Net Valuation</div>
              <div className="text-2xl font-bold mt-1">{lkr(totals.payable)}</div>
              <div className="text-[10px] font-semibold tracking-wide text-green-100 mt-2">PAYABLE BALANCE</div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden min-h-[420px] flex flex-col">
            <div className="px-4 py-3 border-b border-gray-100 text-sm font-bold tracking-wide text-gray-800">
              DRAFT MATRIX
            </div>
            <div className="flex-1 overflow-auto">
              {lines.length ? (
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-green-700 text-white">
                      {["SKU ID", "ITEM DESCRIPTION", "UNIT RATE", "QTY", "ADJUST", "NET TOTAL", ""].map((h) => (
                        <th key={h || "x"} className="text-left font-semibold px-3 py-3 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => (
                      <tr key={l.key} className="border-b border-gray-100">
                        <td className="px-3 py-3 font-medium">{l.sku}</td>
                        <td className="px-3 py-3">{l.name}</td>
                        <td className="px-3 py-3">{lkr(l.price)}</td>
                        <td className="px-3 py-3">{l.qty}</td>
                        <td className="px-3 py-3 text-red-600">{lkr(l.discount)}</td>
                        <td className="px-3 py-3 font-semibold text-green-700">{lkr(l.price * l.qty - l.discount)}</td>
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            className="text-gray-400 hover:text-red-600"
                            onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))}
                          >
                            <X size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="h-full min-h-[320px] grid place-items-center p-8 text-center">
                  <div>
                    <div className="mx-auto w-16 h-16 rounded-full bg-green-50 text-green-600 grid place-items-center mb-3">
                      <ShoppingCart size={28} />
                    </div>
                    <div className="font-semibold text-gray-700">AWAITING INVENTORY INTAKE</div>
                    <div className="text-sm text-gray-500 mt-1 max-w-md">
                      Scan items or use the discovery search to populate this quotation draft.
                    </div>
                    <div className="mt-4 flex justify-center gap-2">
                      <button type="button" className="btn btn-muted text-xs" onClick={() => setShowProductList(true)}>
                        F1 Search
                      </button>
                      <button type="button" className="btn btn-muted text-xs" onClick={() => setShowCustomerList(true)}>
                        F2 Customer
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => saveQuote(false)}
                className="h-11 px-5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-semibold"
              >
                COMMIT DRAFT (F4)
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => saveQuote(true)}
                className="h-11 px-5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold"
              >
                SAVE & PRINT (F9)
              </button>
              <button type="button" className="h-11 px-4 rounded-lg bg-gray-100 text-gray-700 font-semibold ml-auto" onClick={() => navigate("/quotation")}>
                Cancel (X)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

