import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { auth } from "../api";
import { BrandLogo } from "../components/BrandLogo";
import { APP_VERSION } from "../version";
import { useI18n } from "../i18n";

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

export default function SignIn() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [step, setStep] = useState<Step>("login");
  const [licenseKey, setLicenseKey] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [reg, setReg] = useState(emptyReg);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
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
      const role = data.user?.role;
      const shopStatus = data.user?.shop_status || "active";
      if (role === "MasterAdmin") {
        navigate("/master", { replace: true });
        return;
      }
      if (shopStatus === "pending" || shopStatus === "revoked" || shopStatus === "overdue") {
        navigate("/pending-access", { replace: true });
        return;
      }
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const ax = err as { response?: { data?: { message?: string } }; message?: string };
      setError(ax.response?.data?.message || ax.message || "Login failed");
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
      const { data } = await api.post("/auth/register", reg);
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
        : t("signin.titleLogin");
  const subtitle =
    step === "license"
      ? t("signin.subLicense")
      : step === "register"
        ? t("signin.subRegister")
        : t("signin.subLogin");

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

  return (
    <div className="min-h-screen grid md:grid-cols-2 auth-fade">
      <div className="hidden md:flex flex-col justify-between p-10 bg-slate-950 text-white">
        <div>
          <BrandLogo variant="dark" size="lg" showTagline />
          <div className="mt-3 text-slate-400 text-sm">{t("signin.developed")}</div>
        </div>
        <div className="auth-slide">
          <h1 className="text-4xl font-bold leading-tight">{t("signin.welcome")}</h1>
          <p className="mt-3 text-slate-300 max-w-md">{t("signin.tagline")}</p>
        </div>
        <div className="text-sm text-slate-500">
          {t("common.version")} {APP_VERSION}
        </div>
      </div>

      <div className="flex items-center justify-center p-8 bg-white overflow-y-auto">
        <div className="w-full max-w-md auth-slide">
          <div className="md:hidden mb-6">
            <BrandLogo size="md" showTagline />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">{title}</h2>
          <p className="text-sm text-gray-500 mb-6">{subtitle}</p>

          {error && (
            <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          {msg && (
            <div className="mb-4 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
              {msg}
            </div>
          )}

          {step === "license" ? (
            <form onSubmit={submitLicense} className="space-y-4">
              <input
                className="input"
                placeholder="QX-xxxx-xxxx-xxxx"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
              />
              <button className="btn btn-primary w-full" disabled={loading}>
                {loading ? t("signin.validating") : t("signin.next")}
              </button>
            </form>
          ) : step === "register" ? (
            <form onSubmit={submitRegister} className="space-y-3">
              {regFields.map(([key, labelKey, type]) => (
                <div key={key}>
                  <label className="text-xs font-semibold text-gray-600">{t(labelKey)}</label>
                  <input
                    className="input mt-1"
                    type={type}
                    required={!["address", "city", "nic", "businessRegNo"].includes(key)}
                    value={reg[key]}
                    onChange={(e) => setReg((r) => ({ ...r, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <button className="btn btn-primary w-full" disabled={loading}>
                {loading ? t("signin.registering") : t("signin.createAccount")}
              </button>
              <button
                type="button"
                className="w-full text-sm font-semibold text-emerald-700 hover:underline"
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
                <label htmlFor="username" className="text-xs font-semibold text-gray-600">
                  {t("signin.username")}
                </label>
                <input
                  id="username"
                  className="input mt-1"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t("signin.usernamePlaceholder")}
                  autoComplete="username"
                />
              </div>
              <div>
                <label htmlFor="password" className="text-xs font-semibold text-gray-600">
                  {t("signin.password")}
                </label>
                <input
                  id="password"
                  type="password"
                  className="input mt-1"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <button className="btn btn-primary w-full" disabled={loading}>
                {loading ? t("signin.signingIn") : t("signin.signIn")}
              </button>
              <button
                type="button"
                className="w-full text-sm font-semibold text-emerald-700 hover:underline"
                onClick={() => {
                  setError("");
                  setMsg("");
                  setStep("register");
                }}
              >
                {t("signin.registerCta")}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
