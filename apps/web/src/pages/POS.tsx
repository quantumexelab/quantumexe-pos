import { FormEvent, useEffect, useMemo, useState } from "react";
import api from "../api";
import { ErrorBox, PageHeader } from "../components/ui";
import { printReceipt } from "../print/receipt";
import { loadPrintSettings } from "../print/settings";
import { openCashDrawer, shouldOpenCashDrawerOnSale } from "../print/cashDrawer";
import { publishCustomerDisplay } from "../customerDisplay/channel";
import {
  connectPoleDisplay,
  disconnectPoleDisplay,
  poleDisplayConnected,
  poleDisplaySupported,
  showPoleCart,
  showPoleIdle,
  showPoleThankYou,
} from "../customerDisplay/pole";

type Product = {
  id: number;
  displayName: string;
  price: number;
  quantity: number;
  barcode?: string;
  stockId?: number;
  size?: string | null;
  color?: string | null;
};

type CartItem = Product & { qty: number; discount: number };

export default function POS() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [barcode, setBarcode] = useState("");
  const [paymentType, setPaymentType] = useState("Cash");
  const [paidAmount, setPaidAmount] = useState<number | "">("");
  const [customerId, setCustomerId] = useState<number | "">("");
  const [customers, setCustomers] = useState<Array<{ id: number; name: string }>>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [autoPrint, setAutoPrint] = useState(true);
  const [shopName, setShopName] = useState("QUANTUMEXE POS");
  const [currency, setCurrency] = useState("Rs.");
  const [poleOn, setPoleOn] = useState(false);
  const [displayEnabled, setDisplayEnabled] = useState(true);

  useEffect(() => {
    api.get("/stock/all-variations", { params: { hasStock: true, limit: 200, location: "shop" } }).then((r) => {
      setProducts(r.data.data || []);
    });
    api.get("/customers/all", { params: { limit: 100 } }).then((r) => {
      setCustomers((r.data.data?.rows || []).map((c: { id: number; name: string }) => ({ id: c.id, name: c.name })));
    });
    api.get("/settings").then((r) => {
      const map = (r.data?.data || {}) as Record<string, string>;
      setShopName(map.shop_display_name || map.shop_name || "QUANTUMEXE POS");
      setCurrency(map.currency || "Rs.");
      if (map.auto_print_receipt === "0") setAutoPrint(false);
      setDisplayEnabled(!(map.customer_display_enabled === "0" || map.customer_display_enabled === "false"));
    }).catch(() => undefined);
    return () => {
      void showPoleIdle(shopName).catch(() => undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subtotal = useMemo(() => cart.reduce((s, i) => s + i.price * i.qty, 0), [cart]);
  const discount = useMemo(() => cart.reduce((s, i) => s + i.discount, 0), [cart]);
  const total = Math.max(0, subtotal - discount);
  const pay = paidAmount === "" ? total : Number(paidAmount);

  useEffect(() => {
    if (!displayEnabled) return;
    const items = cart.map((i) => ({
      name: i.displayName,
      qty: i.qty,
      price: i.price,
      lineTotal: Math.max(0, i.price * i.qty - i.discount),
    }));
    publishCustomerDisplay({
      status: cart.length ? "cart" : "idle",
      shopName,
      items,
      subtotal,
      discount,
      total,
      paid: undefined,
      change: undefined,
    });
    const last = cart[cart.length - 1];
    if (poleOn) {
      void showPoleCart({
        itemName: last?.displayName,
        itemPrice: last?.price,
        total,
        currency,
      }).catch(() => undefined);
    }
  }, [cart, subtotal, discount, total, shopName, poleOn, currency, displayEnabled]);

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
      setError("");
    } catch {
      setError("Barcode not found");
    }
  }

  async function togglePole() {
    try {
      if (poleOn) {
        await disconnectPoleDisplay();
        setPoleOn(false);
        setMessage("Pole display disconnected");
        return;
      }
      await connectPoleDisplay();
      setPoleOn(true);
      setMessage("Pole display (CD-7220) connected");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pole display connection failed");
      setPoleOn(false);
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
        paidAmount: pay,
        items: cart.map((i) => ({
          id: i.id,
          stock_id: i.stockId,
          qty: i.qty,
          price: i.price,
          discount: i.discount,
        })),
      });
      if (!data.success) throw new Error(data.message);
      const inv = data.data;
      const change = Math.max(0, pay - Number(inv.total || total));
      if (displayEnabled) {
        publishCustomerDisplay({
          status: "thankyou",
          shopName,
          items: [],
          subtotal: 0,
          discount: 0,
          total: Number(inv.total || total),
          paid: pay,
          change,
        });
      }
      if (poleOn || poleDisplayConnected()) {
        await showPoleThankYou(Number(inv.total || total), currency).catch(() => undefined);
      }
      setMessage(`Invoice ${inv.invoiceNo} created — Rs. ${inv.total}`);
      setCart([]);
      setPaidAmount("");
      if (autoPrint) {
        try {
          await printReceipt(inv);
        } catch (pe) {
          console.warn("Print failed", pe);
        }
      }
      try {
        const printSettings = await loadPrintSettings(true);
        if (shouldOpenCashDrawerOnSale(printSettings, paymentType)) {
          const drawer = await openCashDrawer();
          if (!drawer.ok) console.warn(drawer.message);
        }
      } catch (de) {
        console.warn("Cash drawer", de);
      }
      const refreshed = await api.get("/stock/all-variations", { params: { hasStock: true, limit: 200, location: "shop" } });
      setProducts(refreshed.data.data || []);
      setTimeout(() => {
        if (displayEnabled) {
          publishCustomerDisplay({ status: "idle", shopName, items: [], subtotal: 0, discount: 0, total: 0 });
        }
        if (poleOn) void showPoleIdle(shopName).catch(() => undefined);
      }, 8000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Point of Sale" subtitle="Sell from shop floor stock (release from store first)" />
      {error && <ErrorBox text={error} />}
      {message && (
        <div className="mb-3 text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
          {message}
        </div>
      )}

      <div className="grid xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          <form onSubmit={scanBarcode} className="card flex gap-2">
            <input
              className="input flex-1"
              placeholder="Scan barcode…"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              autoFocus
            />
            <button className="btn btn-primary" type="submit">
              Add
            </button>
          </form>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {products.map((p) => (
              <button key={p.id} type="button" className="card text-left hover:border-emerald-400 transition" onClick={() => addToCart(p)}>
                <div className="font-semibold text-sm">{p.displayName}</div>
                <div className="text-xs text-gray-500 mt-1">{p.barcode || "-"}</div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="font-bold">Rs. {p.price}</span>
                  <span className="text-gray-500">Qty {p.quantity}</span>
                </div>
              </button>
            ))}
            {!products.length && <div className="text-sm text-gray-500 col-span-full">No stocked products</div>}
          </div>
        </div>

        <div className="card space-y-3 h-fit">
          <div className="font-bold">Cart</div>
          <div className="space-y-2 max-h-72 overflow-auto">
            {cart.map((item) => (
              <div key={item.id} className="border border-gray-100 rounded-lg p-2">
                <div className="text-sm font-medium">{item.displayName}</div>
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <button
                    type="button"
                    className="btn btn-muted px-2 py-1"
                    onClick={() => setCart((prev) => prev.map((x) => (x.id === item.id ? { ...x, qty: Math.max(1, x.qty - 1) } : x)))}
                  >
                    -
                  </button>
                  <span>{item.qty}</span>
                  <button
                    type="button"
                    className="btn btn-muted px-2 py-1"
                    onClick={() =>
                      setCart((prev) =>
                        prev.map((x) => (x.id === item.id ? { ...x, qty: Math.min(item.quantity, x.qty + 1) } : x))
                      )
                    }
                  >
                    +
                  </button>
                  <span className="ml-auto font-semibold">Rs. {(item.price * item.qty - item.discount).toFixed(2)}</span>
                  <button type="button" className="text-red-600 text-xs" onClick={() => setCart((prev) => prev.filter((x) => x.id !== item.id))}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
            {!cart.length && <div className="text-sm text-gray-500">Cart empty</div>}
          </div>

          <div className="text-sm space-y-1 border-t border-gray-100 pt-2">
            <div className="flex justify-between"><span>Subtotal</span><span>Rs. {subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Discount</span><span>Rs. {discount.toFixed(2)}</span></div>
            <div className="flex justify-between font-bold text-base"><span>Total</span><span>Rs. {total.toFixed(2)}</span></div>
          </div>

          <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value ? Number(e.target.value) : "")}>
            <option value="">Walk-in customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select className="input" value={paymentType} onChange={(e) => setPaymentType(e.target.value)}>
            <option>Cash</option>
            <option>Card</option>
            <option>Bank</option>
          </select>
          <input
            className="input"
            type="number"
            placeholder="Paid amount"
            value={paidAmount}
            onChange={(e) => setPaidAmount(e.target.value === "" ? "" : Number(e.target.value))}
          />

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={autoPrint} onChange={(e) => setAutoPrint(e.target.checked)} />
            Auto print receipt
          </label>

          {poleDisplaySupported() && (
            <button type="button" className={`btn ${poleOn ? "btn-primary" : "btn-muted"} w-full`} onClick={togglePole}>
              {poleOn ? "Disconnect pole display" : "Connect CD-7220 pole display"}
            </button>
          )}

          <button
            type="button"
            className="btn btn-muted w-full"
            onClick={() => {
              void openCashDrawer({ force: true }).then((r) => {
                if (r.ok) setMessage(r.message);
                else setError(r.message);
              });
            }}
          >
            Open cash drawer
          </button>

          <button className="btn btn-primary w-full" disabled={loading} onClick={checkout}>
            {loading ? "Processing…" : "Checkout"}
          </button>
        </div>
      </div>
    </div>
  );
}
