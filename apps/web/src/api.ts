import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  timeout: 15000,
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
