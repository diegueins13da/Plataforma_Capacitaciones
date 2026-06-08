import { create } from "zustand";
import { authService } from "../services/authService";
import { tokenManager } from "../services/tokenManager";
import type { LoginRequest } from "../types/auth";
import type { User } from "../types";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthActions {
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  setAccessToken: (token: string) => void;
}

const initialState: AuthState = {
  user: null,
  accessToken: tokenManager.getAccessToken(),
  refreshToken: tokenManager.getRefreshToken(),
  isAuthenticated: false,
  isLoading: true, // true until restoreSession() resolves
};

export const useAuthStore = create<AuthState & AuthActions>()((set, get) => ({
  ...initialState,

  login: async (credentials) => {
    const data = await authService.login(credentials);
    tokenManager.setTokens(data.access, data.refresh);
    set({
      user: {
        id: data.user.id,
        email: data.user.email,
        role: data.user.role,
        full_name: "",
        is_active: true,
        must_change_password: data.user.force_password_change,
      },
      accessToken: data.access,
      refreshToken: data.refresh,
      isAuthenticated: true,
    });
    // Fetch full user details (includes full_name, area, grupo)
    const me = await authService.me();
    set({ user: me });
  },

  logout: async () => {
    const { refreshToken } = get();
    try {
      if (refreshToken) await authService.logout(refreshToken);
    } catch {
      // Ignore logout errors — always clear local state
    }
    tokenManager.clearTokens();
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
  },

  restoreSession: async () => {
    const storedToken = tokenManager.getAccessToken();
    if (!storedToken) {
      set({ isLoading: false });
      return;
    }
    try {
      // The API interceptor auto-refreshes if the token is expired
      const me = await authService.me();
      const newToken = tokenManager.getAccessToken(); // might have been refreshed
      set({
        user: me,
        accessToken: newToken,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch {
      tokenManager.clearTokens();
      set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false, isLoading: false });
    }
  },

  setAccessToken: (token) => {
    tokenManager.setTokens(token);
    set({ accessToken: token });
  },
}));
