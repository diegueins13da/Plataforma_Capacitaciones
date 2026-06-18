import { Link, useNavigate } from "react-router-dom";

export default function ForbiddenPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 text-center">
      <p className="text-8xl font-bold text-gray-200 select-none">403</p>
      <h1 className="mt-4 text-xl font-semibold text-gray-800">Acceso restringido</h1>
      <p className="mt-2 text-sm text-gray-500">
        No tienes permiso para ver esta página.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="border border-gray-200 text-gray-700 text-sm px-5 py-2.5 rounded-xl hover:bg-gray-100 transition-colors"
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
