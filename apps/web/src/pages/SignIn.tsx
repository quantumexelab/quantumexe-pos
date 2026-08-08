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
  Globe,
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
    "w-full h-[52px] rounded-xl bg-[#101826]/90 border border-[#2a3648] text-white placeholder:text-slate-500 pl-11 pr-4 text-base outline-none focus:border-[#2b8cff] focus:ring-1 focus:ring-[#2b8cff]/40 transition";

  const formCard = (
    <div className="w-full max-w-[400px] auth-slide">
      <div className="rounded-2xl border border-white/[0.1] bg-[#0c121c]/95 backdrop-blur-md px-5 sm:px-8 py-7 sm:py-8 shadow-[0_0_80px_rgba(43,140,255,0.22)]">
        {step === "login" ? (
          <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-7">
            <div className="relative shrink-0 w-12 h-12 sm:w-14 sm:h-14">
              <div className="absolute inset-0 rounded-full bg-[#2b8cff]/35 blur-xl" />
              <div className="relative h-full w-full rounded-full bg-[#0d1520] border-2 border-[#2b8cff]/55 grid place-items-center text-[#7ec8ff] shadow-[0_0_24px_rgba(43,140,255,0.35)]">
                <User size={24} strokeWidth={1.6} className="sm:w-[26px] sm:h-[26px]" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl sm:text-[1.85rem] font-bold tracking-tight leading-tight">
                Welcome <span className="text-[#3b9eff]">back!</span>
              </h2>
              <p className="mt-1 text-base text-slate-400">Please log in to continue</p>
            </div>
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
              <label className="text-sm font-semibold text-slate-300">License key</label>
              <input
                className={`${fieldClass} pl-4 mt-1.5`}
                placeholder="QX-xxxx-xxxx-xxxx"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
              />
            </div>
            <button
              className="w-full h-12 rounded-xl font-bold text-white bg-[#2b8cff] hover:bg-[#4a9dff] transition disabled:opacity-60"
              disabled={loading}
            >
              {loading ? t("signin.validating") : t("signin.next")}
            </button>
          </form>
        ) : step === "register" ? (
          <form onSubmit={submitRegister} className="space-y-3">
            {regFields.map(([key, labelKey, type]) => (
              <div key={key}>
                <label className="text-sm font-semibold text-slate-300">{t(labelKey)}</label>
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
              className="w-full h-12 rounded-xl font-bold text-white bg-[#2b8cff] hover:bg-[#4a9dff] transition disabled:opacity-60 mt-2"
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
              <label htmlFor="username" className="text-sm font-semibold text-slate-300">
                Username or Email
              </label>
              <div className="relative mt-1.5">
                <User
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#3b9eff] pointer-events-none"
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
              <label htmlFor="password" className="text-sm font-semibold text-slate-300">
                Password
              </label>
              <div className="relative mt-1.5">
                <Lock
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#3b9eff] pointer-events-none"
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

            <div className="flex items-center justify-between text-sm">
              <label className="inline-flex items-center gap-2 text-slate-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-600 bg-[#101826] text-[#2b8cff] focus:ring-[#2b8cff]/40"
                />
                Remember me
              </label>
              <button
                type="button"
                className="text-[#3b9eff] hover:text-sky-300 font-medium"
                onClick={() => notify.info("Contact your administrator to reset your password.")}
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              className="w-full h-12 rounded-xl font-bold text-white bg-[#2b8cff] hover:bg-[#4a9dff] transition disabled:opacity-60 shadow-[0_10px_28px_rgba(43,140,255,0.4)]"
              disabled={loading}
            >
              {loading ? t("signin.signingIn") : "Log in"}
            </button>

            <p className="text-center text-sm text-slate-400 pt-1">
              Don&apos;t have an account?{" "}
              <button
                type="button"
                className="font-semibold text-[#3b9eff] hover:text-sky-300"
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

      <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-400">
        <Shield size={14} className="text-[#2b8cff]" />
        <span>Secure. Reliable. Scalable.</span>
        <span className="text-slate-500">· v{APP_VERSION}</span>
      </div>
    </div>
  );

  return (
    <div className="relative min-h-[100dvh] bg-black text-white auth-fade lg:h-[100dvh] lg:max-h-[100dvh] lg:overflow-hidden">
      {/*
        Desktop: ~55/45 split — hero left, login right.
        Mobile: stacked scroll — compact hero band, then login.
      */}
      <div className="relative z-10 min-h-[100dvh] grid lg:h-full lg:grid-cols-[minmax(0,1.15fr)_minmax(400px,0.95fr)] lg:min-h-0">
        {/* LEFT — desktop hero; mobile shows compact band */}
        <section className="relative flex flex-col min-h-0 overflow-hidden bg-black lg:h-full">
          <img
            src={`/signin-hero.png?v=${APP_VERSION}`}
            alt=""
            className="absolute top-0 z-0 h-full max-w-none select-none pointer-events-none object-cover object-[center_35%] lg:object-[center_42%]"
            style={{
              width: "145%",
              left: "-8%",
              transform: "translateX(8%)",
            }}
            draggable={false}
          />
          <div
            className="absolute inset-0 z-[2] pointer-events-none"
            style={{
              background:
                "linear-gradient(90deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.18) 22%, transparent 42%), linear-gradient(90deg, transparent 78%, rgba(0,0,0,0.65) 94%, #000 100%), linear-gradient(180deg, rgba(0,0,0,0.35) 0%, transparent 14%, transparent 70%, rgba(0,0,0,0.85) 100%)",
            }}
          />

          {/* Mobile compact hero */}
          <div className="relative z-10 flex flex-col px-5 pt-6 pb-8 min-h-[42vh] sm:min-h-[46vh] lg:hidden">
            <BrandLogo variant="dark" size="md" showTagline />
            <div className="mt-auto max-w-[22rem] pb-2">
              <p className="text-white/90 text-sm font-medium mb-1.5">Welcome to</p>
              <h1 className="font-bold leading-[1.08] tracking-tight">
                <span className="block text-[1.85rem] sm:text-[2.15rem]">
                  <span className="text-white">QUANTUM</span>
                  <span className="text-[#3b9eff]">EXE</span>
                </span>
                <span className="block text-white text-lg sm:text-xl font-semibold mt-0.5">
                  point of sale system
                </span>
              </h1>
              <p className="mt-2.5 text-slate-300 text-sm leading-relaxed">
                Advanced software solutions for a smarter tomorrow.
              </p>
            </div>
          </div>

          {/* Desktop full hero copy */}
          <div className="relative z-10 hidden lg:flex h-full flex-col px-8 xl:px-11 pt-8 pb-6">
            <BrandLogo variant="dark" size="lg" showTagline />

            <div className="auth-slide flex-1 flex flex-col justify-center max-w-[440px] xl:max-w-[520px] py-6">
              <p className="text-white/90 text-xl xl:text-2xl font-medium mb-3">Welcome to</p>
              <h1 className="font-bold leading-[1.02] tracking-tight">
                <span className="block text-[3.25rem] xl:text-[4.5rem]">
                  <span className="text-white">QUANTUM</span>
                  <span className="text-[#3b9eff]">EXE</span>
                </span>
                <span className="block text-white text-[2.15rem] xl:text-[2.75rem] font-semibold mt-1.5">
                  point of sale system
                </span>
              </h1>
              <p className="mt-5 text-slate-300 text-lg xl:text-xl leading-relaxed max-w-[30rem]">
                Advanced software solutions for a smarter tomorrow.
              </p>
              <ul className="mt-10 space-y-5">
                {features.map((f) => (
                  <li key={f.title} className="flex items-center gap-4">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#0d1524]/85 text-[#3b9eff] border border-[#1e3a5f]">
                      <f.icon size={24} />
                    </span>
                    <div>
                      <div className="text-xl font-semibold text-white leading-none">{f.title}</div>
                      <div className="text-base xl:text-lg text-slate-400 mt-2">{f.desc}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <footer className="space-y-1.5 text-[11px] text-slate-400">
              <a
                href={BRAND.siteUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-white/85 hover:text-[#3b9eff] font-medium"
              >
                <Globe size={12} className="text-[#3b9eff]" />
                www.{BRAND.site}
              </a>
              <div>© 2025 {BRAND.name} Pvt.Ltd. All rights reserved.</div>
            </footer>
          </div>
        </section>

        {/* RIGHT / mobile form — scrollable */}
        <section className="relative min-h-0 bg-[#070a10] lg:overflow-y-auto lg:overscroll-contain">
          <div className="min-h-0 flex justify-center items-start lg:items-center px-4 sm:px-6 lg:px-8 xl:px-12 pt-2 pb-8 sm:py-8 lg:py-10 safe-pb lg:min-h-full">
            <div className="w-full max-w-[400px]">
              {/* Mobile feature chips */}
              <ul className="lg:hidden flex flex-wrap gap-2 mb-5">
                {features.map((f) => (
                  <li
                    key={f.title}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#1e3a5f] bg-[#0d1524]/90 px-3 py-1.5 text-xs text-slate-300"
                  >
                    <f.icon size={12} className="text-[#3b9eff]" />
                    {f.title}
                  </li>
                ))}
              </ul>
              {formCard}
              <footer className="lg:hidden mt-6 space-y-1.5 text-center text-[11px] text-slate-500">
                <a
                  href={BRAND.siteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 text-white/80 hover:text-[#3b9eff] font-medium"
                >
                  <Globe size={12} className="text-[#3b9eff]" />
                  www.{BRAND.site}
                </a>
                <div>© 2025 {BRAND.name} Pvt.Ltd. All rights reserved.</div>
              </footer>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
