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
  UserCheck,
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
  ArrowRightLeft,
  ChevronDown,
  ChevronUp,
  type LucideIcon,
} from "lucide-react";
import api, { auth, syncApi, type SyncStatus } from "../api";
import { useEffect, useMemo, useState } from "react";
import { BrandLogo } from "./BrandLogo";
import { APP_VERSION } from "../version";
import { useI18n } from "../i18n";
import { LanguageSelect } from "../i18n/LanguageSelect";
import {
  modulesForShop,
  parseFeatures,
  readCachedFeatures,
  readCachedShopType,
  cacheShopFeatures,
  SHOP_TYPE_LABELS,
  type ShopFeatures,
} from "../shopFeatures";

type SubItem = { labelKey: string; path: string };
type NavItem = {
  id: string;
  labelKey: string;
  path?: string;
  icon: LucideIcon;
  roles: string[];
  children?: SubItem[];
};

const nav: NavItem[] = [
  {
    id: "dashboard",
    labelKey: "nav.dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
    roles: ["Admin", "Cashier", "Storekeeper"],
  },
  {
    id: "sales",
    labelKey: "nav.sales",
    icon: ShoppingCart,
    roles: ["Admin", "Cashier"],
    children: [
      { labelKey: "nav.manageInvoice", path: "/sales/manage-invoice" },
      { labelKey: "nav.userSales", path: "/sales/manage-user-sales" },
      { labelKey: "nav.returnHistory", path: "/sales/return-history" },
    ],
  },
  {
    id: "quotation",
    labelKey: "nav.quotation",
    icon: FileText,
    roles: ["Admin", "Cashier"],
    children: [
      { labelKey: "nav.createQuotation", path: "/quotation/create-quotation" },
      { labelKey: "nav.quotationList", path: "/quotation/quotation-list" },
    ],
  },
  {
    id: "stock",
    labelKey: "nav.stock",
    icon: Package,
    roles: ["Admin", "Storekeeper"],
    children: [
      { labelKey: "nav.stockList", path: "/stock/stock-list" },
      { labelKey: "nav.outOfStock", path: "/stock/out-of-stock" },
      { labelKey: "nav.damagedStock", path: "/stock/damaged-stock" },
      { labelKey: "nav.lowStock", path: "/stock/low-stock" },
      { labelKey: "nav.expireStock", path: "/stock/expire-stock" },
    ],
  },
  {
    id: "storeRelease",
    labelKey: "nav.storeRelease",
    icon: ArrowRightLeft,
    roles: ["Admin", "Storekeeper"],
    children: [
      { labelKey: "nav.releaseToShop", path: "/store-release/create" },
      { labelKey: "nav.releaseHistory", path: "/store-release/list" },
    ],
  },
  {
    id: "grn",
    labelKey: "nav.grn",
    icon: ClipboardList,
    roles: ["Admin", "Storekeeper"],
    children: [
      { labelKey: "nav.createGrn", path: "/grn/create-grn" },
      { labelKey: "nav.grnList", path: "/grn/grn-list" },
    ],
  },
  {
    id: "products",
    labelKey: "nav.products",
    icon: Boxes,
    roles: ["Admin", "Storekeeper"],
    children: [
      { labelKey: "nav.createProduct", path: "/products/create-product" },
      { labelKey: "nav.productList", path: "/products/product-list" },
      { labelKey: "nav.manageProductType", path: "/products/manage-product-type" },
      { labelKey: "nav.manageUnit", path: "/products/manage-unit" },
      { labelKey: "nav.manageCategory", path: "/products/manage-category" },
      { labelKey: "nav.manageBrand", path: "/products/manage-brand" },
      { labelKey: "nav.deactivatedProducts", path: "/products/deactivated-products" },
    ],
  },
  {
    id: "supplier",
    labelKey: "nav.supplier",
    icon: Truck,
    roles: ["Admin", "Storekeeper"],
    children: [
      { labelKey: "nav.createSupplier", path: "/supplier/create-supplier" },
      { labelKey: "nav.manageSupplier", path: "/supplier/manage-supplier" },
      { labelKey: "nav.manageCompany", path: "/supplier/manage-company" },
      { labelKey: "nav.supplierGrnHistory", path: "/supplier/supplier-grn" },
      { labelKey: "nav.supplierPayments", path: "/supplier/supplier-payments" },
    ],
  },
  {
    id: "customer",
    labelKey: "nav.customer",
    path: "/customer/manage-customer",
    icon: Users,
    roles: ["Admin", "Cashier"],
  },
  {
    id: "users",
    labelKey: "nav.users",
    path: "/manage-users",
    icon: UserCog,
    roles: ["Admin"],
  },
  {
    id: "employee",
    labelKey: "nav.employee",
    icon: UserCheck,
    roles: ["Admin"],
    children: [
      { labelKey: "nav.manageEmployee", path: "/employee/manage-employee" },
      { labelKey: "nav.attendanceMark", path: "/employee/attendance-mark" },
      { labelKey: "nav.attendanceReport", path: "/employee/attendance-report" },
      { labelKey: "nav.employeeSalary", path: "/employee/employee-salary" },
    ],
  },
  {
    id: "accounts",
    labelKey: "nav.accounts",
    path: "/accounts",
    icon: Wallet,
    roles: ["Admin"],
  },
  {
    id: "reports",
    labelKey: "nav.reports",
    icon: BarChart3,
    roles: ["Admin"],
    children: [
      { labelKey: "nav.salesFinancialReport", path: "/reports/sales-financial" },
      { labelKey: "nav.inventoryReport", path: "/reports/inventory-report" },
    ],
  },
  {
    id: "settings",
    labelKey: "nav.settings",
    path: "/setting",
    icon: Settings,
    roles: ["Admin"],
  },
  {
    id: "backup",
    labelKey: "nav.backup",
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
  const { t } = useI18n();
  const [online, setOnline] = useState(navigator.onLine);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [headerQuery, setHeaderQuery] = useState("");
  const [searchCursor, setSearchCursor] = useState(0);
  const [showBell, setShowBell] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [sync, setSync] = useState<SyncStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [features, setFeatures] = useState<ShopFeatures | null>(() => readCachedFeatures());
  const [shopType, setShopType] = useState<string | null>(() => readCachedShopType());

  const role = user?.role || "";
  const allowed = useMemo(() => modulesForShop(features), [features]);

  const items = useMemo(() => {
    return nav
      .filter((n) => {
        if (!n.roles.includes(role)) return false;
        // Admin always gets Employee (attendance) even if older shop features omit it
        if (n.id === "employee" && role === "Admin") return true;
        return allowed.has(n.id);
      })
      .map((n) => {
        if (n.id !== "products" || !n.children) return n;
        if (features?.showBrand !== false) return n;
        return {
          ...n,
          children: n.children.filter((c) => c.path !== "/products/manage-brand"),
        };
      });
  }, [role, allowed, features]);

  type SearchHit = { label: string; path: string; group?: string; keywords: string };

  const searchCatalog = useMemo(() => {
    const hits: SearchHit[] = [
      { label: t("common.pos"), path: "/pos", group: "POS", keywords: "pos sale checkout counter" },
    ];
    for (const item of items) {
      const parentLabel = t(item.labelKey);
      if (item.path) {
        hits.push({
          label: parentLabel,
          path: item.path,
          group: parentLabel,
          keywords: `${parentLabel} ${item.id}`.toLowerCase(),
        });
      }
      for (const child of item.children || []) {
        const childLabel = t(child.labelKey);
        hits.push({
          label: childLabel,
          path: child.path,
          group: parentLabel,
          keywords: `${childLabel} ${parentLabel} ${item.id}`.toLowerCase(),
        });
      }
    }
    const seen = new Set<string>();
    return hits.filter((h) => {
      if (seen.has(h.path)) return false;
      seen.add(h.path);
      return true;
    });
  }, [items, t]);

  const searchSuggestions = useMemo(() => {
    const q = headerQuery.trim().toLowerCase();
    if (!q) return searchCatalog.slice(0, 8);
    return searchCatalog
      .filter(
        (h) =>
          h.label.toLowerCase().includes(q) ||
          h.keywords.includes(q) ||
          h.path.toLowerCase().includes(q)
      )
      .slice(0, 10);
  }, [headerQuery, searchCatalog]);

  useEffect(() => {
    setSearchCursor(0);
  }, [headerQuery, showSearch]);

  function goSearchHit(hit: SearchHit) {
    setShowSearch(false);
    setHeaderQuery("");
    navigate(hit.path);
  }

  useEffect(() => {
    const u = auth.getUser() as { shopType?: string; features?: unknown } | null;
    if (u?.shopType || u?.features) {
      const f = parseFeatures(u.features) || readCachedFeatures();
      setShopType(u.shopType || readCachedShopType());
      setFeatures(f);
      cacheShopFeatures(u.shopType || null, f);
    }
    void (async () => {
      try {
        const { data } = await api.get("/settings");
        const map = (data?.data || {}) as Record<string, string>;
        if (map.shop_type) setShopType(map.shop_type);
        const f = parseFeatures(map.features_json);
        if (f) setFeatures(f);
        cacheShopFeatures(map.shop_type || null, f);
      } catch {
        /* ignore */
      }
    })();
  }, []);

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
          <div className="hidden lg:block text-[10px] text-gray-400 mt-1">
            {t("common.version")} {APP_VERSION}
            {shopType ? ` · ${SHOP_TYPE_LABELS[shopType] || shopType}` : ""}
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1 min-h-0">
          {items.map((item) => {
            const Icon = item.icon;
            const hasChildren = !!item.children?.length;
            const expanded = !!open[item.id];
            const parentActive = sectionActive(location.pathname, item);

            if (!hasChildren && item.path) {
              const label = t(item.labelKey);
              return (
                <NavLink
                  key={item.id}
                  to={item.path}
                  title={label}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                      isActive ? "bg-green-600 text-white" : "text-gray-700 hover:bg-gray-100"
                    }`
                  }
                >
                  <Icon size={18} />
                  <span className="hidden lg:inline">{label}</span>
                </NavLink>
              );
            }

            const label = t(item.labelKey);
            return (
              <div key={item.id} className="space-y-1">
                <button
                  type="button"
                  title={label}
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
                  <span className="hidden lg:inline flex-1 text-left">{label}</span>
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
                        {t(child.labelKey)}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="p-3 border-t space-y-2 shrink-0">
          <div className="hidden lg:flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-gray-500">{t("lang.label")}</span>
            <LanguageSelect />
          </div>
          <div className="lg:hidden flex justify-center">
            <LanguageSelect />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold">
              {(user?.name || "A")[0]}
            </div>
            <div className="hidden lg:block flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{user?.name}</div>
              <div className="text-xs text-gray-500">{user?.role}</div>
            </div>
            <button
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
              title={t("common.logout")}
              onClick={() => {
                auth.logout();
                navigate("/signin", { replace: true });
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-3 shrink-0">
          <div className="flex-1" />
          <div className="flex items-center gap-1.5 rounded-lg border-2 border-emerald-400 bg-emerald-50 px-2.5 py-1 shadow-sm">
            <LanguageSelect />
          </div>
          <button className="btn btn-primary" onClick={() => navigate("/pos")}>
            {t("common.pos")}
          </button>
          <div className={`flex items-center gap-1 text-xs font-semibold ${online ? "text-green-600" : "text-red-500"}`}>
            {online ? t("common.online") : (
              <>
                <WifiOff size={14} /> {t("common.offline")}
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
                ? t("common.syncing")
                : sync.status === "error"
                  ? t("common.syncFailed")
                  : sync.lastPushAt
                    ? `${t("common.synced")} ${new Date(sync.lastPushAt).toLocaleTimeString()}`
                    : t("common.cloudSync")}
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
              <Cloud size={12} /> {t("common.localOnly")}
            </button>
          )}
          <div className="relative">
            <button
              type="button"
              className={`p-2 rounded-lg hover:bg-gray-100 text-gray-500 ${showSearch ? "bg-gray-100 text-emerald-700" : ""}`}
              title={`${t("common.search")} (F)`}
              onClick={() => {
                setShowBell(false);
                setShowSearch((v) => !v);
                if (!showSearch) setHeaderQuery("");
              }}
            >
              <Search size={18} />
            </button>
            {showSearch && (
              <div className="absolute right-0 top-11 z-40 w-80 rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
                <form
                  className="p-3 pb-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const hit = searchSuggestions[searchCursor] || searchSuggestions[0];
                    if (hit) goSearchHit(hit);
                  }}
                >
                  <input
                    autoFocus
                    className="input"
                    placeholder={`${t("common.search")}…`}
                    value={headerQuery}
                    onChange={(e) => setHeaderQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setShowSearch(false);
                        return;
                      }
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setSearchCursor((c) => Math.min(c + 1, Math.max(0, searchSuggestions.length - 1)));
                        return;
                      }
                      if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setSearchCursor((c) => Math.max(0, c - 1));
                      }
                    }}
                  />
                </form>
                <div className="max-h-64 overflow-y-auto border-t border-gray-100">
                  {searchSuggestions.length === 0 ? (
                    <div className="px-3 py-4 text-sm text-gray-500 text-center">No matches</div>
                  ) : (
                    searchSuggestions.map((hit, idx) => (
                      <button
                        key={hit.path}
                        type="button"
                        onMouseEnter={() => setSearchCursor(idx)}
                        onClick={() => goSearchHit(hit)}
                        className={`w-full text-left px-3 py-2.5 text-sm border-b border-gray-50 last:border-0 ${
                          idx === searchCursor ? "bg-emerald-50 text-emerald-900" : "hover:bg-gray-50 text-gray-800"
                        }`}
                      >
                        <div className="font-semibold truncate">{hit.label}</div>
                        {hit.group && hit.group !== hit.label ? (
                          <div className="text-[11px] text-gray-500 truncate">{hit.group}</div>
                        ) : null}
                      </button>
                    ))
                  )}
                </div>
                <div className="px-3 py-2 text-[11px] text-gray-500 bg-gray-50 border-t border-gray-100">
                  ↑↓ select · Enter open · Esc close
                </div>
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
