import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Building2,
  Info,
  RefreshCw,
  RotateCcw,
  Upload,
} from "lucide-react";
import api from "../api";
import { ErrorBox } from "../components/ui";
import ConnectionCenter from "../components/ConnectionCenter";
import { APP_VERSION } from "../version";
import { useI18n } from "../i18n";
import { LanguageSelect } from "../i18n/LanguageSelect";
import { printProductLabels } from "../print/label";
import { openCashDrawer } from "../print/cashDrawer";
import { openCustomerDisplayWindow } from "../customerDisplay/channel";
import {
  connectPoleDisplay,
  disconnectPoleDisplay,
  poleDisplayConnected,
  poleDisplaySupported,
  showPoleIdle,
  writePoleLines,
} from "../customerDisplay/pole";

type Tab = "connection" | "license" | "print" | "pos" | "display" | "about";

const DEFAULTS: Record<string, string> = {
  shop_name: "My POS Store",
  shop_display_name: "",
  store_phone: "+1 234 567 8900",
  store_email: "store@example.com",
  store_address: "123 Main Street, City",
  currency: "Rs.",
  tax_rate: "10",
  stock_code_type: "Barcode (ID)",
  enable_sound: "1",
  quick_sale_mode: "0",
  customer_display_enabled: "1",
  print_language: "English",
  ui_language: "en",
  bill_printer: "xp-q80t",
  label_printer: "xp-361",
  receipt_header: "WELCOME TO OUR STORE",
  receipt_footer: "Thank you for your purchase!",
  show_logo: "1",
  show_barcode: "1",
  show_qr: "0",
  auto_cut: "1",
  print_date: "1",
  print_time: "1",
  cash_drawer_enabled: "1",
  cash_drawer_on_cash: "1",
  cash_drawer_on_any: "0",
  cash_drawer_printer: "XP-Q80T",
  cash_drawer_pin: "0",
  store_logo: "",
  welcome_note: "Please proceed to the counter",
  customer_logo: "",
  bank_name: "",
  bank_account_name: "",
  bank_account_number: "",
  merchant_qr: "",
  business_name: "DEMO ACCOUNT",
  owner_name: "USER DEMO",
  max_devices: "2",
  online_access: "No",
  db_type: "offline",
  plan_name: "1st Month Free (Demo)",
  version: APP_VERSION,
};

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
      <input
        type="checkbox"
        className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

export default function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab: Tab =
    tabParam === "connection" ||
    tabParam === "license" ||
    tabParam === "print" ||
    tabParam === "pos" ||
    tabParam === "display" ||
    tabParam === "about"
      ? tabParam
      : "connection";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [settings, setSettings] = useState<Record<string, string>>({ ...DEFAULTS });
  const [license, setLicense] = useState<any>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [poleConnected, setPoleConnected] = useState(false);
  const [printerNames, setPrinterNames] = useState<string[]>(["XP-Q80T", "Xprinter XP-Q80T", "XP-Q80"]);
  const [billingInterval, setBillingInterval] = useState<"monthly" | "annual">("monthly");
  const [billing, setBilling] = useState<{
    configured: boolean;
    sandbox: boolean;
    hasMerchantId?: boolean;
    hasMerchantSecret?: boolean;
    merchantId?: string | null;
    secretLength?: number;
    secretTail?: string | null;
    returnBase?: string;
    notifyBase?: string;
    checkoutBase?: string | null;
    publicWebNeedsCustomDomain?: boolean;
    publicWebCheckoutOk?: boolean;
    plans: { id: string; label: string; amount: number; currency: string; days: number }[];
    current: {
      status?: string;
      billingPlan?: string | null;
      nextDueAt?: string | null;
      lastPaidAt?: string | null;
      payherePaymentId?: string | null;
      lastBillingAmount?: number | null;
    } | null;
  } | null>(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false);

  function selectTab(id: Tab) {
    setTab(id);
    setSearchParams(id === "connection" ? { tab: "connection" } : { tab: id });
  }

  function setField(key: string, value: string) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  function bool(key: string) {
    return settings[key] === "1" || settings[key] === "true";
  }

  function setBool(key: string, value: boolean) {
    setField(key, value ? "1" : "0");
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [s, l, b] = await Promise.all([
        api.get("/settings"),
        api.get("/license/status"),
        api.get("/billing/plans").catch(() => null),
      ]);
      const merged = { ...DEFAULTS, ...(s.data.data || {}), version: APP_VERSION };
      setSettings(merged);
      setLicense(l.data.data || null);
      if (b?.data?.data) {
        const bill = b.data.data;
        setBilling(bill);
        if (bill.current?.billingPlan === "annual" || bill.current?.billingPlan === "monthly") {
          setBillingInterval(bill.current.billingPlan);
        }
      }
      const savedLang = String(merged.ui_language || "").trim();
      if (savedLang === "en" || savedLang === "si" || savedLang === "ta") {
        setLang(savedLang);
      }
      const billingFlag = searchParams.get("billing");
      if (billingFlag === "return") {
        setMsg("Returned from PayHere — refreshing subscription status…");
        setTimeout(() => void refreshBilling(), 1500);
      } else if (billingFlag === "cancel") {
        setError("PayHere checkout was cancelled.");
      }
    } catch (e: any) {
      setError(e.message || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }

  async function refreshBilling() {
    try {
      const [l, b] = await Promise.all([api.get("/license/status"), api.get("/billing/plans")]);
      setLicense(l.data.data || null);
      if (b.data?.data) setBilling(b.data.data);
      setMsg("Subscription status refreshed");
    } catch (e: any) {
      setError(e.message || "Failed to refresh billing");
    }
  }

  function goToPayHere(bridgeUrl: string | null | undefined, action: string, fields: Record<string, string>) {
    // Prefer custom-domain bridge (quantumexe.lk) so PayHere sees the registered Referer.
    if (bridgeUrl) {
      window.location.assign(bridgeUrl);
      return;
    }
    submitPayHereForm(action, fields);
  }

  function submitPayHereForm(action: string, fields: Record<string, string>) {
    // Fallback when no PAYHERE_CHECKOUT_BASE (local/dev).
    const w = window.open("", "_blank");
    if (!w) {
      setError("Pop-up blocked — allow pop-ups for this site, then try again.");
      setCheckoutBusy(false);
      return;
    }
    const inputs = Object.entries(fields)
      .map(
        ([k, v]) =>
          `<input type="hidden" name="${String(k).replace(/"/g, "&quot;")}" value="${String(v ?? "")
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;")
            .replace(/</g, "&lt;")}" />`
      )
      .join("");
    w.document.open();
    w.document.write(`<!doctype html><html><head>
      <meta name="referrer" content="no-referrer" />
      <title>Redirecting to PayHere…</title>
      </head><body>
      <p style="font-family:sans-serif;padding:24px">Redirecting to PayHere secure checkout…</p>
      <form id="ph" method="POST" action="${action.replace(/"/g, "")}" referrerpolicy="no-referrer">${inputs}</form>
      <script>document.getElementById("ph").submit();<\/script>
      </body></html>`);
    w.document.close();
    setCheckoutBusy(false);
  }

  async function startCheckout(interval: "monthly" | "annual" = billingInterval, recurring = true) {
    setError("");
    setMsg("");
    setCheckoutBusy(true);
    try {
      const { data } = await api.post("/billing/checkout", { interval, recurring });
      if (!data?.success) throw new Error(data?.message || "Checkout failed");
      const action = data.data?.action as string;
      const fields = data.data?.fields as Record<string, string>;
      const bridgeUrl = data.data?.bridgeUrl as string | undefined;
      if (!action || !fields) throw new Error("Invalid checkout response");
      setMsg(
        bridgeUrl
          ? "Opening quantumexe.lk → PayHere…"
          : recurring
            ? "Redirecting to PayHere (auto-renew)…"
            : "Redirecting to PayHere (one-time test)…"
      );
      goToPayHere(bridgeUrl, action, fields);
    } catch (e: any) {
      const ax = e as { response?: { data?: { message?: string } }; message?: string };
      setError(ax.response?.data?.message || ax.message || "PayHere checkout failed");
      setCheckoutBusy(false);
    }
  }

  useEffect(() => {
    load();
    setPoleConnected(poleDisplayConnected());
    void (async () => {
      try {
        const list = await window.quantumexeDesktop?.listPrinters?.();
        if (list?.length) setPrinterNames(list);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const daysRemaining = useMemo(() => {
    const exp = license?.expiry_date ? new Date(license.expiry_date) : null;
    if (!exp || Number.isNaN(exp.getTime())) return null;
    return Math.max(0, Math.ceil((exp.getTime() - Date.now()) / 86400000));
  }, [license]);

  async function save() {
    setError("");
    setMsg("");
    try {
      const payload: Record<string, string> = { ...settings, ui_language: lang, version: APP_VERSION };
      // Avoid sending multi‑MB data URLs that break Firestore (1MB/doc) / Vercel body limits
      for (const k of ["store_logo", "customer_logo"] as const) {
        const v = String(payload[k] || "");
        if (v.startsWith("data:") && v.length > 900_000) {
          throw new Error("Logo is still too large after compress. Use a smaller PNG/JPG (under ~500KB).");
        }
      }
      const { data } = await api.put("/settings", payload);
      if (!data?.success) throw new Error(data?.message || "Failed to save");
      setSettings((s) => ({ ...s, ui_language: lang }));
      setMsg(t("settings.saved"));
      // Reload from server so we confirm logo persisted
      const again = await api.get("/settings");
      const map = (again.data?.data || {}) as Record<string, string>;
      if (map && typeof map === "object") {
        setSettings((s) => ({ ...s, ...map, version: APP_VERSION, ui_language: lang }));
      }
    } catch (e: any) {
      const ax = e as { response?: { data?: { message?: string } }; message?: string };
      setError(ax.response?.data?.message || ax.message || "Failed to save");
    }
  }

  function resetDefaults() {
    if (!confirm("Reset all settings to defaults?")) return;
    setSettings({ ...DEFAULTS });
    setLang("en");
  }

  async function refreshLicense() {
    await refreshBilling();
  }

  /** Resize + JPEG compress so logos survive Firestore (max ~1MB per setting doc). */
  function compressLogoFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Could not read image"));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("Invalid image file"));
        img.onload = () => {
          const maxSide = 512;
          let { width, height } = img;
          const scale = Math.min(1, maxSide / Math.max(width, height));
          width = Math.max(1, Math.round(width * scale));
          height = Math.max(1, Math.round(height * scale));
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Canvas not supported"));
            return;
          }
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          let quality = 0.82;
          let dataUrl = canvas.toDataURL("image/jpeg", quality);
          while (dataUrl.length > 180_000 && quality > 0.45) {
            quality -= 0.1;
            dataUrl = canvas.toDataURL("image/jpeg", quality);
          }
          resolve(dataUrl);
        };
        img.src = String(reader.result || "");
      };
      reader.readAsDataURL(file);
    });
  }

  async function onLogoUpload(key: "store_logo" | "customer_logo", file?: File | null) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Logo must be under 5MB");
      return;
    }
    setError("");
    setMsg("");
    try {
      const dataUrl = await compressLogoFile(file);
      setField(key, dataUrl);
      setMsg("Logo ready — click Save to keep it");
    } catch (e: any) {
      setError(e.message || "Logo upload failed");
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "connection", label: t("settings.tab.connection") },
    { id: "license", label: t("settings.tab.license") },
    { id: "print", label: t("settings.tab.print") },
    { id: "pos", label: t("settings.tab.pos") },
    { id: "display", label: t("settings.tab.display") },
    { id: "about", label: t("settings.tab.about") },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("settings.title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("lang.appLanguageHint")}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={resetDefaults}
            className="h-10 px-4 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 inline-flex items-center gap-2 hover:bg-gray-50"
          >
            <RotateCcw size={16} /> Reset Defaults
          </button>
          <button type="button" onClick={save} className="btn btn-primary h-10 px-4">
            {t("common.save")}
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-gray-900">{t("lang.appLanguage")}</div>
          <p className="text-xs text-gray-500 mt-0.5">{t("lang.appLanguageHint")}</p>
        </div>
        <LanguageSelect size="md" />
      </div>

      {error && <ErrorBox text={error} />}
      {msg && <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">{msg}</div>}

      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-2">
        {tabs.map((tabItem) => (
          <button
            key={tabItem.id}
            type="button"
            onClick={() => selectTab(tabItem.id)}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 -mb-[9px] ${
              tab === tabItem.id
                ? "text-emerald-700 border-emerald-600"
                : "text-gray-600 border-transparent hover:text-gray-800"
            }`}
          >
            {tabItem.label}
          </button>
        ))}
      </div>

      {tab === "connection" && <ConnectionCenter />}

      {tab === "license" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-gray-500">
              QUANTUMEXE SaaS subscription via PayHere
              {billing?.sandbox ? " (sandbox)" : ""}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => selectTab("connection")}
                className="h-9 px-3 rounded-lg border border-emerald-200 bg-emerald-50 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
              >
                Cloud sync / Connection
              </button>
              <button
                type="button"
                onClick={() => void refreshLicense()}
                className="h-9 px-3 rounded-lg border border-gray-200 text-sm font-semibold inline-flex items-center gap-1 hover:bg-gray-50"
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-xs font-semibold text-gray-500 tracking-wide">LICENSE KEY</div>
              <div className="mt-2 text-lg font-bold text-gray-900">{license?.license_key || "—"}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-xs font-semibold text-gray-500 tracking-wide">NEXT DUE</div>
              <div className="mt-2 text-lg font-bold text-gray-900">
                {billing?.current?.nextDueAt
                  ? new Date(billing.current.nextDueAt).toLocaleDateString()
                  : license?.expiry_date
                    ? new Date(license.expiry_date).toLocaleDateString()
                    : "—"}
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
            <div>
              <div className="text-sm font-bold text-gray-800">Choose plan</div>
              <p className="text-xs text-gray-500 mt-1">
                Card is charged by PayHere. Settlements go to QUANTUMEXE&apos;s merchant bank account — we never store your card.
              </p>
            </div>
            {billing != null && !billing.configured && (
              <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 space-y-1">
                <div>
                  PayHere is not configured on this server yet. Add env vars on Vercel, then{" "}
                  <strong>Redeploy</strong> (Deployments → ⋯ → Redeploy).
                </div>
                <div className="text-xs font-mono text-amber-900">
                  merchantId: {billing.hasMerchantId ? "OK" : "MISSING"} · merchantSecret:{" "}
                  {billing.hasMerchantSecret ? "OK" : "MISSING"}
                </div>
              </div>
            )}
            {billing == null && (
              <div className="text-xs text-gray-400">Checking PayHere configuration…</div>
            )}
            {billing != null && billing.configured && billing.publicWebNeedsCustomDomain && (
              <div className="text-sm text-red-900 bg-red-50 border border-red-200 rounded-lg px-3 py-2 space-y-1">
                <div className="font-semibold">Connect quantumexe.lk for live PayHere</div>
                <div className="text-xs leading-relaxed">
                  Pay button will open <code className="text-[10px]">https://quantumexe.lk</code> then PayHere — but only
                  after: (1) add <strong>quantumexe.lk</strong> on Vercel Domains, (2) register{" "}
                  <code className="text-[10px]">quantumexe.lk</code> in PayHere Integrations + new secret, (3) set Vercel
                  env <code className="text-[10px]">PAYHERE_CHECKOUT_BASE</code>,{" "}
                  <code className="text-[10px]">PAYHERE_RETURN_BASE</code>,{" "}
                  <code className="text-[10px]">PUBLIC_WEB_BASE</code>,{" "}
                  <code className="text-[10px]">PUBLIC_API_BASE</code> to{" "}
                  <code className="text-[10px]">https://quantumexe.lk</code> and Redeploy.
                </div>
              </div>
            )}
            {billing != null && billing.configured && billing.checkoutBase && (
              <div className="text-sm text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs">
                Pay opens via <code className="text-[10px]">{billing.checkoutBase}</code> → PayHere
              </div>
            )}
            {billing != null && billing.configured && (
              <div className="text-[11px] text-gray-500 font-mono bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                PayHere OK · id {billing.merchantId || "—"} · secret len {billing.secretLength ?? "?"} ends{" "}
                {billing.secretTail || "????"} · return {billing.returnBase || "—"}
              </div>
            )}
            <div className="grid sm:grid-cols-2 gap-3">
              {(billing?.plans?.length
                ? billing.plans
                : [
                    { id: "monthly", label: "Monthly", amount: 2000, currency: "LKR", days: 30 },
                    { id: "annual", label: "Annual", amount: 20000, currency: "LKR", days: 365 },
                  ]
              ).map((p) => {
                const selected = billingInterval === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setBillingInterval(p.id as "monthly" | "annual")}
                    className={`text-left rounded-xl border p-4 transition ${
                      selected
                        ? "border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600"
                        : "border-gray-200 bg-white hover:bg-gray-50"
                    }`}
                  >
                    <div className="text-sm font-bold text-gray-900">{p.label}</div>
                    <div className="text-2xl font-bold text-emerald-700 mt-1">
                      {p.currency} {Number(p.amount).toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Auto-renews · {p.days} days access per charge</div>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={checkoutBusy}
                onClick={() => void startCheckout(billingInterval, true)}
                className="btn btn-primary h-10 px-4 disabled:opacity-50"
              >
                {checkoutBusy ? "Opening PayHere…" : "Subscribe / Renew with PayHere"}
              </button>
              <button
                type="button"
                disabled={checkoutBusy}
                onClick={() => void startCheckout(billingInterval, false)}
                className="h-10 px-4 rounded-lg border border-gray-200 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
                title="One-time charge without auto-renew — use to test if Unauthorized is from recurring"
              >
                One-time pay (test)
              </button>
              <button
                type="button"
                className="h-10 px-4 rounded-lg border border-gray-200 text-sm font-semibold hover:bg-gray-50"
                onClick={() => void refreshBilling()}
              >
                Refresh status
              </button>
            </div>
            <p className="text-[11px] text-gray-500">
              Pay button opens <strong>quantumexe.lk</strong>, then PayHere. Register{" "}
              <code className="text-[10px]">quantumexe.lk</code> in PayHere Integrations (new secret) and point that
              domain to this Vercel project.
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="text-sm font-bold text-gray-800">Current subscription</div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-gray-800">
                Plan: {billing?.current?.billingPlan || settings.plan_name || "—"}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  (billing?.current?.status || license?.status || "").toString().toLowerCase() === "active" ||
                  String(license?.status || "").toUpperCase() === "VALID"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {billing?.current?.status || license?.status || "—"}
              </span>
              {daysRemaining != null && (
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[11px] font-bold">
                  {daysRemaining} day(s) remaining
                </span>
              )}
            </div>
            <div className="text-sm text-gray-600">
              Last paid:{" "}
              {billing?.current?.lastPaidAt ? new Date(billing.current.lastPaidAt).toLocaleString() : "—"}
              {billing?.current?.lastBillingAmount != null
                ? ` · Rs. ${Number(billing.current.lastBillingAmount).toLocaleString()}`
                : ""}
            </div>
            <div className="text-sm">
              Payment ID:{" "}
              <span className="font-mono text-xs text-gray-700">
                {billing?.current?.payherePaymentId || "—"}
              </span>
            </div>
          </div>
        </div>
      )}

      {tab === "print" && (
        <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4">
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-sm font-bold text-gray-800 mb-3">Store Logo</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="border-2 border-dashed border-gray-200 rounded-xl p-6 grid place-items-center text-center cursor-pointer hover:bg-gray-50">
                  <Upload size={22} className="text-gray-400 mb-2" />
                  <div className="text-sm font-semibold text-gray-700">Click to upload logo</div>
                  <div className="text-xs text-gray-500 mt-1">PNG, JPG up to 5MB — auto-resized so cloud save keeps it</div>
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    className="hidden"
                    onChange={(e) => onLogoUpload("store_logo", e.target.files?.[0])}
                  />
                </label>
                <div className="rounded-xl border border-gray-200 bg-gray-50 grid place-items-center min-h-[140px] p-4">
                  {settings.store_logo ? (
                    <img src={settings.store_logo} alt="Logo preview" className="max-h-28 object-contain" />
                  ) : (
                    <div className="text-center text-gray-400 text-sm">
                      <div className="font-semibold tracking-wide">LOGO PREVIEW</div>
                      <div className="text-xs mt-1">No logo uploaded.</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <div className="text-sm font-bold text-gray-800">Print Configuration</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600">{t("settings.printLanguage")}</label>
                  <select className="input mt-1" value={settings.print_language} onChange={(e) => setField("print_language", e.target.value)}>
                    <option>English</option>
                    <option>Sinhala</option>
                    <option>Tamil</option>
                  </select>
                  <div className="text-[11px] text-gray-500 mt-1">{t("settings.printLanguageHint")}</div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600">Bill / Receipt Printer</label>
                  <select className="input mt-1" value={settings.bill_printer} onChange={(e) => setField("bill_printer", e.target.value)}>
                    <option value="xp-q80t">Xprinter XP-Q80T Thermal Receipt (80mm)</option>
                    <option value="thermal">Other Thermal Receipt (80mm)</option>
                    <option value="a4">A4 Printer</option>
                  </select>
                  <div className="text-[11px] text-gray-500 mt-1">
                    POS invoices print here. In Windows print dialog, choose <strong>XP-Q80T</strong>.
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600">Barcode Label Printer</label>
                  <select className="input mt-1" value={settings.label_printer || "xp-361"} onChange={(e) => setField("label_printer", e.target.value)}>
                    <option value="xp-361">Xprinter XP-361 Thermal Barcode (80mm)</option>
                  </select>
                  <div className="text-[11px] text-gray-500 mt-1">
                    Store Release stickers (barcode + price). Choose <strong>XP-361</strong> in the print dialog.
                  </div>
                  <button
                    type="button"
                    className="mt-2 h-9 px-3 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-900 text-sm font-semibold hover:bg-emerald-100"
                    onClick={() => {
                      void printProductLabels([
                        {
                          productName: "Sample Shirt — Test Label",
                          size: "M",
                          color: "Navy",
                          barcode: "8901234567890",
                          price: 2490,
                          code: "SHIRT-M-NAVY",
                          copies: 1,
                        },
                      ]);
                    }}
                  >
                    Print test label (1 sample)
                  </button>
                </div>

                <div className="md:col-span-2 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
                  <div className="text-xs font-bold text-gray-600 mb-2">Label layout preview (80mm XP-361)</div>
                  <div className="mx-auto w-[220px] bg-white border border-gray-300 rounded-md px-3 py-3 text-center shadow-sm">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-gray-700">
                      {settings.shop_display_name || settings.shop_name || "QUANTUMEXE"}
                    </div>
                    <div className="text-[13px] font-extrabold text-gray-900 mt-1 leading-tight">
                      Sample Shirt — Test Label
                    </div>
                    <div className="text-[11px] font-semibold text-gray-700 mt-0.5">Size M · Navy</div>
                    <div className="text-[18px] font-black text-gray-900 my-1.5">
                      {(settings.currency || "Rs.")} 2,490.00
                    </div>
                    <div className="h-10 mx-auto w-full max-w-[180px] bg-[repeating-linear-gradient(90deg,#111_0,#111_2px,transparent_2px,transparent_4px)] opacity-80 rounded-sm" />
                    <div className="text-[10px] font-mono mt-1 text-gray-800">8901234567890</div>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-3 text-center">
                    Real print: shop name → product → size/color → price → scannable barcode
                  </p>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-gray-600">Header Text</label>
                  <input className="input mt-1" value={settings.receipt_header} onChange={(e) => setField("receipt_header", e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-gray-600">Footer Text</label>
                  <input className="input mt-1" value={settings.receipt_footer} onChange={(e) => setField("receipt_footer", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                <Toggle label="Show Logo" checked={bool("show_logo")} onChange={(v) => setBool("show_logo", v)} />
                <Toggle label="Show Barcode" checked={bool("show_barcode")} onChange={(v) => setBool("show_barcode", v)} />
                <Toggle label="Show QR Code" checked={bool("show_qr")} onChange={(v) => setBool("show_qr", v)} />
                <Toggle label="Auto Cut" checked={bool("auto_cut")} onChange={(v) => setBool("auto_cut", v)} />
                <Toggle label="Print Date" checked={bool("print_date")} onChange={(v) => setBool("print_date", v)} />
                <Toggle label="Print Time" checked={bool("print_time")} onChange={(v) => setBool("print_time", v)} />
              </div>

              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-3">
                <div className="text-sm font-bold text-gray-800">Cash Drawer (XP-Q80T DK port)</div>
                <p className="text-[11px] text-gray-600">
                  Plug drawer RJ11 cable into the receipt printer cash-drawer port. Use the{" "}
                  <strong>QUANTUMEXE desktop app</strong> so POS can send the open pulse. Set the Windows printer name
                  exactly as shown in Windows Printers (often <code>XP-Q80T</code>).
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <Toggle
                    label="Enable cash drawer"
                    checked={bool("cash_drawer_enabled")}
                    onChange={(v) => setBool("cash_drawer_enabled", v)}
                  />
                  <Toggle
                    label="Open on Cash sales"
                    checked={bool("cash_drawer_on_cash")}
                    onChange={(v) => setBool("cash_drawer_on_cash", v)}
                  />
                  <Toggle
                    label="Open on every sale"
                    checked={bool("cash_drawer_on_any")}
                    onChange={(v) => setBool("cash_drawer_on_any", v)}
                  />
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Windows printer name</label>
                    <input
                      className="input mt-1"
                      list="cash-drawer-printers"
                      placeholder="XP-Q80T"
                      value={settings.cash_drawer_printer || ""}
                      onChange={(e) => setField("cash_drawer_printer", e.target.value)}
                    />
                    <datalist id="cash-drawer-printers">
                      {printerNames.map((n) => (
                        <option key={n} value={n} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Drawer pin</label>
                    <select
                      className="input mt-1"
                      value={settings.cash_drawer_pin || "0"}
                      onChange={(e) => setField("cash_drawer_pin", e.target.value)}
                    >
                      <option value="0">Pin 2 (default)</option>
                      <option value="1">Pin 5</option>
                    </select>
                  </div>
                </div>
                <button
                  type="button"
                  className="h-9 px-3 rounded-lg border border-amber-400 bg-white text-amber-900 text-sm font-semibold hover:bg-amber-100"
                  onClick={() => {
                    void openCashDrawer({ force: true }).then((r) => {
                      alert(r.message);
                    });
                  }}
                >
                  Test open cash drawer
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="text-sm font-bold text-gray-800 mb-3">Live Print Preview</div>
            <div className="mx-auto max-w-[280px] bg-white border border-gray-300 rounded-md p-4 text-[11px] font-mono text-gray-800 space-y-2">
              {bool("show_logo") && settings.store_logo && (
                <img src={settings.store_logo} alt="" className="mx-auto h-10 object-contain" />
              )}
              <div className="text-center font-bold">{settings.shop_name || "My POS Store"}</div>
              <div className="text-center text-gray-500">{settings.store_address}</div>
              <div className="text-center font-semibold">{settings.receipt_header}</div>
              <div className="border-t border-dashed border-gray-300 pt-2 space-y-0.5">
                <div>INV: INV-0001</div>
                {bool("print_date") && <div>Date: {new Date().toLocaleDateString()}</div>}
                {bool("print_time") && <div>Time: {new Date().toLocaleTimeString()}</div>}
                <div>Customer: Walking Customer</div>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-300">
                    <th className="text-left py-1">Item</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-1">Sample Item 1</td>
                    <td className="text-right">1</td>
                    <td className="text-right">500.00</td>
                  </tr>
                  <tr>
                    <td className="py-1">Sample Item 2</td>
                    <td className="text-right">2</td>
                    <td className="text-right">900.00</td>
                  </tr>
                </tbody>
              </table>
              <div className="border-t border-dashed border-gray-300 pt-2 space-y-0.5">
                <div className="flex justify-between"><span>Subtotal</span><span>1400.00</span></div>
                <div className="flex justify-between"><span>Discount</span><span>0.00</span></div>
                <div className="flex justify-between font-bold"><span>TOTAL</span><span>1400.00</span></div>
                <div className="flex justify-between"><span>Cash</span><span>1400.00</span></div>
                <div className="flex justify-between"><span>Balance</span><span>0.00</span></div>
              </div>
              <div className="text-center pt-2">{settings.receipt_footer}</div>
              {bool("show_barcode") && (
                <div className="text-center tracking-[0.3em] text-lg leading-none py-1">||||| |||| |||||</div>
              )}
              {bool("show_qr") && (
                <div className="mx-auto w-16 h-16 border-2 border-gray-800 grid place-items-center text-[9px]">QR</div>
              )}
              <div className="text-center text-[9px] text-gray-400">software by QUANTUMEXE Technologies</div>
            </div>
          </div>
        </div>
      )}

      {tab === "pos" && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="text-sm font-bold text-gray-800">Store Information</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600">Store Name</label>
                <input className="input mt-1" value={settings.shop_name} onChange={(e) => setField("shop_name", e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Shop Display Name (Shown on Customer Screen)</label>
                <input
                  className="input mt-1"
                  placeholder="e.g. Shopira2 Supermarket"
                  value={settings.shop_display_name}
                  onChange={(e) => setField("shop_display_name", e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Store Phone</label>
                <input className="input mt-1" value={settings.store_phone} onChange={(e) => setField("store_phone", e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Store Email</label>
                <input className="input mt-1" value={settings.store_email} onChange={(e) => setField("store_email", e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-gray-600">Store Address</label>
                <textarea
                  className="input mt-1 min-h-[80px]"
                  value={settings.store_address}
                  onChange={(e) => setField("store_address", e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="text-sm font-bold text-gray-800">Business Settings</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600">Currency</label>
                <input className="input mt-1" value={settings.currency} onChange={(e) => setField("currency", e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Tax Rate (%)</label>
                <input className="input mt-1" type="number" value={settings.tax_rate} onChange={(e) => setField("tax_rate", e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Stock Code Type</label>
                <select className="input mt-1" value={settings.stock_code_type} onChange={(e) => setField("stock_code_type", e.target.value)}>
                  <option>Barcode (ID)</option>
                  <option>Product Code</option>
                  <option>SKU</option>
                </select>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 pt-1">
              <Toggle label="Enable Sound Effects" checked={bool("enable_sound")} onChange={(v) => setBool("enable_sound", v)} />
              <Toggle label="Quick Sale Mode" checked={bool("quick_sale_mode")} onChange={(v) => setBool("quick_sale_mode", v)} />
              <Toggle label="Customer Display" checked={bool("customer_display_enabled")} onChange={(v) => setBool("customer_display_enabled", v)} />
            </div>
          </div>
        </div>
      )}

      {tab === "display" && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="text-sm font-bold text-gray-800">Customer Price Display</div>
            <div className="text-xs text-gray-500">
              Open a second-screen window for dual monitors, or connect a CD-7220 pole display (USB/COM via Web Serial).
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  openCustomerDisplayWindow();
                  setMsg("Customer display window opened — drag it to the second monitor");
                }}
              >
                Open customer display window
              </button>
              {poleDisplaySupported() && (
                <button
                  type="button"
                  className={`btn ${poleConnected || poleDisplayConnected() ? "btn-muted" : "btn-primary"}`}
                  onClick={async () => {
                    try {
                      if (poleConnected || poleDisplayConnected()) {
                        await disconnectPoleDisplay();
                        setPoleConnected(false);
                        setMsg("Pole display disconnected");
                        return;
                      }
                      await connectPoleDisplay();
                      const shop = settings.shop_display_name || settings.shop_name || "WELCOME";
                      await writePoleLines(String(shop).slice(0, 20), "CUSTOMER DISPLAY");
                      setPoleConnected(true);
                      setMsg("CD-7220 pole display connected");
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Pole connect failed");
                    }
                  }}
                >
                  {poleConnected || poleDisplayConnected() ? "Disconnect CD-7220" : "Connect CD-7220 pole"}
                </button>
              )}
              {(poleConnected || poleDisplayConnected()) && (
                <button
                  type="button"
                  className="btn btn-muted"
                  onClick={async () => {
                    await showPoleIdle(settings.shop_display_name || settings.shop_name || "WELCOME");
                    setMsg("Pole display reset to welcome");
                  }}
                >
                  Test pole welcome
                </button>
              )}
            </div>
            {!poleDisplaySupported() && (
              <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                Pole display needs Chrome/Edge with Web Serial (desktop). Second-monitor customer window works in all browsers.
              </div>
            )}
            <Toggle label="Enable Customer Display sync from POS" checked={bool("customer_display_enabled")} onChange={(v) => setBool("customer_display_enabled", v)} />
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="text-sm font-bold text-gray-800">Shop Branding</div>
            <div className="text-xs text-gray-500">Displayed on the customer-facing screen.</div>
            <div>
              <label className="text-xs font-semibold text-gray-600">WELCOME NOTE</label>
              <input className="input mt-1" value={settings.welcome_note} onChange={(e) => setField("welcome_note", e.target.value)} />
              <div className="text-[11px] text-gray-500 mt-1">
                Shop name is managed via POS Settings — Shop Display Name
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">SHOP LOGO</label>
              <div className="mt-2 flex items-center gap-3">
                <div className="w-16 h-16 rounded-lg border border-gray-200 bg-gray-50 grid place-items-center overflow-hidden">
                  {settings.customer_logo ? (
                    <img src={settings.customer_logo} alt="" className="w-full h-full object-contain" />
                  ) : (
                    <Building2 size={22} className="text-gray-300" />
                  )}
                </div>
                <label className="h-10 px-4 rounded-lg border border-gray-200 text-sm font-semibold inline-flex items-center gap-2 cursor-pointer hover:bg-gray-50">
                  <Upload size={14} /> Upload Logo
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    className="hidden"
                    onChange={(e) => onLogoUpload("customer_logo", e.target.files?.[0])}
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="text-sm font-bold text-gray-800">Bank Transfer Details</div>
            <div className="text-xs text-gray-500">Shown when customer selects Bank payment. Leave blank to hide.</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600">BANK NAME</label>
                <select className="input mt-1" value={settings.bank_name} onChange={(e) => setField("bank_name", e.target.value)}>
                  <option value="">-- Select Bank --</option>
                  <option>Bank of Ceylon (BOC)</option>
                  <option>Commercial Bank of Ceylon</option>
                  <option>People&apos;s Bank</option>
                  <option>Sampath Bank</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">ACCOUNT NAME</label>
                <input
                  className="input mt-1"
                  placeholder="e.g. Shopira2 Pvt Ltd"
                  value={settings.bank_account_name}
                  onChange={(e) => setField("bank_account_name", e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-gray-600">ACCOUNT NUMBER</label>
                <input
                  className="input mt-1"
                  placeholder="e.g. 1234 5678 9012"
                  value={settings.bank_account_number}
                  onChange={(e) => setField("bank_account_number", e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-gray-600">MERCHANT QR STRING (LANKAQR/UPI)</label>
                <textarea
                  className="input mt-1 min-h-[90px]"
                  placeholder="Paste your raw static QR string here (e.g. 000201010211...)"
                  value={settings.merchant_qr}
                  onChange={(e) => setField("merchant_qr", e.target.value)}
                />
                <div className="text-[11px] text-gray-500 mt-1">Used to generate dynamic QR codes with payment amount.</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "about" && (
        <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 grid place-items-center">
              <Info size={28} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                <span className="text-slate-900">QUANTUM</span>
                <span className="text-sky-500">EXE</span> POS System
              </h2>
              <span className="inline-flex mt-2 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                Version {APP_VERSION}
              </span>
              {settings.shop_type ? (
                <div className="mt-2 text-sm text-gray-600">
                  Shop type:{" "}
                  <span className="font-semibold text-gray-900">
                    {settings.shop_type_label || settings.shop_type}
                  </span>
                </div>
              ) : null}
            </div>
            <p className="text-sm text-gray-600 max-w-xl mx-auto">
              A highly optimized and user-friendly Point of Sale system tailored for seamless restaurant and retail
              operations. Crafted with modern web technologies.
            </p>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-left">
              <div className="text-xs font-bold tracking-wide text-gray-700 mb-1">SYSTEM ARCHITECTURE</div>
              <p className="text-sm text-gray-600">
                Built with Electron, Vite, React, and Tailwind CSS. Leveraging modern caching and dual offline-online
                sync capabilities for uncompromised reliability.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-xl bg-teal-600 text-white p-4">
              <div className="text-xs font-semibold tracking-wide text-teal-100">SUPPORT CONTACT</div>
              <div className="mt-2 text-2xl font-bold">0706868950</div>
              <div className="mt-2 text-sm text-teal-50">Contact support for technical assistance or billing inquiries.</div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="text-xs font-semibold tracking-wide text-gray-500">DEVELOPER</div>
              <div className="mt-2 font-bold text-gray-800">QUANTUMEXE Technologies</div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="text-xs font-semibold tracking-wide text-gray-500">OFFICIAL SITE</div>
              <a href="https://quantumexe.com" target="_blank" rel="noreferrer" className="mt-2 inline-block font-bold text-sky-600 hover:underline">
                quantumexe.com
              </a>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
