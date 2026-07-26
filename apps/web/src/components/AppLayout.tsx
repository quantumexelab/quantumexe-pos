import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingCart,
  FileText,
  Package,
  Truck,
  Boxes,
  Users,
  UserCog,
  Settings,
  BarChart3,
  DatabaseBackup,
  Wallet,
  ClipboardList,
  LogOut,
  Search,
  Bell,
  Maximize,
  Minimize2,
  WifiOff,
  Cloud,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  type LucideIcon,
} from "lucide-react";
import { auth, syncApi, type SyncStatus } from "../api";
import { useEffect, useMemo, useState } from "react";
import { BrandLogo } from "./BrandLogo";

type SubItem = { label: string; path: string };
type NavItem = {
  id: string;
  label: string;
  path?: string;
  icon: LucideIcon;
  roles: string[];
  children?: SubItem[];
};

const nav: NavItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
    roles: ["Admin", "Cashier", "Storekeeper"],
  },
  {
    id: "sales",
    label: "Sales",
    icon: ShoppingCart,
    roles: ["Admin", "Cashier"],
    children: [
      { label: "Manage Invoice", path: "/sales/manage-invoice" },
      { label: "User Sales", path: "/sales/manage-user-sales" },
      { label: "Return History", path: "/sales/return-history" },
    ],
  },
  {
    id: "quotation",
    label: "Quotation",
    icon: FileText,
    roles: ["Admin", "Cashier"],
    children: [
      { label: "Create Quotation", path: "/quotation/create-quotation" },
      { label: "Quotation List", path: "/quotation/quotation-list" },
    ],
  },
  {
    id: "stock",
    label: "Stock",
    icon: Package,
    roles: ["Admin", "Storekeeper"],
    children: [
      { label: "Stock List", path: "/stock/stock-list" },
      { label: "Out of Stock", path: "/stock/out-of-stock" },
      { label: "Damaged Stock", path: "/stock/damaged-stock" },
      { label: "Low Stock", path: "/stock/low-stock" },
      { label: "Expire Stock", path: "/stock/expire-stock" },
    ],
  },
  {
    id: "grn",
    label: "GRN",
    icon: ClipboardList,
    roles: ["Admin", "Storekeeper"],
    children: [
      { label: "Create GRN", path: "/grn/create-grn" },
      { label: "GRN List", path: "/grn/grn-list" },
    ],
  },
  {
    id: "products",
    label: "Products",
    icon: Boxes,
    roles: ["Admin", "Storekeeper"],
    children: [
      { label: "Create Product", path: "/products/create-product" },
      { label: "Product List", path: "/products/product-list" },
      { label: "Manage Product Type", path: "/products/manage-product-type" },
      { label: "Manage Unit", path: "/products/manage-unit" },
      { label: "Manage Category", path: "/products/manage-category" },
      { label: "Manage Brand", path: "/products/manage-brand" },
      { label: "Deactivated Products", path: "/products/deactivated-products" },
    ],
  },
  {
    id: "supplier",
    label: "Supplier",
    icon: Truck,
    roles: ["Admin", "Storekeeper"],
    children: [
      { label: "Create Supplier", path: "/supplier/create-supplier" },
      { label: "Manage Supplier", path: "/supplier/manage-supplier" },
      { label: "Manage Company", path: "/supplier/manage-company" },
      { label: "Supplier GRN History", path: "/supplier/supplier-grn" },
      { label: "Supplier Payments", path: "/supplier/supplier-payments" },
    ],
  },
  {
    id: "customer",
    label: "Manage Customer",
    path: "/customer/manage-customer",
    icon: Users,
    roles: ["Admin", "Cashier"],
  },
  {
    id: "users",
    label: "Manage User",
    path: "/manage-users",
    icon: UserCog,
    roles: ["Admin"],
  },
  {
    id: "accounts",
    label: "Accounts",
    path: "/accounts",
    icon: Wallet,
    roles: ["Admin"],
  },
  {
    id: "reports",
    label: "Reports",
    icon: BarChart3,
    roles: ["Admin"],
    children: [
      { label: "Sales & Financial Report", path: "/reports/sales-financial" },
      { label: "Inventory & Product", path: "/reports/inventory-report" },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    path: "/setting",
    icon: Settings,
    roles: ["Admin"],
  },
  {
    id: "backup",
    label: "Back-Up",
    path: "/back-up",
    icon: DatabaseBackup,
    roles: ["Admin"],
  },
];

function isPathActive(pathname: string, path: string) {
  return pathname === path || pathname.startsWith(path + "/");
}

function sectionActive(pathname: string, item: NavItem) {
  if (item.path && isPathActive(pathname, item.path)) return true;
  return !!item.children?.some((c) => isPathActive(pathname, c.path));
}

export default function AppLayout() {
  const user = auth.getUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [online, setOnline] = useState(navigator.onLine);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [headerQuery, setHeaderQuery] = useState("");
  const [showBell, setShowBell] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [sync, setSync] = useState<SyncStatus | null>(null);
  const [syncing, setSyncing] = useState(false);

  const role = user?.role || "";
  const items = useMemo(() => nav.filter((n) => n.roles.includes(role)), [role]);

  async function refreshSync() {
    try {
      const s = await syncApi.status();
      setSync(s);
    } catch {
      setSync(null);
    }
  }

  async function syncNow() {
    setSyncing(true);
    try {
      await syncApi.push();
      await refreshSync();
    } catch (e) {
      console.error(e);
      await refreshSync();
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    document.addEventListener("fullscreenchange", onFs);
    onFs();
    void refreshSync();
    const t = setInterval(() => void refreshSync(), 60_000);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      document.removeEventListener("fullscreenchange", onFs);
      clearInterval(t);
    };
  }, []);

  // Auto-expand the section that matches current route
  useEffect(() => {
    setOpen((prev) => {
      const next = { ...prev };
      for (const item of items) {
        if (item.children && sectionActive(location.pathname, item)) {
          next[item.id] = true;
        }
      }
      return next;
    });
  }, [location.pathname, items]);

  function toggle(id: string) {
    setOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="h-screen flex overflow-hidden bg-[#f3f4f6]">
      <aside className="w-[72px] lg:w-64 bg-white border-r border-gray-200 flex flex-col shrink-0 h-full">
        <div className="h-14 flex items-center justify-center lg:justify-start lg:px-4 gap-2 border-b shrink-0">
          <BrandLogo size="sm" className="hidden lg:block" />
          <div className="lg:hidden text-sm font-black tracking-tight">
            <span className="text-slate-900">Q</span>
            <span className="text-sky-500">EXE</span>
          </div>
          <div className="hidden lg:block text-[10px] text-gray-400 mt-1">Version 1.0.7</div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1 min-h-0">
          {items.map((item) => {
            const Icon = item.icon;
            const hasChildren = !!item.children?.length;
            const expanded = !!open[item.id];
            const parentActive = sectionActive(location.pathname, item);

            if (!hasChildren && item.path) {
              return (
                <NavLink
                  key={item.id}
                  to={item.path}
                  title={item.label}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                      isActive ? "bg-green-600 text-white" : "text-gray-700 hover:bg-gray-100"
                    }`
                  }
                >
                  <Icon size={18} />
                  <span className="hidden lg:inline">{item.label}</span>
                </NavLink>
              );
            }

            return (
              <div key={item.id} className="space-y-1">
                <button
                  type="button"
                  title={item.label}
                  onClick={() => {
                    toggle(item.id);
                    const first = item.children?.[0];
                    if (first && !expanded) navigate(first.path);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                    parentActive ? "bg-green-600 text-white" : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <Icon size={18} />
                  <span className="hidden lg:inline flex-1 text-left">{item.label}</span>
                  <span className="hidden lg:inline opacity-80">
                    {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </span>
                </button>

                {expanded && (
                  <div className="hidden lg:block ml-5 pl-3 border-l border-gray-200 space-y-1 py-1">
                    {item.children!.map((child) => (
                      <NavLink
                        key={child.path}
                        to={child.path}
                        className={({ isActive }) =>
                          `block px-3 py-2 rounded-md text-sm transition ${
                            isActive
                              ? "bg-green-50 text-gray-900 font-semibold border border-green-600"
                              : "text-gray-600 hover:bg-gray-50 border border-transparent"
                          }`
                        }
                      >
                        {child.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="p-3 border-t flex items-center gap-2 shrink-0">
          <div className="w-9 h-9 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold">
            {(user?.name || "A")[0]}
          </div>
          <div className="hidden lg:block flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">{user?.name}</div>
            <div className="text-xs text-gray-500">{user?.role}</div>
          </div>
          <button
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
            title="Logout"
            onClick={() => {
              auth.logout();
              navigate("/signin", { replace: true });
            }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-3 shrink-0">
          <div className="flex-1" />
          <button className="btn btn-primary" onClick={() => navigate("/pos")}>
            POS
          </button>
          <div className={`flex items-center gap-1 text-xs font-semibold ${online ? "text-green-600" : "text-red-500"}`}>
            {online ? "Online" : (
              <>
                <WifiOff size={14} /> Offline
              </>
            )}
          </div>
          {sync?.enabled && (
            <button
              type="button"
              onClick={() => void syncNow()}
              disabled={syncing || !online}
              title={sync.lastError || "Push local DB to Firestore backup"}
              className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md border ${
                sync.status === "error"
                  ? "text-red-600 border-red-200 bg-red-50"
                  : sync.status === "ok"
                    ? "text-emerald-700 border-emerald-200 bg-emerald-50"
                    : "text-gray-600 border-gray-200 bg-gray-50"
              }`}
            >
              {syncing ? <RefreshCw size={12} className="animate-spin" /> : <Cloud size={12} />}
              {syncing
                ? "Syncing…"
                : sync.status === "error"
                  ? "Sync failed"
                  : sync.lastPushAt
                    ? `Synced ${new Date(sync.lastPushAt).toLocaleTimeString()}`
                    : "Cloud sync"}
            </button>
          )}
          {sync && !sync.enabled && sync.mode === "local-sqlite" && (
            <button
              type="button"
              onClick={() => role === "Admin" && navigate("/setting?tab=connection")}
              className="text-[10px] text-gray-400 flex items-center gap-1 hover:text-emerald-700"
              title={
                sync.credentialsConfigured
                  ? "Open Connection Center to turn on cloud auto-sync"
                  : "Cloud credentials not configured"
              }
            >
              <Cloud size={12} /> Local only
            </button>
          )}
          <div className="relative">
            <button
              type="button"
              className={`p-2 rounded-lg hover:bg-gray-100 text-gray-500 ${showSearch ? "bg-gray-100 text-emerald-700" : ""}`}
              title="Search (F)"
              onClick={() => {
                setShowBell(false);
                setShowSearch((v) => !v);
                // Prefer page search box when present
                const pageSearch = document.querySelector<HTMLInputElement>("[data-page-search]");
                if (pageSearch) {
                  pageSearch.focus();
                  pageSearch.select();
                  setShowSearch(false);
                }
              }}
            >
              <Search size={18} />
            </button>
            {showSearch && (
              <div className="absolute right-0 top-11 z-40 w-80 rounded-xl border border-gray-200 bg-white shadow-lg p-3">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const q = headerQuery.trim().toLowerCase();
                    setShowSearch(false);
                    if (!q) return;
                    if (q.includes("invoice") || q.includes("sale")) navigate("/sales/manage-invoice");
                    else if (q.includes("product") || q.includes("stock")) navigate("/products/product-list");
                    else if (q.includes("customer")) navigate("/customer/manage-customer");
                    else if (q.includes("user")) navigate("/manage-users");
                    else if (q.includes("setting")) navigate("/setting");
                    else if (q.includes("report")) navigate("/reports");
                    else if (q.includes("pos")) navigate("/pos");
                    else navigate(`/sales/manage-invoice`);
                  }}
                >
                  <input
                    autoFocus
                    className="input"
                    placeholder="Go to: invoices, products, customers…"
                    value={headerQuery}
                    onChange={(e) => setHeaderQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setShowSearch(false);
                    }}
                  />
                  <div className="mt-2 text-[11px] text-gray-500">Press Enter to open · Esc to close</div>
                </form>
              </div>
            )}
          </div>
          <div className="relative">
            <button
              type="button"
              className={`p-2 rounded-lg hover:bg-gray-100 text-gray-500 ${showBell ? "bg-gray-100 text-emerald-700" : ""}`}
              title="Notifications"
              onClick={() => {
                setShowSearch(false);
                setShowBell((v) => !v);
              }}
            >
              <Bell size={18} />
            </button>
            {showBell && (
              <div className="absolute right-0 top-11 z-40 w-80 rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
                <div className="px-3 py-2 border-b border-gray-100 text-sm font-bold text-gray-800">Notifications</div>
                <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
                  <div className="px-3 py-2.5 text-sm">
                    <div className="font-semibold text-gray-800">System online</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {online ? "Browser is connected to the network." : "You are offline — sales still save locally."}
                    </div>
                  </div>
                  {sync?.enabled ? (
                    <div className="px-3 py-2.5 text-sm">
                      <div className="font-semibold text-gray-800">
                        {sync.status === "error" ? "Cloud sync issue" : "Cloud sync"}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {sync.lastError ||
                          (sync.lastPushAt
                            ? `Last push ${new Date(sync.lastPushAt).toLocaleString()}`
                            : "Auto-sync is enabled")}
                      </div>
                    </div>
                  ) : (
                    <div className="px-3 py-2.5 text-sm">
                      <div className="font-semibold text-gray-800">Local-only mode</div>
                      <div className="text-xs text-gray-500 mt-0.5">Turn on cloud sync from Settings → Connection.</div>
                    </div>
                  )}
                  <div className="px-3 py-2.5 text-sm">
                    <div className="font-semibold text-gray-800">Shortcuts tip</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      On Manage Invoices: ↑↓ navigate · Enter view · P print · F search · R reset
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="w-full text-center text-xs font-semibold text-emerald-700 py-2 hover:bg-emerald-50 border-t border-gray-100"
                  onClick={() => setShowBell(false)}
                >
                  Close
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
            title={isFullscreen ? "Exit full screen (Esc)" : "Full screen"}
            onClick={() => {
              if (document.fullscreenElement) {
                void document.exitFullscreen?.();
              } else {
                void document.documentElement.requestFullscreen?.();
              }
            }}
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize size={18} />}
          </button>
          <div className="text-sm font-semibold text-gray-700">{user?.name}</div>
        </header>
        <main className="flex-1 overflow-y-auto min-h-0 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
