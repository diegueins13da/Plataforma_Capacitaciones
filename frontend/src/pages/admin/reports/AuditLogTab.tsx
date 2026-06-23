import { useEffect, useState, useCallback } from "react";
import api from "../../../services/api";

interface AuditLogEntry {
  id: number;
  timestamp: string;
  actor_email: string;
  actor_nombre: string;
  actor_rol: string;
  accion: string;
  resultado: "OK" | "ERROR";
  ip: string | null;
  user_agent: string;
  entidad_tipo: string;
  entidad_id: string;
  entidad_nombre: string;
  detalles_json: Record<string, unknown>;
  error_detalle: string;
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
    second: "2-digit",
  });
}

function actionColor(accion: string): { color: string; bg: string } {
  const a = accion.toLowerCase();
  if (a.includes("login") || a.includes("logout") || a.includes("password"))
    return { color: "#818CF8", bg: "rgba(79,70,229,0.12)" };
  if (a.includes("created") || a.includes("enrolled") || a.includes("import") || a.includes("generated"))
    return { color: "#34D399", bg: "rgba(16,185,129,0.12)" };
  if (a.includes("deleted") || a.includes("deactivated") || a.includes("locked") || a.includes("failed"))
    return { color: "#F87171", bg: "rgba(239,68,68,0.12)" };
  if (a.includes("updated") || a.includes("changed") || a.includes("archived") || a.includes("reset"))
    return { color: "#FCD34D", bg: "rgba(245,158,11,0.12)" };
  if (a.includes("published") || a.includes("downloaded") || a.includes("completed"))
    return { color: "#38BDF8", bg: "rgba(14,165,233,0.12)" };
  return { color: "#94a3b8", bg: "rgba(100,116,139,0.10)" };
}

const ROL_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  TRAINER: "Instructor",
  USUARIO: "Usuario",
  SISTEMA: "Sistema",
};

export function AuditLogTab() {
  const [data, setData] = useState<PaginatedAuditLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filterEmail, setFilterEmail] = useState("");
  const [filterAccion, setFilterAccion] = useState("");
  const [filterResultado, setFilterResultado] = useState("");
  const [filterEntidad, setFilterEntidad] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page };
      if (filterEmail) params.actor_email = filterEmail;
      if (filterAccion) params.accion = filterAccion;
      if (filterResultado) params.resultado = filterResultado;
      if (filterEntidad) params.entidad_tipo = filterEntidad;
      const res = await api.get<PaginatedAuditLog>("/v1/reports/audit-logs/", { params });
      setData(res.data);
    } finally {
      setLoading(false);
    }
  }, [page, filterEmail, filterAccion, filterResultado, filterEntidad]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  function handleFilter(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    void fetchLogs();
  }

  function clearFilters() {
    setFilterEmail("");
    setFilterAccion("");
    setFilterResultado("");
    setFilterEntidad("");
    setPage(1);
  }

  const hasFilters = filterEmail || filterAccion || filterResultado || filterEntidad;
  const totalPages = data ? Math.ceil(data.count / 50) : 1;

  const inputCls =
    "h-9 rounded-lg border border-slate-700 bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-300";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Registro de Auditoría</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {data
              ? `${data.count} evento${data.count !== 1 ? "s" : ""} — no repudio garantizado`
              : "Cargando…"}
          </p>
        </div>
      </div>

      <form onSubmit={handleFilter} className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[160px] max-w-[220px]">
          <i className="ti ti-at absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-base pointer-events-none" aria-hidden="true" />
          <input type="text" placeholder="Correo del actor…" value={filterEmail}
            onChange={(e) => setFilterEmail(e.target.value)}
            className={`${inputCls} w-full pl-9`} />
        </div>
        <div className="relative flex-1 min-w-[160px] max-w-[220px]">
          <i className="ti ti-terminal absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-base pointer-events-none" aria-hidden="true" />
          <input type="text" placeholder="Tipo de acción…" value={filterAccion}
            onChange={(e) => setFilterAccion(e.target.value)}
            className={`${inputCls} w-full pl-9`} />
        </div>
        <select value={filterResultado} onChange={(e) => setFilterResultado(e.target.value)}
          className={`${inputCls} min-w-[120px]`}>
          <option value="">Resultado</option>
          <option value="OK">OK</option>
          <option value="ERROR">ERROR</option>
        </select>
        <select value={filterEntidad} onChange={(e) => setFilterEntidad(e.target.value)}
          className={`${inputCls} min-w-[130px]`}>
          <option value="">Entidad</option>
          <option value="User">Usuario</option>
          <option value="Course">Curso</option>
          <option value="Module">Módulo</option>
          <option value="Assessment">Evaluación</option>
          <option value="Certificate">Certificado</option>
          <option value="Config">Config</option>
        </select>
        <button type="submit"
          className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all duration-300">
          Filtrar
        </button>
        {hasFilters && (
          <button type="button" onClick={clearFilters}
            className="h-9 px-3 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-accent/50 transition-colors">
            <i className="ti ti-x text-sm" aria-hidden="true" />
          </button>
        )}
      </form>

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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">Fecha / Hora</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Actor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Acción</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Entidad</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide">Res.</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide">+</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.results.map((entry) => {
                  const { color, bg } = actionColor(entry.accion);
                  const isExpanded = expandedId === entry.id;
                  const hasExtra =
                    Object.keys(entry.detalles_json).length > 0 ||
                    !!entry.error_detalle ||
                    !!entry.ip;

                  return (
                    <>
                      <tr key={entry.id} className="hover:bg-accent/30 transition-colors">
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap font-mono">
                          {formatTs(entry.timestamp)}
                        </td>
                        <td className="px-4 py-3 max-w-[180px]">
                          <div className="text-sm text-foreground truncate" title={entry.actor_email}>
                            {entry.actor_nombre || entry.actor_email || "—"}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-xs text-muted-foreground truncate">{entry.actor_email}</span>
                            {entry.actor_rol && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted/50 text-muted-foreground shrink-0">
                                {ROL_LABELS[entry.actor_rol] ?? entry.actor_rol}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-block px-2.5 py-1 rounded-full text-xs font-mono font-medium"
                            style={{ color, background: bg }}>
                            {entry.accion}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell max-w-[180px]">
                          {entry.entidad_tipo ? (
                            <div>
                              <span className="text-xs font-medium text-muted-foreground uppercase">{entry.entidad_tipo}</span>
                              {entry.entidad_nombre && (
                                <div className="text-xs text-foreground/70 truncate mt-0.5" title={entry.entidad_nombre}>
                                  {entry.entidad_nombre}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                            entry.resultado === "OK"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-red-500/10 text-red-400"
                          }`}>
                            <i className={`ti ${entry.resultado === "OK" ? "ti-check" : "ti-x"} text-xs`} />
                            {entry.resultado}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {hasExtra ? (
                            <button type="button"
                              onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center mx-auto text-muted-foreground hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors">
                              <i className={`ti ${isExpanded ? "ti-chevron-up" : "ti-chevron-down"} text-sm`} aria-hidden="true" />
                            </button>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${entry.id}-detail`}>
                          <td colSpan={6} className="px-4 pb-4 pt-1 bg-background/50">
                            <div className="space-y-2">
                              {entry.ip && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <i className="ti ti-map-pin text-sm" />
                                  <span>IP: <span className="font-mono text-foreground">{entry.ip}</span></span>
                                  {entry.user_agent && (
                                    <span className="truncate max-w-[360px]" title={entry.user_agent}>
                                      — {entry.user_agent}
                                    </span>
                                  )}
                                </div>
                              )}
                              {Object.keys(entry.detalles_json).length > 0 && (
                                <pre className="text-xs text-muted-foreground bg-background rounded-lg p-3 overflow-x-auto border border-border">
                                  {JSON.stringify(entry.detalles_json, null, 2)}
                                </pre>
                              )}
                              {entry.error_detalle && (
                                <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                                  <p className="text-xs font-medium text-red-400 mb-1">Error:</p>
                                  <pre className="text-xs text-red-300/80 whitespace-pre-wrap break-all">{entry.error_detalle}</pre>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
