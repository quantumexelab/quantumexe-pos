import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Eye,
  EyeOff,
  User,
  Lock,
  Shield,
  Zap,
  BarChart3,
} from "lucide-react";
import api, { auth } from "../api";
import { BrandLogo, BRAND } from "../components/BrandLogo";
import { APP_VERSION } from "../version";
import { useI18n } from "../i18n";
import { notify, useBusyOverlay } from "../notify";
import { ErrorBox, SuccessBox } from "../components/ui";

type Step = "license" | "login" | "register";

const emptyReg = {
  shopName: "",
  ownerName: "",
  phone: "",
  email: "",
  password: "",
  address: "",
  city: "",
  nic: "",
  businessRegNo: "",
};

const REMEMBER_KEY = "qx_signin_remember";

export default function SignIn() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [step, setStep] = useState<Step>("login");
  const [licenseKey, setLicenseKey] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [reg, setReg] = useState(emptyReg);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  useBusyOverlay(
    loading,
    step === "register" ? "Creating account…" : step === "license" ? "Validating…" : "Signing in…"
  );

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        setUsername(saved);
        setRemember(true);
      }
    } catch {
      /* ignore */
    }
    api
      .get("/setup/check-env")
      .then((r) => {
        if (!r.data?.license) setStep("license");
        else setStep("login");
      })
      .catch(() => setStep("login"));
  }, []);

  async function submitLicense(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post("/license/validate", { license_key: licenseKey });
      if (!data.success) throw new Error(data.message || "Invalid license");
      setStep("login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "License failed");
    } finally {
      setLoading(false);
    }
  }

  async function submitLogin(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMsg("");
    try {
      const data = await auth.login(username, password);
      if (!data.success) throw new Error(data.message || "Login failed");
      try {
        if (remember) localStorage.setItem(REMEMBER_KEY, username.trim());
        else localStorage.removeItem(REMEMBER_KEY);
      } catch {
        /* ignore */
      }
      const role = data.user?.role;
      const shopStatus = data.user?.shop_status || "active";
      if (role === "MasterAdmin") {
        notify.success("Welcome, Master Admin");
        navigate("/master", { replace: true });
        return;
      }
      if (shopStatus === "pending" || shopStatus === "revoked" || shopStatus === "overdue") {
        navigate("/pending-access", { replace: true });
        return;
      }
      notify.success("Signed in");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const ax = err as { response?: { data?: { message?: string } }; code?: string; message?: string };
      const message =
        ax.response?.data?.message ||
        ax.message ||
        (ax.code === "ECONNABORTED" ? "Login timed out — check internet / try again" : "Login failed");
      setError(message);
      notify.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function submitRegister(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMsg("");
    try {
      const { data } = await api.post("/auth/register", reg, { timeout: 120000 });
      if (!data.success) throw new Error(data.message || "Registration failed");
      setMsg(t("signin.registeredMsg"));
      setUsername(reg.phone);
      setPassword(reg.password);
      setStep("login");
    } catch (err) {
      const ax = err as { response?: { data?: { message?: string } }; message?: string };
      setError(ax.response?.data?.message || ax.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  const title =
    step === "license"
      ? t("signin.titleLicense")
      : step === "register"
        ? t("signin.titleRegister")
        : null;
  const subtitle =
    step === "license"
      ? t("signin.subLicense")
      : step === "register"
        ? t("signin.subRegister")
        : null;

  const regFields = [
    ["shopName", "signin.shopName", "text"],
    ["ownerName", "signin.ownerName", "text"],
    ["phone", "signin.phone", "tel"],
    ["email", "signin.email", "email"],
    ["password", "signin.password", "password"],
    ["address", "signin.address", "text"],
    ["city", "signin.city", "text"],
    ["nic", "signin.nic", "text"],
    ["businessRegNo", "signin.businessRegNo", "text"],
  ] as const;

  const features = [
    { icon: Shield, title: "Secure", desc: "Enterprise grade security" },
    { icon: Zap, title: "Fast", desc: "Optimized for performance" },
    { icon: BarChart3, title: "Reliable", desc: "Built for scalability" },
  ];

  const fieldClass =
    "w-full h-12 rounded-xl bg-[#0b1220] border border-[#1e2a3a] text-white placeholder:text-slate-500 pl-11 pr-4 text-sm outline-none focus:border-sky-500/70 focus:ring-1 focus:ring-sky-500/40 transition";

  return (
    <div className="h-[100dvh] max-h-[100dvh] grid lg:grid-cols-2 overflow-hidden auth-fade bg-black text-white">
      {/* —— Left: brand panel (matches design mockup) —— */}
      <aside className="hidden lg:flex relative flex-col min-h-0 overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 55% 50% at 72% 42%, rgba(14,165,233,0.28), transparent 58%), radial-gradient(ellipse 40% 35% at 20% 70%, rgba(56,189,248,0.08), transparent 50%), #000000",
          }}
        />
        <div className="relative z-10 flex flex-col h-full px-10 xl:px-14 pt-10 pb-8">
          <BrandLogo variant="dark" size="md" showTagline />

          <div className="auth-slide flex-1 grid grid-cols-[1fr_minmax(220px,46%)] gap-6 xl:gap-10 items-center min-h-0 py-8">
            <div className="min-w-0">
              <h1 className="text-[1.85rem] xl:text-[2.35rem] font-bold leading-[1.15] tracking-tight">
                Welcome to{" "}
                <span className="text-sky-400">{BRAND.name}</span> PVT.LTD.
              </h1>
              <p className="mt-4 text-slate-400 text-sm xl:text-[15px] leading-relaxed max-w-sm">
                Advanced software solutions for a smarter tomorrow.
              </p>
              <ul className="mt-8 space-y-4">
                {features.map((f) => (
                  <li key={f.title} className="flex items-center gap-3.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/25">
                      <f.icon size={18} />
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-white leading-none">{f.title}</div>
                      <div className="text-xs text-slate-400 mt-1">{f.desc}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Hero + phone composite */}
            <div className="relative h-full min-h-[320px] max-h-[min(58vh,520px)] flex items-end justify-center">
              <div className="absolute left-1/2 top-[18%] -translate-x-1/2 w-[85%] h-[70%] rounded-full bg-sky-500/25 blur-[70px] pointer-events-none" />
              <img
                src="/signin-hero.png"
                alt=""
                className="relative z-[1] h-[92%] w-auto max-w-none object-contain object-bottom drop-shadow-[0_20px_50px_rgba(0,0,0,0.65)] select-none pointer-events-none"
                draggable={false}
              />
              <img
                src="/signin-phone.png"
                alt=""
                className="absolute z-[2] right-[2%] bottom-[4%] w-[38%] max-w-[150px] drop-shadow-[0_18px_40px_rgba(14,165,233,0.45)] select-none pointer-events-none"
                draggable={false}
              />
            </div>
          </div>

          <footer className="text-[11px] text-slate-500 space-y-1">
            <a
              href={BRAND.siteUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sky-400 hover:text-sky-300 font-medium"
            >
              www.{BRAND.site}
            </a>
            <div>
              © 2025 {BRAND.name} Pvt.Ltd. All rights reserved.
            </div>
          </footer>
        </div>
      </aside>

      {/* —— Right: login card —— */}
      <div className="min-h-0 h-[100dvh] lg:h-auto overflow-y-auto overscroll-contain relative">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 80% 55% at 50% -10%, rgba(14,165,233,0.22), transparent 55%), #020617",
          }}
        />
        <div className="relative z-10 min-h-full flex justify-center px-5 sm:px-8 py-10 sm:py-14 safe-pb">
          <div className="w-full max-w-[400px] auth-slide my-auto">
            <div className="lg:hidden mb-8">
              <BrandLogo variant="dark" size="md" showTagline />
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-[#0a1018]/95 backdrop-blur-md px-6 sm:px-8 py-8 shadow-[0_0_80px_rgba(14,165,233,0.14)]">
              {step === "login" ? (
                <div className="text-center mb-8">
                  <div className="mx-auto mb-5 relative w-[68px] h-[68px]">
                    <div className="absolute inset-0 rounded-full bg-sky-500/35 blur-2xl" />
                    <div className="relative h-full w-full rounded-full bg-[#0d1520] border-2 border-sky-500/50 grid place-items-center text-sky-300 shadow-[0_0_24px_rgba(14,165,233,0.35)]">
                      <User size={30} strokeWidth={1.6} />
                    </div>
                  </div>
                  <h2 className="text-[1.65rem] font-bold tracking-tight">
                    Welcome <span className="text-sky-400">back!</span>
                  </h2>
                  <p className="mt-2 text-sm text-slate-400">Please log in to continue</p>
                </div>
              ) : (
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-white">{title}</h2>
                  {subtitle && <p className="mt-1.5 text-sm text-slate-400">{subtitle}</p>}
                </div>
              )}

              {error && (
                <div className="mb-4">
                  <ErrorBox text={error} toast={false} />
                </div>
              )}
              {msg && (
                <div className="mb-4">
                  <SuccessBox text={msg} />
                </div>
              )}

              {step === "license" ? (
                <form onSubmit={submitLicense} className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-300">License key</label>
                    <input
                      className={`${fieldClass} pl-4 mt-1.5`}
                      placeholder="QX-xxxx-xxxx-xxxx"
                      value={licenseKey}
                      onChange={(e) => setLicenseKey(e.target.value)}
                    />
                  </div>
                  <button
                    className="w-full h-12 rounded-xl font-bold text-white bg-[#0ea5e9] hover:bg-sky-400 transition disabled:opacity-60"
                    disabled={loading}
                  >
                    {loading ? t("signin.validating") : t("signin.next")}
                  </button>
                </form>
              ) : step === "register" ? (
                <form onSubmit={submitRegister} className="space-y-3">
                  {regFields.map(([key, labelKey, type]) => (
                    <div key={key}>
                      <label className="text-xs font-semibold text-slate-300">{t(labelKey)}</label>
                      {key === "password" ? (
                        <div className="relative mt-1.5">
                          <input
                            className={`${fieldClass} pr-11 pl-4`}
                            type={showRegPassword ? "text" : "password"}
                            required
                            value={reg.password}
                            onChange={(e) => setReg((r) => ({ ...r, password: e.target.value }))}
                            autoComplete="new-password"
                          />
                          <button
                            type="button"
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-slate-400 hover:text-white"
                            aria-label={showRegPassword ? "Hide password" : "Show password"}
                            onClick={() => setShowRegPassword((v) => !v)}
                          >
                            {showRegPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      ) : (
                        <input
                          className={`${fieldClass} pl-4 mt-1.5`}
                          type={type}
                          required={!["address", "city", "nic", "businessRegNo"].includes(key)}
                          value={reg[key]}
                          onChange={(e) => setReg((r) => ({ ...r, [key]: e.target.value }))}
                        />
                      )}
                    </div>
                  ))}
                  <button
                    className="w-full h-12 rounded-xl font-bold text-white bg-[#0ea5e9] hover:bg-sky-400 transition disabled:opacity-60 mt-2"
                    disabled={loading}
                  >
                    {loading ? t("signin.registering") : t("signin.createAccount")}
                  </button>
                  <button
                    type="button"
                    className="w-full text-sm text-slate-400 hover:text-sky-300 pt-1"
                    onClick={() => {
                      setError("");
                      setStep("login");
                    }}
                  >
                    {t("signin.haveAccount")}
                  </button>
                </form>
              ) : (
                <form onSubmit={submitLogin} className="space-y-4">
                  <div>
                    <label htmlFor="username" className="text-xs font-semibold text-slate-300">
                      Username or Email
                    </label>
                    <div className="relative mt-1.5">
                      <User
                        size={16}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
                      />
                      <input
                        id="username"
                        className={fieldClass}
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Enter your username or email"
                        autoComplete="username"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="password" className="text-xs font-semibold text-slate-300">
                      Password
                    </label>
                    <div className="relative mt-1.5">
                      <Lock
                        size={16}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
                      />
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        className={`${fieldClass} pr-11`}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-slate-400 hover:text-white"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        onClick={() => setShowPassword((v) => !v)}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm pt-0.5">
                    <label className="inline-flex items-center gap-2 text-slate-400 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={remember}
                        onChange={(e) => setRemember(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-600 bg-[#0b1220] text-sky-500 focus:ring-sky-500/40"
                      />
                      Remember me
                    </label>
                    <button
                      type="button"
                      className="text-sky-400 hover:text-sky-300 font-medium"
                      onClick={() =>
                        notify.info("Contact your administrator to reset your password.")
                      }
                    >
                      Forgot password?
                    </button>
                  </div>

                  <button
                    type="submit"
                    className="w-full h-12 rounded-xl font-bold text-white bg-[#0ea5e9] hover:bg-sky-400 active:bg-sky-600 transition disabled:opacity-60 shadow-[0_10px_28px_rgba(14,165,233,0.4)]"
                    disabled={loading}
                  >
                    {loading ? t("signin.signingIn") : "Log in"}
                  </button>

                  {/* No Google / social login — design without Continue with Google */}

                  <p className="text-center text-sm text-slate-400 pt-2">
                    Don&apos;t have an account?{" "}
                    <button
                      type="button"
                      className="font-semibold text-sky-400 hover:text-sky-300"
                      onClick={() => {
                        setError("");
                        setMsg("");
                        setStep("register");
                      }}
                    >
                      Contact your administrator
                    </button>
                  </p>
                </form>
              )}
            </div>

            <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-500">
              <Shield size={14} className="text-sky-500" />
              <span>Secure. Reliable. Scalable.</span>
              <span className="text-slate-600">· v{APP_VERSION}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
