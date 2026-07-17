import api from "./api";
import type {
  ChangePasswordRequest,
  LoginRequest,
  LoginResponse,
  MeResponse,
  MfaChallengeResponse,
  MfaVerifyRequest,
  PasswordResetConfirm,
  PasswordResetRequest,
} from "../types/auth";

export const authService = {
  async login(data: LoginRequest): Promise<LoginResponse | MfaChallengeResponse> {
    const res = await api.post<LoginResponse | MfaChallengeResponse>("/v1/auth/login/", data);
    return res.data;
  },

  async verifyMfa(data: MfaVerifyRequest): Promise<LoginResponse> {
    const res = await api.post<LoginResponse>("/v1/auth/mfa/verify/", data);
    return res.data;
  },

  async resendMfa(mfa_token: string): Promise<void> {
    await api.post("/v1/auth/mfa/resend/", { mfa_token });
  },

  async logout(refreshToken: string): Promise<void> {
    await api.post("/v1/auth/logout/", { refresh: refreshToken });
  },

  async me(): Promise<MeResponse> {
    const res = await api.get<MeResponse>("/v1/auth/me/");
    return res.data;
  },

  async requestPasswordReset(data: PasswordResetRequest): Promise<void> {
    await api.post("/v1/auth/password-reset/", data);
  },

  async confirmPasswordReset(data: PasswordResetConfirm): Promise<void> {
    await api.post("/v1/auth/password-reset/confirm/", data);
  },

  async changePassword(data: ChangePasswordRequest): Promise<void> {
    await api.post("/v1/auth/change-password/", data);
  },

  refreshToken(refresh: string): Promise<{ access: string }> {
    return api
      .post<{ access: string }>("/v1/auth/token/refresh/", { refresh })
      .then((r) => r.data);
  },
};
