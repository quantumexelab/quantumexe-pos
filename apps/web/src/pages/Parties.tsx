import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  CalendarDays,
  Banknote,
  Building2,
  Download,
  Eye,
  FileText,
  FolderOpen,
  History,
  Mail,
  Pencil,
  Phone,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  UserPlus,
  Users,
} from "lucide-react";
import api, { auth } from "../api";
import { ErrorBox, PageHeader, SubNav } from "../components/ui";
import { BrandLogo } from "../components/BrandLogo";

function lkr(n: number) {
  return `LKR ${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function SupplierHome() {
  return (
    <div>
      <PageHeader title="Supplier" />
      <SubNav
        items={[
          { to: "/supplier/manage-supplier", label: "Manage Supplier" },
          { to: "/supplier/create-supplier", label: "Create Supplier" },
          { to: "/supplier/manage-company", label: "Manage Company" },
          { to: "/supplier/supplier-grn", label: "Supplier GRN" },
          { to: "/supplier/supplier-payments", label: "Supplier Payments" },
        ]}
      />
    </div>
  );
}

export function ManageSupplier() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [suppliers, comps] = await Promise.all([
        api.get("/suppliers/list"),
        api.get("/suppliers/companies"),
      ]);
      setRows(suppliers.data.data || []);
      setCompanies(comps.data.data || []);
    } catch (e: any) {
      setError(e.message || "Failed to load suppliers");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const activeCount = useMemo(
    () => rows.filter((r) => (r.status?.name || "Active") === "Active").length,
    [rows]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return rows;
    return rows.filter((r) => {
      const hay = `${r.name || ""} ${r.contact || ""} ${r.email || ""} ${r.company?.name || ""} ${r.bank?.name || ""} ${r.accountNo || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const showingFrom = filtered.length ? (currentPage - 1) * pageSize + 1 : 0;
  const showingTo = Math.min(currentPage * pageSize, filtered.length);

  async function toggleStatus(id: number) {
    await api.put(`/suppliers/update-status/${id}`);
    load();
  }

  const pillColors = [
    "bg-purple-100 text-purple-700",
    "bg-pink-100 text-pink-700",
    "bg-sky-100 text-sky-700",
    "bg-amber-100 text-amber-700",
    "bg-emerald-100 text-emerald-700",
  ];

  function companyPill(name?: string) {
    if (!name) return <span className="text-gray-400">-</span>;
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash + name.charCodeAt(i) * (i + 1)) % pillColors.length;
    return (
      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${pillColors[hash]}`}>
        {name}
      </span>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs text-gray-500 mb-1">Suppliers &gt; Manage Supplier</div>
          <h1 className="text-2xl font-bold text-emerald-700">Manage Suppliers</h1>
        </div>
        <button
          type="button"
          title="Refresh"
          onClick={load}
          className="h-10 w-10 rounded-full border border-gray-200 bg-white text-gray-600 grid place-items-center hover:bg-gray-50"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>
      {error && <ErrorBox text={error} />}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl bg-emerald-600 text-white p-4 relative overflow-hidden">
          <div className="text-xs font-semibold tracking-wide text-emerald-100">TOTAL SUPPLIERS</div>
          <div className="mt-2 text-4xl font-bold">{rows.length}</div>
          <div className="mt-3 flex items-center gap-2 text-xs">
            <Users size={14} />
            <span className="px-2 py-0.5 rounded-full bg-white/15">Real-time</span>
          </div>
          <div className="absolute right-3 bottom-3 opacity-30 text-[10px] font-semibold">CURRENT STATISTICS</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-xs font-semibold tracking-wide text-gray-500">ACTIVE SUPPLIERS</div>
          <div className="mt-2 text-4xl font-bold text-gray-800">{activeCount}</div>
          <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
            <Users size={14} className="text-emerald-600" />
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Overview</span>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-xs font-semibold tracking-wide text-gray-500">TOTAL COMPANIES</div>
          <div className="mt-2 text-4xl font-bold text-gray-800">{companies.length}</div>
          <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
            <Building2 size={14} className="text-emerald-600" />
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Overview</span>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-emerald-600" />
            <div className="text-sm font-bold tracking-wide text-gray-800">SUPPLIER DIRECTORY</div>
          </div>
          <div className="relative w-full sm:w-[360px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-9"
              placeholder="Search suppliers by name, contact or company..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
        <div className="overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-emerald-700 text-white">
                {["NO", "NAME", "EMAIL", "CONTACT", "COMPANY", "BANK", "ACCOUNT", "STATUS", "ACTIONS"].map((h) => (
                  <th key={h} className="text-left font-semibold px-3 py-3 whitespace-nowrap text-xs tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r, idx) => {
                const isActive = (r.status?.name || "Active") === "Active";
                return (
                  <tr key={r.id} className={idx % 2 === 0 ? "bg-white" : "bg-emerald-50/30"}>
                    <td className="px-3 py-3 font-semibold text-gray-700">
                      {(currentPage - 1) * pageSize + idx + 1}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        className="font-bold text-emerald-700 hover:underline"
                        onClick={() => navigate("/supplier/create-supplier", { state: { editId: r.id } })}
                      >
                        {r.name}
                      </button>
                    </td>
                    <td className="px-3 py-3 text-gray-600">
                      {r.email ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Mail size={14} className="text-gray-400" />
                          {r.email}
                        </span>
                      ) : (
                        <Mail size={14} className="text-gray-300" />
                      )}
                    </td>
                    <td className="px-3 py-3 text-gray-700">
                      <span className="inline-flex items-center gap-1.5">
                        <Phone size={14} className="text-gray-400" />
                        {r.contact || "-"}
                      </span>
                    </td>
                    <td className="px-3 py-3">{companyPill(r.company?.name)}</td>
                    <td className="px-3 py-3">
                      {r.bank?.name ? (
                        <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-100 text-sky-700">
                          {r.bank.name}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-3 py-3 text-gray-700">
                      <span className="inline-flex items-center gap-1.5">
                        <FolderOpen size={14} className="text-gray-400" />
                        {r.accountNo || "-"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        title="Toggle status"
                        onClick={() => toggleStatus(r.id)}
                        className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide ${
                          isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {isActive ? "ACTIVE" : "INACTIVE"}
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        title="Edit"
                        className="w-8 h-8 rounded-full bg-sky-500 text-white grid place-items-center hover:bg-sky-600"
                        onClick={() => navigate("/supplier/create-supplier", { state: { editId: r.id } })}
                      >
                        <Pencil size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!pageRows.length && (
                <tr>
                  <td colSpan={9} className="px-3 py-12 text-center text-gray-400">
                    {loading ? "Loading..." : "No suppliers found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-gray-500">
            Showing {showingFrom} to {showingTo} of {filtered.length} results
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="px-3 py-1.5 text-sm rounded-md border border-gray-200 disabled:opacity-40"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .slice(0, 5)
              .map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  className={`w-8 h-8 text-sm rounded-full border ${
                    n === currentPage
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {n}
                </button>
              ))}
            <button
              type="button"
              className="px-3 py-1.5 text-sm rounded-md border border-gray-200 disabled:opacity-40"
              disabled={currentPage >= totalPages || filtered.length === 0}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CreateSupplier() {
  const location = useLocation();
  const [rows, setRows] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const emptyForm = {
    name: "",
    email: "",
    contact: "",
    companyId: "",
    bankId: "",
    accountNo: "",
  };
  const [form, setForm] = useState(emptyForm);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [suppliers, comps, bks] = await Promise.all([
        api.get("/suppliers/list"),
        api.get("/suppliers/companies"),
        api.get("/suppliers/banks"),
      ]);
      const list = suppliers.data.data || [];
      setRows(list);
      setCompanies(comps.data.data || []);
      setBanks(bks.data.data || []);
      return list;
    } catch (e: any) {
      setError(e.message || "Failed to load suppliers");
      return [];
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const editId = (location.state as any)?.editId;
    if (!editId || !rows.length) return;
    const row = rows.find((r) => r.id === editId);
    if (row) startEdit(row);
  }, [location.state, rows]);

  const activeCount = useMemo(
    () => rows.filter((r) => (r.status?.name || "Active") === "Active").length,
    [rows]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return rows;
    return rows.filter((r) => {
      const hay = `${r.name || ""} ${r.contact || ""} ${r.email || ""} ${r.company?.name || ""} ${r.bank?.name || ""} ${r.accountNo || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const showingFrom = filtered.length ? (currentPage - 1) * pageSize + 1 : 0;
  const showingTo = Math.min(currentPage * pageSize, filtered.length);

  function setField(key: keyof typeof emptyForm, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function resetForm() {
    setEditing(null);
    setForm(emptyForm);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setError("");
    const payload = {
      name: form.name.trim(),
      email: form.email.trim() || null,
      contact: form.contact.trim() || null,
      companyId: form.companyId ? Number(form.companyId) : undefined,
      bankId: form.bankId ? Number(form.bankId) : undefined,
      accountNo: form.accountNo.trim() || null,
    };
    try {
      if (editing) {
        await api.put(`/suppliers/update/${editing.id}`, payload);
      } else {
        await api.post("/suppliers/add", payload);
      }
      resetForm();
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Failed to save");
    }
  }

  function startEdit(row: any) {
    setEditing(row);
    setForm({
      name: row.name || "",
      email: row.email || "",
      contact: row.contact || "",
      companyId: row.companyId ? String(row.companyId) : "",
      bankId: row.bankId ? String(row.bankId) : "",
      accountNo: row.accountNo || "",
    });
  }

  async function addCompany() {
    const name = window.prompt("New company name");
    if (!name?.trim()) return;
    const { data } = await api.post("/suppliers/companies", { name: name.trim() });
    const row = data.data;
    await load();
    if (row?.id) setField("companyId", String(row.id));
  }

  async function addBank() {
    const name = window.prompt("New bank name");
    if (!name?.trim()) return;
    const { data } = await api.post("/suppliers/banks", { name: name.trim() });
    const row = data.data;
    await load();
    if (row?.id) setField("bankId", String(row.id));
  }

  function downloadTemplate() {
    const csv = "name,email,contact,company,bank,accountNo\nNANDA TRADINGS,,0707894561,LAUGFS,COMMERCIAL BANK OF CEYLON,000000078\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "supplier-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onImport() {
    await api.post("/suppliers/import");
    alert("Import accepted. Use TEMPLATE CSV format for future uploads.");
  }

  const pillColors = [
    "bg-purple-100 text-purple-700",
    "bg-pink-100 text-pink-700",
    "bg-sky-100 text-sky-700",
    "bg-amber-100 text-amber-700",
    "bg-emerald-100 text-emerald-700",
  ];

  function companyPill(name?: string) {
    if (!name) return <span className="text-gray-400">-</span>;
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash + name.charCodeAt(i) * (i + 1)) % pillColors.length;
    return (
      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${pillColors[hash]}`}>
        {name}
      </span>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs text-gray-500 mb-1">Suppliers &gt; Create Supplier</div>
          <h1 className="text-2xl font-bold text-emerald-700">Create New Supplier</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={downloadTemplate}
            className="h-10 px-4 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 inline-flex items-center gap-2 hover:bg-gray-50"
          >
            <Download size={16} /> TEMPLATE
          </button>
          <button
            type="button"
            onClick={onImport}
            className="h-10 px-4 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 inline-flex items-center gap-2 hover:bg-gray-50"
          >
            <Upload size={16} /> IMPORT
          </button>
        </div>
      </div>
      {error && <ErrorBox text={error} />}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl bg-emerald-600 text-white p-4 relative overflow-hidden">
          <div className="text-xs font-semibold tracking-wide text-emerald-100">TOTAL SUPPLIERS</div>
          <div className="mt-2 text-4xl font-bold">{rows.length}</div>
          <div className="mt-3 flex items-center gap-2 text-xs">
            <Users size={14} />
            <span className="px-2 py-0.5 rounded-full bg-white/15">Real-time</span>
          </div>
          <div className="absolute right-3 bottom-3 opacity-30 text-[10px] font-semibold">CURRENT STATISTICS</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-xs font-semibold tracking-wide text-gray-500">ACTIVE SUPPLIERS</div>
          <div className="mt-2 text-4xl font-bold text-gray-800">{activeCount}</div>
          <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
            <Users size={14} className="text-emerald-600" />
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Overview</span>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-xs font-semibold tracking-wide text-gray-500">TOTAL COMPANIES</div>
          <div className="mt-2 text-4xl font-bold text-gray-800">{companies.length}</div>
          <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
            <Building2 size={14} className="text-emerald-600" />
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Overview</span>
          </div>
        </div>
      </div>

      <form onSubmit={submit} className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 grid place-items-center">
            <UserPlus size={18} />
          </div>
          <div>
            <div className="text-sm font-bold tracking-wide text-gray-800">SUPPLIER INFORMATION</div>
            <div className="text-xs text-gray-500">REGISTER NEW SUPPLY PARTNER</div>
          </div>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr_auto_auto] gap-3 items-end">
          <div>
            <label className="text-[11px] font-semibold text-gray-500">NAME</label>
            <input
              className="input mt-1"
              placeholder="Supplier Name"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-500">EMAIL</label>
            <input
              className="input mt-1"
              placeholder="Email (Optional)"
              type="email"
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-500">CONTACT</label>
            <input
              className="input mt-1"
              placeholder="Contact Number"
              value={form.contact}
              onChange={(e) => setField("contact", e.target.value)}
            />
          </div>
          <div>
            <div className="flex items-center justify-between gap-2">
              <label className="text-[11px] font-semibold text-gray-500">COMPANY</label>
              <button type="button" onClick={addCompany} className="text-[11px] font-bold text-emerald-600 hover:underline">
                + NEW
              </button>
            </div>
            <select className="input mt-1" value={form.companyId} onChange={(e) => setField("companyId", e.target.value)}>
              <option value="">Select Company</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="flex items-center justify-between gap-2">
              <label className="text-[11px] font-semibold text-gray-500">BANK</label>
              <button type="button" onClick={addBank} className="text-[11px] font-bold text-sky-600 hover:underline">
                + NEW
              </button>
            </div>
            <select className="input mt-1" value={form.bankId} onChange={(e) => setField("bankId", e.target.value)}>
              <option value="">Select Bank</option>
              {banks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-500">ACCOUNT</label>
            <input
              className="input mt-1"
              placeholder="Account Number"
              value={form.accountNo}
              onChange={(e) => setField("accountNo", e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary h-[42px] px-5 inline-flex items-center justify-center gap-1 whitespace-nowrap">
            <Plus size={16} /> {editing ? "UPDATE" : "ADD"}
          </button>
          <button
            type="button"
            title="Reset"
            onClick={resetForm}
            className="h-[42px] w-[42px] rounded-full bg-gray-800 text-white grid place-items-center hover:bg-gray-700"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </form>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-emerald-600" />
            <div className="text-sm font-bold tracking-wide text-gray-800">EXISTING SUPPLIERS</div>
          </div>
          <div className="relative w-full sm:w-[360px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-9"
              placeholder="Search suppliers by name, contact or company..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
        <div className="overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-emerald-700 text-white">
                {["NO", "NAME", "EMAIL", "CONTACT", "COMPANY", "BANK", "ACCOUNT", "ACTIONS"].map((h) => (
                  <th key={h} className="text-left font-semibold px-3 py-3 whitespace-nowrap text-xs tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r, idx) => (
                <tr key={r.id} className={idx % 2 === 0 ? "bg-white" : "bg-emerald-50/30"}>
                  <td className="px-3 py-3 font-semibold text-gray-700">
                    {(currentPage - 1) * pageSize + idx + 1}
                  </td>
                  <td className="px-3 py-3 font-bold text-emerald-700">{r.name}</td>
                  <td className="px-3 py-3 text-gray-600">
                    {r.email ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Mail size={14} className="text-gray-400" />
                        {r.email}
                      </span>
                    ) : (
                      <Mail size={14} className="text-gray-300" />
                    )}
                  </td>
                  <td className="px-3 py-3 text-gray-700">
                    <span className="inline-flex items-center gap-1.5">
                      <Phone size={14} className="text-gray-400" />
                      {r.contact || "-"}
                    </span>
                  </td>
                  <td className="px-3 py-3">{companyPill(r.company?.name)}</td>
                  <td className="px-3 py-3 font-medium text-sky-700">{r.bank?.name || "-"}</td>
                  <td className="px-3 py-3 text-gray-700">
                    <span className="inline-flex items-center gap-1.5">
                      <FolderOpen size={14} className="text-gray-400" />
                      {r.accountNo || "-"}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      title="Edit"
                      className="w-8 h-8 rounded-full bg-sky-500 text-white grid place-items-center hover:bg-sky-600"
                      onClick={() => startEdit(r)}
                    >
                      <Pencil size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {!pageRows.length && (
                <tr>
                  <td colSpan={8} className="px-3 py-12 text-center text-gray-400">
                    {loading ? "Loading..." : "No suppliers found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-gray-500">
            Showing {showingFrom} to {showingTo} of {filtered.length} results
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="px-3 py-1.5 text-sm rounded-md border border-gray-200 disabled:opacity-40"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              &lt; Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .slice(0, 5)
              .map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  className={`w-8 h-8 text-sm rounded-full border ${
                    n === currentPage
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {n}
                </button>
              ))}
            <button
              type="button"
              className="px-3 py-1.5 text-sm rounded-md border border-gray-200 disabled:opacity-40"
              disabled={currentPage >= totalPages || filtered.length === 0}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next &gt;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ManageCompany() {
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ name: "", email: "", contact: "" });
  const pageSize = 10;

  async function load() {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/suppliers/companies");
      setRows(data.data || []);
    } catch (e: any) {
      setError(e.message || "Failed to load companies");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return rows;
    return rows.filter((r) => {
      const hay = `${r.name || ""} ${r.email || ""} ${r.contact || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const showingFrom = filtered.length ? (currentPage - 1) * pageSize + 1 : 0;
  const showingTo = Math.min(currentPage * pageSize, filtered.length);

  const activeThisMonth = useMemo(() => {
    const now = new Date();
    return rows.filter((r) => {
      if (!r.createdAt) return true;
      const d = new Date(r.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
  }, [rows]);

  function openAdd() {
    setEditing(null);
    setForm({ name: "", email: "", contact: "" });
    setShowForm(true);
  }

  function openEdit(row: any) {
    setEditing(row);
    setForm({
      name: row.name || "",
      email: row.email || "",
      contact: row.contact || "",
    });
    setShowForm(true);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setError("");
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim() || null,
        contact: form.contact.trim() || null,
      };
      if (editing) {
        await api.put(`/suppliers/companies/${editing.id}`, payload);
      } else {
        await api.post("/suppliers/companies", payload);
      }
      setShowForm(false);
      setEditing(null);
      setForm({ name: "", email: "", contact: "" });
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Failed to save");
    }
  }

  function formatRegistered(value?: string | Date | null) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs text-gray-500 mb-1">Suppliers &gt; Manage Company</div>
          <h1 className="text-2xl font-bold text-gray-900">Company Directory</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            title="Refresh"
            onClick={load}
            className="h-10 w-10 rounded-full bg-sky-500 text-white grid place-items-center hover:bg-sky-600"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <button type="button" onClick={openAdd} className="btn btn-primary h-10 px-4 inline-flex items-center gap-1">
            <Plus size={16} /> ADD COMPANY
          </button>
        </div>
      </div>
      {error && <ErrorBox text={error} />}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl bg-emerald-600 text-white p-4 relative overflow-hidden">
          <div className="text-xs font-semibold tracking-wide text-emerald-100">TOTAL COMPANIES</div>
          <div className="mt-2 text-4xl font-bold">{rows.length}</div>
          <div className="mt-3 flex items-center gap-2 text-xs">
            <Building2 size={14} />
            <span className="px-2 py-0.5 rounded-full bg-white/15">Real-time</span>
          </div>
          <div className="absolute right-3 bottom-3 opacity-30 text-[10px] font-semibold">CURRENT STATISTICS</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-xs font-semibold tracking-wide text-gray-500">ACTIVE THIS MONTH</div>
          <div className="mt-2 text-4xl font-bold text-gray-800">{activeThisMonth}</div>
          <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
            <Building2 size={14} className="text-emerald-600" />
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Overview</span>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-xs font-semibold tracking-wide text-gray-500">SEARCH RESULTS</div>
          <div className="mt-2 text-4xl font-bold text-gray-800">{filtered.length}</div>
          <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
            <Search size={14} className="text-emerald-600" />
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Overview</span>
          </div>
        </div>
      </div>

      {showForm && (
        <form onSubmit={save} className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
          <div className="text-sm font-bold text-gray-800 mb-3">{editing ? "Edit Company" : "Add Company"}</div>
          <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1.2fr_1fr_auto_auto] gap-3 items-end">
            <div>
              <label className="text-xs font-semibold text-gray-600">Company Name</label>
              <input
                className="input mt-1"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Company name"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Email</label>
              <input
                className="input mt-1"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="Email (optional)"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Contact</label>
              <input
                className="input mt-1"
                value={form.contact}
                onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
                placeholder="Contact number"
              />
            </div>
            <button type="submit" className="btn btn-primary h-[42px] px-5">
              {editing ? "Update" : "Save"}
            </button>
            <button
              type="button"
              className="h-[42px] px-4 rounded-lg border border-gray-200 text-gray-700 font-semibold"
              onClick={() => {
                setShowForm(false);
                setEditing(null);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-emerald-600" />
            <div className="text-sm font-bold tracking-wide text-gray-800">COMPANY DIRECTORY</div>
          </div>
          <div className="relative w-full sm:w-[380px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-9"
              placeholder="Search companies by name, email or contact..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
        <div className="overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-emerald-700 text-white">
                {["NO", "COMPANY NAME", "CONTACT INFO", "REGISTERED AT", "ACTIONS"].map((h) => (
                  <th key={h} className="text-left font-semibold px-3 py-3 whitespace-nowrap text-xs tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r, idx) => (
                <tr key={r.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="px-3 py-3 font-semibold text-gray-700">
                    {(currentPage - 1) * pageSize + idx + 1}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2 font-semibold text-gray-800">
                      <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 grid place-items-center">
                        <Building2 size={14} />
                      </span>
                      {r.name}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-gray-600">
                    <div className="space-y-1">
                      {r.contact && (
                        <div className="inline-flex items-center gap-1.5">
                          <Phone size={14} className="text-gray-400" />
                          {r.contact}
                        </div>
                      )}
                      {r.email && (
                        <div className="inline-flex items-center gap-1.5">
                          <Mail size={14} className="text-gray-400" />
                          {r.email}
                        </div>
                      )}
                      {!r.contact && !r.email && <span className="text-gray-400">-</span>}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-gray-600">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays size={14} className="text-gray-400" />
                      {formatRegistered(r.createdAt)}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      title="Edit"
                      className="w-8 h-8 rounded-full bg-sky-500 text-white grid place-items-center hover:bg-sky-600"
                      onClick={() => openEdit(r)}
                    >
                      <Pencil size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {!pageRows.length && (
                <tr>
                  <td colSpan={5} className="px-3 py-12 text-center text-gray-400">
                    {loading ? "Loading..." : "No companies found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-gray-500">
            Showing {showingFrom} to {showingTo} of {filtered.length} results
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="px-3 py-1.5 text-sm rounded-md border border-gray-200 disabled:opacity-40"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .slice(0, 5)
              .map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  className={`w-8 h-8 text-sm rounded-full border ${
                    n === currentPage
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {n}
                </button>
              ))}
            <button
              type="button"
              className="px-3 py-1.5 text-sm rounded-md border border-gray-200 disabled:opacity-40"
              disabled={currentPage >= totalPages || filtered.length === 0}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SupplierGrn() {
  const [rows, setRows] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [applied, setApplied] = useState({ supplierId: "", fromDate: "", toDate: "" });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<any | null>(null);
  const pageSize = 10;

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [grn, sup] = await Promise.all([
        api.get("/grn/list", { params: { limit: 500 } }),
        api.get("/suppliers/dropdown-list"),
      ]);
      setRows(grn.data.data?.rows || []);
      setSuppliers(sup.data.data || []);
    } catch (e: any) {
      setError(e.message || "Failed to load supplier GRN history");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const enriched = useMemo(() => {
    return rows.map((r) => {
      const total = Number(r.totalAmount || 0);
      const paid = Number(r.paidAmount || 0);
      const balance = Math.max(0, total - paid);
      return {
        ...r,
        total,
        paid,
        balance,
        status: balance <= 0 ? "COMPLETE" : "PENDING",
      };
    });
  }, [rows]);

  const filtered = useMemo(() => {
    return enriched.filter((r) => {
      if (applied.supplierId && String(r.supplierId) !== String(applied.supplierId)) return false;
      const created = new Date(r.createdAt);
      if (applied.fromDate) {
        const from = new Date(applied.fromDate);
        from.setHours(0, 0, 0, 0);
        if (created < from) return false;
      }
      if (applied.toDate) {
        const to = new Date(applied.toDate);
        to.setHours(23, 59, 59, 999);
        if (created > to) return false;
      }
      return true;
    });
  }, [enriched, applied]);

  const stats = useMemo(() => {
    const totalBills = filtered.length;
    const totalAmount = filtered.reduce((s, r) => s + r.total, 0);
    const totalPaid = filtered.reduce((s, r) => s + r.paid, 0);
    const totalBalance = filtered.reduce((s, r) => s + r.balance, 0);
    return { totalBills, totalAmount, totalPaid, totalBalance };
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const showingFrom = filtered.length ? (currentPage - 1) * pageSize + 1 : 0;
  const showingTo = Math.min(currentPage * pageSize, filtered.length);

  function applyFilters(e?: FormEvent) {
    e?.preventDefault();
    setApplied({ supplierId, fromDate, toDate });
    setPage(1);
  }

  function resetFilters() {
    setSupplierId("");
    setFromDate("");
    setToDate("");
    setApplied({ supplierId: "", fromDate: "", toDate: "" });
    setPage(1);
    load();
  }

  function formatDate(value?: string | Date | null) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${yyyy}.${mm}.${dd} ${String(hours).padStart(2, "0")}:${minutes} ${ampm}`;
  }

  function printGrn(row: any) {
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) return;
    w.document.write(`
      <html><head><title>${row.billNo || "GRN"}</title>
      <style>body{font-family:Arial;padding:24px}table{width:100%;border-collapse:collapse;margin-top:12px}
      th,td{border-bottom:1px solid #ddd;padding:8px;text-align:left}</style></head>
      <body>
        <h1>QUANTUMEXE Supplier GRN</h1>
        <div>Bill: ${row.billNo || "-"}</div>
        <div>Supplier: ${row.supplier?.name || "-"}</div>
        <div>Date: ${formatDate(row.createdAt)}</div>
        <div>Total: ${lkr(row.total)}</div>
        <div>Paid: ${lkr(row.paid)}</div>
        <div>Balance: ${lkr(row.balance)}</div>
        <div>Status: ${row.status}</div>
      </body></html>
    `);
    w.document.close();
    w.focus();
    w.print();
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs text-gray-500 mb-1">Supplier &gt; Supplier GRN History</div>
        <h1 className="text-2xl font-bold text-emerald-700">Supplier GRN History</h1>
      </div>
      {error && <ErrorBox text={error} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="rounded-xl bg-emerald-600 text-white p-4 relative overflow-hidden">
          <div className="text-xs font-semibold tracking-wide text-emerald-100">TOTAL BILLS</div>
          <div className="mt-2 text-4xl font-bold">{stats.totalBills}</div>
          <div className="mt-3 flex items-center gap-2 text-xs">
            <FileText size={14} />
            <span className="px-2 py-0.5 rounded-full bg-white/15">Real-time</span>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-xs font-semibold tracking-wide text-gray-500">TOTAL AMOUNT</div>
          <div className="mt-2 text-3xl font-bold text-gray-800">{lkr(stats.totalAmount)}</div>
          <div className="mt-3">
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">Overview</span>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-xs font-semibold tracking-wide text-gray-500">TOTAL PAID</div>
          <div className="mt-2 text-3xl font-bold text-gray-800">{lkr(stats.totalPaid)}</div>
          <div className="mt-3">
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">Overview</span>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-xs font-semibold tracking-wide text-gray-500">TOTAL BALANCE</div>
          <div className="mt-2 text-3xl font-bold text-gray-800">{lkr(stats.totalBalance)}</div>
          <div className="mt-3">
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">Overview</span>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <FileText size={16} className="text-emerald-600" />
          <div className="text-sm font-bold tracking-wide text-gray-800">GRN RECORD DIRECTORY</div>
        </div>
        <form onSubmit={applyFilters} className="px-4 py-4 border-b border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr_auto_auto] gap-3 items-end">
            <div>
              <label className="text-[11px] font-semibold text-gray-500">SUPPLIER</label>
              <select className="input mt-1" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">Filter by supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-500">FROM DATE</label>
              <input className="input mt-1" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-500">TO DATE</label>
              <input className="input mt-1" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary h-[42px] px-5 inline-flex items-center gap-2 whitespace-nowrap">
              <Search size={16} /> APPLY FILTERS
            </button>
            <button
              type="button"
              title="Reset"
              onClick={resetFilters}
              className="h-[42px] w-[42px] rounded-full bg-gray-800 text-white grid place-items-center hover:bg-gray-700"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </form>

        <div className="overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-emerald-700 text-white">
                {["ID", "SUPPLIER NAME", "BILL NUMBER", "TOTAL AMOUNT", "PAID", "BALANCE", "DATE", "STATUS", "ACTIONS"].map((h) => (
                  <th key={h} className="text-left font-semibold px-3 py-3 whitespace-nowrap text-xs tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r, idx) => {
                const initial = String(r.supplier?.name || "?").charAt(0).toUpperCase();
                return (
                  <tr key={r.id} className={idx % 2 === 0 ? "bg-white" : "bg-emerald-50/30"}>
                    <td className="px-3 py-3 font-semibold text-gray-700">#{r.id}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2 font-semibold text-gray-800">
                        <span className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold grid place-items-center">
                          {initial}
                        </span>
                        {(r.supplier?.name || "-").toUpperCase()}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex px-2.5 py-1 rounded-md bg-gray-100 text-gray-700 text-xs font-semibold">
                        {r.billNo || "-"}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-semibold text-gray-800">{lkr(r.total)}</td>
                    <td className="px-3 py-3 text-gray-700">{lkr(r.paid)}</td>
                    <td className={`px-3 py-3 font-semibold ${r.balance > 0 ? "text-red-600" : "text-emerald-600"}`}>
                      {lkr(r.balance)}
                    </td>
                    <td className="px-3 py-3 text-gray-600 whitespace-nowrap">{formatDate(r.createdAt)}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide ${
                          r.status === "COMPLETE"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          title="View"
                          className="w-8 h-8 rounded-full bg-sky-500 text-white grid place-items-center hover:bg-sky-600"
                          onClick={() => setSelected(r)}
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          type="button"
                          title="Print"
                          className="w-8 h-8 rounded-full bg-emerald-500 text-white grid place-items-center hover:bg-emerald-600"
                          onClick={() => printGrn(r)}
                        >
                          <Printer size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!pageRows.length && (
                <tr>
                  <td colSpan={9} className="px-3 py-12 text-center text-gray-400">
                    {loading ? "Loading..." : "No GRN records found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-gray-500">
            Showing {showingFrom} to {showingTo} of {filtered.length} results
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="px-3 py-1.5 text-sm rounded-md border border-gray-200 disabled:opacity-40"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .slice(0, 5)
              .map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  className={`w-8 h-8 text-sm rounded-full border ${
                    n === currentPage
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {n}
                </button>
              ))}
            <button
              type="button"
              className="px-3 py-1.5 text-sm rounded-md border border-gray-200 disabled:opacity-40"
              disabled={currentPage >= totalPages || filtered.length === 0}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">GRN Details</h2>
              <button type="button" className="text-sm text-gray-500 hover:underline" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
            <div className="text-sm space-y-1 text-gray-700">
              <div>Bill: <strong>{selected.billNo}</strong></div>
              <div>Supplier: <strong>{selected.supplier?.name || "-"}</strong></div>
              <div>Date: <strong>{formatDate(selected.createdAt)}</strong></div>
              <div>Total: <strong>{lkr(selected.total)}</strong></div>
              <div>Paid: <strong>{lkr(selected.paid)}</strong></div>
              <div>
                Balance:{" "}
                <strong className={selected.balance > 0 ? "text-red-600" : "text-emerald-600"}>
                  {lkr(selected.balance)}
                </strong>
              </div>
              <div>Status: <strong>{selected.status}</strong></div>
            </div>
            <button type="button" className="btn btn-primary inline-flex items-center gap-2" onClick={() => printGrn(selected)}>
              <Printer size={16} /> Print
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function SupplierPayments() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [grns, setGrns] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [grnId, setGrnId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentType, setPaymentType] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<any | null>(null);
  const pageSize = 10;

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [sup, grn] = await Promise.all([
        api.get("/suppliers/dropdown-list"),
        api.get("/grn/list", { params: { limit: 500 } }),
      ]);
      setSuppliers(sup.data.data || []);
      setGrns(grn.data.data?.rows || []);
    } catch (e: any) {
      setError(e.message || "Failed to load payments data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const enriched = useMemo(() => {
    return grns.map((r) => {
      const total = Number(r.totalAmount || 0);
      const paid = Number(r.paidAmount || 0);
      const balance = Math.max(0, total - paid);
      return {
        ...r,
        total,
        paid,
        balance,
        status: balance <= 0 ? "COMPLETE" : "PENDING",
      };
    });
  }, [grns]);

  const supplierBills = useMemo(() => {
    if (!supplierId) return enriched.filter((r) => r.balance > 0);
    return enriched.filter((r) => String(r.supplierId) === String(supplierId));
  }, [enriched, supplierId]);

  const selectedBill = useMemo(
    () => enriched.find((r) => String(r.id) === String(grnId)) || null,
    [enriched, grnId]
  );

  const selectedBalance = selectedBill ? selectedBill.balance : 0;

  const stats = useMemo(() => {
    const totalBills = enriched.length;
    const totalAmount = enriched.reduce((s, r) => s + r.total, 0);
    const totalPaid = enriched.reduce((s, r) => s + r.paid, 0);
    const totalBalance = enriched.reduce((s, r) => s + r.balance, 0);
    return { totalBills, totalAmount, totalPaid, totalBalance };
  }, [enriched]);

  const totalPages = Math.max(1, Math.ceil(enriched.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = enriched.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const showingFrom = enriched.length ? (currentPage - 1) * pageSize + 1 : 0;
  const showingTo = Math.min(currentPage * pageSize, enriched.length);

  useEffect(() => {
    if (grnId && selectedBill && String(selectedBill.supplierId) !== String(supplierId) && supplierId) {
      setGrnId("");
      setAmount("");
    }
  }, [supplierId]);

  useEffect(() => {
    if (selectedBill) {
      if (!supplierId) setSupplierId(String(selectedBill.supplierId));
      setAmount(selectedBill.balance > 0 ? String(selectedBill.balance) : "0");
    }
  }, [grnId]);

  function resetForm() {
    setSupplierId("");
    setGrnId("");
    setAmount("");
    setPaymentType("");
    load();
  }

  async function pay(e: FormEvent) {
    e.preventDefault();
    if (!supplierId || !grnId) {
      setError("Select supplier and bill");
      return;
    }
    const payAmount = Number(amount);
    if (!(payAmount > 0)) {
      setError("Enter a valid amount");
      return;
    }
    if (!paymentType) {
      setError("Select payment type");
      return;
    }
    setError("");
    try {
      await api.post("/suppliers/payments", {
        supplierId: Number(supplierId),
        grnId: Number(grnId),
        amount: payAmount,
        paymentType,
      });
      setAmount("");
      setPaymentType("");
      setGrnId("");
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Payment failed");
    }
  }

  function formatDate(value?: string | Date | null) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${yyyy}.${mm}.${dd} ${String(hours).padStart(2, "0")}:${minutes} ${ampm}`;
  }

  function printGrn(row: any) {
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) return;
    w.document.write(`
      <html><head><title>${row.billNo || "GRN"}</title>
      <style>body{font-family:Arial;padding:24px}</style></head>
      <body>
        <h1>QUANTUMEXE Supplier Payment / GRN</h1>
        <div>Bill: ${row.billNo || "-"}</div>
        <div>Supplier: ${row.supplier?.name || "-"}</div>
        <div>Date: ${formatDate(row.createdAt)}</div>
        <div>Amount: ${lkr(row.total)}</div>
        <div>Paid: ${lkr(row.paid)}</div>
        <div>Balance: ${lkr(row.balance)}</div>
        <div>Status: ${row.status}</div>
      </body></html>
    `);
    w.document.close();
    w.focus();
    w.print();
  }

  function lkr2(n: number) {
    return `LKR ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs text-gray-500 mb-1">Supplier &gt; Supplier Payments</div>
        <h1 className="text-2xl font-bold text-emerald-700">Supplier Payments</h1>
      </div>
      {error && <ErrorBox text={error} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="rounded-xl bg-emerald-600 text-white p-4">
          <div className="text-xs font-semibold tracking-wide text-emerald-100">TOTAL BILLS</div>
          <div className="mt-2 text-4xl font-bold">{stats.totalBills}</div>
          <div className="mt-3 text-xs">
            <span className="px-2 py-0.5 rounded-full bg-white/15">Real-time</span>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-xs font-semibold tracking-wide text-gray-500">TOTAL AMOUNT</div>
          <div className="mt-2 text-3xl font-bold text-gray-800">{lkr(stats.totalAmount)}</div>
          <div className="mt-3">
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">Overview</span>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-xs font-semibold tracking-wide text-gray-500">TOTAL PAID</div>
          <div className="mt-2 text-3xl font-bold text-gray-800">{lkr(stats.totalPaid)}</div>
          <div className="mt-3">
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">Overview</span>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-xs font-semibold tracking-wide text-gray-500">TOTAL BALANCE</div>
          <div className="mt-2 text-3xl font-bold text-gray-800">{lkr(stats.totalBalance)}</div>
          <div className="mt-3">
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">Overview</span>
          </div>
        </div>
      </div>

      <form onSubmit={pay} className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
        <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_1.3fr_1fr_1fr_1fr_auto_auto] gap-3 items-end">
          <div>
            <label className="text-[11px] font-semibold text-gray-500">SUPPLIER</label>
            <select
              className="input mt-1"
              value={supplierId}
              onChange={(e) => {
                setSupplierId(e.target.value);
                setGrnId("");
                setAmount("");
              }}
              required
            >
              <option value="">Search / select supplier...</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-500">BILL NUMBER</label>
            <select
              className="input mt-1"
              value={grnId}
              onChange={(e) => setGrnId(e.target.value)}
              required
            >
              <option value="">Select bill...</option>
              {supplierBills.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.billNo} ({lkr(b.balance)} due)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-500">BALANCE</label>
            <div className={`input mt-1 flex items-center font-semibold ${selectedBalance > 0 ? "text-red-600" : "text-emerald-600"}`}>
              {lkr2(selectedBalance)}
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-500">AMOUNT</label>
            <input
              className="input mt-1"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-500">PAYMENT TYPE</label>
            <select className="input mt-1" value={paymentType} onChange={(e) => setPaymentType(e.target.value)} required>
              <option value="">Select..</option>
              <option value="Cash">Cash</option>
              <option value="Bank">Bank</option>
              <option value="Cheque">Cheque</option>
              <option value="Card">Card</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary h-[42px] px-5 inline-flex items-center gap-2 whitespace-nowrap">
            <Banknote size={16} /> PAY
          </button>
          <button
            type="button"
            title="Reset"
            onClick={resetForm}
            className="h-[42px] w-[42px] rounded-full bg-sky-500 text-white grid place-items-center hover:bg-sky-600"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </form>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <FileText size={16} className="text-emerald-600" />
          <div className="text-sm font-bold tracking-wide text-gray-800">GRN DIRECTORY</div>
        </div>
        <div className="overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-emerald-700 text-white">
                {["SUP. ID", "SUPPLIER", "BILL NO.", "AMOUNT", "PAID", "BALANCE", "DATE", "STATUS", "ACTIONS"].map((h) => (
                  <th key={h} className="text-left font-semibold px-3 py-3 whitespace-nowrap text-xs tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r, idx) => (
                <tr key={r.id} className={idx % 2 === 0 ? "bg-white" : "bg-emerald-50/30"}>
                  <td className="px-3 py-3 font-semibold text-gray-700">{r.supplierId}</td>
                  <td className="px-3 py-3 font-semibold text-gray-800">{r.supplier?.name || "-"}</td>
                  <td className="px-3 py-3">
                    <span className="inline-flex px-2.5 py-1 rounded-md bg-gray-100 text-gray-700 text-xs font-semibold">
                      {r.billNo || "-"}
                    </span>
                  </td>
                  <td className="px-3 py-3 font-semibold text-gray-800">{lkr(r.total)}</td>
                  <td className="px-3 py-3 text-gray-700">{lkr(r.paid)}</td>
                  <td className={`px-3 py-3 font-semibold ${r.balance > 0 ? "text-red-600" : "text-emerald-600"}`}>
                    {lkr(r.balance)}
                  </td>
                  <td className="px-3 py-3 text-gray-600 whitespace-nowrap">{formatDate(r.createdAt)}</td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide ${
                        r.status === "COMPLETE"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        title="View"
                        className="w-8 h-8 rounded-full bg-sky-500 text-white grid place-items-center hover:bg-sky-600"
                        onClick={() => setSelected(r)}
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        type="button"
                        title="Print"
                        className="w-8 h-8 rounded-full bg-emerald-500 text-white grid place-items-center hover:bg-emerald-600"
                        onClick={() => printGrn(r)}
                      >
                        <Printer size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!pageRows.length && (
                <tr>
                  <td colSpan={9} className="px-3 py-12 text-center text-gray-400">
                    {loading ? "Loading..." : "No GRN bills found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-gray-500">
            Showing {showingFrom} to {showingTo} of {enriched.length} results
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="px-3 py-1.5 text-sm rounded-md border border-gray-200 disabled:opacity-40"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .slice(0, 5)
              .map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  className={`w-8 h-8 text-sm rounded-full border ${
                    n === currentPage
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {n}
                </button>
              ))}
            <button
              type="button"
              className="px-3 py-1.5 text-sm rounded-md border border-gray-200 disabled:opacity-40"
              disabled={currentPage >= totalPages || enriched.length === 0}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">Bill Details</h2>
              <button type="button" className="text-sm text-gray-500 hover:underline" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
            <div className="text-sm space-y-1 text-gray-700">
              <div>Bill: <strong>{selected.billNo}</strong></div>
              <div>Supplier: <strong>{selected.supplier?.name || "-"}</strong></div>
              <div>Amount: <strong>{lkr(selected.total)}</strong></div>
              <div>Paid: <strong>{lkr(selected.paid)}</strong></div>
              <div>
                Balance:{" "}
                <strong className={selected.balance > 0 ? "text-red-600" : "text-emerald-600"}>
                  {lkr(selected.balance)}
                </strong>
              </div>
              <div>Status: <strong>{selected.status}</strong></div>
            </div>
            {selected.balance > 0 && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setSupplierId(String(selected.supplierId));
                  setGrnId(String(selected.id));
                  setAmount(String(selected.balance));
                  setSelected(null);
                }}
              >
                Pay this bill
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function CustomerHome() {
  return (
    <div>
      <PageHeader title="Customers" />
      <SubNav items={[{ to: "/customer/manage-customer", label: "Manage Customer" }]} />
    </div>
  );
}

export function ManageCustomer() {
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [selected, setSelected] = useState<any | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "" });
  const searchRef = useRef<HTMLInputElement | null>(null);
  const pageRowsRef = useRef<any[]>([]);
  const selectedIdxRef = useRef(0);
  const pageSize = 10;

  async function load() {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/customers/all", { params: { limit: 500 } });
      setRows(data.data?.rows || []);
    } catch (e: any) {
      setError(e.message || "Failed to load customers");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return rows;
    return rows.filter((r) => {
      const hay = `${r.name || ""} ${r.phone || ""} ${r.email || ""} ${r.id}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search]);

  const activeCount = useMemo(
    () => rows.filter((r) => (r.status?.name || "Active") === "Active").length,
    [rows]
  );
  const totalCredit = useMemo(
    () => rows.reduce((s, r) => s + Number(r.creditBalance || 0), 0),
    [rows]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const showingFrom = filtered.length ? (currentPage - 1) * pageSize + 1 : 0;
  const showingTo = Math.min(currentPage * pageSize, filtered.length);

  pageRowsRef.current = pageRows;
  selectedIdxRef.current = selectedIdx;

  useEffect(() => {
    setSelectedIdx(0);
  }, [currentPage, search, filtered.length]);

  function openAdd() {
    setEditing(null);
    setForm({ name: "", phone: "", email: "", address: "" });
    setShowForm(true);
  }

  function openEdit(row: any) {
    setEditing(row);
    setForm({
      name: row.name || "",
      phone: row.phone || "",
      email: row.email || "",
      address: row.address || "",
    });
    setShowForm(true);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setError("");
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
      };
      if (editing) {
        await api.put(`/customers/${editing.id}/update`, payload);
      } else {
        await api.post("/customers/add", payload);
      }
      setShowForm(false);
      setEditing(null);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Failed to save");
    }
  }

  async function toggleStatus(id: number) {
    await api.patch(`/customers/${id}/status`);
    load();
  }

  async function viewCustomer(row: any) {
    const { data } = await api.get(`/customers/${row.id}`);
    setSelected(data.data || row);
  }

  async function viewHistory(row: any) {
    const { data } = await api.get(`/customers/${row.id}/invoices`);
    setHistory(data.data || []);
    setSelected(row);
    setShowHistory(true);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const rowsNow = pageRowsRef.current;
      if (!e.altKey) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIdx((i) => Math.min(Math.max(rowsNow.length - 1, 0), i + 1));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIdx((i) => Math.max(0, i - 1));
        }
        return;
      }
      const key = e.key.toLowerCase();
      if (key === "s") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (key === "v") {
        e.preventDefault();
        const row = rowsNow[selectedIdxRef.current];
        if (row) viewCustomer(row);
      } else if (key === "e") {
        e.preventDefault();
        const row = rowsNow[selectedIdxRef.current];
        if (row) openEdit(row);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const avatarColors = [
    "bg-violet-100 text-violet-700",
    "bg-sky-100 text-sky-700",
    "bg-emerald-100 text-emerald-700",
    "bg-amber-100 text-amber-700",
    "bg-pink-100 text-pink-700",
  ];

  function avatarClass(name: string) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash + name.charCodeAt(i) * (i + 1)) % avatarColors.length;
    return avatarColors[hash];
  }

  function rs(n: number) {
    return `Rs. ${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs text-gray-500 mb-1">Customer &gt; Manage Customer</div>
          <h1 className="text-2xl font-bold text-gray-900">Manage Customer</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-[11px] text-gray-500 flex flex-wrap gap-x-3 gap-y-1">
            <span><kbd className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200">↑↓</kbd> Navigate</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200">ALT+V</kbd> View</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200">ALT+E</kbd> Edit</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200">ALT+S</kbd> Search</span>
          </div>
          <button type="button" onClick={openAdd} className="btn btn-primary h-10 px-4 inline-flex items-center gap-1">
            <Plus size={16} /> Add Customer
          </button>
        </div>
      </div>
      {error && <ErrorBox text={error} />}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl bg-emerald-600 text-white p-4">
          <div className="text-xs font-semibold tracking-wide text-emerald-100">TOTAL CUSTOMERS</div>
          <div className="mt-2 text-4xl font-bold">{rows.length}</div>
          <div className="mt-3 flex items-center gap-2 text-xs">
            <Users size={14} />
            <span className="px-2 py-0.5 rounded-full bg-white/15">Real-time</span>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-xs font-semibold tracking-wide text-gray-500">ACTIVE CUSTOMERS</div>
          <div className="mt-2 text-4xl font-bold text-gray-800">{activeCount}</div>
          <div className="mt-3">
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">Overview</span>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-xs font-semibold tracking-wide text-gray-500">TOTAL CREDIT BALANCE</div>
          <div className="mt-2 text-4xl font-bold text-gray-800">{rs(totalCredit)}</div>
          <div className="mt-3">
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">Overview</span>
          </div>
        </div>
      </div>

      {showForm && (
        <form onSubmit={save} className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
          <div className="text-sm font-bold text-gray-800 mb-3">{editing ? "Edit Customer" : "Add Customer"}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 items-end">
            <div>
              <label className="text-xs font-semibold text-gray-600">Name</label>
              <input className="input mt-1" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Phone</label>
              <input className="input mt-1" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Email</label>
              <input className="input mt-1" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn btn-primary h-[42px] px-5 flex-1">{editing ? "Update" : "Save"}</button>
              <button type="button" className="h-[42px] px-4 rounded-lg border border-gray-200 font-semibold" onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-emerald-600" />
            <div className="text-sm font-bold tracking-wide text-gray-800">CUSTOMER LIST</div>
          </div>
          <div className="relative w-full sm:w-[320px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={searchRef}
              className="input pl-9"
              placeholder="Search customer, phone..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
        <div className="overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-emerald-700 text-white">
                {["NO", "CUSTOMER INFORMATION", "CONTACT DETAILS", "CREDIT BALANCE", "STATUS", "ACTIONS"].map((h) => (
                  <th key={h} className="text-left font-semibold px-3 py-3 whitespace-nowrap text-xs tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r, idx) => {
                const isActive = (r.status?.name || "Active") === "Active";
                const credit = Number(r.creditBalance || 0);
                return (
                  <tr
                    key={r.id}
                    className={`${idx % 2 === 0 ? "bg-white" : "bg-emerald-50/30"} ${
                      selectedIdx === idx ? "ring-1 ring-inset ring-emerald-300" : ""
                    }`}
                    onClick={() => setSelectedIdx(idx)}
                  >
                    <td className="px-3 py-3 font-semibold text-gray-700">
                      {(currentPage - 1) * pageSize + idx + 1}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <span className={`w-10 h-10 rounded-full grid place-items-center text-sm font-bold ${avatarClass(r.name || "")}`}>
                          {String(r.name || "?").charAt(0).toUpperCase()}
                        </span>
                        <div>
                          <div className="font-bold text-gray-800">{r.name}</div>
                          <div className="text-xs text-gray-500">ID: #{r.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-gray-700">
                      <span className="inline-flex items-center gap-1.5">
                        <Phone size={14} className="text-gray-400" />
                        {r.phone || "-"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-semibold text-gray-800">{rs(credit)}</div>
                      <div className="text-[11px] font-bold text-red-500 tracking-wide">OUTSTANDING</div>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide ${
                          isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {isActive ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          title="View"
                          className="w-8 h-8 rounded-full bg-sky-500 text-white grid place-items-center hover:bg-sky-600"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            viewCustomer(r);
                          }}
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          type="button"
                          title="History"
                          className="w-8 h-8 rounded-full bg-violet-500 text-white grid place-items-center hover:bg-violet-600"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            viewHistory(r);
                          }}
                        >
                          <History size={14} />
                        </button>
                        <button
                          type="button"
                          title="Edit"
                          className="w-8 h-8 rounded-full bg-amber-500 text-white grid place-items-center hover:bg-amber-600"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            openEdit(r);
                          }}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          title="Toggle status"
                          className="w-8 h-8 rounded-full bg-emerald-500 text-white grid place-items-center hover:bg-emerald-600"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            toggleStatus(r.id);
                          }}
                        >
                          <RefreshCw size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!pageRows.length && (
                <tr>
                  <td colSpan={6} className="px-3 py-12 text-center text-gray-400">
                    {loading ? "Loading..." : "No customers found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-gray-500">
            Showing {showingFrom} to {showingTo} of {filtered.length} customers
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="px-3 py-1.5 text-sm rounded-md border border-gray-200 disabled:opacity-40"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .slice(0, 5)
              .map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  className={`w-8 h-8 text-sm rounded-full border ${
                    n === currentPage
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {n}
                </button>
              ))}
            <button
              type="button"
              className="px-3 py-1.5 text-sm rounded-md border border-gray-200 disabled:opacity-40"
              disabled={currentPage >= totalPages || filtered.length === 0}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {selected && !showHistory && (
        <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">Customer Details</h2>
              <button type="button" className="text-sm text-gray-500 hover:underline" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
            <div className="text-sm space-y-1 text-gray-700">
              <div>Name: <strong>{selected.name}</strong></div>
              <div>ID: <strong>#{selected.id}</strong></div>
              <div>Phone: <strong>{selected.phone || "-"}</strong></div>
              <div>Email: <strong>{selected.email || "-"}</strong></div>
              <div>Address: <strong>{selected.address || "-"}</strong></div>
              <div>Status: <strong>{selected.status?.name || "Active"}</strong></div>
              <div>Credit: <strong>{rs(Number(selected.creditBalance || 0))}</strong></div>
            </div>
          </div>
        </div>
      )}

      {showHistory && selected && (
        <div
          className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4"
          onClick={() => {
            setShowHistory(false);
            setSelected(null);
          }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">Invoice History — {selected.name}</h2>
              <button
                type="button"
                className="text-sm text-gray-500 hover:underline"
                onClick={() => {
                  setShowHistory(false);
                  setSelected(null);
                }}
              >
                Close
              </button>
            </div>
            <div className="overflow-auto max-h-[50vh]">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-600">
                    <th className="text-left px-3 py-2">Invoice</th>
                    <th className="text-left px-3 py-2">Total</th>
                    <th className="text-left px-3 py-2">Paid</th>
                    <th className="text-left px-3 py-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((inv) => (
                    <tr key={inv.id} className="border-t border-gray-100">
                      <td className="px-3 py-2">{inv.invoiceNo}</td>
                      <td className="px-3 py-2">{rs(inv.total)}</td>
                      <td className="px-3 py-2">{rs(inv.paidAmount)}</td>
                      <td className="px-3 py-2">{inv.createdAt ? new Date(inv.createdAt).toLocaleString() : "-"}</td>
                    </tr>
                  ))}
                  {!history.length && (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-gray-400">
                        No invoices found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ManageUsers() {
  const [rows, setRows] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({
    name: "",
    contact: "",
    email: "",
    password: "123456",
    role_id: 1,
  });
  const searchRef = useRef<HTMLInputElement | null>(null);
  const pageRowsRef = useRef<any[]>([]);
  const selectedIdxRef = useRef(0);
  const pageSize = 10;

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [users, roleRes] = await Promise.all([api.get("/users/all"), api.get("/roles")]);
      setRows(users.data.data || []);
      const roleList = (roleRes.data.data || []).filter(
        (r: any, i: number, arr: any[]) =>
          arr.findIndex((x) => String(x.name).toLowerCase() === String(r.name).toLowerCase()) === i
      );
      setRoles(roleList);
      if (roleList.length && !editing) {
        setForm((f) => ({ ...f, role_id: roleList[0].id }));
      }
    } catch (e: any) {
      setError(e.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return rows;
    return rows.filter((r) => {
      const hay = `${r.name || ""} ${r.email || ""} ${r.contact || ""} ${r.role_name || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search]);

  const activeCount = useMemo(
    () => rows.filter((r) => String(r.status || "").toLowerCase() === "active").length,
    [rows]
  );
  const adminCount = useMemo(
    () => rows.filter((r) => String(r.role_name || "").toLowerCase().includes("admin")).length,
    [rows]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const showingFrom = filtered.length ? (currentPage - 1) * pageSize + 1 : 0;
  const showingTo = Math.min(currentPage * pageSize, filtered.length);

  pageRowsRef.current = pageRows;
  selectedIdxRef.current = selectedIdx;

  useEffect(() => {
    setSelectedIdx(0);
  }, [currentPage, search, filtered.length]);

  function openAdd() {
    setEditing(null);
    setForm({
      name: "",
      contact: "",
      email: "",
      password: "123456",
      role_id: roles[0]?.id || 1,
    });
    setShowForm(true);
  }

  function openEdit(row: any) {
    setEditing(row);
    setForm({
      name: row.name || "",
      contact: row.contact || "",
      email: row.email || "",
      password: "",
      role_id: row.role_id || roles[0]?.id || 1,
    });
    setShowForm(true);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      if (editing) {
        const payload: any = {
          name: form.name.trim(),
          contact: form.contact.trim(),
          email: form.email.trim() || null,
          role_id: Number(form.role_id),
        };
        if (form.password.trim()) payload.password = form.password.trim();
        await api.put(`/users/${editing.id}`, payload);
      } else {
        await api.post("/users/add", {
          name: form.name.trim(),
          contact: form.contact.trim(),
          email: form.email.trim() || undefined,
          password: form.password || "123456",
          role_id: Number(form.role_id),
        });
      }
      setShowForm(false);
      setEditing(null);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Failed to save user");
    }
  }

  async function toggleStatus(id: number) {
    await api.patch(`/users/${id}/status`);
    load();
  }

  async function deleteUser(row: { id: number; name?: string }) {
    const me = auth.getUser();
    if (me?.id === row.id) {
      setError("You cannot delete your own account while logged in");
      return;
    }
    if (!confirm(`Delete user "${row.name || row.id}"? This cannot be undone.`)) return;
    setError("");
    try {
      await api.delete(`/users/${row.id}`);
      if (editing?.id === row.id) {
        setShowForm(false);
        setEditing(null);
      }
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Failed to delete user");
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const rowsNow = pageRowsRef.current;
      if (!e.altKey) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIdx((i) => Math.min(Math.max(rowsNow.length - 1, 0), i + 1));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIdx((i) => Math.max(0, i - 1));
        }
        return;
      }
      const key = e.key.toLowerCase();
      if (key === "a") {
        e.preventDefault();
        openAdd();
      } else if (key === "s") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (key === "e") {
        e.preventDefault();
        const row = rowsNow[selectedIdxRef.current];
        if (row) openEdit(row);
      } else if (key === "d") {
        e.preventDefault();
        const row = rowsNow[selectedIdxRef.current];
        if (row) void deleteUser(row);
      } else if (key === "t") {
        e.preventDefault();
        const row = rowsNow[selectedIdxRef.current];
        if (row) toggleStatus(row.id);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [roles]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs text-gray-500 mb-1">Users &gt; Manage User</div>
          <h1 className="text-2xl font-bold text-gray-900">Manage User</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-[11px] text-gray-500 flex flex-wrap gap-x-3 gap-y-1">
            <span><kbd className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200">↑↓</kbd> Navigate</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200">ALT+A</kbd> Add</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200">ALT+E</kbd> Edit</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200">ALT+D</kbd> Delete</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200">ALT+T</kbd> Status</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200">ALT+S</kbd> Search</span>
          </div>
          <button type="button" onClick={openAdd} className="btn btn-primary h-10 px-4 inline-flex items-center gap-1">
            <Plus size={16} /> ADD USER
          </button>
        </div>
      </div>
      {error && <ErrorBox text={error} />}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl bg-emerald-600 text-white p-4">
          <div className="text-xs font-semibold tracking-wide text-emerald-100">TOTAL USERS</div>
          <div className="mt-2 text-4xl font-bold">{rows.length}</div>
          <div className="mt-3 flex items-center gap-2 text-xs">
            <Users size={14} />
            <span className="px-2 py-0.5 rounded-full bg-white/15">Real-time</span>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-xs font-semibold tracking-wide text-gray-500">ACTIVE USERS</div>
          <div className="mt-2 text-4xl font-bold text-gray-800">{activeCount}</div>
          <div className="mt-3">
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">Overview</span>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-xs font-semibold tracking-wide text-gray-500">ADMIN USERS</div>
          <div className="mt-2 text-4xl font-bold text-gray-800">{adminCount}</div>
          <div className="mt-3">
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">Overview</span>
          </div>
        </div>
      </div>

      {showForm && (
        <form onSubmit={save} className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
          <div className="text-sm font-bold text-gray-800 mb-3">{editing ? "Edit User" : "Add User"}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 items-end">
            <div>
              <label className="text-xs font-semibold text-gray-600">Name</label>
              <input className="input mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Email</label>
              <input className="input mt-1" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Contact Number</label>
              <input className="input mt-1" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} required />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Role</label>
              <select className="input mt-1" value={form.role_id} onChange={(e) => setForm({ ...form, role_id: Number(e.target.value) })}>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">
                Password {editing ? "(leave blank to keep)" : ""}
              </label>
              <input
                className="input mt-1"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required={!editing}
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn btn-primary h-[42px] px-5 flex-1">
                {editing ? "Update" : "Save"}
              </button>
              <button
                type="button"
                className="h-[42px] px-4 rounded-lg border border-gray-200 font-semibold"
                onClick={() => {
                  setShowForm(false);
                  setEditing(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-emerald-600" />
            <div className="text-sm font-bold tracking-wide text-gray-800">USER DIRECTORY</div>
          </div>
          <div className="relative w-full sm:w-[380px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={searchRef}
              className="input pl-9"
              placeholder="Search users by name, email, contact, or role..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
        <div className="overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-emerald-700 text-white">
                {["NO", "NAME", "EMAIL", "CONTACT NUMBER", "ROLE", "STATUS", "ACTIONS"].map((h) => (
                  <th key={h} className="text-left font-semibold px-3 py-3 whitespace-nowrap text-xs tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r, idx) => {
                const isActive = String(r.status || "").toLowerCase() === "active";
                return (
                  <tr
                    key={r.id}
                    className={`${idx % 2 === 0 ? "bg-white" : "bg-emerald-50/30"} ${
                      selectedIdx === idx ? "ring-1 ring-inset ring-emerald-300" : ""
                    }`}
                    onClick={() => setSelectedIdx(idx)}
                  >
                    <td className="px-3 py-3 font-semibold text-gray-700">
                      {(currentPage - 1) * pageSize + idx + 1}
                    </td>
                    <td className="px-3 py-3 font-bold text-emerald-700 uppercase">{r.name}</td>
                    <td className="px-3 py-3 text-gray-600">
                      <span className="inline-flex items-center gap-1.5">
                        <Mail size={14} className="text-gray-400" />
                        {r.email || "-"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-gray-700">
                      <span className="inline-flex items-center gap-1.5">
                        <Phone size={14} className="text-gray-400" />
                        {r.contact || "-"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide bg-violet-100 text-violet-700">
                        {String(r.role_name || "USER").toUpperCase()}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        title="Toggle status"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          toggleStatus(r.id);
                        }}
                        className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide ${
                          isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {isActive ? "ACTIVE" : "INACTIVE"}
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          title="Edit"
                          className="w-8 h-8 rounded-full bg-sky-500 text-white grid place-items-center hover:bg-sky-600"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            openEdit(r);
                          }}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          title="Delete"
                          className="w-8 h-8 rounded-full bg-rose-500 text-white grid place-items-center hover:bg-rose-600 disabled:opacity-40"
                          disabled={auth.getUser()?.id === r.id}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            void deleteUser(r);
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!pageRows.length && (
                <tr>
                  <td colSpan={7} className="px-3 py-12 text-center text-gray-400">
                    {loading ? "Loading..." : "No users found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-gray-500">
            Showing {showingFrom} to {showingTo} of {filtered.length} results
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="px-3 py-1.5 text-sm rounded-md border border-gray-200 disabled:opacity-40"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .slice(0, 5)
              .map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  className={`w-8 h-8 text-sm rounded-full border ${
                    n === currentPage
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {n}
                </button>
              ))}
            <button
              type="button"
              className="px-3 py-1.5 text-sm rounded-md border border-gray-200 disabled:opacity-40"
              disabled={currentPage >= totalPages || filtered.length === 0}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function EmployeeHome() {
  return (
    <div>
      <PageHeader title="Employee" />
      <SubNav
        items={[
          { to: "/employee/manage-employee", label: "Manage Employee" },
          { to: "/employee/attendance-mark", label: "Attendance Mark" },
          { to: "/employee/attendance-report", label: "Attendance Report" },
          { to: "/employee/employee-salary", label: "Employee Salary" },
        ]}
      />
    </div>
  );
}

export function ManageEmployee() {
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", contact: "", roleTitle: "", salaryBase: 0 });
  const load = () => api.get("/employees").then((r) => setRows(r.data.data || []));
  useEffect(() => { load(); }, []);
  async function add(e: FormEvent) {
    e.preventDefault();
    await api.post("/employees", form);
    load();
  }
  return (
    <div className="space-y-4">
      <PageHeader title="Manage Employee" />
      <form onSubmit={add} className="card grid md:grid-cols-4 gap-2">
        <input className="input" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input className="input" placeholder="Contact" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
        <input className="input" placeholder="Role" value={form.roleTitle} onChange={(e) => setForm({ ...form, roleTitle: e.target.value })} />
        <button className="btn btn-primary">Add</button>
      </form>
      <div className="card overflow-auto">
        <table className="table">
          <thead><tr><th>Name</th><th>Contact</th><th>Role</th><th>Salary</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.id}><td>{r.name}</td><td>{r.contact}</td><td>{r.roleTitle}</td><td>Rs. {r.salaryBase}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

export function AttendanceMark() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [checkIn, setCheckIn] = useState("09:00");
  const [checkOut, setCheckOut] = useState("17:00");
  useEffect(() => {
    api.get("/employees").then((r) => setEmployees(r.data.data || []));
  }, []);
  async function submit(e: FormEvent) {
    e.preventDefault();
    await api.post("/employees/attendance", { employeeId: Number(employeeId), checkIn, checkOut });
    alert("Attendance marked");
  }
  return (
    <div>
      <PageHeader title="Attendance Mark" />
      <form onSubmit={submit} className="card grid md:grid-cols-4 gap-2 max-w-4xl">
        <select className="input" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required>
          <option value="">Employee</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <input className="input" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
        <input className="input" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
        <button className="btn btn-primary">Save</button>
      </form>
    </div>
  );
}

export function AttendanceReport() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    api.get("/employees/attendance").then((r) => setRows(r.data.data || []));
  }, []);
  return (
    <div>
      <PageHeader title="Attendance Report" />
      <div className="card overflow-auto">
        <table className="table">
          <thead><tr><th>Employee</th><th>Date</th><th>In</th><th>Out</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}><td>{r.employee?.name}</td><td>{new Date(r.date).toLocaleDateString()}</td><td>{r.checkIn}</td><td>{r.checkOut}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function EmployeeSalary() {
  const [rows, setRows] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [form, setForm] = useState({ employeeId: "", month: "2026-07", amount: 0 });
  const load = () => api.get("/employees/salaries").then((r) => setRows(r.data.data || []));
  useEffect(() => {
    load();
    api.get("/employees").then((r) => setEmployees(r.data.data || []));
  }, []);
  async function add(e: FormEvent) {
    e.preventDefault();
    await api.post("/employees/salaries", { ...form, employeeId: Number(form.employeeId) });
    load();
  }
  return (
    <div className="space-y-4">
      <PageHeader title="Employee Salary" />
      <form onSubmit={add} className="card grid md:grid-cols-4 gap-2">
        <select className="input" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} required>
          <option value="">Employee</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <input className="input" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} />
        <input className="input" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
        <button className="btn btn-primary">Add</button>
      </form>
      <div className="card overflow-auto">
        <table className="table">
          <thead><tr><th>Employee</th><th>Month</th><th>Amount</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.id}><td>{r.employee?.name}</td><td>{r.month}</td><td>Rs. {r.amount}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

export function AccountsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cashierId, setCashierId] = useState("");
  const [counter, setCounter] = useState("");
  const [specificDate, setSpecificDate] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [status, setStatus] = useState("");
  const [applied, setApplied] = useState({
    cashierId: "",
    counter: "",
    specificDate: "",
    fromDate: "",
    toDate: "",
    status: "",
  });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<any | null>(null);
  const pageSize = 10;

  async function load() {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/accounts/sessions");
      setRows(data.data || []);
    } catch (e: any) {
      setError(e.message || "Failed to load cashier sessions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const cashiers = useMemo(() => {
    const map = new Map<number, any>();
    rows.forEach((r) => {
      if (r.user) map.set(r.userId, r.user);
    });
    return Array.from(map.values());
  }, [rows]);

  const counters = useMemo(() => {
    return Array.from(new Set(rows.map((r) => r.counterName || "Counter 1")));
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (applied.cashierId && String(r.userId) !== String(applied.cashierId)) return false;
      if (applied.counter && String(r.counterName || "") !== applied.counter) return false;
      if (applied.status && String(r.status || "").toUpperCase() !== applied.status.toUpperCase()) return false;
      const opened = new Date(r.openedAt);
      if (applied.specificDate) {
        const d = applied.specificDate;
        const ymd = opened.toISOString().slice(0, 10);
        if (ymd !== d) return false;
      }
      if (applied.fromDate) {
        const from = new Date(applied.fromDate);
        from.setHours(0, 0, 0, 0);
        if (opened < from) return false;
      }
      if (applied.toDate) {
        const to = new Date(applied.toDate);
        to.setHours(23, 59, 59, 999);
        if (opened > to) return false;
      }
      return true;
    });
  }, [rows, applied]);

  const stats = useMemo(() => {
    const openSessions = filtered.filter((r) => r.status === "OPEN").length;
    const totalSales = filtered.reduce((s, r) => s + Number(r.totalSales || 0), 0);
    const expectedCash = filtered.reduce((s, r) => s + Number(r.expected || 0), 0);
    const cashIn = filtered.reduce((s, r) => s + Number(r.cashIn || 0), 0);
    const cashOut = filtered.reduce((s, r) => s + Number(r.cashOut || 0), 0);
    return { openSessions, totalSales, expectedCash, cashIn, cashOut };
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const showingFrom = filtered.length ? (currentPage - 1) * pageSize + 1 : 0;
  const showingTo = Math.min(currentPage * pageSize, filtered.length);

  function applyFilters() {
    setApplied({ cashierId, counter, specificDate, fromDate, toDate, status });
    setPage(1);
  }

  function resetFilters() {
    setCashierId("");
    setCounter("");
    setSpecificDate("");
    setFromDate("");
    setToDate("");
    setStatus("");
    setApplied({
      cashierId: "",
      counter: "",
      specificDate: "",
      fromDate: "",
      toDate: "",
      status: "",
    });
    setPage(1);
    load();
  }

  function rs(n: number) {
    return `Rs. ${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }

  function formatDate(value?: string | Date | null) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toISOString().slice(0, 10);
  }

  function formatTime(value?: string | Date | null) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  function generateReport() {
    const header = [
      "#",
      "Cashier",
      "Email",
      "Counter",
      "Date",
      "Opening Time",
      "Opening Balance",
      "Total Sales",
      "Cash In",
      "Cash Out",
      "Expected",
      "Status",
    ];
    const body = filtered.map((r, idx) =>
      [
        idx + 1,
        r.user?.name || "",
        r.user?.email || "",
        r.counterName || "",
        formatDate(r.openedAt),
        formatTime(r.openedAt),
        r.openingBalance,
        r.totalSales,
        r.cashIn,
        r.cashOut,
        r.expected,
        r.status,
      ].join(",")
    );
    const blob = new Blob([[header.join(","), ...body].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cashier-sessions-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === "r") {
        e.preventDefault();
        generateReport();
      } else if (key === "f" || key === "p") {
        e.preventDefault();
        resetFilters();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs text-gray-500 mb-1">Accounts &gt; Cashier Sessions</div>
          <h1 className="text-2xl font-bold text-gray-900">Cashier Accounts</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-[11px] text-gray-500 flex flex-wrap gap-x-3 gap-y-1">
            <span><kbd className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200">ALT+R</kbd> Report</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200">ALT+F</kbd> Reset</span>
          </div>
          <button type="button" onClick={generateReport} className="btn btn-primary h-10 px-4 inline-flex items-center gap-2">
            <Download size={16} /> GENERATE REPORT
          </button>
        </div>
      </div>
      {error && <ErrorBox text={error} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="rounded-xl bg-emerald-600 text-white p-4">
          <div className="text-xs font-semibold tracking-wide text-emerald-100">OPEN SESSIONS</div>
          <div className="mt-2 text-4xl font-bold">{stats.openSessions}</div>
          <div className="mt-3 text-xs">
            <span className="px-2 py-0.5 rounded-full bg-white/15">Real-time</span>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-xs font-semibold tracking-wide text-gray-500">TOTAL SALES</div>
          <div className="mt-2 text-3xl font-bold text-gray-800">{rs(stats.totalSales)}</div>
          <div className="mt-3">
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">Overview</span>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-xs font-semibold tracking-wide text-gray-500">EXPECTED CASH</div>
          <div className="mt-2 text-3xl font-bold text-gray-800">{rs(stats.expectedCash)}</div>
          <div className="mt-3">
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">Overview</span>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-xs font-semibold tracking-wide text-gray-500">CASH IN / OUT</div>
          <div className="mt-2 text-3xl font-bold text-gray-800">
            <span className="text-emerald-600">+{Number(stats.cashIn || 0).toLocaleString()}</span>
            {" / "}
            <span className="text-red-600">-{Number(stats.cashOut || 0).toLocaleString()}</span>
          </div>
          <div className="mt-3">
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">Overview</span>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="text-sm font-bold tracking-wide text-gray-800">FILTER SESSIONS</div>
          <button
            type="button"
            onClick={resetFilters}
            className="h-9 px-3 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 inline-flex items-center gap-2 hover:bg-gray-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> RESET FILTERS
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3 items-end">
          <div>
            <label className="text-[11px] font-semibold text-gray-500">Cashier</label>
            <select className="input mt-1" value={cashierId} onChange={(e) => setCashierId(e.target.value)}>
              <option value="">All Cashiers</option>
              {cashiers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-500">Counter</label>
            <select className="input mt-1" value={counter} onChange={(e) => setCounter(e.target.value)}>
              <option value="">All Counters</option>
              {counters.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-500">Specific Date</label>
            <input className="input mt-1" type="date" value={specificDate} onChange={(e) => setSpecificDate(e.target.value)} />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-500">From Date</label>
            <input className="input mt-1" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-500">To Date</label>
            <input className="input mt-1" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[11px] font-semibold text-gray-500">Status</label>
              <select className="input mt-1" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All Status</option>
                <option value="OPEN">Open</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>
            <button type="button" onClick={applyFilters} className="btn btn-primary h-[42px] px-4 mt-auto">
              Apply
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <FileText size={16} className="text-emerald-600" />
          <div className="text-sm font-bold tracking-wide text-gray-800">SESSION DIRECTORY</div>
        </div>
        <div className="overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-emerald-700 text-white">
                {[
                  "#",
                  "CASHIER",
                  "COUNTER",
                  "DATE",
                  "OPENING TIME",
                  "OPENING BALANCE",
                  "TOTAL SALES",
                  "CASH IN / OUT",
                  "EXPECTED",
                  "STATUS",
                  "ACTIONS",
                ].map((h) => (
                  <th key={h} className="text-left font-semibold px-3 py-3 whitespace-nowrap text-xs tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r, idx) => (
                <tr key={r.id} className={idx % 2 === 0 ? "bg-white" : "bg-emerald-50/30"}>
                  <td className="px-3 py-3 font-semibold text-gray-700">
                    {(currentPage - 1) * pageSize + idx + 1}
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-bold text-gray-800 uppercase">{r.user?.name || "-"}</div>
                    <div className="text-xs text-gray-500">{r.user?.email || ""}</div>
                  </td>
                  <td className="px-3 py-3 text-gray-700">{r.counterName || "Counter 1"}</td>
                  <td className="px-3 py-3 text-gray-700 whitespace-nowrap">{formatDate(r.openedAt)}</td>
                  <td className="px-3 py-3 text-gray-700 whitespace-nowrap">{formatTime(r.openedAt)}</td>
                  <td className="px-3 py-3 text-gray-700">{rs(r.openingBalance)}</td>
                  <td className="px-3 py-3 font-semibold text-sky-600">{rs(r.totalSales)}</td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span className="text-emerald-600 font-semibold">+{Number(r.cashIn || 0).toLocaleString()}</span>{" "}
                    <span className="text-red-600 font-semibold">-{Number(r.cashOut || 0).toLocaleString()}</span>
                  </td>
                  <td className="px-3 py-3 font-semibold text-violet-700">{rs(r.expected)}</td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide ${
                        r.status === "OPEN" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      title="View"
                      className="w-8 h-8 rounded-full bg-sky-500 text-white grid place-items-center hover:bg-sky-600"
                      onClick={() => setSelected(r)}
                    >
                      <Eye size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {!pageRows.length && (
                <tr>
                  <td colSpan={11} className="px-3 py-12 text-center text-gray-400">
                    {loading ? "Loading..." : "No cashier sessions found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-gray-500">
            Showing {showingFrom} to {showingTo} of {filtered.length} results
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="px-3 py-1.5 text-sm rounded-md border border-gray-200 disabled:opacity-40"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .slice(0, 5)
              .map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  className={`w-8 h-8 text-sm rounded-full border ${
                    n === currentPage
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {n}
                </button>
              ))}
            <button
              type="button"
              className="px-3 py-1.5 text-sm rounded-md border border-gray-200 disabled:opacity-40"
              disabled={currentPage >= totalPages || filtered.length === 0}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">Session Details</h2>
              <button type="button" className="text-sm text-gray-500 hover:underline" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
            <div className="text-sm space-y-1 text-gray-700">
              <div>Cashier: <strong>{selected.user?.name}</strong></div>
              <div>Email: <strong>{selected.user?.email || "-"}</strong></div>
              <div>Counter: <strong>{selected.counterName}</strong></div>
              <div>Opened: <strong>{formatDate(selected.openedAt)} {formatTime(selected.openedAt)}</strong></div>
              <div>Opening Balance: <strong>{rs(selected.openingBalance)}</strong></div>
              <div>Total Sales: <strong className="text-sky-600">{rs(selected.totalSales)}</strong></div>
              <div>
                Cash In/Out:{" "}
                <strong className="text-emerald-600">+{selected.cashIn}</strong> /{" "}
                <strong className="text-red-600">-{selected.cashOut}</strong>
              </div>
              <div>Expected: <strong className="text-violet-700">{rs(selected.expected)}</strong></div>
              <div>Status: <strong>{selected.status}</strong></div>
              {selected.closedAt && (
                <div>Closed: <strong>{formatDate(selected.closedAt)} {formatTime(selected.closedAt)}</strong></div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ReportsHome() {
  return (
    <div>
      <PageHeader title="Reports" />
      <SubNav
        items={[
          { to: "/reports/sales-financial", label: "Sales & Financial" },
          { to: "/reports/inventory-report", label: "Inventory" },
          { to: "/reports/tax-report", label: "Tax" },
          { to: "/reports/employee-report", label: "Employee" },
          { to: "/reports/quotation-list", label: "Sales & Quotations" },
        ]}
      />
    </div>
  );
}

function ReportTable({ endpoint, title, columns }: { endpoint: string; title: string; columns: Array<{ key: string; label: string; render?: (row: any) => any }> }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    api.get(endpoint).then((r) => setRows(r.data.data || []));
  }, [endpoint]);
  function exportCsv() {
    const header = columns.map((c) => c.label).join(",");
    const body = rows.map((r) => columns.map((c) => JSON.stringify(c.render ? c.render(r) : r[c.key] ?? "")).join(",")).join("\n");
    const blob = new Blob([header + "\n" + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title}.csv`;
    a.click();
  }
  return (
    <div>
      <PageHeader title={title} actions={<button className="btn btn-muted" onClick={exportCsv}>Export CSV</button>} />
      <div className="card overflow-auto">
        <table className="table">
          <thead><tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
          <tbody>
            {Array.isArray(rows) ? rows.map((r, idx) => (
              <tr key={r.id || idx}>{columns.map((c) => <td key={c.key}>{c.render ? c.render(r) : String(r[c.key] ?? "")}</td>)}</tr>
            )) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const InventoryReport = () => (
  <ReportTable
    endpoint="/reports/inventory"
    title="Inventory Report"
    columns={[
      { key: "product", label: "Product" },
      { key: "code", label: "Code" },
      { key: "qty", label: "Qty" },
      { key: "value", label: "Value", render: (r) => `Rs. ${r.value}` },
    ]}
  />
);

export function TaxReport() {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    api.get("/reports/tax").then((r) => setData(r.data.data));
  }, []);
  if (!data) return <div>Loading...</div>;
  return (
    <div>
      <PageHeader title="Tax Report" />
      <div className="grid md:grid-cols-4 gap-3">
        <div className="card"><div className="text-xs text-gray-500">Gross</div><div className="text-xl font-bold">Rs. {data.gross}</div></div>
        <div className="card"><div className="text-xs text-gray-500">Tax Rate</div><div className="text-xl font-bold">{data.taxRate}%</div></div>
        <div className="card"><div className="text-xs text-gray-500">Tax</div><div className="text-xl font-bold">Rs. {data.tax}</div></div>
        <div className="card"><div className="text-xs text-gray-500">Invoices</div><div className="text-xl font-bold">{data.invoices}</div></div>
      </div>
    </div>
  );
}

export const EmployeeReport = () => (
  <ReportTable
    endpoint="/reports/employee"
    title="Employee Report"
    columns={[
      { key: "name", label: "Name" },
      { key: "roleTitle", label: "Role" },
      { key: "salaryBase", label: "Base Salary", render: (r) => `Rs. ${r.salaryBase}` },
      { key: "attendances", label: "Attendance", render: (r) => r.attendances?.length || 0 },
    ]}
  />
);

export function SalesQuotationReport() {
  const [sales, setSales] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  useEffect(() => {
    api.get("/reports/sales").then((r) => setSales(r.data.data || []));
    api.get("/reports/quotations").then((r) => setQuotes(r.data.data || []));
  }, []);
  return (
    <div className="space-y-4">
      <PageHeader title="Sales & Quotation Report" />
      <div className="card overflow-auto">
        <div className="font-semibold mb-2">Sales</div>
        <table className="table">
          <thead><tr><th>Invoice</th><th>Customer</th><th>Total</th></tr></thead>
          <tbody>{sales.map((r) => <tr key={r.id}><td>{r.invoiceNo}</td><td>{r.customer?.name || "-"}</td><td>Rs. {r.total}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="card overflow-auto">
        <div className="font-semibold mb-2">Quotations</div>
        <table className="table">
          <thead><tr><th>Quote</th><th>Customer</th><th>Total</th><th>Status</th></tr></thead>
          <tbody>{quotes.map((r) => <tr key={r.id}><td>{r.quoteNo}</td><td>{r.customer?.name || "-"}</td><td>Rs. {r.total}</td><td>{r.status}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

export function CustomerDisplay() {
  return (
    <div className="min-h-screen grid place-items-center bg-slate-950 text-white p-8">
      <div className="text-center">
        <BrandLogo variant="dark" size="lg" showTagline className="inline-block text-left" />
        <div className="mt-6 text-2xl">Customer Display</div>
        <div className="mt-2 text-gray-300">Thank you for shopping with us</div>
      </div>
    </div>
  );
}

export function SetupPage() {
  return (
    <div className="min-h-screen grid place-items-center p-8">
      <div className="card max-w-lg w-full text-center space-y-3">
        <h1 className="text-2xl font-bold">Setup</h1>
        <p className="text-sm text-gray-500">Environment connected. Continue to sign in.</p>
        <Link className="btn btn-primary" to="/signin">Go to Sign in</Link>
      </div>
    </div>
  );
}
