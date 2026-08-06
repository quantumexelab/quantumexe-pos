import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cloud,
  KeyRound,
  LogOut,
  RefreshCw,
  ShieldOff,
  Wallet,
} from "lucide-react";
import api, { auth } from "../api";
import { BrandLogo } from "../components/BrandLogo";
import { ErrorBox } from "../components/ui";
import { buildFirebaseConnectPayload, parseServiceAccountPaste } from "../lib/serviceAccount";
import { SHOP_TYPE_LABELS, SHOP_TYPE_OPTIONS } from "../shopFeatures";

type Shop = {
  shopId: string;
  shopName: string;
  ownerName: string;
  phone: string;
  email: string;
  address?: string;
  city?: string;
  nic?: string;
  businessRegNo?: string;
  status: string;
  paymentNote?: string;
  lastPaidAt?: string | null;
  nextDueAt?: string | null;
  approvedAt?: string | null;
  createdAt: string;
  firebaseProjectId?: string;
  firebaseClientEmail?: string;
  firebaseConfigured?: boolean;
  firebaseProvisionedAt?: string | null;
  shopType?: string;
  fingerprintAttendance?: boolean;
  cloudRetentionMonths?: number;
  billingPlan?: string | null;
  billingInterval?: string | null;
  payhereSubscriptionId?: string | null;
  payherePaymentId?: string | null;
  lastBillingAmount?: number | null;
  billingDiscountPercent?: number | null;
  billingCreditBalance?: number | null;
};

type PanelTab = "firebase" | "access" | "security";
type TypeModalMode = "approve" | "renew" | "change" | null;

function formatWhen(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function statusClass(status: string) {
  if (status === "active") return "bg-emerald-100 text-emerald-800";
  if (status === "pending") return "bg-amber-100 text-amber-900";
  return "bg-rose-100 text-rose-800";
}

export default function MasterAdmin() {
  const navigate = useNavigate();
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [selected, setSelected] = useState<Shop | null>(null);
  const [filter, setFilter] = useState("");
  const [tab, setTab] = useState<PanelTab>("firebase");
  const [showGuide, setShowGuide] = useState(false);
  const [pwdForm, setPwdForm] = useState({ currentPassword: "", newPassword: "" });
  const [resetPwd, setResetPwd] = useState("");
  const [busy, setBusy] = useState(false);
  const [fbForm, setFbForm] = useState({
    firebaseProjectId: "",
    firebaseClientEmail: "",
    firebasePrivateKey: "",
  });
  const [typeModal, setTypeModal] = useState<TypeModalMode>(null);
  const [pickType, setPickType] = useState("clothing");
  const [billingForm, setBillingForm] = useState({ discountPercent: "0", creditBalance: "0" });

  async function load() {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/master/shops");
      const list: Shop[] = data?.data || [];
      setShops(list);
      if (selected) {
        const updated = list.find((s) => s.shopId === selected.shopId) || null;
        setSelected(updated);
        if (updated) {
          setFbForm({
            firebaseProjectId: updated.firebaseProjectId || "",
            firebaseClientEmail: updated.firebaseClientEmail || "",
            firebasePrivateKey: "",
          });
          setBillingForm({
            discountPercent: String(updated.billingDiscountPercent ?? 0),
            creditBalance: String(updated.billingCreditBalance ?? 0),
          });
        }
      }
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string } }; message?: string };
      setError(ax.response?.data?.message || ax.message || "Failed to load shops");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const u = auth.getUser() as { role?: string } | null;
    if (!auth.isAuthenticated() || u?.role !== "MasterAdmin") {
      navigate("/signin", { replace: true });
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return shops;
    return shops.filter(
      (s) =>
        s.shopName.toLowerCase().includes(q) ||
        s.ownerName.toLowerCase().includes(q) ||
        s.phone.includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.status.toLowerCase().includes(q)
    );
  }, [shops, filter]);

  const stats = useMemo(
    () => ({
      total: shops.length,
      pending: shops.filter((s) => s.status === "pending").length,
      active: shops.filter((s) => s.status === "active").length,
      blocked: shops.filter((s) => s.status === "revoked" || s.status === "overdue").length,
    }),
    [shops]
  );

  async function act(path: string, body?: object, successMsg?: string, method: "post" | "delete" = "post") {
    setBusy(true);
    setError("");
    setMsg("");
    try {
      const { data } =
        method === "delete" ? await api.delete(path) : await api.post(path, body || {});
      if (!data.success) throw new Error(data.message || "Action failed");
      setMsg(successMsg || data.message || "Done");
      await load();
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string } }; message?: string };
      setError(ax.response?.data?.message || ax.message || "Action failed");
    } finally {
      setBusy(false);
    }
  }

  function selectShop(s: Shop) {
    setSelected(s);
    setTab(s.firebaseConfigured ? "access" : "firebase");
    setPickType(s.shopType || "clothing");
    setFbForm({
      firebaseProjectId: s.firebaseProjectId || "",
      firebaseClientEmail: s.firebaseClientEmail || "",
      firebasePrivateKey: "",
    });
    setBillingForm({
      discountPercent: String(s.billingDiscountPercent ?? 0),
      creditBalance: String(s.billingCreditBalance ?? 0),
    });
  }

  function openTypeModal(mode: TypeModalMode) {
    if (!selected) return;
    setPickType(selected.shopType || "clothing");
    setTypeModal(mode);
  }

  async function confirmTypeModal() {
    if (!selected || !typeModal) return;
    const mode = typeModal;
    setTypeModal(null);
    if (mode === "approve") {
      await act(
        `/master/shops/${selected.shopId}/approve`,
        {
          paymentNote: "Payment confirmed by Master Admin",
          shopType: pickType,
        },
        `Approved as ${SHOP_TYPE_LABELS[pickType] || pickType}`
      );
    } else if (mode === "renew") {
      await act(
        `/master/shops/${selected.shopId}/mark-paid`,
        {
          paymentNote: "Monthly payment renewed",
          shopType: selected.shopType || pickType,
        },
        "Payment renewed (+30 days)"
      );
    } else if (mode === "change") {
      await act(
        `/master/shops/${selected.shopId}/shop-type`,
        { shopType: pickType },
        `Shop type → ${SHOP_TYPE_LABELS[pickType] || pickType}`
      );
    }
  }

  async function changeMasterPassword(e: FormEvent) {
    e.preventDefault();
    await act("/master/password", pwdForm, "Master password updated");
    setPwdForm({ currentPassword: "", newPassword: "" });
  }

  const step1Done = !!selected;
  const step2Done = !!selected?.firebaseConfigured;
  const step3Done = selected?.status === "active";

  return (
    <div className="h-[100dvh] overflow-y-auto overscroll-contain bg-[#eef1f4]">
      <header className="bg-slate-950 text-white sticky top-0 z-10 safe-pt">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <BrandLogo variant="dark" size="sm" showTagline />
            <div className="hidden sm:block border-l border-white/15 pl-4">
              <div className="text-[10px] font-bold tracking-[0.18em] text-emerald-300">MASTER CONTROL</div>
              <div className="text-sm font-semibold">Shop registry & payments</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="h-9 px-3 rounded-lg bg-white/10 text-sm font-semibold inline-flex items-center gap-1.5 hover:bg-white/15"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
            <button
              type="button"
              className="h-9 px-3 rounded-lg bg-white/10 text-sm font-semibold inline-flex items-center gap-1.5 hover:bg-white/15"
              onClick={() => {
                auth.logout();
                navigate("/signin", { replace: true });
              }}
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-5 space-y-4 safe-pb">
        {error && <ErrorBox text={error} />}
        {msg && (
          <div className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            {msg}
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            ["Total", stats.total, "border-slate-200 bg-white"],
            ["Pending", stats.pending, "border-amber-200 bg-amber-50"],
            ["Active", stats.active, "border-emerald-200 bg-emerald-50"],
            ["Blocked", stats.blocked, "border-rose-200 bg-rose-50"],
          ].map(([label, value, cls]) => (
            <div key={label as string} className={`rounded-xl border ${cls} px-4 py-3`}>
              <div className="text-2xl font-bold text-slate-900 tabular-nums">{value as number}</div>
              <div className="text-xs font-semibold text-slate-600 mt-0.5">{label as string}</div>
            </div>
          ))}
        </div>

        {/* Workflow strip */}
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">
            Onboard order
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-0">
            {[
              { n: 1, label: "Select shop", done: step1Done },
              { n: 2, label: "Connect Firebase", done: step2Done },
              { n: 3, label: "Approve payment", done: step3Done },
            ].map((s, i) => (
              <div key={s.n} className="flex items-center gap-2 flex-1 min-w-0">
                <div
                  className={`h-7 w-7 rounded-full grid place-items-center text-xs font-bold shrink-0 ${
                    s.done ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {s.done ? <CheckCircle2 size={14} /> : s.n}
                </div>
                <div className={`text-sm font-semibold truncate ${s.done ? "text-emerald-800" : "text-slate-700"}`}>
                  {s.label}
                </div>
                {i < 2 && (
                  <div className="hidden sm:block flex-1 h-px bg-slate-200 mx-3" aria-hidden />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,380px)_1fr] gap-4 items-start">
          {/* Shop list */}
          <aside className="bg-white border border-slate-200 rounded-2xl overflow-hidden lg:sticky lg:top-[4.5rem]">
            <div className="px-4 py-3 border-b border-slate-100 space-y-2">
              <div className="text-sm font-bold text-slate-900">1 · Shops</div>
              <input
                className="input w-full text-sm"
                placeholder="Search shop, owner, phone…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
            <div className="max-h-[min(70vh,640px)] overflow-y-auto divide-y divide-slate-100">
              {filtered.map((s) => {
                const active = selected?.shopId === s.shopId;
                return (
                  <button
                    key={s.shopId}
                    type="button"
                    onClick={() => selectShop(s)}
                    className={`w-full text-left px-4 py-3 transition-colors ${
                      active ? "bg-emerald-50 border-l-4 border-l-emerald-600" : "hover:bg-slate-50 border-l-4 border-l-transparent"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate">{s.shopName}</div>
                        <div className="text-xs text-slate-500 truncate mt-0.5">
                          {s.ownerName} · {s.phone}
                        </div>
                      </div>
                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusClass(s.status)}`}>
                        {s.status}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-[11px]">
                      <span
                        className={`inline-flex items-center gap-1 font-semibold ${
                          s.firebaseConfigured ? "text-sky-700" : "text-slate-400"
                        }`}
                      >
                        <Cloud size={12} />
                        {s.firebaseConfigured ? "Firebase OK" : "No Firebase"}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="text-slate-500">Due {formatWhen(s.nextDueAt)}</span>
                      {(s.billingPlan || s.billingInterval) && (
                        <>
                          <span className="text-slate-300">·</span>
                          <span className="text-emerald-700 font-semibold capitalize">
                            {s.billingPlan || s.billingInterval}
                          </span>
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
              {!filtered.length && (
                <div className="px-4 py-10 text-center text-sm text-slate-400">
                  {loading ? "Loading…" : "No shops yet"}
                </div>
              )}
            </div>
          </aside>

          {/* Workspace */}
          <section className="space-y-4 min-w-0">
            {!selected ? (
              <div className="bg-white border border-dashed border-slate-300 rounded-2xl px-6 py-16 text-center">
                <Building2 className="mx-auto text-slate-300 mb-3" size={36} />
                <div className="text-base font-bold text-slate-800">Select a shop from the left</div>
                <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                  Then connect that shop&apos;s Firebase project and approve payment — in that order.
                </p>
              </div>
            ) : (
              <>
                <div className="bg-white border border-slate-200 rounded-2xl p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Selected shop</div>
                      <h2 className="text-xl font-bold text-slate-900 mt-0.5">{selected.shopName}</h2>
                      <p className="text-sm text-slate-600 mt-1">
                        {selected.ownerName} · {selected.phone} · {selected.email}
                      </p>
                      {selected.shopType ? (
                        <p className="text-xs font-semibold text-sky-800 mt-1">
                          Type: {SHOP_TYPE_LABELS[selected.shopType] || selected.shopType}
                        </p>
                      ) : (
                        <p className="text-xs text-amber-700 mt-1">Shop type not set yet — pick on approve</p>
                      )}
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${statusClass(selected.status)}`}>
                      {selected.status}
                    </span>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-xs">
                    {[
                      ["City", selected.city || "—"],
                      ["NIC", selected.nic || "—"],
                      ["Biz reg", selected.businessRegNo || "—"],
                      ["Cloud ID", selected.shopId],
                      ["Registered", formatWhen(selected.createdAt)],
                      ["Last paid", formatWhen(selected.lastPaidAt)],
                      ["Next due", formatWhen(selected.nextDueAt)],
                      ["Address", selected.address || "—"],
                      [
                        "Billing plan",
                        selected.billingPlan || selected.billingInterval
                          ? String(selected.billingPlan || selected.billingInterval)
                          : "—",
                      ],
                      [
                        "Last PayHere",
                        selected.payherePaymentId
                          ? `${selected.payherePaymentId}${
                              selected.lastBillingAmount != null
                                ? ` · Rs. ${Number(selected.lastBillingAmount).toLocaleString()}`
                                : ""
                            }`
                          : "—",
                      ],
                      ["Discount", `${Number(selected.billingDiscountPercent) || 0}%`],
                      [
                        "Credit balance",
                        `Rs. ${Number(selected.billingCreditBalance || 0).toLocaleString()}`,
                      ],
                      ["Subscription ID", selected.payhereSubscriptionId || "—"],
                      ["Payment note", selected.paymentNote || "—"],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-slate-400 font-semibold">{k}</dt>
                        <dd className="text-slate-800 font-medium break-all">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="flex border-b border-slate-100">
                    {(
                      [
                        ["firebase", "2 · Firebase", Cloud],
                        ["access", "3 · Payment", Wallet],
                        ["security", "Security", KeyRound],
                      ] as const
                    ).map(([id, label, Icon]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setTab(id)}
                        className={`flex-1 px-3 py-3 text-sm font-semibold inline-flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
                          tab === id
                            ? "border-emerald-600 text-emerald-800 bg-emerald-50/50"
                            : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                        }`}
                      >
                        <Icon size={15} />
                        <span className="hidden sm:inline">{label}</span>
                        <span className="sm:hidden">{id === "firebase" ? "Firebase" : id === "access" ? "Pay" : "Sec"}</span>
                      </button>
                    ))}
                  </div>

                  <div className="p-4 sm:p-5">
                    {tab === "firebase" && (
                      <div className="space-y-4 max-w-xl">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="text-sm font-bold text-slate-900">Connect shop database</div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              One Firebase project = this shop&apos;s POS data only.
                            </p>
                          </div>
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                              selected.firebaseConfigured
                                ? "bg-sky-100 text-sky-800"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {selected.firebaseConfigured ? "Connected" : "Not connected"}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setShowGuide((v) => !v)}
                          className="w-full flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          How to create the Firebase project
                          {showGuide ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                        {showGuide && (
                          <ol className="list-decimal pl-5 space-y-1.5 text-xs text-slate-600 leading-relaxed bg-slate-50 border border-slate-100 rounded-lg p-3">
                            <li>
                              Open{" "}
                              <a
                                className="text-sky-700 font-semibold underline"
                                href="https://console.firebase.google.com/"
                                target="_blank"
                                rel="noreferrer"
                              >
                                Firebase Console
                              </a>{" "}
                              → Add project
                            </li>
                            <li>Build → Firestore Database → Create database</li>
                            <li>Project settings → Service accounts → Generate new private key (JSON)</li>
                            <li>
                              Easiest: paste the <strong>entire</strong> downloaded JSON into “Private key or full JSON”
                              (Project ID + email fill automatically)
                            </li>
                            <li>Or paste Project ID, client email, and only the private_key block</li>
                            <li>Save &amp; provision → then open Payment tab and Approve</li>
                          </ol>
                        )}

                        <div className="space-y-2">
                          <label className="text-[11px] font-bold uppercase text-slate-500">Project ID</label>
                          <input
                            className="input w-full text-sm"
                            placeholder="my-shop-pos"
                            value={fbForm.firebaseProjectId}
                            onChange={(e) => setFbForm((p) => ({ ...p, firebaseProjectId: e.target.value }))}
                          />
                          <label className="text-[11px] font-bold uppercase text-slate-500">Client email</label>
                          <input
                            className="input w-full text-sm"
                            placeholder="firebase-adminsdk-…@….iam.gserviceaccount.com"
                            value={fbForm.firebaseClientEmail}
                            onChange={(e) => setFbForm((p) => ({ ...p, firebaseClientEmail: e.target.value }))}
                          />
                          <label className="text-[11px] font-bold uppercase text-slate-500">
                            Private key or full JSON
                          </label>
                          <textarea
                            className="input w-full text-xs min-h-[120px] font-mono"
                            placeholder='Paste entire JSON file here, e.g. {"type":"service_account","project_id":"…",…}'
                            value={fbForm.firebasePrivateKey}
                            onChange={(e) => {
                              const v = e.target.value;
                              setFbForm((p) => {
                                const next = { ...p, firebasePrivateKey: v };
                                const trimmed = v.trim();
                                if (trimmed.length > 40 && (trimmed.startsWith("{") || trimmed.includes('"private_key"'))) {
                                  try {
                                    const sa = parseServiceAccountPaste(trimmed);
                                    next.firebaseProjectId = sa.projectId;
                                    next.firebaseClientEmail = sa.clientEmail;
                                  } catch {
                                    /* still typing */
                                  }
                                }
                                return next;
                              });
                            }}
                          />
                          <p className="text-[11px] text-slate-500">
                            Tip: open <code className="text-[10px]">diva-…-firebase-adminsdk-….json</code> in Notepad →
                            Ctrl+A → Ctrl+C → paste here (whole file). Project ID &amp; email fill automatically.
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2 pt-1">
                          <button
                            type="button"
                            disabled={busy || !fbForm.firebasePrivateKey.trim()}
                            className="btn btn-primary"
                            onClick={() => {
                              try {
                                const payload = buildFirebaseConnectPayload(fbForm);
                                setFbForm({
                                  firebaseProjectId: payload.firebaseProjectId,
                                  firebaseClientEmail: payload.firebaseClientEmail,
                                  firebasePrivateKey: payload.firebasePrivateKey,
                                });
                                void act(
                                  `/master/shops/${selected.shopId}/firebase`,
                                  payload,
                                  "Firebase connected — shop database ready"
                                ).then(() => setTab("access"));
                              } catch (e) {
                                setError(e instanceof Error ? e.message : "Invalid service account JSON");
                              }
                            }}
                          >
                            <Cloud size={16} /> Save &amp; provision DB
                          </button>
                          {selected.firebaseConfigured ? (
                            <>
                              <button
                                type="button"
                                disabled={busy}
                                className="btn btn-muted"
                                onClick={() =>
                                  void act(
                                    `/master/shops/${selected.shopId}/reprovision`,
                                    {},
                                    "Roles & lookups re-seeded (Storekeeper added)"
                                  )
                                }
                              >
                                Re-seed roles
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                className="btn btn-muted"
                                onClick={() =>
                                  void act(
                                    `/master/shops/${selected.shopId}/firebase`,
                                    undefined,
                                    "Firebase disconnected",
                                    "delete"
                                  )
                                }
                              >
                                Disconnect
                              </button>
                            </>
                          ) : null}
                        </div>
                        {selected.firebaseProvisionedAt ? (
                          <p className="text-[11px] text-slate-500">
                            Last provisioned {formatWhen(selected.firebaseProvisionedAt)}
                          </p>
                        ) : null}
                      </div>
                    )}

                    {tab === "access" && (
                      <div className="space-y-4 max-w-xl">
                        <div>
                          <div className="text-sm font-bold text-slate-900">Payment & access</div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            On approve you must choose the shop type — POS features & starter catalog are applied
                            automatically.
                          </p>
                        </div>
                        {!selected.firebaseConfigured && (
                          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                            Firebase not connected yet. Open the <strong>Firebase</strong> tab first.
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            className="btn btn-primary"
                            onClick={() => openTypeModal("approve")}
                          >
                            <CheckCircle2 size={16} /> Confirm payment &amp; approve
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            className="btn btn-muted"
                            onClick={() => {
                              if (selected.shopType) {
                                void act(
                                  `/master/shops/${selected.shopId}/mark-paid`,
                                  {
                                    paymentNote: "Monthly payment renewed",
                                    shopType: selected.shopType,
                                  },
                                  "Payment renewed (+30 days)"
                                );
                              } else {
                                openTypeModal("renew");
                              }
                            }}
                          >
                            <Wallet size={16} /> Mark paid / renew
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            className="btn btn-muted"
                            onClick={() => openTypeModal("change")}
                          >
                            Change shop type
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            className="h-9 px-3 rounded-lg bg-rose-600 text-white text-sm font-semibold inline-flex items-center gap-1.5 hover:bg-rose-700"
                            onClick={() =>
                              void act(`/master/shops/${selected.shopId}/revoke`, {}, "Shop access revoked")
                            }
                          >
                            <ShieldOff size={16} /> Revoke
                          </button>
                        </div>

                        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-3">
                          <div>
                            <div className="text-sm font-bold text-slate-900">Subscription discount &amp; credit</div>
                            <p className="text-xs text-slate-600 mt-0.5">
                              Per-shop terms for PayHere. Discount % off list price, then prepaid credit (LKR) is
                              applied. If payable becomes Rs. 0, shop renews without PayHere.
                            </p>
                          </div>
                          <div className="grid sm:grid-cols-2 gap-3">
                            <label className="block text-xs font-semibold text-slate-700">
                              Discount %
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step={0.01}
                                className="mt-1 w-full h-9 px-3 rounded-lg border border-slate-200 text-sm"
                                value={billingForm.discountPercent}
                                onChange={(e) =>
                                  setBillingForm((f) => ({ ...f, discountPercent: e.target.value }))
                                }
                              />
                            </label>
                            <label className="block text-xs font-semibold text-slate-700">
                              Credit balance (LKR)
                              <input
                                type="number"
                                min={0}
                                step={0.01}
                                className="mt-1 w-full h-9 px-3 rounded-lg border border-slate-200 text-sm"
                                value={billingForm.creditBalance}
                                onChange={(e) =>
                                  setBillingForm((f) => ({ ...f, creditBalance: e.target.value }))
                                }
                              />
                            </label>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            Example: Monthly Rs. 2,000 · 10% off → Rs. 1,800 · credit Rs. 500 → PayHere Rs. 1,300.
                          </p>
                          <button
                            type="button"
                            disabled={busy}
                            className="btn btn-primary h-9"
                            onClick={() =>
                              void act(
                                `/master/shops/${selected.shopId}/billing`,
                                {
                                  billingDiscountPercent: Number(billingForm.discountPercent) || 0,
                                  billingCreditBalance: Number(billingForm.creditBalance) || 0,
                                },
                                "Billing terms saved"
                              )
                            }
                          >
                            Save discount &amp; credit
                          </button>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                          <div>
                            <div className="text-sm font-bold text-slate-900">Fingerprint attendance</div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              When ON, the shop can punch attendance with a fingerprint reader. Manual entry always
                              stays available.
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-3">
                            <span
                              className={`text-xs font-bold px-2 py-1 rounded-full ${
                                selected.fingerprintAttendance
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-slate-200 text-slate-700"
                              }`}
                            >
                              {selected.fingerprintAttendance ? "ON" : "OFF"}
                            </span>
                            <button
                              type="button"
                              disabled={busy}
                              className={`btn ${selected.fingerprintAttendance ? "btn-muted" : "btn-primary"}`}
                              onClick={() =>
                                void act(
                                  `/master/shops/${selected.shopId}/fingerprint`,
                                  { enabled: !selected.fingerprintAttendance },
                                  selected.fingerprintAttendance
                                    ? "Fingerprint attendance OFF"
                                    : "Fingerprint attendance ON"
                                )
                              }
                            >
                              {selected.fingerprintAttendance ? "Turn OFF" : "Turn ON"}
                            </button>
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                          <div>
                            <div className="text-sm font-bold text-slate-900">Cloud data retention</div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Keep cloud (Firestore) data for N months. After a successful local SQLite archive, month
                              N+1 auto-wipes cloud docs older than N months. Local shop DB stays complete. Choose 0 to
                              keep cloud forever.
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              className="input w-auto min-w-[10rem]"
                              value={selected.cloudRetentionMonths ?? 12}
                              disabled={busy}
                              onChange={(e) => {
                                const months = Number(e.target.value);
                                void act(
                                  `/master/shops/${selected.shopId}/retention`,
                                  { months },
                                  months === 0
                                    ? "Cloud retention OFF"
                                    : `Cloud retention ${months} months`
                                );
                              }}
                            >
                              <option value={0}>Off (keep forever)</option>
                              <option value={3}>3 months</option>
                              <option value={6}>6 months</option>
                              <option value={12}>12 months</option>
                              <option value={24}>24 months</option>
                            </select>
                            <span className="text-xs font-semibold text-slate-600">
                              Current:{" "}
                              {(selected.cloudRetentionMonths ?? 12) === 0
                                ? "Off"
                                : `${selected.cloudRetentionMonths ?? 12} months`}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {tab === "security" && (
                      <div className="space-y-6 max-w-md">
                        <div>
                          <div className="text-sm font-bold text-slate-900 mb-2">Reset shop Super Admin password</div>
                          <div className="flex gap-2">
                            <input
                              className="input flex-1"
                              type="text"
                              placeholder="New password (min 6)"
                              value={resetPwd}
                              onChange={(e) => setResetPwd(e.target.value)}
                            />
                            <button
                              type="button"
                              disabled={busy || resetPwd.length < 6}
                              className="btn btn-muted shrink-0"
                              onClick={() => {
                                void act(
                                  `/master/shops/${selected.shopId}/reset-password`,
                                  { password: resetPwd },
                                  "Password reset"
                                ).then(() => setResetPwd(""));
                              }}
                            >
                              <KeyRound size={16} /> Reset
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            <form
              onSubmit={changeMasterPassword}
              className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-end gap-3"
            >
              <div className="sm:w-40 shrink-0">
                <div className="text-sm font-bold text-slate-900">Master password</div>
                <div className="text-[11px] text-slate-500">Your login only</div>
              </div>
              <input
                className="input flex-1"
                type="password"
                placeholder="Current"
                value={pwdForm.currentPassword}
                onChange={(e) => setPwdForm((p) => ({ ...p, currentPassword: e.target.value }))}
                required
              />
              <input
                className="input flex-1"
                type="password"
                placeholder="New (min 6)"
                value={pwdForm.newPassword}
                onChange={(e) => setPwdForm((p) => ({ ...p, newPassword: e.target.value }))}
                required
                minLength={6}
              />
              <button className="btn btn-primary shrink-0" disabled={busy}>
                Update
              </button>
            </form>
          </section>
        </div>
      </div>

      {typeModal && selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="text-sm font-bold text-slate-900">
                {typeModal === "change"
                  ? "Change shop type"
                  : typeModal === "renew"
                    ? "Renew — set shop type"
                    : "What kind of shop is this?"}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {selected.shopName} — features and starter categories will match this type.
              </p>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto">
              {SHOP_TYPE_OPTIONS.map((opt) => {
                const on = pickType === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPickType(opt.id)}
                    className={`text-left rounded-xl border px-3 py-3 transition-colors ${
                      on
                        ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="text-sm font-bold text-slate-900">{opt.label}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{opt.hint}</div>
                  </button>
                );
              })}
            </div>
            <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button type="button" className="btn btn-muted" disabled={busy} onClick={() => setTypeModal(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" disabled={busy || !pickType} onClick={() => void confirmTypeModal()}>
                {typeModal === "approve" ? "Approve & apply" : typeModal === "change" ? "Apply type" : "Renew"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
