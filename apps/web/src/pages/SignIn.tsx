import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { auth } from "../api";
import { BrandLogo } from "../components/BrandLogo";
import { APP_VERSION } from "../version";

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
      setMsg(
        "Registered successfully. You can sign in now, but POS unlocks only after Master Admin confirms payment."
      );
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
    step === "license" ? "Enter your license key" : step === "register" ? "Register your shop" : "Sign in";
  const subtitle =
    step === "license"
      ? "Enter your unique license key to initiate system access."
      : step === "register"
        ? "Create your Super Admin account. Master Admin must confirm payment before POS unlocks."
        : "Use your contact number and password — or Master Admin credentials.";

  return (
    <div className="min-h-screen grid md:grid-cols-2 auth-fade">
      <div className="hidden md:flex flex-col justify-between p-10 bg-slate-950 text-white">
        <div>
          <BrandLogo variant="dark" size="lg" showTagline />
          <div className="mt-3 text-slate-400 text-sm">Developed for modern retail excellence</div>
        </div>
        <div className="auth-slide">
          <h1 className="text-4xl font-bold leading-tight">Welcome</h1>
          <p className="mt-3 text-slate-300 max-w-md">
            An advanced point-of-sale platform engineered for modern retail excellence.
          </p>
        </div>
        <div className="text-sm text-slate-500">Version {APP_VERSION}</div>
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
                {loading ? "Validating..." : "Next"}
              </button>
            </form>
          ) : step === "register" ? (
            <form onSubmit={submitRegister} className="space-y-3">
              {(
                [
                  ["shopName", "Shop name", "text"],
                  ["ownerName", "Owner name", "text"],
                  ["phone", "Contact number (login)", "tel"],
                  ["email", "Email", "email"],
                  ["password", "Password", "password"],
                  ["address", "Address", "text"],
                  ["city", "City", "text"],
                  ["nic", "NIC", "text"],
                  ["businessRegNo", "Business reg. no", "text"],
                ] as const
              ).map(([key, label, type]) => (
                <div key={key}>
                  <label className="text-xs font-semibold text-gray-600">{label}</label>
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
                {loading ? "Registering..." : "Create shop account"}
              </button>
              <button
                type="button"
                className="w-full text-sm font-semibold text-emerald-700 hover:underline"
                onClick={() => {
                  setError("");
                  setStep("login");
                }}
              >
                Already have an account? Sign in
              </button>
            </form>
          ) : (
            <form onSubmit={submitLogin} className="space-y-4">
              <div>
                <label htmlFor="username" className="text-xs font-semibold text-gray-600">
                  Username
                </label>
                <input
                  id="username"
                  className="input mt-1"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Phone or master"
                  autoComplete="username"
                />
              </div>
              <div>
                <label htmlFor="password" className="text-xs font-semibold text-gray-600">
                  Password
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
                {loading ? "Signing in..." : "Sign in"}
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
                No account? Register your shop
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
