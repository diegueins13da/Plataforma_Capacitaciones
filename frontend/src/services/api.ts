import axios, { type AxiosRequestConfig } from "axios";
import { tokenManager } from "./tokenManager";

// ---------------------------------------------------------------------------
// Axios instance
// ---------------------------------------------------------------------------
const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
  timeout: 30_000,
});

// ---------------------------------------------------------------------------
// Request interceptor — attach Bearer token
// ---------------------------------------------------------------------------
api.interceptors.request.use((config) => {
  const token = tokenManager.getAccessToken();
  if (token) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

// ---------------------------------------------------------------------------
// Response interceptor — transparent token refresh on 401
// ---------------------------------------------------------------------------
let isRefreshing = false;
let pendingQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

const drainQueue = (error: unknown, token: string | null = null) => {
  pendingQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)));
  pendingQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean };

    // Only attempt refresh on 401, once per original request
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    // Skip refresh for the login and token-refresh endpoints themselves
    const url = original.url ?? "";
    if (url.includes("/auth/login") || url.includes("/auth/token/refresh")) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // Queue this request until the in-flight refresh resolves
      return new Promise((resolve, reject) => {
        pendingQueue.push({ resolve, reject });
      }).then((newToken) => {
        original.headers = { ...original.headers, Authorization: `Bearer ${newToken}` };
        original._retry = true;
        return api(original);
      });
    }

    isRefreshing = true;
    original._retry = true;

    const refreshToken = tokenManager.getRefreshToken();
    if (!refreshToken) {
      isRefreshing = false;
      _forceLogout();
      return Promise.reject(error);
    }

    try {
      // Use raw axios to avoid our interceptor handling this refresh call
      const { data } = await axios.post<{ access: string }>("/api/v1/auth/token/refresh/", {
        refresh: refreshToken,
      });

      tokenManager.setTokens(data.access);
      api.defaults.headers.common["Authorization"] = `Bearer ${data.access}`;

      drainQueue(null, data.access);
      isRefreshing = false;

      original.headers = { ...original.headers, Authorization: `Bearer ${data.access}` };
      return api(original);
    } catch (refreshError) {
      drainQueue(refreshError);
      isRefreshing = false;
      _forceLogout();
      return Promise.reject(refreshError);
    }
  }
);

/** Redirect to login without importing the store (avoids circular dep). */
function _forceLogout(): void {
  tokenManager.clearTokens();
  window.location.href = "/login?session_expired=1";
}

export default api;
