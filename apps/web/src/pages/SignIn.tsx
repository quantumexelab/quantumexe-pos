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
    "w-full h-12 rounded-xl bg-[#101826] border border-[#2a3648] text-white placeholder:text-slate-500 pl-11 pr-4 text-sm outline-none focus:border-[#2b8cff] focus:ring-1 focus:ring-[#2b8cff]/40 transition";

  return (
    <div className="h-[100dvh] max-h-[100dvh] grid lg:grid-cols-2 overflow-hidden auth-fade bg-black text-white">
      {/* LEFT — mockup: copy left | hero right */}
      <aside className="hidden lg:flex relative flex-col min-h-0 overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 72% 42%, rgba(43,140,255,0.32), transparent 40%), #000000",
          }}
        />
        <div className="absolute top-16 left-8 text-[140px] font-black text-white/[0.03] leading-none select-none pointer-events-none">
          QE
        </div>

        <div className="relative z-10 flex flex-col h-full px-8 xl:px-12 pt-8 pb-6">
          <BrandLogo variant="dark" size="md" showTagline />

          <div className="auth-slide flex-1 grid grid-cols-[minmax(0,1fr)_minmax(240px,48%)] gap-4 xl:gap-8 items-center min-h-0 py-6">
            {/* Copy column */}
            <div className="min-w-0 self-center">
              <p className="text-[#3b9eff] text-sm font-semibold mb-2">Welcome to</p>
              <h1 className="text-[1.65rem] xl:text-[2.05rem] font-bold leading-[1.15] tracking-tight">
                <span className="text-[#3b9eff]">{BRAND.name}</span>
                <span className="text-white"> point of sale system</span>
              </h1>
              <p className="mt-3 text-slate-400 text-[13px] xl:text-sm leading-relaxed max-w-[280px]">
                Advanced software solutions for a smarter tomorrow.
              </p>
              <ul className="mt-7 space-y-4">
                {features.map((f) => (
                  <li key={f.title} className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0d1524] text-[#3b9eff] border border-[#1c2f4a]">
                      <f.icon size={16} />
                    </span>
                    <div>
                      <div className="text-[13px] font-semibold text-white leading-none">{f.title}</div>
                      <div className="text-[11px] text-slate-400 mt-1">{f.desc}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Hero: restored girl + phone; hard-fade every edge so no box corners */}
            <div className="relative h-full min-h-[360px] max-h-[min(72vh,560px)] flex items-end justify-center overflow-hidden">
              <div
                className="relative h-full w-full max-w-[420px] mx-auto"
                style={{
                  WebkitMaskImage:
                    "linear-gradient(to right, transparent 0%, #000 12%, #000 88%, transparent 100%), linear-gradient(to bottom, transparent 0%, #000 10%, #000 90%, transparent 100%)",
                  WebkitMaskComposite: "source-in",
                  maskImage:
                    "linear-gradient(to right, transparent 0%, #000 12%, #000 88%, transparent 100%), linear-gradient(to bottom, transparent 0%, #000 10%, #000 90%, transparent 100%)",
                  maskComposite: "intersect",
                }}
              >
                <img
                  src="/signin-hero.png"
                  alt=""
                  className="absolute inset-0 z-[1] h-full w-full object-contain object-bottom select-none pointer-events-none"
                  draggable={false}
                />
                <img
                  src="/signin-phone.png"
                  alt=""
                  className="absolute z-[2] left-1/2 -translate-x-1/2 bottom-[2%] w-[34%] max-w-[130px] select-none pointer-events-none drop-shadow-[0_12px_28px_rgba(43,140,255,0.45)]"
                  style={{
                    WebkitMaskImage:
                      "radial-gradient(ellipse 90% 90% at 50% 50%, #000 55%, transparent 85%)",
                    maskImage:
                      "radial-gradient(ellipse 90% 90% at 50% 50%, #000 55%, transparent 85%)",
                  }}
                  draggable={false}
                />
              </div>
              {/* Corner killers — solid black fades on all 4 sides */}
              <div className="pointer-events-none absolute inset-0 z-[3]" style={{ background: "linear-gradient(to right, #000 0%, transparent 14%, transparent 86%, #000 100%)" }} />
              <div className="pointer-events-none absolute inset-0 z-[3]" style={{ background: "linear-gradient(to bottom, #000 0%, transparent 12%, transparent 88%, #000 100%)" }} />
            </div>
          </div>

          <footer className="space-y-1 text-[11px] text-slate-500">
            <a
              href={BRAND.siteUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-white/80 hover:text-[#3b9eff] font-medium"
            >
              <Globe size={12} className="text-[#3b9eff]" />
              www.{BRAND.site}
            </a>
            <div>© 2025 {BRAND.name} Pvt.Ltd. All rights reserved.</div>
          </footer>
        </div>
      </aside>

      {/* RIGHT — login card */}
      <div className="min-h-0 h-[100dvh] lg:h-auto overflow-y-auto overscroll-contain relative">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 85% 50% at 50% -5%, rgba(43,140,255,0.3), transparent 55%), #000000",
          }}
        />
        <div className="relative z-10 min-h-full flex justify-center px-5 sm:px-8 py-10 safe-pb">
          <div className="w-full max-w-[400px] auth-slide my-auto">
            <div className="lg:hidden mb-8">
              <BrandLogo variant="dark" size="md" showTagline />
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-[#0c121c] px-6 sm:px-8 py-8 shadow-[0_0_90px_rgba(43,140,255,0.2)]">
              {step === "login" ? (
                <div className="flex items-center gap-4 mb-7">
                  <div className="relative shrink-0 w-14 h-14">
                    <div className="absolute inset-0 rounded-full bg-[#2b8cff]/35 blur-xl" />
                    <div className="relative h-full w-full rounded-full bg-[#0d1520] border-2 border-[#2b8cff]/55 grid place-items-center text-[#7ec8ff] shadow-[0_0_24px_rgba(43,140,255,0.35)]">
                      <User size={26} strokeWidth={1.6} />
                    </div>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold tracking-tight leading-tight">
                      Welcome <span className="text-[#3b9eff]">back!</span>
                    </h2>
                    <p className="mt-1 text-sm text-slate-400">Please log in to continue</p>
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
                    <label className="text-xs font-semibold text-slate-300">License key</label>
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
                    <label htmlFor="username" className="text-xs font-semibold text-slate-300">
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
                    <label htmlFor="password" className="text-xs font-semibold text-slate-300">
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
                      onClick={() =>
                        notify.info("Contact your administrator to reset your password.")
                      }
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

            <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-500">
              <Shield size={14} className="text-[#2b8cff]" />
              <span>Secure. Reliable. Scalable.</span>
              <span className="text-slate-600">· v{APP_VERSION}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
