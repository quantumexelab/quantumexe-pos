import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { auth } from "./api";
import AppLayout from "./components/AppLayout";
import SignIn from "./pages/SignIn";
import Dashboard from "./pages/Dashboard";
import POS from "./pages/POS";
import PendingAccess from "./pages/PendingAccess";
import MasterAdmin from "./pages/MasterAdmin";
import { ManageInvoice, ReturnHistory, SalesHome, UserSales } from "./pages/Sales";
import {
  CreateGrn,
  CreateProduct,
  DamagedStock,
  DeactivatedProducts,
  ExpireStock,
  GrnHome,
  GrnList,
  LowStock,
  ManageBrand,
  ManageCategory,
  ManageProductType,
  ManageUnit,
  OutOfStock,
  ProductList,
  ProductsHome,
  QuotationForm,
  QuotationHome,
  QuotationList,
  StockHome,
  StockList,
} from "./pages/Catalog";
import SettingsPage from "./pages/Settings";
import BackupPage from "./pages/Backup";
import SalesFinancialReport from "./pages/SalesFinancialReport";
import InventoryProductReport from "./pages/InventoryProductReport";
import {
  AccountsPage,
  AttendanceMark,
  AttendanceReport,
  CreateSupplier,
  CustomerDisplay,
  CustomerHome,
  EmployeeHome,
  EmployeeReport,
  EmployeeSalary,
  ManageCompany,
  ManageCustomer,
  ManageEmployee,
  ManageSupplier,
  ManageUsers,
  ReportsHome,
  SalesQuotationReport,
  SetupPage,
  SupplierGrn,
  SupplierHome,
  SupplierPayments,
  TaxReport,
} from "./pages/Parties";

function Protected() {
  if (!auth.isAuthenticated()) return <Navigate to="/signin" replace />;
  return <Outlet />;
}

function ShopGate() {
  const user = auth.getUser() as { role?: string; shop_status?: string } | null;
  if (user?.role === "MasterAdmin") return <Navigate to="/master" replace />;
  if (user?.shop_status && user.shop_status !== "active") {
    return <Navigate to="/pending-access" replace />;
  }
  return <Outlet />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/signin" element={<SignIn />} />
      <Route path="/setup" element={<SetupPage />} />
      <Route path="/customer-display" element={<CustomerDisplay />} />

      <Route element={<Protected />}>
        <Route path="/master" element={<MasterAdmin />} />
        <Route path="/pending-access" element={<PendingAccess />} />

        <Route element={<ShopGate />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/pos" element={<POS />} />

            <Route path="/sales" element={<SalesHome />} />
            <Route path="/sales/manage-invoice" element={<ManageInvoice />} />
            <Route path="/sales/manage-user-sales" element={<UserSales />} />
            <Route path="/sales/return-history" element={<ReturnHistory />} />

            <Route path="/quotation" element={<QuotationHome />} />
            <Route path="/quotation/quotation-list" element={<QuotationList />} />
            <Route path="/quotation/create-quotation" element={<QuotationForm />} />
            <Route path="/quotation/edit-quotation/:id" element={<QuotationForm edit />} />

            <Route path="/stock" element={<StockHome />} />
            <Route path="/stock/stock-list" element={<StockList />} />
            <Route path="/stock/low-stock" element={<LowStock />} />
            <Route path="/stock/out-of-stock" element={<OutOfStock />} />
            <Route path="/stock/expire-stock" element={<ExpireStock />} />
            <Route path="/stock/damaged-stock" element={<DamagedStock />} />

            <Route path="/grn" element={<GrnHome />} />
            <Route path="/grn/create-grn" element={<CreateGrn />} />
            <Route path="/grn/grn-list" element={<GrnList />} />

            <Route path="/products" element={<ProductsHome />} />
            <Route path="/products/product-list" element={<ProductList />} />
            <Route path="/products/create-product" element={<CreateProduct />} />
            <Route path="/products/deactivated-products" element={<DeactivatedProducts />} />
            <Route path="/products/manage-category" element={<ManageCategory />} />
            <Route path="/products/manage-brand" element={<ManageBrand />} />
            <Route path="/products/manage-unit" element={<ManageUnit />} />
            <Route path="/products/manage-product-type" element={<ManageProductType />} />

            <Route path="/supplier" element={<SupplierHome />} />
            <Route path="/supplier/manage-supplier" element={<ManageSupplier />} />
            <Route path="/supplier/create-supplier" element={<CreateSupplier />} />
            <Route path="/supplier/manage-company" element={<ManageCompany />} />
            <Route path="/supplier/supplier-grn" element={<SupplierGrn />} />
            <Route path="/supplier/supplier-payments" element={<SupplierPayments />} />

            <Route path="/customer" element={<CustomerHome />} />
            <Route path="/customer/manage-customer" element={<ManageCustomer />} />

            <Route path="/manage-users" element={<ManageUsers />} />

            <Route path="/employee" element={<EmployeeHome />} />
            <Route path="/employee/manage-employee" element={<ManageEmployee />} />
            <Route path="/employee/attendance-mark" element={<AttendanceMark />} />
            <Route path="/employee/attendance-report" element={<AttendanceReport />} />
            <Route path="/employee/employee-salary" element={<EmployeeSalary />} />

            <Route path="/accounts" element={<AccountsPage />} />

            <Route path="/reports" element={<ReportsHome />} />
            <Route path="/reports/sales-financial" element={<SalesFinancialReport />} />
            <Route path="/reports/inventory-report" element={<InventoryProductReport />} />
            <Route path="/reports/tax-report" element={<TaxReport />} />
            <Route path="/reports/employee-report" element={<EmployeeReport />} />
            <Route path="/reports/quotation-list" element={<SalesQuotationReport />} />

            <Route path="/setting" element={<SettingsPage />} />
            <Route path="/back-up" element={<BackupPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
