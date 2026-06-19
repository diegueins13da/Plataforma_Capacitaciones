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

// Colour-code action chips by prefix
function actionColor(accion: string): { color: string; bg: string } {
  const a = accion.toLowerCase();
  if (a.startsWith("login") || a.startsWith("auth"))
    return { color: "#818CF8", bg: "rgba(79,70,229,0.12)" };
  if (a.startsWith("create") || a.startsWith("add") || a.startsWith("new"))
    return { color: "#34D399", bg: "rgba(16,185,129,0.12)" };
  if (a.startsWith("delete") || a.startsWith("remove") || a.startsWith("deactivate"))
    return { color: "#F87171", bg: "rgba(239,68,68,0.12)" };
  if (a.startsWith("update") || a.startsWith("edit") || a.startsWith("change"))
    return { color: "#FCD34D", bg: "rgba(245,158,11,0.12)" };
  return { color: "#94a3b8", bg: "rgba(100,116,139,0.10)" };
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
  const inputCls =
    "h-9 rounded-lg border border-slate-700 bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-300";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Auditoría</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {data ? `${data.count} registro${data.count !== 1 ? "s" : ""}` : "Cargando…"}
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <form onSubmit={handleFilter} className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <i className="ti ti-at absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-base pointer-events-none" aria-hidden="true" />
          <input type="text" placeholder="Filtrar por correo…" value={filterEmail}
            onChange={(e) => setFilterEmail(e.target.value)}
            className={`${inputCls} w-full pl-9`} />
        </div>
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <i className="ti ti-terminal absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-base pointer-events-none" aria-hidden="true" />
          <input type="text" placeholder="Filtrar por acción…" value={filterAccion}
            onChange={(e) => setFilterAccion(e.target.value)}
            className={`${inputCls} w-full pl-9`} />
        </div>
        <button type="submit"
          className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all duration-300">
          Filtrar
        </button>
        {(filterEmail || filterAccion) && (
          <button type="button"
            onClick={() => { setFilterEmail(""); setFilterAccion(""); setPage(1); }}
            className="h-9 px-3 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-accent/50 transition-colors">
            <i className="ti ti-x text-sm" aria-hidden="true" />
          </button>
        )}
      </form>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-7 h-7 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
          </div>
        ) : !data || data.results.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-muted/40 flex items-center justify-center mx-auto mb-3">
              <i className="ti ti-list-details text-2xl text-muted-foreground" aria-hidden="true" />
            </div>
            <p className="text-sm text-muted-foreground">Sin registros de auditoría.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Fecha</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Usuario</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Acción</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide hidden sm:table-cell">IP</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.results.map((entry) => {
                const { color, bg } = actionColor(entry.accion);
                const hasDetails = Object.keys(entry.detalles_json).length > 0;
                return (
                  <>
                    <tr key={entry.id} className="hover:bg-accent/30 transition-colors">
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap font-mono">
                        {formatTs(entry.timestamp)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-foreground">{entry.user_email}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-mono font-medium"
                          style={{ color, background: bg }}>
                          {entry.accion}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono hidden sm:table-cell">
                        {entry.ip ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {hasDetails ? (
                          <button type="button"
                            onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center mx-auto text-muted-foreground hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors">
                            <i className={`ti ${expandedId === entry.id ? "ti-chevron-up" : "ti-chevron-down"} text-sm`} aria-hidden="true" />
                          </button>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                    </tr>
                    {expandedId === entry.id && (
                      <tr key={`${entry.id}-detail`}>
                        <td colSpan={5} className="px-4 pb-3">
                          <pre className="text-xs text-muted-foreground bg-background rounded-lg p-3 overflow-x-auto border border-border">
                            {JSON.stringify(entry.detalles_json, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button type="button" disabled={page === 1} onClick={() => setPage((p) => p - 1)}
            className="h-8 px-3 text-sm border border-border rounded-lg disabled:opacity-40 hover:bg-accent/50 transition-colors text-muted-foreground">
            ← Anterior
          </button>
          <span className="text-sm text-muted-foreground px-2">{page} / {totalPages}</span>
          <button type="button" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}
            className="h-8 px-3 text-sm border border-border rounded-lg disabled:opacity-40 hover:bg-accent/50 transition-colors text-muted-foreground">
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}
