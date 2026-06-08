import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Lock } from "lucide-react";

interface LocationState {
  minutesRemaining?: number;
}

export default function AccountLockedPage() {
  const location = useLocation();
  const state = location.state as LocationState | undefined;
  const initial = state?.minutesRemaining ?? 15;

  const [minutesLeft, setMinutesLeft] = useState(initial);

  // Count down by 1 each minute
  useEffect(() => {
    if (minutesLeft <= 0) return;
    const id = setInterval(() => {
      setMinutesLeft((m) => Math.max(0, m - 1));
    }, 60_000);
    return () => clearInterval(id);
  }, [minutesLeft]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md rounded-lg border bg-card p-8 shadow-sm text-center">
        <div className="mb-4 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <Lock className="h-8 w-8 text-destructive" aria-hidden="true" />
          </div>
        </div>

        <h1 className="mb-2 text-xl font-bold">Cuenta bloqueada</h1>

        {minutesLeft > 0 ? (
          <>
            <p className="mb-1 text-sm text-muted-foreground">
              Tu cuenta está bloqueada temporalmente por demasiados intentos fallidos.
            </p>
            <p className="mb-6 text-sm text-muted-foreground">
              Tiempo restante:{" "}
              <span className="font-semibold text-foreground">
                {minutesLeft} {minutesLeft === 1 ? "minuto" : "minutos"}
              </span>
            </p>
          </>
        ) : (
          <p className="mb-6 text-sm text-muted-foreground">
            Ya puedes intentar iniciar sesión nuevamente.
          </p>
        )}

        <Link
          to="/login"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Volver al login
        </Link>
      </div>
    </div>
  );
}
