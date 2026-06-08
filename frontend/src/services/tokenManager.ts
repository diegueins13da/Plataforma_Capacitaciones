/**
 * Thin in-memory + localStorage token store.
 * api.ts imports this (not the Zustand store) to avoid circular dependencies.
 * authStore.ts keeps this in sync after login / logout / token refresh.
 */

const ACCESS_KEY = "lms_access_token";
const REFRESH_KEY = "lms_refresh_token";

export const tokenManager = {
  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_KEY);
  },

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  },

  setTokens(access: string, refresh?: string): void {
    localStorage.setItem(ACCESS_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  },

  clearTokens(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};
