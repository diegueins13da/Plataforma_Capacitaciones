import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { coursesService, type CourseEnrollmentUser } from "../../services/coursesService";

interface Props {
  courseId: number;
  courseTitle: string;
  onClose: () => void;
}

const ESTADO_LABELS: Record<string, { label: string; cls: string; icon: string }> = {
  EN_PROGRESO: { label: "En progreso",  cls: "bg-indigo-500/10 text-indigo-400",  icon: "ti-book-2" },
  COMPLETADO:  { label: "Completado",   cls: "bg-emerald-500/10 text-emerald-400", icon: "ti-circle-check" },
  VENCIDO:     { label: "Vencido",      cls: "bg-red-500/10 text-red-400",         icon: "ti-alert-triangle" },
};

const ROLE_LABELS: Record<string, string> = {
  USUARIO:  "Usuario",
  TRAINER:  "Instructor",
  ADMIN:    "Admin",
};

const INPUT = "w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-colors";

export function CourseAssignUsersModal({ courseId, courseTitle, onClose }: Props) {
  const [users, setUsers] = useState<CourseEnrollmentUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<"" | "USUARIO" | "TRAINER">("");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    setLoading(true);
    coursesService
      .getCourseEnrollmentUsers(courseId)
      .then(setUsers)
      .catch(() => toast.error("No se pudo cargar la lista de usuarios."))
      .finally(() => setLoading(false));
  }, [courseId]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter((u) => {
      const matchSearch = !q || u.nombre.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      const matchRole = !filterRole || u.role === filterRole;
      return matchSearch && matchRole;
    });
  }, [users, search, filterRole]);

  // Stats
  const notEnrolled = useMemo(() => filtered.filter((u) => !u.estado_inscripcion), [filtered]);
  const alreadyEnrolled = useMemo(() => filtered.filter((u) => !!u.estado_inscripcion), [filtered]);

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      notEnrolled.forEach((u) => next.add(u.id));
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function handleAssign() {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      const { created, skipped } = await coursesService.bulkAssignUsers(courseId, [...selected]);
      const msgs = [];
      if (created > 0) msgs.push(`${created} usuario${created !== 1 ? "s" : ""} inscrito${created !== 1 ? "s" : ""}`);
      if (skipped > 0) msgs.push(`${skipped} ya estaba${skipped !== 1 ? "n" : ""} inscrito${skipped !== 1 ? "s" : ""}`);
      toast.success(msgs.join(" · "));
      // Refresh the list to show updated enrollment states
      const updated = await coursesService.getCourseEnrollmentUsers(courseId);
      setUsers(updated);
      setSelected(new Set());
    } catch {
      toast.error("No se pudo completar la asignación.", { duration: 6000 });
    } finally {
      setSaving(false);
    }
  }

  const totalEnrolled = users.filter((u) => !!u.estado_inscripcion).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[88vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background rounded-t-2xl shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
              <i className="ti ti-user-plus text-emerald-400 text-lg" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground leading-tight">Asignar usuarios</h2>
              <p className="text-xs text-muted-foreground truncate max-w-xs">{courseTitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {totalEnrolled > 0 && (
              <span className="text-xs px-2.5 py-1 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">
                {totalEnrolled} inscritos
              </span>
            )}
            <button type="button" onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-accent/50 text-muted-foreground transition-colors"
              aria-label="Cerrar">
              <i className="ti ti-x text-base" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="px-6 py-3 border-b border-border bg-background shrink-0">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm" aria-hidden="true" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre o correo..."
                className={INPUT + " pl-8"}
                autoFocus
              />
            </div>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value as typeof filterRole)}
              className={INPUT + " w-40"}>
              <option value="">Todos los roles</option>
              <option value="USUARIO">Usuario</option>
              <option value="TRAINER">Instructor</option>
            </select>
          </div>
        </div>

        {/* Selection bar */}
        {selected.size > 0 && (
          <div className="px-6 py-2 bg-indigo-500/8 border-b border-indigo-500/20 shrink-0 flex items-center justify-between">
            <span className="text-xs text-indigo-400">
              <strong>{selected.size}</strong> usuario{selected.size !== 1 ? "s" : ""} seleccionado{selected.size !== 1 ? "s" : ""}
            </span>
            <button type="button" onClick={clearSelection}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Limpiar selección
            </button>
          </div>
        )}

        {/* User list */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-7 h-7 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <i className="ti ti-users text-3xl block mb-2 opacity-30" aria-hidden="true" />
              No hay usuarios que coincidan con la búsqueda.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Not enrolled */}
              {notEnrolled.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Sin inscribir ({notEnrolled.length})
                    </p>
                    {notEnrolled.length > 1 && (
                      <button type="button" onClick={selectAllVisible}
                        className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                        Seleccionar todos
                      </button>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {notEnrolled.map((u) => (
                      <label key={u.id}
                        className="flex items-center gap-3 p-3 rounded-xl border border-border bg-background hover:border-indigo-500/30 hover:bg-indigo-500/5 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={selected.has(u.id)}
                          onChange={() => toggle(u.id)}
                          className="w-4 h-4 rounded border-border text-indigo-600 bg-card focus:ring-indigo-500 focus:ring-offset-0"
                        />
                        <div className="w-8 h-8 rounded-full bg-indigo-500/15 flex items-center justify-center shrink-0 text-indigo-400 font-semibold text-xs">
                          {u.nombre.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{u.nombre}</p>
                          <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">{ROLE_LABELS[u.role] ?? u.role}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Already enrolled */}
              {alreadyEnrolled.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Ya inscritos ({alreadyEnrolled.length})
                  </p>
                  <div className="space-y-1.5">
                    {alreadyEnrolled.map((u) => {
                      const s = ESTADO_LABELS[u.estado_inscripcion!] ?? { label: u.estado_inscripcion!, cls: "bg-muted/20 text-muted-foreground", icon: "ti-clock" };
                      return (
                        <div key={u.id}
                          className="flex items-center gap-3 p-3 rounded-xl border border-border bg-background opacity-60">
                          <div className="w-4 h-4 flex items-center justify-center shrink-0">
                            <i className="ti ti-lock text-muted-foreground text-xs" aria-hidden="true" />
                          </div>
                          <div className="w-8 h-8 rounded-full bg-muted/30 flex items-center justify-center shrink-0 text-muted-foreground font-semibold text-xs">
                            {u.nombre.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground truncate">{u.nombre}</p>
                            <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0 ${s.cls}`}>
                            <i className={`ti ${s.icon} text-xs`} aria-hidden="true" />
                            {s.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-background rounded-b-2xl shrink-0">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <i className="ti ti-info-circle text-sm" aria-hidden="true" />
            Los usuarios inscritos recibirán acceso inmediato al curso
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 border border-border text-muted-foreground text-sm rounded-lg hover:bg-accent/50 transition-colors">
              Cerrar
            </button>
            <button
              type="button"
              onClick={() => void handleAssign()}
              disabled={selected.size === 0 || saving}
              className="px-5 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2 transition-colors">
              {saving ? (
                <><div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Asignando...</>
              ) : (
                <><i className="ti ti-user-plus text-base" aria-hidden="true" />Asignar {selected.size > 0 ? `(${selected.size})` : ""}</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
