import { create } from "zustand";
import { authService } from "../services/authService";
import { tokenManager } from "../services/tokenManager";
import type { LoginRequest, LoginResponse } from "../types/auth";
import type { User } from "../types";

interface PendingMfa {
  mfa_token: string;
  email_hint: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  pendingMfa: PendingMfa | null;
}

interface AuthActions {
  login: (credentials: LoginRequest) => Promise<void>;
  completeMfa: (otp_code: string) => Promise<void>;
  cancelMfa: () => void;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  setAccessToken: (token: string) => void;
}

const initialState: AuthState = {
  user: null,
  accessToken: tokenManager.getAccessToken(),
  refreshToken: tokenManager.getRefreshToken(),
  isAuthenticated: false,
  isLoading: true,
  pendingMfa: null,
};

function applyLoginResponse(data: LoginResponse) {
  return {
    user: {
      id: data.user.id,
      email: data.user.email,
      role: data.user.role,
      full_name: "",
      first_name: "",
      last_name: "",
      is_active: true,
      must_change_password: data.user.force_password_change,
    },
    accessToken: data.access,
    refreshToken: data.refresh,
    isAuthenticated: true,
    pendingMfa: null as PendingMfa | null,
  };
}

export const useAuthStore = create<AuthState & AuthActions>()((set, get) => ({
  ...initialState,

  login: async (credentials) => {
    const data = await authService.login(credentials);

    if ("mfa_required" in data && data.mfa_required) {
      set({ pendingMfa: { mfa_token: data.mfa_token, email_hint: data.email_hint } });
      return;
    }

    const loginData = data as LoginResponse;
    tokenManager.setTokens(loginData.access, loginData.refresh);
    set(applyLoginResponse(loginData));
    const me = await authService.me();
    set({ user: me });
  },

  completeMfa: async (otp_code) => {
    const { pendingMfa } = get();
    if (!pendingMfa) throw new Error("No hay desafío MFA pendiente.");

    const data = await authService.verifyMfa({ mfa_token: pendingMfa.mfa_token, otp_code });
    tokenManager.setTokens(data.access, data.refresh);
    set(applyLoginResponse(data));
    const me = await authService.me();
    set({ user: me });
  },

  cancelMfa: () => set({ pendingMfa: null }),

  logout: async () => {
    const { refreshToken } = get();
    try {
      if (refreshToken) await authService.logout(refreshToken);
    } catch {
      // Ignore logout errors — always clear local state
    }
    tokenManager.clearTokens();
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false, pendingMfa: null });
  },

  restoreSession: async () => {
    const storedToken = tokenManager.getAccessToken();
    if (!storedToken) {
      set({ isLoading: false });
      return;
    }
    try {
      const me = await authService.me();
      const newToken = tokenManager.getAccessToken();
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
