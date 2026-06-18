import { Link } from "react-router-dom";

export default function ServerErrorPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 text-center">
      <p className="text-8xl font-bold text-gray-200 select-none">500</p>
      <h1 className="mt-4 text-xl font-semibold text-gray-800">Error del servidor</h1>
      <p className="mt-2 text-sm text-gray-500">
        Algo salió mal. Intenta de nuevo en unos momentos.
      </p>
      <Link
        to="/dashboard"
        className="mt-6 inline-block bg-indigo-600 text-white text-sm px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition-colors"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
