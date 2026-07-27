import axios from "axios";
import { cacheShopFeatures, parseFeatures } from "./shopFeatures";

/** Production: set VITE_API_BASE to Firebase Hosting URL (e.g. https://quantumexe-pos.web.app) when API runs on Cloud Functions. */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || "/api",
  timeout: 60000,
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export type User = {
  id: number;
  name: string;
  contact: string;
  email?: string | null;
  role: string;
  role_id: number;
  shop_status?: string;
  shopId?: string | null;
  shopType?: string | null;
  features?: unknown;
};

export type ShopAccess = {
  shopId: string | null;
  status: string;
  shop?: unknown;
};

export const masterApi = {
  async register(payload: Record<string, string>) {
    const { data } = await api.post("/auth/register", payload);
    if (!data?.success) throw new Error(data?.message || "Registration failed");
    return data;
  },
  async access() {
    const { data } = await api.get("/shop/access");
    return (data?.data || {}) as ShopAccess;
  },
  async shops(): Promise<Shop[]> {
    const { data } = await api.get("/master/shops");
    return (data?.data || []) as Shop[];
  },
  async approve(shopId: string, paymentNote?: string, shopType?: string) {
    const { data } = await api.post(`/master/shops/${shopId}/approve`, { paymentNote, shopType });
    if (!data?.success) throw new Error(data?.message || "Approve failed");
    return data;
  },
  async setShopType(shopId: string, shopType: string) {
    const { data } = await api.post(`/master/shops/${shopId}/shop-type`, { shopType });
    if (!data?.success) throw new Error(data?.message || "Shop type update failed");
    return data;
  },
  async markPaid(shopId: string, paymentNote?: string, shopType?: string) {
    const { data } = await api.post(`/master/shops/${shopId}/mark-paid`, { paymentNote, shopType });
    if (!data?.success) throw new Error(data?.message || "Mark paid failed");
    return data;
  },
  async revoke(shopId: string) {
    const { data } = await api.post(`/master/shops/${shopId}/revoke`);
    if (!data?.success) throw new Error(data?.message || "Revoke failed");
    return data;
  },
  async resetPassword(shopId: string, password: string) {
    const { data } = await api.post(`/master/shops/${shopId}/reset-password`, { password });
    if (!data?.success) throw new Error(data?.message || "Reset failed");
    return data;
  },
  async changePassword(currentPassword: string, newPassword: string) {
    const { data } = await api.post("/master/password", { currentPassword, newPassword });
    if (!data?.success) throw new Error(data?.message || "Password change failed");
    return data;
  },
};

type Shop = {
  shopId: string;
  shopName: string;
  ownerName: string;
  phone: string;
  email: string;
  status: string;
  [key: string]: unknown;
};

export const auth = {
  async login(username: string, password: string) {
    try {
      const { data } = await api.post("/auth/login", { username, password });
      if (data.success && data.token) {
        sessionStorage.setItem("token", data.token);
        sessionStorage.setItem("user", JSON.stringify(data.user));
        cacheShopFeatures(data.user?.shopType, parseFeatures(data.user?.features));
      }
      return data;
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { success?: boolean; message?: string } } };
      if (ax.response?.data?.message) {
        return { success: false, message: ax.response.data.message };
      }
      throw e;
    }
  },
  logout() {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    cacheShopFeatures(null, null);
  },
  getUser(): User | null {
    const raw = sessionStorage.getItem("user");
    return raw ? (JSON.parse(raw) as User) : null;
  },
  isAuthenticated() {
    return !!sessionStorage.getItem("token");
  },
};

export type SyncStatus = {
  enabled: boolean;
  mode?: string;
  connectionMode?: "not-configured" | "offline" | "auto-sync" | string;
  credentialsConfigured?: boolean;
  userEnabled?: boolean;
  cloudReachable?: boolean | null;
  pendingOutbox?: number;
  status?: string;
  lastPushAt?: string | null;
  lastPullAt?: string | null;
  lastError?: string | null;
  intervalMinutes?: number;
  projectId?: string | null;
  message?: string;
};

export const syncApi = {
  async status(): Promise<SyncStatus> {
    const { data } = await api.get("/sync/status");
    return (data?.data || {}) as SyncStatus;
  },
  async setAuto(enabled: boolean): Promise<SyncStatus> {
    try {
      const { data } = await api.post("/sync/auto", { enabled });
      if (!data?.success) throw new Error(data?.message || "Failed to update sync");
      return (data?.data || {}) as SyncStatus;
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string } }; message?: string };
      throw new Error(ax.response?.data?.message || ax.message || "Failed to update sync");
    }
  },
  async push() {
    try {
      const { data } = await api.post("/sync/push");
      if (!data?.success) throw new Error(data?.message || "Push failed");
      return data;
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string } }; message?: string };
      throw new Error(ax.response?.data?.message || ax.message || "Push failed");
    }
  },
  async pull(force = false) {
    try {
      const { data } = await api.post(`/sync/pull${force ? "?force=1" : ""}`);
      if (!data?.success) throw new Error(data?.message || "Pull failed");
      return data;
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string } }; message?: string };
      throw new Error(ax.response?.data?.message || ax.message || "Pull failed");
    }
  },
};

export default api;
