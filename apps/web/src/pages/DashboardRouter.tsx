import { auth } from "../api";
import AdminDashboard from "./Dashboard";
import StorekeeperDashboard from "./StorekeeperDashboard";

export default function DashboardRouter() {
  const role = (auth.getUser() as { role?: string } | null)?.role || "";
  if (role === "Storekeeper") return <StorekeeperDashboard />;
  return <AdminDashboard />;
}
