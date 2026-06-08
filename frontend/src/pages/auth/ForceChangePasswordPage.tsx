import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { ShieldAlert, Loader2 } from "lucide-react";
import { changePasswordSchema, type ChangePasswordValues } from "../../schemas/auth";
import { authService } from "../../services/authService";
import { useAuthStore } from "../../store/authStore";

// ---------------------------------------------------------------------------
// Error parsing
// ---------------------------------------------------------------------------
interface ApiErrorData {
  errors?: Record<string, string[]>;
  detail?: string;
}

function parseApiError(err: unknown): string {
  const e = err as { response?: { data?: ApiErrorData } };
  const data = e.response?.data;
  if (data?.errors?.current_password) {
    return data.errors.current_password[0];
  }
  if (data?.errors?.new_password) {
    return data.errors.new_password[0];
  }
  if (data?.detail) return data.detail;
  return "Ocurrió un error inesperado. Intenta de nuevo.";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function ForceChangePasswordPage() {
  const navigate = useNavigate();
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
  });

  const onSubmit = async (data: ChangePasswordValues) => {
    setApiError(null);
    try {
      await authService.changePassword({
        current_password: data.current_password,
        new_password: data.new_password,
      });
      // Refresh user profile — must_change_password will be false now
      const updatedUser = await authService.me();
      useAuthStore.setState({ user: updatedUser });
      // Navigate to the appropriate dashboard
      navigate(
        updatedUser.role === "ADMIN" ? "/admin/users" : "/dashboard",
        { replace: true }
      );
    } catch (err: unknown) {
      setApiError(parseApiError(err));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md rounded-lg border bg-card p-8 shadow-sm">
        {/* Header */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
            <ShieldAlert className="h-7 w-7 text-amber-600" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-bold">Cambio de contraseña obligatorio</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Debes cambiar tu contraseña antes de continuar. Elige una contraseña segura.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          {/* Current password */}
          <div className="space-y-1.5">
            <label htmlFor="current_password" className="block text-sm font-medium">
              Contraseña actual
            </label>
            <input
              id="current_password"
              type="password"
              autoComplete="current-password"
              aria-invalid={!!errors.current_password}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              {...register("current_password")}
            />
            {errors.current_password && (
              <p role="alert" className="text-xs text-destructive">
                {errors.current_password.message}
              </p>
            )}
          </div>

          {/* New password */}
          <div className="space-y-1.5">
            <label htmlFor="new_password" className="block text-sm font-medium">
              Nueva contraseña
            </label>
            <input
              id="new_password"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.new_password}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              {...register("new_password")}
            />
            {errors.new_password && (
              <p role="alert" className="text-xs text-destructive">
                {errors.new_password.message}
              </p>
            )}
          </div>

          {/* Confirm password */}
          <div className="space-y-1.5">
            <label htmlFor="confirm_password" className="block text-sm font-medium">
              Confirmar contraseña
            </label>
            <input
              id="confirm_password"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.confirm_password}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              {...register("confirm_password")}
            />
            {errors.confirm_password && (
              <p role="alert" className="text-xs text-destructive">
                {errors.confirm_password.message}
              </p>
            )}
          </div>

          {/* API error */}
          {apiError && (
            <div
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {apiError}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Actualizando...
              </span>
            ) : (
              "Cambiar contraseña"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
