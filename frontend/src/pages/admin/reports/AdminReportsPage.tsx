/**
 * T34 / P24 — Audit log viewer for admins.
 * Displays paginated AuditLog records with filters by user email and action.
 */
import { useEffect, useState, useCallback } from "react";
import api from "../../../services/api";

interface AuditLogEntry {
  id: number;
  user_email: string;
  accion: string;
  ip: string | null;
  timestamp: string;
  detalles_json: Record<string, unknown>;
}

interface PaginatedAuditLog {
  count: number;
  next: string | null;
  previous: string | null;
  results: AuditLogEntry[];
}

function formatTs(iso: string): string {
  return new Date(iso).toLocaleString("es-EC", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminReportsPage() {
  const [data, setData] = useState<PaginatedAuditLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filterEmail, setFilterEmail] = useState("");
  const [filterAccion, setFilterAccion] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page };
      if (filterEmail) params.user_email = filterEmail;
      if (filterAccion) params.accion = filterAccion;
      const res = await api.get<PaginatedAuditLog>("/v1/reports/audit-logs/", { params });
      setData(res.data);
    } finally {
      setLoading(false);
    }
  }, [page, filterEmail, filterAccion]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  function handleFilter(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    void fetchLogs();
  }

  const totalPages = data ? Math.ceil(data.count / 50) : 1;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Registro de auditoría</h1>
        {data && (
          <span className="text-sm text-gray-500">{data.count} registros</span>
        )}
      </div>

      {/* Filters */}
      <form onSubmit={handleFilter} className="flex gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Filtrar por correo"
          value={filterEmail}
          onChange={(e) => setFilterEmail(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-56"
        />
        <input
          type="text"
          placeholder="Filtrar por acción"
          value={filterAccion}
          onChange={(e) => setFilterAccion(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-56"
        />
        <button
          type="submit"
          className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700"
        >
          Filtrar
        </button>
        {(filterEmail || filterAccion) && (
          <button
            type="button"
            onClick={() => {
              setFilterEmail("");
              setFilterAccion("");
              setPage(1);
            }}
            className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2"
          >
            Limpiar
          </button>
        )}
      </form>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          </div>
        ) : !data || data.results.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">No hay registros.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Fecha</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Usuario</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Acción</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">IP</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Detalles</th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((entry) => (
                <>
                  <tr
                    key={entry.id}
                    className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {formatTs(entry.timestamp)}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{entry.user_email}</td>
                    <td className="px-4 py-3">
                      <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs font-mono">
                        {entry.accion}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                      {entry.ip ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {Object.keys(entry.detalles_json).length > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedId(expandedId === entry.id ? null : entry.id)
                          }
                          className="text-indigo-600 text-xs hover:underline"
                        >
                          {expandedId === entry.id ? "Ocultar" : "Ver"}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandedId === entry.id && (
                    <tr key={`${entry.id}-detail`} className="bg-gray-50">
                      <td colSpan={5} className="px-4 py-3">
                        <pre className="text-xs text-gray-600 overflow-x-auto">
                          {JSON.stringify(entry.detalles_json, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            ← Anterior
          </button>
          <span className="text-sm text-gray-500">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}
