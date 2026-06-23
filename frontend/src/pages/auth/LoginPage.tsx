import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { loginSchema, type LoginFormValues } from "../../schemas/auth";
import { useAuthStore } from "../../store/authStore";
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
  const login = useAuthStore((s) => s.login);
  const branding = useBranding();
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (formData: LoginFormValues) => {
    setApiError(null);
    try {
      await login(formData);
      const user = useAuthStore.getState().user;
      navigate(user?.role === "ADMIN" ? "/admin" : "/dashboard", { replace: true });
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

  const inputCls =
    "w-full h-11 rounded-xl border border-slate-700/60 bg-slate-900/60 pl-10 pr-4 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-300";

  return (
    <div
      className="flex h-screen overflow-hidden items-center justify-center p-6"
      style={{ background: "#020617", fontFamily: "'Inter',sans-serif" }}
    >
      {/* ── Outer rounded card ─────────────────────────────────────── */}
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
        {/* ── LEFT: branding panel ─────────────────────────────────── */}
        <div
          className="hidden lg:flex lg:flex-col relative overflow-hidden px-12 py-8"
          style={{
            flex: "0 0 52%",
            background: "rgba(10, 20, 45, 0.9)",
            borderRight: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          {/* Ambient glows */}
          <div style={{
            position: "absolute", top: -140, left: -140,
            width: 520, height: 520, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(79,70,229,0.22) 0%, transparent 65%)",
            pointerEvents: "none",
          }} />
          <div style={{
            position: "absolute", bottom: -60, right: -60,
            width: 380, height: 380, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(16,185,129,0.14) 0%, transparent 65%)",
            pointerEvents: "none",
          }} />

          {/* Logo */}
          <div className="flex items-center gap-3 relative z-10">
            {branding.LOGO_URL ? (
              <img
                src={branding.LOGO_URL}
                alt={branding.COMPANY_NAME}
                className="h-9 w-auto object-contain"
                style={{ filter: "brightness(0) invert(1)" }}
              />
            ) : (
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)", boxShadow: "0 0 20px rgba(79,70,229,0.4)" }}
              >
                <i className="ti ti-certificate text-white text-lg" aria-hidden="true" />
              </div>
            )}
            <p className="text-sm font-semibold" style={{ color: "#f1f5f9" }}>{branding.SYSTEM_NAME}</p>
          </div>

          {/* Center content */}
          <div className="flex-1 flex flex-col justify-center relative z-10 py-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 shrink-0"
              style={{ background: "rgba(79,70,229,0.12)", border: "1px solid rgba(79,70,229,0.2)" }}
            >
              <i className="ti ti-book text-2xl" style={{ color: "#818cf8" }} aria-hidden="true" />
            </div>

            <p
              className="text-4xl font-black leading-[1.1] mb-4"
              style={{ color: "#f1f5f9", letterSpacing: "-0.04em" }}
            >
              {branding.SYSTEM_NAME}<br />
              <span style={{ background: "linear-gradient(90deg, #818cf8, #34d399)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Plataforma de Formación
              </span>
            </p>

            {/* Separador */}
            <div style={{ width: 36, height: 2, background: "#4F46E5", borderRadius: 2, marginBottom: 18 }} />

            <p className="text-base mb-4" style={{ color: "#64748b", lineHeight: 1.8 }}>
              Capacítate, evalúate y certifícate. Todo lo que necesitas para impulsar tu desarrollo profesional en un solo lugar.
            </p>

            {/* Pills */}
            <div className="flex flex-wrap gap-2">
              {[
                { icon: "ti-books",           label: "Cursos",       emerald: false },
                { icon: "ti-clipboard-check", label: "Evaluaciones", emerald: false },
                { icon: "ti-certificate",     label: "Certificados", emerald: true  },
              ].map((p) => (
                <span
                  key={p.label}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
                  style={p.emerald
                    ? { background: "rgba(16,185,129,0.08)", border: "1px solid rgba(52,211,153,0.2)", color: "#34d399" }
                    : { background: "rgba(79,70,229,0.1)",  border: "1px solid rgba(99,102,241,0.2)",  color: "#818cf8" }}
                >
                  <i className={`ti ${p.icon} text-sm`} aria-hidden="true" />
                  {p.label}
                </span>
              ))}
            </div>
          </div>

          {/* Footer */}
          <p className="text-xs relative z-10 shrink-0" style={{ color: "#475569" }}>
            © {new Date().getFullYear()} {branding.COMPANY_NAME} · Todos los derechos reservados
          </p>
        </div>

        {/* ── RIGHT: form ──────────────────────────────────────────── */}
        <div
          className="flex-1 flex items-center justify-center px-8 py-10"
          style={{ background: "#020617" }}
        >
          <div className="w-full max-w-[360px]">

            {/* Mobile logo */}
            <div className="flex items-center gap-2.5 mb-8 lg:hidden">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #4F46E5, #7C3AED)" }}>
                <i className="ti ti-certificate text-white text-sm" aria-hidden="true" />
              </div>
              <span className="text-sm font-semibold" style={{ color: "#f1f5f9" }}>{branding.SYSTEM_NAME}</span>
            </div>

          {/* Form card */}
          <div
            className="rounded-3xl p-8"
            style={{
              background: "rgba(15, 23, 42, 0.8)",
              border: "1px solid rgba(255,255,255,0.07)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
            }}
          >
            <h1
              className="text-2xl font-bold mb-1"
              style={{ color: "#f1f5f9", letterSpacing: "-0.03em" }}
            >
              Iniciar sesión
            </h1>
            <p className="text-sm mb-7" style={{ color: "#64748b" }}>
              Ingresa tus credenciales para continuar
            </p>

            {/* API error */}
            {apiError && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm mb-5"
                style={{
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.25)",
                  color: "#f87171",
                }}
              >
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
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="usuario@empresa.com"
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? "email-error" : undefined}
                    className={inputCls}
                    {...register("email")}
                  />
                </div>
                {errors.email && (
                  <p id="email-error" role="alert" className="text-xs mt-1.5" style={{ color: "#f87171" }}>
                    {errors.email.message}
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-xs font-medium mb-1.5" style={{ color: "#94a3b8" }}>
                  Contraseña
                </label>
                <div className="relative">
                  <i className="ti ti-lock absolute left-3 top-1/2 -translate-y-1/2 text-base pointer-events-none" style={{ color: "#475569" }} aria-hidden="true" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    aria-invalid={!!errors.password}
                    aria-describedby={errors.password ? "password-error" : undefined}
                    className={inputCls}
                    {...register("password")}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: "#475569" }}
                  >
                    <i className={`ti ${showPassword ? "ti-eye-off" : "ti-eye"} text-base`} aria-hidden="true" />
                  </button>
                </div>
                {errors.password && (
                  <p id="password-error" role="alert" className="text-xs mt-1.5" style={{ color: "#f87171" }}>
                    {errors.password.message}
                  </p>
                )}
              </div>

              {/* Forgot */}
              <div className="flex justify-end">
                <a
                  href="/password-recovery"
                  className="text-xs transition-colors"
                  style={{ color: "#818cf8" }}
                  onMouseOver={(e) => { (e.target as HTMLAnchorElement).style.color = "#a5b4fc"; }}
                  onMouseOut={(e) => { (e.target as HTMLAnchorElement).style.color = "#818cf8"; }}
                >
                  ¿Olvidaste tu contraseña?
                </a>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-11 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all duration-300 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
                style={{
                  background: "linear-gradient(135deg, #4F46E5 0%, #6D28D9 100%)",
                  boxShadow: "0 4px 24px rgba(79,70,229,0.4)",
                }}
              >
                {isSubmitting ? (
                  <>
                    <i className="ti ti-loader-2 animate-spin text-base" aria-hidden="true" />
                    Ingresando…
                  </>
                ) : (
                  <>
                    <i className="ti ti-login-2 text-base" aria-hidden="true" />
                    Ingresar
                  </>
                )}
              </button>
            </form>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
