import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, LogOut, RefreshCw, ShieldAlert } from "lucide-react";
import api, { auth } from "../api";
import { BrandLogo } from "../components/BrandLogo";

export default function PendingAccess() {
  const navigate = useNavigate();
  const user = auth.getUser() as { name?: string; shop_status?: string; role?: string } | null;
  const [status, setStatus] = useState(user?.shop_status || "pending");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
    const t = setInterval(() => void refresh(), 20_000);
    return () => clearInterval(t);
  }, []);

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
        ? "Monthly payment is overdue. POS stays locked until Master Admin confirms payment."
        : "Your shop is registered. POS unlocks after Master Admin confirms your payment.";

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
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary"
              disabled={loading}
              onClick={() => void refresh()}
            >
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
