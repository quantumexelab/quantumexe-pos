import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  CheckCircle2,
  KeyRound,
  LogOut,
  RefreshCw,
  ShieldOff,
  Wallet,
} from "lucide-react";
import api, { auth } from "../api";
import { BrandLogo } from "../components/BrandLogo";
import { ErrorBox } from "../components/ui";

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
};

function formatWhen(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export default function MasterAdmin() {
  const navigate = useNavigate();
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [selected, setSelected] = useState<Shop | null>(null);
  const [filter, setFilter] = useState("");
  const [pwdForm, setPwdForm] = useState({ currentPassword: "", newPassword: "" });
  const [resetPwd, setResetPwd] = useState("");
  const [busy, setBusy] = useState(false);
  const [fbForm, setFbForm] = useState({
    firebaseProjectId: "",
    firebaseClientEmail: "",
    firebasePrivateKey: "",
  });

  async function load() {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/master/shops");
      setShops(data?.data || []);
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

  const stats = useMemo(() => {
    return {
      total: shops.length,
      pending: shops.filter((s) => s.status === "pending").length,
      active: shops.filter((s) => s.status === "active").length,
      blocked: shops.filter((s) => s.status === "revoked" || s.status === "overdue").length,
    };
  }, [shops]);

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
      if (selected) {
        const updated = (await api.get("/master/shops")).data?.data?.find(
          (s: Shop) => s.shopId === selected.shopId
        );
        setSelected(updated || null);
        if (updated) {
          setFbForm({
            firebaseProjectId: updated.firebaseProjectId || "",
            firebaseClientEmail: updated.firebaseClientEmail || "",
            firebasePrivateKey: "",
          });
        }
      }
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string } }; message?: string };
      setError(ax.response?.data?.message || ax.message || "Action failed");
    } finally {
      setBusy(false);
    }
  }

  function selectShop(s: Shop) {
    setSelected(s);
    setFbForm({
      firebaseProjectId: s.firebaseProjectId || "",
      firebaseClientEmail: s.firebaseClientEmail || "",
      firebasePrivateKey: "",
    });
  }

  async function changeMasterPassword(e: FormEvent) {
    e.preventDefault();
    await act("/master/password", pwdForm, "Master password updated");
    setPwdForm({ currentPassword: "", newPassword: "" });
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-100 auth-fade">
      <div className="bg-slate-950 text-white">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-3">
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
      </div>

      <div className="max-w-7xl mx-auto px-4 py-5 space-y-4">
        {error && <ErrorBox text={error} />}
        {msg && (
          <div className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
            {msg}
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            ["Total shops", stats.total, "bg-white"],
            ["Pending approval", stats.pending, "bg-amber-50"],
            ["Active", stats.active, "bg-emerald-50"],
            ["Blocked", stats.blocked, "bg-red-50"],
          ].map(([label, value, bg]) => (
            <div key={label as string} className={`rounded-xl border border-slate-200 ${bg} p-4`}>
              <div className="text-2xl font-bold text-slate-900">{value as number}</div>
              <div className="text-xs font-semibold text-slate-600 mt-1">{label as string}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-bold text-slate-900">Shops</div>
                <div className="text-xs text-slate-500">Select a shop to approve payment / manage access</div>
              </div>
              <input
                className="input max-w-xs"
                placeholder="Search shop, owner, phone…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="table text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500">
                    <th className="px-4 py-2">Shop</th>
                    <th className="px-4 py-2">Owner</th>
                    <th className="px-4 py-2">Phone</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Next due</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr
                      key={s.shopId}
                      onClick={() => selectShop(s)}
                      className={`cursor-pointer border-t border-slate-50 hover:bg-emerald-50/40 ${
                        selected?.shopId === s.shopId ? "bg-emerald-50" : ""
                      }`}
                    >
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        {s.shopName}
                        {s.firebaseConfigured ? (
                          <span className="ml-2 text-[10px] font-bold text-sky-600">FB</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">{s.ownerName}</td>
                      <td className="px-4 py-3">{s.phone}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                            s.status === "active"
                              ? "bg-emerald-100 text-emerald-700"
                              : s.status === "pending"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-red-100 text-red-700"
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatWhen(s.nextDueAt)}</td>
                    </tr>
                  ))}
                  {!filtered.length && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                        {loading ? "Loading…" : "No shops yet — waiting for registrations"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-sky-200 bg-white p-4 space-y-3">
              <div className="text-sm font-bold text-slate-900">New shop — Firebase setup (step by step)</div>
              <ol className="list-decimal pl-4 space-y-2 text-xs text-slate-700 leading-relaxed">
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
                  with your Google account → <strong>Add project</strong> (one project = one shop).
                </li>
                <li>
                  In that project: <strong>Build → Firestore Database → Create database</strong> (start in
                  production or test mode).
                </li>
                <li>
                  Go to <strong>Project settings → Service accounts → Generate new private key</strong>.
                  Download the JSON file.
                </li>
                <li>
                  Select the shop on the left → fill below:
                  <ul className="list-disc pl-4 mt-1 space-y-0.5 text-slate-600">
                    <li>
                      <strong>Project ID</strong> — from JSON <code className="bg-slate-100 px-1 rounded">project_id</code>
                    </li>
                    <li>
                      <strong>Client email</strong> —{" "}
                      <code className="bg-slate-100 px-1 rounded">client_email</code>
                    </li>
                    <li>
                      <strong>Private key</strong> — paste{" "}
                      <code className="bg-slate-100 px-1 rounded">private_key</code> OR paste the{" "}
                      <strong>full JSON</strong> file contents
                    </li>
                  </ul>
                </li>
                <li>
                  Click <strong>Save &amp; provision DB</strong> (creates Admin user + roles in that shop DB).
                </li>
                <li>
                  Then click <strong>Confirm payment &amp; approve</strong> so the shop can log in to POS.
                </li>
              </ol>
              <p className="text-[11px] text-slate-500 border-t border-slate-100 pt-2">
                Master registry / Master login stays on the control Firebase (server env). Only shop POS data
                uses the project you connect here.
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Building2 size={16} /> Shop detail
              </div>
              {!selected ? (
                <p className="text-sm text-slate-500 mt-3">Select a shop from the list.</p>
              ) : (
                <div className="mt-3 space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      ["Shop", selected.shopName],
                      ["Owner", selected.ownerName],
                      ["Phone", selected.phone],
                      ["Email", selected.email],
                      ["City", selected.city || "—"],
                      ["NIC", selected.nic || "—"],
                      ["Address", selected.address || "—"],
                      ["Biz reg", selected.businessRegNo || "—"],
                      ["Cloud ID", selected.shopId],
                      ["Registered", formatWhen(selected.createdAt)],
                      ["Last paid", formatWhen(selected.lastPaidAt)],
                    ].map(([k, v]) => (
                      <div key={k as string} className="rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-2">
                        <div className="text-[10px] font-semibold text-slate-500">{k}</div>
                        <div className="font-semibold text-slate-800 break-words">{v as string}</div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      disabled={busy}
                      className="btn btn-primary"
                      onClick={() =>
                        void act(
                          `/master/shops/${selected.shopId}/approve`,
                          { paymentNote: "Payment confirmed by Master Admin" },
                          "Approved — payment confirmed, shop unlocked"
                        )
                      }
                    >
                      <CheckCircle2 size={16} /> Confirm payment & approve
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      className="btn btn-muted"
                      onClick={() =>
                        void act(
                          `/master/shops/${selected.shopId}/mark-paid`,
                          { paymentNote: "Monthly payment renewed" },
                          "Payment renewed (+30 days)"
                        )
                      }
                    >
                      <Wallet size={16} /> Mark paid / renew
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      className="h-9 px-3 rounded-lg bg-red-600 text-white text-sm font-semibold inline-flex items-center gap-1.5 hover:bg-red-700"
                      onClick={() =>
                        void act(`/master/shops/${selected.shopId}/revoke`, {}, "Shop access revoked")
                      }
                    >
                      <ShieldOff size={16} /> Revoke access
                    </button>
                  </div>

                  <div className="border-t border-slate-100 pt-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-semibold text-slate-600">Shop Firebase project</div>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          selected.firebaseConfigured
                            ? "bg-sky-100 text-sky-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {selected.firebaseConfigured ? "Connected" : "Not connected"}
                      </span>
                    </div>
                    <input
                      className="input text-xs"
                      placeholder="Firebase Project ID"
                      value={fbForm.firebaseProjectId}
                      onChange={(e) => setFbForm((p) => ({ ...p, firebaseProjectId: e.target.value }))}
                    />
                    <input
                      className="input text-xs"
                      placeholder="Service account client email"
                      value={fbForm.firebaseClientEmail}
                      onChange={(e) => setFbForm((p) => ({ ...p, firebaseClientEmail: e.target.value }))}
                    />
                    <textarea
                      className="input text-xs min-h-[88px] font-mono"
                      placeholder="Private key (or paste full service-account JSON here)"
                      value={fbForm.firebasePrivateKey}
                      onChange={(e) => setFbForm((p) => ({ ...p, firebasePrivateKey: e.target.value }))}
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={
                          busy ||
                          !fbForm.firebaseProjectId.trim() ||
                          !fbForm.firebaseClientEmail.trim() ||
                          !fbForm.firebasePrivateKey.trim()
                        }
                        className="btn btn-primary text-xs"
                        onClick={() =>
                          void act(
                            `/master/shops/${selected.shopId}/firebase`,
                            fbForm,
                            "Firebase connected — shop database ready"
                          )
                        }
                      >
                        Save & provision DB
                      </button>
                      {selected.firebaseConfigured ? (
                        <button
                          type="button"
                          disabled={busy}
                          className="btn btn-muted text-xs"
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
                      ) : null}
                    </div>
                    {selected.firebaseProvisionedAt ? (
                      <div className="text-[11px] text-slate-500">
                        Provisioned {formatWhen(selected.firebaseProvisionedAt)}
                      </div>
                    ) : null}
                  </div>

                  <div className="border-t border-slate-100 pt-3">
                    <div className="text-xs font-semibold text-slate-600 mb-2">Reset Super Admin password</div>
                    <div className="flex gap-2">
                      <input
                        className="input"
                        type="text"
                        placeholder="New password"
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

            <form onSubmit={changeMasterPassword} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="text-sm font-bold text-slate-900">Change Master Admin password</div>
              <input
                className="input"
                type="password"
                placeholder="Current password"
                value={pwdForm.currentPassword}
                onChange={(e) => setPwdForm((p) => ({ ...p, currentPassword: e.target.value }))}
                required
              />
              <input
                className="input"
                type="password"
                placeholder="New password"
                value={pwdForm.newPassword}
                onChange={(e) => setPwdForm((p) => ({ ...p, newPassword: e.target.value }))}
                required
                minLength={6}
              />
              <button className="btn btn-primary" disabled={busy}>
                Update password
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
