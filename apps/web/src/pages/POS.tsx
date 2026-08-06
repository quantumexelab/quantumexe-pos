import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  UserPlus,
  Phone,
  Mail,
  X,
  Search,
  ShoppingCart,
  Zap,
  Monitor,
  TrendingUp,
  CheckCircle2,
  DollarSign,
  Store,
  Pause,
  ListOrdered,
  Wallet,
  Package,
  RotateCcw,
  ArrowRight,
} from "lucide-react";
import api, { auth } from "../api";
import { ErrorBox } from "../components/ui";
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
import { BulkConvertModal, CashManageModal, HeldBillsDrawer, ReturnRefundModal } from "./posModals";

type Product = {
  id: number;
  displayName: string;
  price: number;
  cost?: number;
  quantity: number;
  barcode?: string;
  stockId?: number;
  size?: string | null;
  color?: string | null;
  code?: string;
};

type CartItem = Product & { qty: number; discount: number };

type Customer = { id: number; name: string; phone?: string | null };

type PosSession = {
  id: number;
  counterName: string;
  openingBalance: number;
  userId?: number;
  openedAt?: string;
};

type HeldBill = {
  id: string;
  savedAt: string;
  cart: CartItem[];
  customerId: number | "";
  customerQuery: string;
  cash: number;
  card: number;
  bank: number;
  note?: string;
};

const SESSION_KEY = "pos_active_session";
const HELD_KEY = "pos_held_bills";
const COUNTERS = ["Counter 1", "Counter 2"] as const;

function money(n: number, currency = "Rs.") {
  return `${currency} ${Number(n || 0).toFixed(2)}`;
}

function loadHeld(): HeldBill[] {
  try {
    const raw = localStorage.getItem(HELD_KEY);
    return raw ? (JSON.parse(raw) as HeldBill[]) : [];
  } catch {
    return [];
  }
}

function saveHeld(rows: HeldBill[]) {
  localStorage.setItem(HELD_KEY, JSON.stringify(rows));
}

function loadStoredSession(): PosSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as PosSession) : null;
  } catch {
    return null;
  }
}

function storeSession(s: PosSession | null) {
  if (!s) sessionStorage.removeItem(SESSION_KEY);
  else sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
}

export default function POS() {
  const navigate = useNavigate();
  const me = auth.getUser();
  const productInputRef = useRef<HTMLInputElement>(null);
  const customerInputRef = useRef<HTMLInputElement>(null);
  const cashInputRef = useRef<HTMLInputElement>(null);
  const cardInputRef = useRef<HTMLInputElement>(null);
  const bankInputRef = useRef<HTMLInputElement>(null);

  const [sessionReady, setSessionReady] = useState(false);
  const [sessionChecking, setSessionChecking] = useState(true);
  const [session, setSession] = useState<PosSession | null>(null);
  const [counterName, setCounterName] = useState<(typeof COUNTERS)[number] | "">("");
  const [openingBalance, setOpeningBalance] = useState("0.00");
  const [sessionBusy, setSessionBusy] = useState(false);
  const [sessionError, setSessionError] = useState("");

  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [productQuery, setProductQuery] = useState("");
  const [showProductList, setShowProductList] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState<number | "">("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [showCustomerList, setShowCustomerList] = useState(false);
  const [cashPay, setCashPay] = useState<number | "">("");
  const [cardPay, setCardPay] = useState<number | "">("");
  const [bankPay, setBankPay] = useState<number | "">("");
  const [priceMode, setPriceMode] = useState<"retail" | "wholesale">("retail");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [autoPrint, setAutoPrint] = useState(true);
  const [shopName, setShopName] = useState("QUANTUMEXE POS");
  const [currency, setCurrency] = useState("Rs.");
  const [poleOn, setPoleOn] = useState(false);
  const [displayEnabled, setDisplayEnabled] = useState(true);

  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerBusy, setRegisterBusy] = useState(false);
  const [registerError, setRegisterError] = useState("");
  const [registerForm, setRegisterForm] = useState({ name: "", phone: "", email: "" });

  const [heldOpen, setHeldOpen] = useState(false);
  const [heldBills, setHeldBills] = useState<HeldBill[]>(() => loadHeld());
  const [cashManageOpen, setCashManageOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function resolveSession() {
      setSessionChecking(true);
      setSessionError("");
      try {
        const stored = loadStoredSession();
        const { data } = await api.get("/accounts/sessions");
        const rows = (data?.data || []) as Array<PosSession & { status?: string; closedAt?: string | null; userId: number }>;
        const openMine = rows.find(
          (s) =>
            s.status === "OPEN" &&
            (!me?.id || Number(s.userId) === Number(me.id))
        );
        if (cancelled) return;
        if (openMine) {
          const s: PosSession = {
            id: openMine.id,
            counterName: openMine.counterName || "Counter 1",
            openingBalance: Number(openMine.openingBalance || 0),
            userId: openMine.userId,
            openedAt: (openMine as { openedAt?: string }).openedAt,
          };
          setSession(s);
          storeSession(s);
          setSessionReady(true);
        } else if (stored && me?.id && Number(stored.userId) === Number(me.id)) {
          // stale local — clear; require new open
          storeSession(null);
          setSession(null);
          setSessionReady(false);
        } else {
          storeSession(null);
          setSession(null);
          setSessionReady(false);
        }
      } catch {
        if (!cancelled) {
          const stored = loadStoredSession();
          if (stored) {
            setSession(stored);
            setSessionReady(true);
          }
        }
      } finally {
        if (!cancelled) setSessionChecking(false);
      }
    }
    void resolveSession();
    return () => {
      cancelled = true;
    };
  }, [me?.id]);

  useEffect(() => {
    if (!sessionReady) return;
    api.get("/stock/all-variations", { params: { hasStock: true, limit: 200, location: "shop" } }).then((r) => {
      setProducts(
        (r.data.data || []).map((p: Product & { product?: { code?: string } }) => ({
          ...p,
          code: p.code || p.product?.code,
        }))
      );
    });
    api.get("/customers/all", { params: { limit: 200 } }).then((r) => {
      setCustomers(
        (r.data.data?.rows || []).map((c: Customer) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
        }))
      );
    });
    api
      .get("/settings")
      .then((r) => {
        const map = (r.data?.data || {}) as Record<string, string>;
        setShopName(map.shop_display_name || map.shop_name || "QUANTUMEXE POS");
        setCurrency(map.currency || "Rs.");
        if (map.auto_print_receipt === "0") setAutoPrint(false);
        setDisplayEnabled(!(map.customer_display_enabled === "0" || map.customer_display_enabled === "false"));
      })
      .catch(() => undefined);
    return () => {
      void showPoleIdle(shopName).catch(() => undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionReady]);

  const subtotal = useMemo(() => cart.reduce((s, i) => s + i.price * i.qty, 0), [cart]);
  const discount = useMemo(() => cart.reduce((s, i) => s + i.discount, 0), [cart]);
  const total = Math.max(0, subtotal - discount);
  const discountPct = subtotal > 0 ? (discount / subtotal) * 100 : 0;
  const cashN = cashPay === "" ? 0 : Number(cashPay);
  const cardN = cardPay === "" ? 0 : Number(cardPay);
  const bankN = bankPay === "" ? 0 : Number(bankPay);
  const paidSum = cashN + cardN + bankN;
  const balance = paidSum - total;

  const primaryPaymentType = useMemo(() => {
    const tenders: Array<{ type: string; amount: number }> = [
      { type: "Cash", amount: cashN },
      { type: "Card", amount: cardN },
      { type: "Bank", amount: bankN },
    ];
    tenders.sort((a, b) => b.amount - a.amount);
    return tenders[0].amount > 0 ? tenders[0].type : "Cash";
  }, [cashN, cardN, bankN]);

  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return products.slice(0, 10);
    return products
      .filter(
        (p) =>
          p.displayName?.toLowerCase().includes(q) ||
          p.barcode?.toLowerCase().includes(q) ||
          p.code?.toLowerCase().includes(q) ||
          String(p.id).includes(q)
      )
      .slice(0, 10);
  }, [products, productQuery]);

  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return customers.slice(0, 8);
    return customers
      .filter((c) => c.name?.toLowerCase().includes(q) || (c.phone || "").includes(q))
      .slice(0, 8);
  }, [customers, customerQuery]);

  useEffect(() => {
    if (!sessionReady || !displayEnabled) return;
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
  }, [cart, subtotal, discount, total, shopName, poleOn, currency, displayEnabled, sessionReady]);

  async function startSession(e?: FormEvent) {
    e?.preventDefault();
    if (!counterName) {
      setSessionError("Select a counter to continue");
      return;
    }
    setSessionBusy(true);
    setSessionError("");
    try {
      const { data } = await api.post("/accounts/sessions", {
        counterName,
        openingBalance: Number(openingBalance) || 0,
      });
      if (!data?.success) throw new Error(data?.message || "Failed to start session");
      const row = data.data as PosSession;
      const s: PosSession = {
        id: row.id,
        counterName: row.counterName || counterName,
        openingBalance: Number(row.openingBalance ?? openingBalance) || 0,
        userId: me?.id,
        openedAt: row.openedAt || new Date().toISOString(),
      };
      setSession(s);
      storeSession(s);
      setSessionReady(true);
    } catch (err) {
      const ax = err as { response?: { data?: { message?: string } }; message?: string };
      setSessionError(ax.response?.data?.message || ax.message || "Failed to start cash session");
    } finally {
      setSessionBusy(false);
    }
  }

  function sellPrice(p: Product) {
    if (priceMode === "wholesale") {
      const c = Number(p.cost || 0);
      if (c > 0 && c < Number(p.price || 0)) return c;
      return Number(p.price || 0);
    }
    return Number(p.price || 0);
  }

  function addToCart(p: Product) {
    const unit = sellPrice(p);
    setCart((prev) => {
      const existing = prev.find((x) => x.id === p.id && x.price === unit);
      if (existing) {
        return prev.map((x) =>
          x.id === p.id && x.price === unit ? { ...x, qty: Math.min(x.qty + 1, p.quantity) } : x
        );
      }
      return [...prev, { ...p, price: unit, qty: 1, discount: 0 }];
    });
    setProductQuery("");
    setShowProductList(false);
    setError("");
  }

  async function submitProductSearch(e?: FormEvent) {
    e?.preventDefault();
    const q = productQuery.trim();
    if (!q) return;
    try {
      const { data } = await api.get(`/pos/products/barcode/${encodeURIComponent(q)}`);
      if (data.success && data.data) {
        addToCart(data.data);
        return;
      }
    } catch {
      /* fall through to list match */
    }
    if (filteredProducts[0]) addToCart(filteredProducts[0]);
    else setError("Product not found");
  }

  function pickCustomer(c: Customer) {
    setCustomerId(c.id);
    setCustomerQuery(c.name);
    setShowCustomerList(false);
  }

  function clearCart() {
    setCart([]);
    setCashPay("");
    setCardPay("");
    setBankPay("");
    setError("");
  }

  function holdBill() {
    if (!cart.length) {
      setError("Cart is empty — nothing to hold");
      return;
    }
    const bill: HeldBill = {
      id: `HB-${Date.now()}`,
      savedAt: new Date().toISOString(),
      cart,
      customerId,
      customerQuery,
      cash: cashN,
      card: cardN,
      bank: bankN,
    };
    const next = [bill, ...heldBills].slice(0, 40);
    setHeldBills(next);
    saveHeld(next);
    clearCart();
    setCustomerId("");
    setCustomerQuery("");
    setMessage(`Bill held (${bill.id})`);
  }

  function restoreHeld(bill: HeldBill) {
    setCart(bill.cart);
    setCustomerId(bill.customerId);
    setCustomerQuery(bill.customerQuery);
    setCashPay(bill.cash || "");
    setCardPay(bill.card || "");
    setBankPay(bill.bank || "");
    const next = heldBills.filter((b) => b.id !== bill.id);
    setHeldBills(next);
    saveHeld(next);
    setHeldOpen(false);
    setMessage(`Restored ${bill.id}`);
  }

  function restoreHeldById(id: string) {
    const bill = heldBills.find((b) => b.id === id);
    if (bill) restoreHeld(bill);
  }

  function deleteHeld(id: string) {
    const next = heldBills.filter((b) => b.id !== id);
    setHeldBills(next);
    saveHeld(next);
  }

  async function registerCustomer(e?: FormEvent) {
    e?.preventDefault();
    if (!registerForm.name.trim() || !registerForm.phone.trim()) {
      setRegisterError("Customer name and contact number are required");
      return;
    }
    setRegisterBusy(true);
    setRegisterError("");
    try {
      const { data } = await api.post("/customers/add", {
        name: registerForm.name.trim(),
        phone: registerForm.phone.trim(),
        email: registerForm.email.trim() || undefined,
      });
      if (!data?.success) throw new Error(data?.message || "Failed to register customer");
      const row = data.data as Customer;
      setCustomers((prev) => [{ id: row.id, name: row.name, phone: row.phone }, ...prev.filter((c) => c.id !== row.id)]);
      pickCustomer(row);
      setRegisterOpen(false);
      setRegisterForm({ name: "", phone: "", email: "" });
      setMessage(`Customer ${row.name} registered`);
    } catch (err) {
      const ax = err as { response?: { data?: { message?: string } }; message?: string };
      setRegisterError(ax.response?.data?.message || ax.message || "Failed to register customer");
    } finally {
      setRegisterBusy(false);
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
    if (paidSum + 0.001 < total) return setError("Paid amount is less than total");
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const { data } = await api.post("/pos/invoice", {
        customerId: customerId || undefined,
        paymentType: primaryPaymentType,
        paidAmount: paidSum || total,
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
      const change = Math.max(0, paidSum - Number(inv.total || total));
      if (displayEnabled) {
        publishCustomerDisplay({
          status: "thankyou",
          shopName,
          items: [],
          subtotal: 0,
          discount: 0,
          total: Number(inv.total || total),
          paid: paidSum,
          change,
        });
      }
      if (poleOn || poleDisplayConnected()) {
        await showPoleThankYou(Number(inv.total || total), currency).catch(() => undefined);
      }
      setMessage(`Invoice ${inv.invoiceNo} created — ${money(inv.total, currency)}`);
      clearCart();
      setCustomerId("");
      setCustomerQuery("");
      if (autoPrint) {
        try {
          await printReceipt(inv);
        } catch (pe) {
          console.warn("Print failed", pe);
        }
      }
      try {
        const printSettings = await loadPrintSettings(true);
        if (shouldOpenCashDrawerOnSale(printSettings, primaryPaymentType)) {
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

  useEffect(() => {
    if (!sessionReady) return;
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (e.key === "F1") {
        e.preventDefault();
        setCashManageOpen(true);
      }
      if (e.key === "F2") {
        e.preventDefault();
        setBulkOpen(true);
      }
      if (e.key === "F3") {
        e.preventDefault();
        setReturnOpen(true);
      }
      if (e.key === "F4" && !e.altKey) {
        e.preventDefault();
        holdBill();
      }
      if (e.key === "F5") {
        e.preventDefault();
        clearCart();
      }
      if (e.key === "F6") {
        e.preventDefault();
        customerInputRef.current?.focus();
        setShowCustomerList(true);
      }
      if (e.key === "F7") {
        e.preventDefault();
        setRegisterError("");
        setRegisterOpen(true);
      }
      if (e.key === "F8") {
        e.preventDefault();
        setHeldOpen(true);
      }
      if (e.key === "F12") {
        e.preventDefault();
        void checkout();
      }
      if (e.altKey && e.key === "1") {
        e.preventDefault();
        cashInputRef.current?.focus();
      }
      if (e.altKey && e.key === "2") {
        e.preventDefault();
        cardInputRef.current?.focus();
      }
      if (e.altKey && e.key === "3") {
        e.preventDefault();
        bankInputRef.current?.focus();
      }
      if (!typing && e.key === "/" ) {
        e.preventDefault();
        productInputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionReady, cart, cashN, cardN, bankN, total, customerId, heldBills]);

  const sessionDateLabel = useMemo(() => {
    return new Date().toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, []);

  if (sessionChecking) {
    return (
      <div className="min-h-[60vh] grid place-items-center text-sm text-gray-500">
        Checking cash session…
      </div>
    );
  }

  if (!sessionReady) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm grid place-items-center p-4">
        <form
          onSubmit={startSession}
          className="w-full max-w-3xl rounded-2xl overflow-hidden bg-white shadow-2xl border border-gray-100"
        >
          <div className="bg-gradient-to-r from-emerald-600 to-teal-500 px-6 py-5 flex items-start gap-4 text-white">
            <div className="h-12 w-12 rounded-full border-2 border-white/40 grid place-items-center shrink-0">
              <Zap size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold">Start Cash Session</h1>
              <p className="text-sm text-emerald-50 mt-0.5">
                {sessionDateLabel} | Cashier Session
              </p>
            </div>
            <button
              type="button"
              className="h-9 w-9 rounded-full bg-white/15 hover:bg-white/25 grid place-items-center"
              onClick={() => navigate("/dashboard")}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <div className="grid md:grid-cols-[1.2fr_0.9fr]">
            <div className="p-6 space-y-5">
              {sessionError && <ErrorBox text={sessionError} />}
              <div>
                <div className="text-sm font-semibold text-gray-800 inline-flex items-center gap-2 mb-3">
                  <Store size={16} className="text-emerald-600" />
                  Select Your Counter
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {COUNTERS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCounterName(c)}
                      className={`rounded-xl border-2 p-4 text-left transition ${
                        counterName === c
                          ? "border-emerald-500 bg-emerald-50"
                          : "border-gray-200 hover:border-emerald-300"
                      }`}
                    >
                      <Monitor size={22} className={counterName === c ? "text-emerald-700" : "text-gray-400"} />
                      <div className="mt-2 font-bold text-gray-900">{c}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-sm font-semibold text-gray-800 inline-flex items-center gap-2 mb-2">
                  <TrendingUp size={16} className="text-emerald-600" />
                  Opening Balance
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-500">
                    Rs
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="input pl-10 text-lg font-semibold"
                    value={openingBalance}
                    onChange={(e) => setOpeningBalance(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={!counterName || sessionBusy}
                className="w-full h-12 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-200 disabled:text-gray-500 inline-flex items-center justify-center gap-2"
              >
                {sessionBusy ? "Starting…" : "Start POS Terminal"}
                <ArrowRight size={18} />
              </button>
            </div>

            <div className="bg-slate-50 border-l border-gray-100 p-5 space-y-3">
              <div className="rounded-xl bg-white border border-emerald-100 p-4 flex gap-3">
                <CheckCircle2 className="text-emerald-600 shrink-0" size={22} />
                <div>
                  <div className="text-sm font-bold text-gray-900">Session Tracking</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Active &amp; Secure. Cash sessions are securely tracked and monitored throughout the day.
                  </div>
                </div>
              </div>
              <div className="rounded-xl bg-white border border-sky-100 p-4 flex gap-3">
                <DollarSign className="text-sky-600 shrink-0" size={22} />
                <div>
                  <div className="text-sm font-bold text-gray-900">Balance Management</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Real-time Updates. Track cash, card, and bank transactions with real-time updates.
                  </div>
                </div>
              </div>
              <div className="rounded-xl bg-white border border-violet-100 p-4 flex gap-3">
                <Store className="text-violet-600 shrink-0" size={22} />
                <div>
                  <div className="text-sm font-bold text-gray-900">Counter Assignment</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Designated Terminal. Assigned counter ensures accurate transaction processing.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-3 -mt-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-gray-900">POS Terminal — FAST BILLING SYSTEM</h1>
          <div className="text-xs text-gray-500">
            {session?.counterName} · Opening {money(session?.openingBalance || 0, currency)}
          </div>
        </div>
        <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-full px-3 py-1.5">
          <span className={priceMode === "retail" ? "text-emerald-700" : ""}>Retail</span>
          <button
            type="button"
            role="switch"
            aria-checked={priceMode === "wholesale"}
            className={`relative h-5 w-9 rounded-full transition ${
              priceMode === "wholesale" ? "bg-violet-500" : "bg-emerald-500"
            }`}
            onClick={() => setPriceMode((m) => (m === "retail" ? "wholesale" : "retail"))}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${
                priceMode === "wholesale" ? "left-4" : "left-0.5"
              }`}
            />
          </button>
          <span className={priceMode === "wholesale" ? "text-violet-700" : ""}>Wholesale</span>
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="h-9 px-3 rounded-lg bg-slate-600 text-white text-xs font-bold inline-flex items-center gap-1.5" onClick={holdBill}>
          <Pause size={14} /> Hold Bill F4
        </button>
        <button type="button" className="h-9 px-3 rounded-lg bg-pink-500 text-white text-xs font-bold inline-flex items-center gap-1.5" onClick={() => setHeldOpen(true)}>
          <ListOrdered size={14} /> Held Bills F8 {heldBills.length ? `(${heldBills.length})` : ""}
        </button>
        <button type="button" className="h-9 px-3 rounded-lg bg-teal-600 text-white text-xs font-bold inline-flex items-center gap-1.5" onClick={() => setCashManageOpen(true)}>
          <Wallet size={14} /> Cash Manage F1
        </button>
        <button type="button" className="h-9 px-3 rounded-lg bg-sky-600 text-white text-xs font-bold inline-flex items-center gap-1.5" onClick={() => setBulkOpen(true)}>
          <Package size={14} /> Bulk Loose F2
        </button>
        <button type="button" className="h-9 px-3 rounded-lg bg-orange-500 text-white text-xs font-bold inline-flex items-center gap-1.5" onClick={() => setReturnOpen(true)}>
          <RotateCcw size={14} /> Return F3
        </button>
      </div>

      {error && <ErrorBox text={error} />}
      {message && (
        <div className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">{message}</div>
      )}

      <div className="grid xl:grid-cols-[1fr_340px] gap-4">
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/80 border border-emerald-100 p-3">
              <div className="text-[10px] font-bold tracking-wide text-emerald-700">ITEMS</div>
              <div className="text-xl font-bold text-emerald-900 mt-1">{cart.reduce((s, i) => s + i.qty, 0)}</div>
            </div>
            <div className="rounded-xl bg-gradient-to-br from-sky-50 to-sky-100/80 border border-sky-100 p-3">
              <div className="text-[10px] font-bold tracking-wide text-sky-700">SUBTOTAL</div>
              <div className="text-lg font-bold text-sky-900 mt-1">{money(subtotal, currency)}</div>
            </div>
            <div className="rounded-xl bg-gradient-to-br from-orange-50 to-orange-100/80 border border-orange-100 p-3">
              <div className="text-[10px] font-bold tracking-wide text-orange-700">DISCOUNT</div>
              <div className="text-lg font-bold text-orange-900 mt-1">{discountPct.toFixed(0)}%</div>
            </div>
            <div className="rounded-xl bg-gradient-to-br from-violet-50 to-violet-100/80 border border-violet-100 p-3">
              <div className="text-[10px] font-bold tracking-wide text-violet-700">TOTAL</div>
              <div className="text-lg font-bold text-violet-900 mt-1">{money(total, currency)}</div>
            </div>
          </div>

          <form onSubmit={submitProductSearch} className="relative">
            <Search size={16} className="input-icon" />
            <input
              ref={productInputRef}
              className="input has-icon h-12 text-sm"
              placeholder="Search product, code or scan barcode… (Enter)"
              value={productQuery}
              onChange={(e) => {
                setProductQuery(e.target.value);
                setShowProductList(true);
              }}
              onFocus={() => setShowProductList(true)}
              autoFocus
            />
            {showProductList && (productQuery || filteredProducts.length > 0) && (
              <div className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-auto">
                {filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-emerald-50 border-b border-gray-50 last:border-0"
                    onClick={() => addToCart(p)}
                  >
                    <div className="font-medium text-gray-900">{p.displayName}</div>
                    <div className="text-xs text-gray-500 flex justify-between gap-2">
                      <span>{p.barcode || p.code || p.id}</span>
                      <span>
                        {money(p.price, currency)} · Qty {p.quantity}
                      </span>
                    </div>
                  </button>
                ))}
                {!filteredProducts.length && <div className="px-3 py-3 text-sm text-gray-400">No products</div>}
              </div>
            )}
          </form>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden min-h-[360px] flex flex-col">
            <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between gap-2">
              <div className="text-[11px] text-gray-500">Navigate · Del Remove · F5 Clear</div>
              <button type="button" className="text-xs font-bold text-red-600 hover:underline" onClick={clearCart}>
                Clear F5
              </button>
            </div>
            <div className="flex-1 overflow-auto">
              {cart.length ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-emerald-700 text-white text-left">
                      <th className="px-3 py-2 font-semibold">Item</th>
                      <th className="px-3 py-2 font-semibold">Price</th>
                      <th className="px-3 py-2 font-semibold">Qty</th>
                      <th className="px-3 py-2 font-semibold">Net</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((item) => (
                      <tr key={item.id} className="border-b border-gray-100">
                        <td className="px-3 py-2.5 font-medium">{item.displayName}</td>
                        <td className="px-3 py-2.5">{money(item.price, currency)}</td>
                        <td className="px-3 py-2.5">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              className="h-7 w-7 rounded border border-gray-200"
                              onClick={() =>
                                setCart((prev) =>
                                  prev.map((x) => (x.id === item.id ? { ...x, qty: Math.max(1, x.qty - 1) } : x))
                                )
                              }
                            >
                              −
                            </button>
                            <span className="w-8 text-center font-semibold">{item.qty}</span>
                            <button
                              type="button"
                              className="h-7 w-7 rounded border border-gray-200"
                              onClick={() =>
                                setCart((prev) =>
                                  prev.map((x) =>
                                    x.id === item.id ? { ...x, qty: Math.min(item.quantity, x.qty + 1) } : x
                                  )
                                )
                              }
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-emerald-700">
                          {money(item.price * item.qty - item.discount, currency)}
                        </td>
                        <td className="px-3 py-2.5">
                          <button
                            type="button"
                            className="text-gray-400 hover:text-red-600"
                            onClick={() => setCart((prev) => prev.filter((x) => x.id !== item.id))}
                          >
                            <X size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="h-full min-h-[280px] grid place-items-center p-8 text-center">
                  <div>
                    <div className="mx-auto w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 grid place-items-center mb-3">
                      <ShoppingCart size={26} />
                    </div>
                    <div className="font-semibold text-gray-700">Your cart is empty</div>
                    <div className="text-sm text-gray-500 mt-1">Add products to get started.</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-bold tracking-wide text-gray-700">CUSTOMER</div>
              <button
                type="button"
                className="text-xs font-bold text-emerald-700 inline-flex items-center gap-1 hover:underline"
                onClick={() => {
                  setRegisterError("");
                  setRegisterOpen(true);
                }}
              >
                <Plus size={12} /> Register (F7)
              </button>
            </div>
            <div className="relative">
              <Search size={14} className="input-icon" />
              <input
                ref={customerInputRef}
                className="input has-icon"
                placeholder="Search customer… (F6)"
                value={customerQuery}
                onChange={(e) => {
                  setCustomerQuery(e.target.value);
                  setShowCustomerList(true);
                  if (!e.target.value) setCustomerId("");
                }}
                onFocus={() => setShowCustomerList(true)}
              />
              {showCustomerList && (
                <div className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-44 overflow-auto">
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-gray-500"
                    onClick={() => {
                      setCustomerId("");
                      setCustomerQuery("");
                      setShowCustomerList(false);
                    }}
                  >
                    Walk-in customer
                  </button>
                  {filteredCustomers.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-emerald-50"
                      onClick={() => pickCustomer(c)}
                    >
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-gray-500">{c.phone || "No phone"}</div>
                    </button>
                  ))}
                  {!filteredCustomers.length && (
                    <div className="px-3 py-2 text-sm text-gray-400">No customers</div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="text-xs font-bold tracking-wide text-gray-700">PAYMENT METHODS</div>
            <div>
              <label className="text-[11px] font-semibold text-gray-500">Cash (Alt+1)</label>
              <input
                ref={cashInputRef}
                type="number"
                min={0}
                step="0.01"
                className="input mt-1"
                placeholder="Enter amount"
                value={cashPay}
                onChange={(e) => setCashPay(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-500">Card (Alt+2)</label>
              <input
                ref={cardInputRef}
                type="number"
                min={0}
                step="0.01"
                className="input mt-1"
                placeholder="Enter amount"
                value={cardPay}
                onChange={(e) => setCardPay(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-500">Bank Deposit (Alt+3)</label>
              <input
                ref={bankInputRef}
                type="number"
                min={0}
                step="0.01"
                className="input mt-1"
                placeholder="Enter amount"
                value={bankPay}
                onChange={(e) => setBankPay(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </div>
            <button
              type="button"
              className="text-xs font-semibold text-emerald-700 hover:underline"
              onClick={() => setCashPay(total)}
            >
              Fill cash = total
            </button>
          </div>

          <div className="rounded-xl bg-emerald-800 text-white p-4 space-y-2">
            <div className="flex justify-between text-sm text-emerald-100">
              <span>Paid Amount</span>
              <span>{money(paidSum, currency)}</span>
            </div>
            <div className="flex justify-between text-sm text-emerald-100">
              <span>Balance</span>
              <span className={balance < 0 ? "text-amber-200" : ""}>{money(balance, currency)}</span>
            </div>
            <div className="flex justify-between items-end pt-1 border-t border-emerald-700">
              <span className="text-xs font-bold tracking-wide text-emerald-200">TOTAL</span>
              <span className="text-2xl font-bold">{money(total, currency)}</span>
            </div>
          </div>

          <button
            type="button"
            disabled={loading || !cart.length}
            onClick={() => void checkout()}
            className="w-full h-12 rounded-xl font-bold text-white bg-slate-700 hover:bg-slate-800 disabled:bg-gray-200 disabled:text-gray-500"
          >
            {loading ? "Processing…" : "COMPLETE PAYMENT (F12)"}
          </button>
          <div className="text-[10px] text-center text-gray-400">
            F6 Search · F7 Register · Alt+1/2/3 Payment · F12 Complete
          </div>

          <label className="flex items-center gap-2 text-xs text-gray-600">
            <input type="checkbox" checked={autoPrint} onChange={(e) => setAutoPrint(e.target.checked)} />
            Auto print receipt
          </label>
          {poleDisplaySupported() && (
            <button type="button" className={`btn ${poleOn ? "btn-primary" : "btn-muted"} w-full text-xs`} onClick={togglePole}>
              {poleOn ? "Disconnect pole display" : "Connect CD-7220 pole display"}
            </button>
          )}
          <button
            type="button"
            className="btn btn-muted w-full text-xs"
            onClick={() => {
              void openCashDrawer({ force: true }).then((r) => {
                if (r.ok) setMessage(r.message);
                else setError(r.message);
              });
            }}
          >
            Open cash drawer
          </button>
        </div>
      </div>

      {registerOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={() => !registerBusy && setRegisterOpen(false)}>
          <form
            onSubmit={registerCustomer}
            className="bg-white rounded-xl w-full max-w-md shadow-xl border border-gray-100 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Register Customer</h2>
              <button type="button" className="h-8 w-8 rounded-lg text-gray-400 hover:bg-gray-100 grid place-items-center" onClick={() => !registerBusy && setRegisterOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {registerError && <ErrorBox text={registerError} />}
              <div>
                <label className="text-xs font-semibold text-gray-700">
                  Customer Name <span className="text-red-500">*</span>
                </label>
                <input
                  className="input mt-1"
                  placeholder="Enter customer name"
                  value={registerForm.name}
                  onChange={(e) => setRegisterForm((f) => ({ ...f, name: e.target.value }))}
                  autoFocus
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700">
                  Contact Number <span className="text-red-500">*</span>
                </label>
                <div className="relative mt-1">
                  <Phone size={14} className="input-icon" />
                  <input
                    className="input has-icon"
                    placeholder="Enter contact number"
                    value={registerForm.phone}
                    onChange={(e) => setRegisterForm((f) => ({ ...f, phone: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700">Email Address</label>
                <div className="relative mt-1">
                  <Mail size={14} className="input-icon" />
                  <input
                    type="email"
                    className="input has-icon"
                    placeholder="Enter email (optional)"
                    value={registerForm.email}
                    onChange={(e) => setRegisterForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
              <button type="button" className="h-10 px-4 rounded-lg border border-gray-200 font-semibold" disabled={registerBusy} onClick={() => setRegisterOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary h-10 px-5 inline-flex items-center gap-1.5" disabled={registerBusy}>
                <UserPlus size={16} />
                {registerBusy ? "Registering..." : "Register"}
              </button>
            </div>
          </form>
        </div>
      )}

      <HeldBillsDrawer
        open={heldOpen}
        onClose={() => setHeldOpen(false)}
        bills={heldBills}
        currency={currency}
        onRestore={restoreHeldById}
        onDelete={deleteHeld}
      />

      <CashManageModal
        open={cashManageOpen}
        onClose={() => setCashManageOpen(false)}
        session={session}
        currency={currency}
        onMessage={setMessage}
      />

      <BulkConvertModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        products={products}
        onDone={(msg) => {
          setMessage(msg);
          api.get("/stock/all-variations", { params: { hasStock: true, limit: 200, location: "shop" } }).then((r) => {
            setProducts(r.data.data || []);
          });
        }}
      />

      <ReturnRefundModal
        open={returnOpen}
        onClose={() => setReturnOpen(false)}
        currency={currency}
        onDone={(msg) => {
          setMessage(msg);
          api.get("/stock/all-variations", { params: { hasStock: true, limit: 200, location: "shop" } }).then((r) => {
            setProducts(r.data.data || []);
          });
        }}
      />
    </div>
  );
}
