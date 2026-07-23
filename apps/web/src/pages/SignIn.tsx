import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { auth } from "../api";
import { BrandLogo } from "../components/BrandLogo";

export default function SignIn() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"license" | "login">("login");
  const [licenseKey, setLicenseKey] = useState("");
  const [username, setUsername] = useState("0771234567");
  const [password, setPassword] = useState("123456");
  const [error, setError] = useState("");
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
    try {
      const data = await auth.login(username, password);
      if (!data.success) throw new Error(data.message || "Login failed");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="hidden md:flex flex-col justify-between p-10 bg-slate-950 text-white">
        <div>
          <BrandLogo variant="dark" size="lg" showTagline />
          <div className="mt-3 text-slate-400 text-sm">Developed for modern retail excellence</div>
        </div>
        <div>
          <h1 className="text-4xl font-bold leading-tight">Welcome</h1>
          <p className="mt-3 text-slate-300 max-w-md">
            An advanced point-of-sale platform engineered for modern retail excellence.
          </p>
        </div>
        <div className="text-sm text-slate-500">Version 1.0.1</div>
      </div>

      <div className="flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          <div className="md:hidden mb-6">
            <BrandLogo size="md" showTagline />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            {step === "license" ? "Enter your license key" : "Sign in"}
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            {step === "license"
              ? "Enter your unique license key to initiate system access."
              : "Use your contact number and password to continue."}
          </p>

          {error && (
            <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>
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
                />
              </div>
              <button className="btn btn-primary w-full" disabled={loading}>
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
