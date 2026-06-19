import { Link, useNavigate } from "react-router-dom";

export default function ForbiddenPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 text-center">
      <p className="text-8xl font-bold text-foreground/10 select-none">403</p>
      <h1 className="mt-4 text-xl font-semibold text-foreground">Acceso restringido</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        No tienes permiso para ver esta página.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="border border-border text-foreground text-sm px-5 py-2.5 rounded-xl hover:bg-muted/40 transition-colors"
        >
          ← Volver
        </button>
        <Link
          to="/dashboard"
          className="bg-indigo-600 text-white text-sm px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition-colors"
        >
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
