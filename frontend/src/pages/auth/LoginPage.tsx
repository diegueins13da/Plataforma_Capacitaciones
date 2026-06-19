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
      navigate(user?.role === "ADMIN" ? "/admin/users" : "/dashboard", { replace: true });
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
    "w-full h-11 rounded-xl border border-slate-700 bg-slate-900 pl-10 pr-4 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-300";

  const FEATURES = [
    { icon: "ti-robot",       text: "Generación de cursos asistida por IA" },
    { icon: "ti-certificate", text: "Evaluaciones y certificados automáticos" },
    { icon: "ti-chart-bar",   text: "Reportes de progreso en tiempo real" },
    { icon: "ti-users",       text: "Roles: Administrador · Capacitador · Usuario" },
  ];

  return (
    <div className="flex min-h-screen" style={{ background: "#020617", fontFamily: "'Inter',sans-serif" }}>

      {/* ── LEFT: branding panel ───────────────────────────────────── */}
      <div
        className="hidden lg:flex lg:flex-col lg:w-[55%] relative overflow-hidden px-14 py-12"
        style={{ background: "#020617", borderRight: "1px solid #1e293b" }}
      >
        {/* Ambient glows */}
        <div style={{
          position: "absolute", top: -120, left: -120,
          width: 480, height: 480, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(79,70,229,0.14) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", bottom: -80, right: -40,
          width: 320, height: 320, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99,102,241,0.09) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        {/* Logo */}
        <div className="flex items-center gap-3 relative z-10">
          {branding.LOGO_URL ? (
            <img src={branding.LOGO_URL} alt={branding.COMPANY_NAME} className="h-9 w-auto object-contain" />
          ) : (
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "#4F46E5" }}
            >
              <i className="ti ti-certificate text-white text-lg" aria-hidden="true" />
            </div>
          )}
          <div>
            <p className="text-sm font-semibold" style={{ color: "#f1f5f9" }}>{branding.SYSTEM_NAME}</p>
            <p className="text-xs" style={{ color: "#475569" }}>{branding.COMPANY_NAME}</p>
          </div>
        </div>

        {/* Center content */}
        <div className="flex-1 flex flex-col justify-center relative z-10 py-12">
          <p
            className="text-3xl font-semibold leading-tight mb-4"
            style={{ color: "#f1f5f9", letterSpacing: "-0.03em" }}
          >
            Potencia el talento<br />
            de tu <span style={{ color: "#818cf8" }}>organización</span>
          </p>
          <p className="text-sm mb-10" style={{ color: "#475569", lineHeight: 1.75 }}>
            Gestiona cursos, evaluaciones y certificados en un solo lugar.<br />
            Formación inteligente con IA para todos los colaboradores.
          </p>

          <div className="space-y-3">
            {FEATURES.map((f) => (
              <div key={f.text} className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "rgba(79,70,229,0.12)" }}
                >
                  <i className={`ti ${f.icon} text-sm`} style={{ color: "#818cf8" }} aria-hidden="true" />
                </div>
                <span className="text-sm" style={{ color: "#64748b" }}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-xs relative z-10" style={{ color: "#334155" }}>
          © {new Date().getFullYear()} {branding.COMPANY_NAME} · Todos los derechos reservados
        </p>
      </div>

      {/* ── RIGHT: form ───────────────────────────────────────────── */}
      <div
        className="flex-1 flex items-center justify-center px-8 py-12"
        style={{ background: "#020617" }}
      >
        <div className="w-full max-w-[360px]">

          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#4F46E5" }}>
              <i className="ti ti-certificate text-white text-sm" aria-hidden="true" />
            </div>
            <span className="text-sm font-semibold" style={{ color: "#f1f5f9" }}>{branding.SYSTEM_NAME}</span>
          </div>

          <h1
            className="text-xl font-semibold mb-1"
            style={{ color: "#f1f5f9", letterSpacing: "-0.02em" }}
          >
            Iniciar sesión
          </h1>
          <p className="text-sm mb-8" style={{ color: "#475569" }}>
            Ingresa tus credenciales para continuar
          </p>

          {/* API error */}
          {apiError && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm mb-6"
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
              className="w-full h-11 rounded-xl text-sm font-medium text-white flex items-center justify-center gap-2 transition-all duration-300 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
              style={{
                background: "#4F46E5",
                boxShadow: "0 4px 20px rgba(79,70,229,0.3)",
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
  );
}
