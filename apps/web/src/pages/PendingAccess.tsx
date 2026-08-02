import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, CreditCard, LogOut, RefreshCw, ShieldAlert } from "lucide-react";
import api, { auth } from "../api";
import { BrandLogo } from "../components/BrandLogo";

export default function PendingAccess() {
  const navigate = useNavigate();
  const user = auth.getUser() as { name?: string; shop_status?: string; role?: string } | null;
  const [status, setStatus] = useState(user?.shop_status || "pending");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [interval, setIntervalPlan] = useState<"monthly" | "annual">("monthly");
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [payhereReady, setPayhereReady] = useState(false);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/shop/access");
      const next = data?.data?.status || "pending";
      setStatus(next);
      const u = auth.getUser();
      if (u) {
        sessionStorage.setItem("user", JSON.stringify({ ...u, shop_status: next }));
      }
      if (next === "active") navigate("/dashboard", { replace: true });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not refresh status");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user?.role === "MasterAdmin") {
      navigate("/master", { replace: true });
      return;
    }
    void refresh();
    void api
      .get("/billing/plans")
      .then((r) => setPayhereReady(Boolean(r.data?.data?.configured)))
      .catch(() => setPayhereReady(false));
    const t = setInterval(() => void refresh(), 20_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submitPayHereForm(action: string, fields: Record<string, string>) {
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

  async function payNow() {
    setError("");
    setMsg("");
    setCheckoutBusy(true);
    try {
      const { data } = await api.post("/billing/checkout", { interval });
      if (!data?.success) throw new Error(data?.message || "Checkout failed");
      const bridgeUrl = data.data?.bridgeUrl as string | undefined;
      if (bridgeUrl) {
        setMsg("Opening pos.quantumexe.lk → PayHere…");
        window.location.assign(bridgeUrl);
        return;
      }
      submitPayHereForm(data.data.action, data.data.fields);
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string } }; message?: string };
      setError(ax.response?.data?.message || ax.message || "PayHere checkout failed");
      setCheckoutBusy(false);
    }
  }

  const title =
    status === "revoked"
      ? "Access revoked"
      : status === "overdue"
        ? "Payment overdue"
        : "Waiting for approval";

  const body =
    status === "revoked"
      ? "Master Admin has revoked this shop. Contact QUANTUMEXE support."
      : status === "overdue"
        ? "Subscription overdue. Pay with PayHere to unlock POS automatically, or wait for Master Admin."
        : "Your shop is registered. Pay the subscription with PayHere, or wait for Master Admin to confirm payment.";

  const canPay = user?.role === "Admin" && status !== "revoked";

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6 auth-fade">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden auth-slide">
        <div className="bg-slate-950 text-white px-6 py-5">
          <BrandLogo variant="dark" size="md" showTagline />
          <div className="mt-4 flex items-center gap-2 text-amber-300 text-sm font-semibold">
            <ShieldAlert size={16} /> Shop access gate
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <Clock size={22} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{title}</h1>
              <p className="text-sm text-slate-600 mt-1">{body}</p>
              {user?.name && (
                <p className="text-xs text-slate-400 mt-2">
                  Signed in as {user.name} · status: {status}
                </p>
              )}
            </div>
          </div>
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>
          )}
          {msg && (
            <div className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
              {msg}
            </div>
          )}

          {canPay && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div className="text-sm font-bold text-slate-800 inline-flex items-center gap-2">
                <CreditCard size={16} /> Pay with PayHere
              </div>
              {!payhereReady && (
                <p className="text-xs text-amber-800">
                  PayHere is not configured on the server yet. Master Admin can still mark you paid manually.
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIntervalPlan("monthly")}
                  className={`flex-1 h-10 rounded-lg text-sm font-semibold border ${
                    interval === "monthly"
                      ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  Monthly · Rs. 2,000
                </button>
                <button
                  type="button"
                  onClick={() => setIntervalPlan("annual")}
                  className={`flex-1 h-10 rounded-lg text-sm font-semibold border ${
                    interval === "annual"
                      ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  Annual · Rs. 20,000
                </button>
              </div>
              <button
                type="button"
                className="btn btn-primary w-full justify-center"
                disabled={checkoutBusy || !payhereReady}
                onClick={() => void payNow()}
              >
                {checkoutBusy ? "Opening PayHere…" : "Pay now"}
              </button>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" disabled={loading} onClick={() => void refresh()}>
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Check status
            </button>
            <button
              type="button"
              className="btn btn-muted"
              onClick={() => {
                auth.logout();
                navigate("/signin", { replace: true });
              }}
            >
              <LogOut size={16} /> Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
