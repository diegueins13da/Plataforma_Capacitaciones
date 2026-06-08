import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn, AlertCircle } from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { tokenManager } from "../../services/tokenManager";

/**
 * P05 — Session Expired Modal
 *
 * Listens for the "session:expired" custom DOM event dispatched by api.ts
 * when the refresh token can no longer be renewed.  When the event fires,
 * it clears Zustand auth state and shows a blocking dialog.
 *
 * Mount once in App.tsx so it is always in the tree regardless of route.
 */
export function SessionExpiredModal() {
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleExpired = () => {
      // Ensure tokens and store are cleared
      tokenManager.clearTokens();
      useAuthStore.setState({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
      });
      setVisible(true);
    };

    window.addEventListener("session:expired", handleExpired);
    return () => window.removeEventListener("session:expired", handleExpired);
  }, []);

  const handleLogin = () => {
    setVisible(false);
    // navigate() preserves the current URL in location.state for post-login redirect
    navigate("/login", { replace: true });
  };

  if (!visible) return null;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      aria-modal="true"
      role="dialog"
      aria-labelledby="session-expired-title"
    >
      <div className="w-full max-w-sm rounded-lg bg-card p-6 shadow-xl">
        <div className="mb-4 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
            <AlertCircle className="h-6 w-6 text-amber-600" aria-hidden="true" />
          </div>
          <h2 id="session-expired-title" className="text-lg font-semibold">
            Sesión expirada
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tu sesión ha expirado por inactividad. Por favor inicia sesión nuevamente para continuar.
          </p>
        </div>

        <button
          type="button"
          onClick={handleLogin}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <LogIn className="h-4 w-4" aria-hidden="true" />
          Volver a iniciar sesión
        </button>
      </div>
    </div>
  );
}
