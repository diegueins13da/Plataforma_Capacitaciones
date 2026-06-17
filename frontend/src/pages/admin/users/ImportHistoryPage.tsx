/**
 * P29 — Import History Page
 *
 * Shows recent bulk import operations and provides access to exam attempt reset.
 * Full audit log history available in T34 (P39). Exam reset in T22.
 */
import { Link } from "react-router-dom";

export default function ImportHistoryPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Historial de importaciones</h1>
        <p className="text-sm text-gray-500 mt-1">
          Operaciones de importación masiva y gestión de intentos de examen.
        </p>
      </div>

      {/* Import history notice */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="text-3xl">📋</div>
          <div className="flex-1">
            <h2 className="font-semibold text-gray-900 mb-1">Historial de importaciones masivas</h2>
            <p className="text-sm text-gray-500 mb-4">
              El historial completo de todas las operaciones de importación estará disponible
              en el módulo de Reportes y Auditoría (Panel de Auditoría → P39).
            </p>
            <Link
              to="/admin/users/import"
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
            >
              Nueva importación
            </Link>
          </div>
        </div>
      </div>

      {/* Exam reset section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start gap-4">
          <div className="text-3xl">🔄</div>
          <div className="flex-1">
            <h2 className="font-semibold text-gray-900 mb-1">Resetear intentos de examen</h2>
            <p className="text-sm text-gray-500 mb-4">
              Permite resetear los intentos de examen de un usuario para que pueda volver a
              intentar una evaluación ya agotada. Esta funcionalidad estará disponible con
              el módulo de evaluaciones (T22).
            </p>
            <button
              disabled
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-400 text-sm font-medium rounded-lg cursor-not-allowed"
              title="Disponible con el módulo de evaluaciones"
            >
              Resetear intentos
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                Próximamente
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
