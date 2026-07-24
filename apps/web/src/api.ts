import axios from "axios";

/** Production: set VITE_API_BASE to Firebase Hosting URL (e.g. https://quantumexe-pos.web.app) when API runs on Cloud Functions. */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || "/api",
  timeout: 30000,
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
};

export const auth = {
  async login(username: string, password: string) {
    const { data } = await api.post("/auth/login", { username, password });
    if (data.success && data.token) {
      sessionStorage.setItem("token", data.token);
      sessionStorage.setItem("user", JSON.stringify(data.user));
    }
    return data;
  },
  logout() {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
  },
  getUser(): User | null {
    const raw = sessionStorage.getItem("user");
    return raw ? (JSON.parse(raw) as User) : null;
  },
  isAuthenticated() {
    return !!sessionStorage.getItem("token");
  },
};

export default api;
