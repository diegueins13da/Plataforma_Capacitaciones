import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { loginSchema, type LoginFormValues } from "../../schemas/auth";
import { useAuthStore } from "../../store/authStore";

// ---------------------------------------------------------------------------
// Error parsing helpers
// ---------------------------------------------------------------------------
interface ApiLoginError {
  detail?: string;
  attempts_left?: number;
  locked?: boolean;
  minutes_remaining?: number;
}

function parseLoginError(
  err: unknown
): { status: number; data: ApiLoginError } {
  const e = err as {
    response?: { status?: number; data?: ApiLoginError };
  };
  return {
    status: e.response?.status ?? 0,
    data: e.response?.data ?? {},
  };
}

function buildErrorMessage(
  status: number,
  data: ApiLoginError
): string {
  if (status === 429) {
    return "Demasiados intentos. Por favor espera un momento antes de volver a intentar.";
  }
  if (status === 401) {
    const left = data.attempts_left;
    if (typeof left === "number" && left > 0) {
      return `Credenciales incorrectas. Te quedan ${left} ${left === 1 ? "intento" : "intentos"}.`;
    }
    return "Credenciales incorrectas. Verifica tu correo y contraseña.";
  }
  return "Ocurrió un error inesperado. Por favor intenta de nuevo.";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (formData: LoginFormValues) => {
    setApiError(null);
    try {
      await login(formData);
      // login() fully resolves (including /me/) — read role directly from store
      const user = useAuthStore.getState().user;
      navigate(
        user?.role === "ADMIN" ? "/admin/users" : "/dashboard",
        { replace: true }
      );
    } catch (err: unknown) {
      const { status, data } = parseLoginError(err);
      if (status === 423 || data.locked) {
        // Pass remaining lockout time so AccountLockedPage can show the countdown
        navigate("/account-locked", {
          replace: true,
          state: { minutesRemaining: data.minutes_remaining ?? 15 },
        });
        return;
      }
      setApiError(buildErrorMessage(status, data));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md rounded-lg border bg-card p-8 shadow-sm">
        {/* Brand header */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight">LMS Corporativo</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Inicia sesión en tu cuenta
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
          {/* ── Email ──────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="block text-sm font-medium leading-none"
            >
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "email-error" : undefined}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50"
              {...register("email")}
            />
            {errors.email && (
              <p
                id="email-error"
                role="alert"
                className="text-xs text-destructive"
              >
                {errors.email.message}
              </p>
            )}
          </div>

          {/* ── Password ───────────────────────────────────────── */}
          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="block text-sm font-medium leading-none"
            >
              Contraseña
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? "password-error" : undefined}
                className="w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50"
                {...register("password")}
              />
              <button
                type="button"
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded text-muted-foreground hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
            {errors.password && (
              <p
                id="password-error"
                role="alert"
                className="text-xs text-destructive"
              >
                {errors.password.message}
              </p>
            )}
          </div>

          {/* ── API error banner ───────────────────────────────── */}
          {apiError && (
            <div
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {apiError}
            </div>
          )}

          {/* ── Submit ─────────────────────────────────────────── */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Ingresando...
              </span>
            ) : (
              "Ingresar"
            )}
          </button>
        </form>

        {/* ── Footer link ────────────────────────────────────────── */}
        <p className="mt-5 text-center text-sm text-muted-foreground">
          <Link
            to="/password-recovery"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </p>
      </div>
    </div>
  );
}
