import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import api from "../../services/api";

interface GradeRow {
  user_id: number;
  nombre: string;
  email: string;
  curso_id: number;
  curso_titulo: string;
  progreso: number;
  estado: string;
  nota: number | null;
  aprobado: boolean | null;
  fecha_examen: string | null;
}

const ESTADO_LABELS: Record<string, string> = {
  EN_PROGRESO: "En progreso",
  COMPLETADO: "Completado",
  VENCIDO: "Vencido",
  NO_INICIADO: "No iniciado",
};

function EstadoBadge({ estado }: { estado: string }) {
  const color: Record<string, string> = {
    COMPLETADO: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    EN_PROGRESO: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    VENCIDO: "bg-red-500/10 text-red-400 border-red-500/20",
    NO_INICIADO: "bg-muted/40 text-muted-foreground border-border",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${color[estado] ?? color.NO_INICIADO}`}>
      {ESTADO_LABELS[estado] ?? estado}
    </span>
  );
}

export default function InstructorGradesPage() {
  const [rows, setRows] = useState<GradeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCurso, setFilterCurso] = useState("");
  const [sortKey, setSortKey] = useState<keyof GradeRow>("curso_titulo");
  const [sortAsc, setSortAsc] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ results: GradeRow[] }>("/v1/instructor/grades/");
      setRows(res.data.results);
    } catch {
      toast.error("No se pudieron cargar las calificaciones.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const cursos = Array.from(new Set(rows.map((r) => r.curso_titulo))).sort();

  const filtered = rows.filter((r) => {
    const matchCurso = !filterCurso || r.curso_titulo === filterCurso;
    const matchSearch = !search ||
      r.nombre.toLowerCase().includes(search.toLowerCase()) ||
      r.email.toLowerCase().includes(search.toLowerCase());
    return matchCurso && matchSearch;
  });

  function toggleSort(key: keyof GradeRow) {
    if (sortKey === key) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(true); }
  }

  const sorted = [...filtered].sort((a, b) => {
    const va = a[sortKey] ?? "";
    const vb = b[sortKey] ?? "";
    if (va < vb) return sortAsc ? -1 : 1;
    if (va > vb) return sortAsc ? 1 : -1;
    return 0;
  });

  function SortIcon({ col }: { col: keyof GradeRow }) {
    if (sortKey !== col) return <i className="ti ti-arrows-sort text-[10px] opacity-30" />;
    return <i className={`ti ${sortAsc ? "ti-sort-ascending" : "ti-sort-descending"} text-[10px] text-indigo-400`} />;
  }

  const totalAprobados = filtered.filter((r) => r.aprobado === true).length;
  const totalConNota = filtered.filter((r) => r.nota !== null).length;
  const promedio = totalConNota > 0
    ? (filtered.filter((r) => r.nota !== null).reduce((s, r) => s + r.nota!, 0) / totalConNota).toFixed(1)
    : "—";

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Calificaciones</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Resultados de examen de todos tus alumnos, en todos tus cursos.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Total alumnos</p>
          <p className="text-2xl font-bold text-foreground">{filtered.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Aprobados</p>
          <p className="text-2xl font-bold text-emerald-400">
            {totalAprobados}
            {totalConNota > 0 && (
              <span className="text-sm font-normal text-muted-foreground ml-1">
                ({Math.round((totalAprobados / totalConNota) * 100)}%)
              </span>
            )}
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Nota promedio</p>
          <p className="text-2xl font-bold text-indigo-400">{promedio}{totalConNota > 0 ? "%" : ""}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar alumno…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-colors"
          />
        </div>
        <select
          value={filterCurso}
          onChange={(e) => setFilterCurso(e.target.value)}
          className="h-9 rounded-xl border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
        >
          <option value="">Todos los cursos</option>
          {cursos.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button
          type="button"
          onClick={() => void load()}
          title="Recargar"
          className="h-9 w-9 flex items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
        >
          <i className="ti ti-refresh text-sm" />
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-16">
          <i className="ti ti-chart-bar text-4xl text-muted-foreground/40 block mb-2" />
          <p className="text-muted-foreground text-sm">No hay resultados.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  {[
                    { key: "nombre" as keyof GradeRow, label: "Alumno" },
                    { key: "curso_titulo" as keyof GradeRow, label: "Curso" },
                    { key: "progreso" as keyof GradeRow, label: "Progreso" },
                    { key: "estado" as keyof GradeRow, label: "Estado" },
                    { key: "nota" as keyof GradeRow, label: "Nota" },
                    { key: "aprobado" as keyof GradeRow, label: "Resultado" },
                  ].map(({ key, label }) => (
                    <th
                      key={key}
                      onClick={() => toggleSort(key)}
                      className="text-left px-4 py-3 font-medium cursor-pointer hover:text-foreground select-none"
                    >
                      <span className="flex items-center gap-1">
                        {label} <SortIcon col={key} />
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sorted.map((row, i) => (
                  <tr key={`${row.user_id}-${row.curso_id}-${i}`} className="hover:bg-accent/20 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{row.nombre}</p>
                      <p className="text-xs text-muted-foreground">{row.email}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[200px]">
                      <span className="truncate block">{row.curso_titulo}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-muted/40 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 rounded-full"
                            style={{ width: `${row.progreso}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{row.progreso}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <EstadoBadge estado={row.estado} />
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {row.nota !== null ? (
                        <span className={row.aprobado ? "text-emerald-400" : "text-red-400"}>
                          {row.nota.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {row.aprobado === true && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                          Aprobado
                        </span>
                      )}
                      {row.aprobado === false && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 font-medium">
                          Reprobado
                        </span>
                      )}
                      {row.aprobado === null && (
                        <span className="text-xs text-muted-foreground">Sin examen</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
            {sorted.length} resultado{sorted.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}
    </div>
  );
}
