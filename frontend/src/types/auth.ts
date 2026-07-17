import type { Role, User } from "./index";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user: {
    id: number;
    email: string;
    role: Role;
    force_password_change: boolean;
  };
}

export interface MeResponse extends User {}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirm {
  email: string;
  code: string;
  new_password: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface MfaChallengeResponse {
  mfa_required: true;
  mfa_token: string;
  email_hint: string;
}

export interface MfaVerifyRequest {
  mfa_token: string;
  otp_code: string;
}
