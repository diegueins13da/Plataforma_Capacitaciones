import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { loginSchema, type LoginFormValues } from "../../schemas/auth";
import { useAuthStore } from "../../store/authStore";
import { authService } from "../../services/authService";
import { useBranding } from "../../context/BrandingContext";

interface ApiLoginError {
  detail?: string;
  attempts_left?: number;
  locked?: boolean;
  minutes_remaining?: number;
}

function parseLoginError(err: unknown): { status: number; data: ApiLoginError } {
  const e = err as { response?: { status?: number; data?: ApiLoginError } };
  return { status: e.response?.status ?? 0, data: e.response?.data ?? {} };
}

function buildErrorMessage(status: number, data: ApiLoginError): string {
  if (status === 429)
    return "Demasiados intentos. Por favor espera un momento antes de volver a intentar.";
  if (status === 401) {
    const left = data.attempts_left;
    if (typeof left === "number" && left > 0)
      return `Credenciales incorrectas. Te quedan ${left} ${left === 1 ? "intento" : "intentos"}.`;
    return "Credenciales incorrectas. Verifica tu correo y contraseña.";
  }
  return "Ocurrió un error inesperado. Por favor intenta de nuevo.";
}

export default function LoginPage() {
  const navigate = useNavigate();
  const branding = useBranding();

  const login = useAuthStore((s) => s.login);
  const completeMfa = useAuthStore((s) => s.completeMfa);
  const cancelMfa = useAuthStore((s) => s.cancelMfa);
  const pendingMfa = useAuthStore((s) => s.pendingMfa);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // ── Login step state ──────────────────────────────────────────────────────
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // ── MFA step state ────────────────────────────────────────────────────────
  const [mfaDigits, setMfaDigits] = useState(["", "", "", "", "", ""]);
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [mfaSubmitting, setMfaSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600);
  const [resendCooldown, setResendCooldown] = useState(0);
  const mfaRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Navigate once MFA completes and user is fully authenticated
  useEffect(() => {
    if (!isAuthenticated || pendingMfa) return;
    const user = useAuthStore.getState().user;
    navigate(user?.role === "ADMIN" ? "/admin" : "/dashboard", { replace: true });
  }, [isAuthenticated, pendingMfa, navigate]);

  // Reset and focus first digit when MFA challenge appears
  useEffect(() => {
    if (!pendingMfa) return;
    setMfaDigits(["", "", "", "", "", ""]);
    setMfaError(null);
    setTimeLeft(600);
    setTimeout(() => mfaRefs.current[0]?.focus(), 80);
  }, [pendingMfa]);

  // Countdown timer (10-minute OTP TTL)
  useEffect(() => {
    if (!pendingMfa || timeLeft <= 0) return;
    const id = setTimeout(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000);
    return () => clearTimeout(id);
  }, [pendingMfa, timeLeft]);

  // Resend cooldown (60 s)
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setTimeout(() => setResendCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(id);
  }, [resendCooldown]);

  // ── Login form ────────────────────────────────────────────────────────────
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (formData: LoginFormValues) => {
    setApiError(null);
    try {
      await login(formData);
      // If MFA: pendingMfa is set — UI switches automatically
      // If no MFA: isAuthenticated → true → useEffect navigates
    } catch (err: unknown) {
      const { status, data } = parseLoginError(err);
      if (status === 423 || data.locked) {
        navigate("/account-locked", {
          replace: true,
          state: { minutesRemaining: data.minutes_remaining ?? 15 },
        });
        return;
      }
      setApiError(buildErrorMessage(status, data));
    }
  };

  // ── MFA handlers ──────────────────────────────────────────────────────────
  const handleDigitChange = (i: number, val: string) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next = [...mfaDigits];
    next[i] = digit;
    setMfaDigits(next);
    if (digit && i < 5) mfaRefs.current[i + 1]?.focus();
  };

  const handleDigitKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !mfaDigits[i] && i > 0) {
      mfaRefs.current[i - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && i > 0) mfaRefs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < 5) mfaRefs.current[i + 1]?.focus();
  };

  const handleDigitPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const next = Array(6).fill("") as string[];
    for (let j = 0; j < text.length; j++) next[j] = text[j];
    setMfaDigits(next);
    setTimeout(() => mfaRefs.current[Math.min(text.length, 5)]?.focus(), 0);
  };

  const handleMfaSubmit = async () => {
    const otp = mfaDigits.join("");
    if (otp.length !== 6 || mfaSubmitting || timeLeft === 0) return;
    setMfaError(null);
    setMfaSubmitting(true);
    try {
      await completeMfa(otp);
      // isAuthenticated becomes true → useEffect navigates
    } catch (err: unknown) {
      const e = err as { response?: { data?: { errors?: { non_field_errors?: string[] } } } };
      const msg =
        e.response?.data?.errors?.non_field_errors?.[0] ??
        "Código incorrecto. Inténtalo de nuevo.";
      setMfaError(msg);
      setMfaDigits(["", "", "", "", "", ""]);
      setTimeout(() => mfaRefs.current[0]?.focus(), 0);
    } finally {
      setMfaSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!pendingMfa || resendCooldown > 0) return;
    setMfaError(null);
    try {
      await authService.resendMfa(pendingMfa.mfa_token);
      setResendCooldown(60);
      setTimeLeft(600);
      setMfaDigits(["", "", "", "", "", ""]);
      setTimeout(() => mfaRefs.current[0]?.focus(), 0);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { errors?: { non_field_errors?: string[] } } } };
      const msg =
        e.response?.data?.errors?.non_field_errors?.[0] ??
        "Error al reenviar. Inténtalo más tarde.";
      setMfaError(msg);
    }
  };

  // ── Styles ────────────────────────────────────────────────────────────────
  const inputCls =
    "w-full h-11 rounded-xl border border-slate-700/60 bg-slate-900/60 pl-10 pr-4 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-300";

  const cardStyle: React.CSSProperties = {
    background: "rgba(15, 23, 42, 0.8)",
    border: "1px solid rgba(255,255,255,0.07)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
  };

  const minsStr = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const secsStr = String(timeLeft % 60).padStart(2, "0");
  const otpFilled = mfaDigits.every((d) => d !== "");

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="flex h-screen overflow-hidden items-center justify-center p-6"
      style={{ background: "#F1F5F9", fontFamily: "'Inter',sans-serif" }}
    >
      <div
        className="flex w-full overflow-hidden"
        style={{
          maxWidth: 920,
          maxHeight: "calc(100vh - 3rem)",
          borderRadius: 28,
          border: "1px solid rgba(255,255,255,0.07)",
          boxShadow: "0 40px 80px rgba(0,0,0,0.6)",
          minHeight: 480,
        }}
      >
        {/* ── LEFT: branding panel ───────────────────────────────────── */}
        <div
          className="hidden lg:flex lg:flex-col relative overflow-hidden px-12 py-8"
          style={{
            flex: "0 0 52%",
            background: "rgba(10, 20, 45, 0.9)",
            borderRight: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <div style={{ position: "absolute", top: -140, left: -140, width: 520, height: 520, borderRadius: "50%", background: "radial-gradient(circle, rgba(79,70,229,0.22) 0%, transparent 65%)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: -60, right: -60, width: 380, height: 380, borderRadius: "50%", background: "radial-gradient(circle, rgba(16,185,129,0.14) 0%, transparent 65%)", pointerEvents: "none" }} />

          <div className="flex items-center gap-3 relative z-10">
            {branding.LOGO_URL ? (
              <img src={branding.LOGO_URL} alt={branding.COMPANY_NAME} className="h-10 w-auto object-contain" style={{ filter: "brightness(0) invert(1)" }} />
            ) : (
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)", boxShadow: "0 0 20px rgba(79,70,229,0.4)" }}>
                <i className="ti ti-certificate text-white text-lg" aria-hidden="true" />
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col justify-center relative z-10 py-8">
            <p className="text-5xl font-black leading-[1.1] mb-6" style={{ color: "#f1f5f9", letterSpacing: "-0.04em" }}>
              <span style={{ background: "linear-gradient(90deg, #818cf8, #34d399)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Plataforma de<br />Formación
              </span>
            </p>
            <div style={{ width: 44, height: 2, background: "#4F46E5", borderRadius: 2, marginBottom: 22 }} />
            <p className="text-base mb-6" style={{ color: "#64748b", lineHeight: 1.8 }}>
              Capacítate, evalúate y certifícate. Todo lo que necesitas para impulsar tu desarrollo profesional en un solo lugar.
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                { icon: "ti-books", label: "Cursos", emerald: false },
                { icon: "ti-clipboard-check", label: "Evaluaciones", emerald: false },
                { icon: "ti-certificate", label: "Certificados", emerald: true },
              ].map((p) => (
                <span key={p.label} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
                  style={p.emerald
                    ? { background: "rgba(16,185,129,0.08)", border: "1px solid rgba(52,211,153,0.2)", color: "#34d399" }
                    : { background: "rgba(79,70,229,0.1)", border: "1px solid rgba(99,102,241,0.2)", color: "#818cf8" }}>
                  <i className={`ti ${p.icon} text-sm`} aria-hidden="true" />
                  {p.label}
                </span>
              ))}
            </div>
          </div>

          <p className="text-xs relative z-10 shrink-0" style={{ color: "#475569" }}>
            © {new Date().getFullYear()} {branding.COMPANY_NAME} · Todos los derechos reservados
          </p>
        </div>

        {/* ── RIGHT: form area ───────────────────────────────────────── */}
        <div className="flex-1 flex items-center justify-center px-8 py-10" style={{ background: "#020617" }}>
          <div className="w-full max-w-[360px]">

            {/* Mobile logo */}
            <div className="flex items-center gap-2.5 mb-8 lg:hidden">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #4F46E5, #7C3AED)" }}>
                <i className="ti ti-certificate text-white text-sm" aria-hidden="true" />
              </div>
              <span className="text-sm font-semibold" style={{ color: "#f1f5f9" }}>{branding.SYSTEM_NAME}</span>
            </div>

            {/* ── MFA step ──────────────────────────────────────────────── */}
            {pendingMfa ? (
              <div className="rounded-3xl p-8" style={cardStyle}>
                {/* Back button */}
                <button
                  type="button"
                  onClick={cancelMfa}
                  className="flex items-center gap-1.5 text-xs mb-6 transition-colors"
                  style={{ color: "#64748b" }}
                  onMouseOver={(e) => ((e.currentTarget as HTMLElement).style.color = "#94a3b8")}
                  onMouseOut={(e) => ((e.currentTarget as HTMLElement).style.color = "#64748b")}
                >
                  <i className="ti ti-arrow-left text-sm" aria-hidden="true" />
                  Volver al inicio de sesión
                </button>

                {/* Shield icon */}
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: "rgba(79,70,229,0.12)", border: "1px solid rgba(79,70,229,0.2)" }}>
                  <i className="ti ti-shield-check text-xl" style={{ color: "#818cf8" }} aria-hidden="true" />
                </div>

                <h1 className="text-xl font-bold mb-1" style={{ color: "#f1f5f9", letterSpacing: "-0.03em" }}>
                  Verificación de dos pasos
                </h1>
                <p className="text-sm mb-6" style={{ color: "#64748b" }}>
                  Ingresa el código enviado a{" "}
                  <span className="font-semibold" style={{ color: "#94a3b8" }}>{pendingMfa.email_hint}</span>
                </p>

                {/* Error */}
                {mfaError && (
                  <div role="alert" className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm mb-4" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}>
                    <i className="ti ti-alert-circle text-base shrink-0" aria-hidden="true" />
                    {mfaError}
                  </div>
                )}

                {/* Digit inputs */}
                <div className="flex gap-2 justify-center mb-5" role="group" aria-label="Código de verificación">
                  {mfaDigits.map((d, i) => (
                    <input
                      key={i}
                      ref={(el) => { mfaRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={2}
                      value={d}
                      onChange={(e) => handleDigitChange(i, e.target.value)}
                      onKeyDown={(e) => handleDigitKeyDown(i, e)}
                      onPaste={handleDigitPaste}
                      aria-label={`Dígito ${i + 1} de 6`}
                      className="rounded-xl border text-center text-2xl font-bold font-mono text-slate-100 bg-slate-900/60 focus:outline-none transition-all duration-200 caret-transparent"
                      style={{
                        width: 46,
                        height: 58,
                        borderColor: d ? "rgba(99,102,241,0.7)" : "rgba(51,65,85,0.8)",
                        boxShadow: d ? "0 0 0 3px rgba(79,70,229,0.15)" : "none",
                      }}
                    />
                  ))}
                </div>

                {/* Countdown */}
                <p className="text-center text-xs mb-5" style={{ color: timeLeft > 0 ? "#64748b" : "#f87171" }}>
                  {timeLeft > 0 ? (
                    <>
                      El código expira en{" "}
                      <span className="font-semibold tabular-nums" style={{ color: timeLeft < 60 ? "#f59e0b" : "#94a3b8" }}>
                        {minsStr}:{secsStr}
                      </span>
                    </>
                  ) : (
                    <>
                      <i className="ti ti-clock-off text-sm mr-1" aria-hidden="true" />
                      El código expiró. Solicita uno nuevo.
                    </>
                  )}
                </p>

                {/* Submit */}
                <button
                  type="button"
                  onClick={handleMfaSubmit}
                  disabled={!otpFilled || mfaSubmitting || timeLeft === 0}
                  className="w-full h-11 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all duration-300 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none mb-4"
                  style={{ background: "linear-gradient(135deg, #4F46E5 0%, #6D28D9 100%)", boxShadow: "0 4px 24px rgba(79,70,229,0.4)" }}
                >
                  {mfaSubmitting ? (
                    <>
                      <i className="ti ti-loader-2 animate-spin text-base" aria-hidden="true" />
                      Verificando…
                    </>
                  ) : (
                    <>
                      <i className="ti ti-shield-check text-base" aria-hidden="true" />
                      Verificar código
                    </>
                  )}
                </button>

                {/* Resend */}
                <p className="text-center text-xs" style={{ color: "#475569" }}>
                  ¿No recibiste el código?{" "}
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendCooldown > 0}
                    className="transition-colors disabled:pointer-events-none"
                    style={{ color: resendCooldown > 0 ? "#334155" : "#818cf8" }}
                  >
                    {resendCooldown > 0 ? `Reenviar en ${resendCooldown}s` : "Reenviar código"}
                  </button>
                </p>
              </div>

            ) : (

              /* ── Login form card ────────────────────────────────────── */
              <div className="rounded-3xl p-8" style={cardStyle}>
                <h1 className="text-2xl font-bold mb-1" style={{ color: "#f1f5f9", letterSpacing: "-0.03em" }}>
                  Iniciar sesión
                </h1>
                <p className="text-sm mb-7" style={{ color: "#64748b" }}>
                  Ingresa tus credenciales para continuar
                </p>

                {apiError && (
                  <div role="alert" className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm mb-5" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}>
                    <i className="ti ti-alert-circle text-base shrink-0" aria-hidden="true" />
                    {apiError}
                  </div>
                )}

                <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
                  {/* Email */}
                  <div>
                    <label htmlFor="email" className="block text-xs font-medium mb-1.5" style={{ color: "#94a3b8" }}>
                      Correo electrónico
                    </label>
                    <div className="relative">
                      <i className="ti ti-mail absolute left-3 top-1/2 -translate-y-1/2 text-base pointer-events-none" style={{ color: "#475569" }} aria-hidden="true" />
                      <input id="email" type="email" autoComplete="email" placeholder="usuario@empresa.com"
                        aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-error" : undefined}
                        className={inputCls} {...register("email")} />
                    </div>
                    {errors.email && (
                      <p id="email-error" role="alert" className="text-xs mt-1.5" style={{ color: "#f87171" }}>{errors.email.message}</p>
                    )}
                  </div>

                  {/* Password */}
                  <div>
                    <label htmlFor="password" className="block text-xs font-medium mb-1.5" style={{ color: "#94a3b8" }}>
                      Contraseña
                    </label>
                    <div className="relative">
                      <i className="ti ti-lock absolute left-3 top-1/2 -translate-y-1/2 text-base pointer-events-none" style={{ color: "#475569" }} aria-hidden="true" />
                      <input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password"
                        placeholder="••••••••" aria-invalid={!!errors.password}
                        aria-describedby={errors.password ? "password-error" : undefined}
                        className={inputCls} {...register("password")} />
                      <button type="button" aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors" style={{ color: "#475569" }}>
                        <i className={`ti ${showPassword ? "ti-eye-off" : "ti-eye"} text-base`} aria-hidden="true" />
                      </button>
                    </div>
                    {errors.password && (
                      <p id="password-error" role="alert" className="text-xs mt-1.5" style={{ color: "#f87171" }}>{errors.password.message}</p>
                    )}
                  </div>

                  {/* Forgot */}
                  <div className="flex justify-end">
                    <a href="/password-recovery" className="text-xs transition-colors" style={{ color: "#818cf8" }}
                      onMouseOver={(e) => { (e.target as HTMLAnchorElement).style.color = "#a5b4fc"; }}
                      onMouseOut={(e) => { (e.target as HTMLAnchorElement).style.color = "#818cf8"; }}>
                      ¿Olvidaste tu contraseña?
                    </a>
                  </div>

                  {/* Submit */}
                  <button type="submit" disabled={isSubmitting}
                    className="w-full h-11 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all duration-300 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
                    style={{ background: "linear-gradient(135deg, #4F46E5 0%, #6D28D9 100%)", boxShadow: "0 4px 24px rgba(79,70,229,0.4)" }}>
                    {isSubmitting ? (
                      <><i className="ti ti-loader-2 animate-spin text-base" aria-hidden="true" />Ingresando…</>
                    ) : (
                      <><i className="ti ti-login-2 text-base" aria-hidden="true" />Ingresar</>
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
