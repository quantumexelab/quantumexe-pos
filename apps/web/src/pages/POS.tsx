import { FormEvent, useEffect, useMemo, useState } from "react";
import api from "../api";
import { ErrorBox, PageHeader } from "../components/ui";

type Product = {
  id: number;
  displayName: string;
  price: number;
  quantity: number;
  barcode?: string;
  stockId?: number;
};

type CartItem = Product & { qty: number; discount: number };

export default function POS() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [barcode, setBarcode] = useState("");
  const [paymentType, setPaymentType] = useState("Cash");
  const [customerId, setCustomerId] = useState<number | "">("");
  const [customers, setCustomers] = useState<Array<{ id: number; name: string }>>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/stock/all-variations", { params: { hasStock: true, limit: 200 } }).then((r) => {
      setProducts(r.data.data || []);
    });
    api.get("/customers/all", { params: { limit: 100 } }).then((r) => {
      setCustomers((r.data.data?.rows || []).map((c: { id: number; name: string }) => ({ id: c.id, name: c.name })));
    });
  }, []);

  const subtotal = useMemo(() => cart.reduce((s, i) => s + i.price * i.qty, 0), [cart]);
  const discount = useMemo(() => cart.reduce((s, i) => s + i.discount, 0), [cart]);
  const total = Math.max(0, subtotal - discount);

  function addToCart(p: Product) {
    setCart((prev) => {
      const existing = prev.find((x) => x.id === p.id);
      if (existing) {
        return prev.map((x) => (x.id === p.id ? { ...x, qty: Math.min(x.qty + 1, p.quantity) } : x));
      }
      return [...prev, { ...p, qty: 1, discount: 0 }];
    });
  }

  async function scanBarcode(e: FormEvent) {
    e.preventDefault();
    if (!barcode.trim()) return;
    try {
      const { data } = await api.get(`/pos/products/barcode/${encodeURIComponent(barcode.trim())}`);
      if (data.success) addToCart(data.data);
      setBarcode("");
    } catch {
      setError("Barcode not found");
    }
  }

  async function checkout() {
    if (!cart.length) return setError("Cart is empty");
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const { data } = await api.post("/pos/invoice", {
        customerId: customerId || undefined,
        paymentType,
        paidAmount: total,
        items: cart.map((i) => ({
          id: i.id,
          stock_id: i.stockId,
          qty: i.qty,
          price: i.price,
          discount: i.discount,
        })),
      });
      if (!data.success) throw new Error(data.message);
      setMessage(`Invoice ${data.data.invoiceNo} created — Rs. ${data.data.total}`);
      setCart([]);
      const refreshed = await api.get("/stock/all-variations", { params: { hasStock: true, limit: 200 } });
      setProducts(refreshed.data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Point of Sale" subtitle="Scan barcode or pick products to sell" />
      {error && <ErrorBox text={error} />}
      {message && <div className="mb-3 text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">{message}</div>}

      <div className="grid xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          <form onSubmit={scanBarcode} className="card flex gap-2">
            <input className="input" placeholder="Scan / enter barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
            <button className="btn btn-primary" type="submit">Add</button>
          </form>
          <div className="card">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[520px] overflow-auto">
              {products.map((p) => (
                <button
                  key={p.id}
                  className="text-left border border-gray-200 rounded-xl p-3 hover:border-green-500 hover:bg-green-50 transition"
                  onClick={() => addToCart(p)}
                >
                  <div className="font-semibold text-sm">{p.displayName}</div>
                  <div className="text-xs text-gray-500">Qty: {p.quantity}</div>
                  <div className="mt-2 font-bold text-green-700">Rs. {p.price}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="card space-y-3">
          <div className="font-semibold">Cart</div>
          <div className="space-y-2 max-h-72 overflow-auto">
            {cart.map((item) => (
              <div key={item.id} className="border border-gray-100 rounded-lg p-2">
                <div className="flex justify-between gap-2">
                  <div className="text-sm font-medium">{item.displayName}</div>
                  <button className="text-xs text-red-500" onClick={() => setCart((c) => c.filter((x) => x.id !== item.id))}>Remove</button>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={item.quantity}
                    className="input w-20"
                    value={item.qty}
                    onChange={(e) =>
                      setCart((c) =>
                        c.map((x) => (x.id === item.id ? { ...x, qty: Number(e.target.value) } : x))
                      )
                    }
                  />
                  <input
                    type="number"
                    min={0}
                    className="input"
                    placeholder="Discount"
                    value={item.discount}
                    onChange={(e) =>
                      setCart((c) =>
                        c.map((x) => (x.id === item.id ? { ...x, discount: Number(e.target.value) } : x))
                      )
                    }
                  />
                </div>
                <div className="text-xs text-gray-500 mt-1">Line: Rs. {(item.price * item.qty - item.discount).toFixed(2)}</div>
              </div>
            ))}
            {!cart.length && <div className="text-sm text-gray-400">No items</div>}
          </div>

          <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value ? Number(e.target.value) : "")}>
            <option value="">Walk-in customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <div className="grid grid-cols-3 gap-2">
            {["Cash", "Card", "Digital/QR"].map((t) => (
              <button
                key={t}
                className={`btn text-sm ${paymentType === t ? "btn-primary" : "btn-muted"}`}
                onClick={() => setPaymentType(t)}
                type="button"
              >
                {t}
              </button>
            ))}
          </div>

          <div className="text-sm space-y-1 border-t pt-3">
            <div className="flex justify-between"><span>Subtotal</span><span>Rs. {subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Discount</span><span>Rs. {discount.toFixed(2)}</span></div>
            <div className="flex justify-between font-bold text-lg"><span>Total</span><span>Rs. {total.toFixed(2)}</span></div>
          </div>

          <button className="btn btn-primary w-full" disabled={loading} onClick={checkout}>
            {loading ? "Processing..." : "Complete Sale"}
          </button>
        </div>
      </div>
    </div>
  );
}
