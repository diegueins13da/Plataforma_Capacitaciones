import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { coursesService, type CourseEnrollmentUser } from "../../services/coursesService";

interface Props {
  courseId: number;
  courseTitle: string;
  onClose: () => void;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const ESTADO_LABELS: Record<string, { label: string; cls: string; icon: string }> = {
  EN_PROGRESO: { label: "En progreso",  cls: "bg-indigo-500/10 text-indigo-400",   icon: "ti-book-2" },
  COMPLETADO:  { label: "Completado",   cls: "bg-emerald-500/10 text-emerald-400", icon: "ti-circle-check" },
  VENCIDO:     { label: "Vencido",      cls: "bg-red-500/10 text-red-400",         icon: "ti-alert-triangle" },
};

const ROLE_LABELS: Record<string, string> = {
  USUARIO:  "Usuario",
  TRAINER:  "Instructor",
  ADMIN:    "Admin",
};

const DEPT_COLORS = [
  "bg-violet-500/15 text-violet-400",
  "bg-sky-500/15 text-sky-400",
  "bg-amber-500/15 text-amber-400",
  "bg-rose-500/15 text-rose-400",
  "bg-teal-500/15 text-teal-400",
  "bg-orange-500/15 text-orange-400",
  "bg-fuchsia-500/15 text-fuchsia-400",
  "bg-cyan-500/15 text-cyan-400",
];

const INPUT = "w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-colors";

// ─── Derived types ───────────────────────────────────────────────────────────

interface DeptGroup {
  grupo_id: number;
  grupo_nombre: string;
  areas: string[];
  total: number;
  enrolled: number;
  colorIdx: number;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function CourseAssignUsersModal({ courseId, courseTitle, onClose }: Props) {
  const [tab, setTab] = useState<"depto" | "individual">("depto");
  const [users, setUsers] = useState<CourseEnrollmentUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterArea, setFilterArea] = useState("");
  const [filterRole, setFilterRole] = useState<"" | "USUARIO" | "TRAINER">("");
  const [selectedGroups, setSelectedGroups] = useState<Set<number>>(new Set());
  const [selectedUsers, setSelectedUsers] = useState<Set<number>>(new Set());

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

  // Reset search/filters when switching tabs
  useEffect(() => {
    setSearch("");
    setFilterArea("");
    setFilterRole("");
  }, [tab]);

  // ── Department tab derived data ────────────────────────────────────────────

  const deptGroups = useMemo<DeptGroup[]>(() => {
    const map = new Map<number, { nombre: string; areasSet: Set<string>; total: number; enrolled: number }>();
    for (const u of users) {
      if (!u.grupo_id || !u.grupo_nombre) continue;
      if (!map.has(u.grupo_id)) {
        map.set(u.grupo_id, { nombre: u.grupo_nombre, areasSet: new Set(), total: 0, enrolled: 0 });
      }
      const d = map.get(u.grupo_id)!;
      if (u.area) d.areasSet.add(u.area);
      d.total++;
      if (u.estado_inscripcion) d.enrolled++;
    }
    return [...map.entries()]
      .map(([id, d], idx) => ({
        grupo_id: id,
        grupo_nombre: d.nombre,
        areas: [...d.areasSet].sort(),
        total: d.total,
        enrolled: d.enrolled,
        colorIdx: idx % DEPT_COLORS.length,
      }))
      .sort((a, b) => a.grupo_nombre.localeCompare(b.grupo_nombre));
  }, [users]);

  const allAreas = useMemo<string[]>(() => {
    const s = new Set<string>();
    for (const d of deptGroups) d.areas.forEach(a => s.add(a));
    return [...s].sort();
  }, [deptGroups]);

  const filteredDepts = useMemo(() => {
    const q = search.toLowerCase();
    return deptGroups.filter(d => {
      const matchSearch = !q || d.grupo_nombre.toLowerCase().includes(q);
      const matchArea = !filterArea || d.areas.includes(filterArea);
      return matchSearch && matchArea;
    });
  }, [deptGroups, search, filterArea]);

  // Count available (non-enrolled) users in selected groups
  const selectedGroupsInfo = useMemo(() => {
    let totalUsers = 0;
    let availableUsers = 0;
    for (const d of deptGroups) {
      if (selectedGroups.has(d.grupo_id)) {
        totalUsers += d.total;
        availableUsers += d.total - d.enrolled;
      }
    }
    return { totalUsers, availableUsers };
  }, [deptGroups, selectedGroups]);

  // ── Individual tab derived data ────────────────────────────────────────────

  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter(u => {
      const matchSearch = !q || u.nombre.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      const matchRole = !filterRole || u.role === filterRole;
      return matchSearch && matchRole;
    });
  }, [users, search, filterRole]);

  const notEnrolled = useMemo(() => filteredUsers.filter(u => !u.estado_inscripcion), [filteredUsers]);
  const alreadyEnrolled = useMemo(() => filteredUsers.filter(u => !!u.estado_inscripcion), [filteredUsers]);
  const totalEnrolled = useMemo(() => users.filter(u => !!u.estado_inscripcion).length, [users]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function toggleGroup(id: number) {
    setSelectedGroups(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleUser(id: number) {
    setSelectedUsers(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAllDepts() {
    setSelectedGroups(new Set(filteredDepts.map(d => d.grupo_id)));
  }

  function selectAllVisibleUsers() {
    setSelectedUsers(prev => {
      const next = new Set(prev);
      notEnrolled.forEach(u => next.add(u.id));
      return next;
    });
  }

  async function handleAssign() {
    setSaving(true);
    try {
      let created = 0;
      let skipped = 0;

      if (tab === "depto") {
        if (selectedGroups.size === 0) return;
        const res = await coursesService.enrollGroup(courseId, [...selectedGroups]);
        created = res.created;
        skipped = res.skipped;
        setSelectedGroups(new Set());
      } else {
        if (selectedUsers.size === 0) return;
        const res = await coursesService.bulkAssignUsers(courseId, [...selectedUsers]);
        created = res.created;
        skipped = res.skipped;
        setSelectedUsers(new Set());
      }

      const msgs: string[] = [];
      if (created > 0) msgs.push(`${created} usuario${created !== 1 ? "s" : ""} inscrito${created !== 1 ? "s" : ""}`);
      if (skipped > 0) msgs.push(`${skipped} ya estaba${skipped !== 1 ? "n" : ""} inscrito${skipped !== 1 ? "s" : ""}`);
      toast.success(msgs.join(" · ") || "Sin cambios.");

      // Refresh list
      const updated = await coursesService.getCourseEnrollmentUsers(courseId);
      setUsers(updated);
    } catch {
      toast.error("No se pudo completar la asignación.", { duration: 6000 });
    } finally {
      setSaving(false);
    }
  }

  const canAssign = tab === "depto" ? selectedGroups.size > 0 : selectedUsers.size > 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">

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

        {/* Tabs */}
        <div className="px-6 pt-3 pb-0 border-b border-border bg-background shrink-0">
          <div className="flex gap-1">
            {(["depto", "individual"] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
                  tab === t
                    ? "border-indigo-500 text-indigo-400 bg-indigo-500/5"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "depto" ? (
                  <span className="flex items-center gap-1.5">
                    <i className="ti ti-building-community text-sm" aria-hidden="true" />
                    Por departamento
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <i className="ti ti-users text-sm" aria-hidden="true" />
                    Individual
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="px-6 py-3 border-b border-border bg-background shrink-0">
          {tab === "depto" ? (
            <div className="flex gap-2">
              <div className="relative" style={{ flex: "0 0 65%" }}>
                <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm" aria-hidden="true" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar departamento..."
                  className={INPUT + " pl-8"}
                  autoFocus
                />
              </div>
              {allAreas.length > 0 && (
                <select
                  value={filterArea}
                  onChange={e => setFilterArea(e.target.value)}
                  className={INPUT}
                  style={{ flex: "0 0 calc(35% - 0.5rem)" }}>
                  <option value="">Todas las áreas</option>
                  {allAreas.map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              )}
            </div>
          ) : (
            <div className="flex gap-2">
              <div className="relative flex-1">
                <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm" aria-hidden="true" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar por nombre o correo..."
                  className={INPUT + " pl-8"}
                  autoFocus
                />
              </div>
              <select
                value={filterRole}
                onChange={e => setFilterRole(e.target.value as typeof filterRole)}
                className={INPUT + " w-40"}>
                <option value="">Todos los roles</option>
                <option value="USUARIO">Usuario</option>
                <option value="TRAINER">Instructor</option>
              </select>
            </div>
          )}
        </div>

        {/* Selection bar */}
        {(tab === "depto" ? selectedGroups.size > 0 : selectedUsers.size > 0) && (
          <div className="px-6 py-2 bg-indigo-500/8 border-b border-indigo-500/20 shrink-0 flex items-center justify-between">
            {tab === "depto" ? (
              <span className="text-xs text-indigo-400">
                <strong>{selectedGroups.size}</strong> depto{selectedGroups.size !== 1 ? "s" : ""} seleccionado{selectedGroups.size !== 1 ? "s" : ""}
                {selectedGroupsInfo.availableUsers > 0 && (
                  <> · <strong>{selectedGroupsInfo.availableUsers}</strong> usuarios a inscribir</>
                )}
              </span>
            ) : (
              <span className="text-xs text-indigo-400">
                <strong>{selectedUsers.size}</strong> usuario{selectedUsers.size !== 1 ? "s" : ""} seleccionado{selectedUsers.size !== 1 ? "s" : ""}
              </span>
            )}
            <button
              type="button"
              onClick={() => tab === "depto" ? setSelectedGroups(new Set()) : setSelectedUsers(new Set())}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Limpiar
            </button>
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-7 h-7 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
            </div>
          ) : tab === "depto" ? (
            <DeptoList
              depts={filteredDepts}
              selected={selectedGroups}
              onToggle={toggleGroup}
              onSelectAll={selectAllDepts}
            />
          ) : (
            <IndividualList
              notEnrolled={notEnrolled}
              alreadyEnrolled={alreadyEnrolled}
              selected={selectedUsers}
              onToggle={toggleUser}
              onSelectAll={selectAllVisibleUsers}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-background rounded-b-2xl shrink-0">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <i className="ti ti-info-circle text-sm" aria-hidden="true" />
            Los usuarios inscritos recibirán acceso inmediato
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 border border-border text-muted-foreground text-sm rounded-lg hover:bg-accent/50 transition-colors">
              Cerrar
            </button>
            <button
              type="button"
              onClick={() => void handleAssign()}
              disabled={!canAssign || saving}
              className="px-5 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2 transition-colors">
              {saving ? (
                <><div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Asignando...</>
              ) : tab === "depto" ? (
                <><i className="ti ti-building-community text-base" aria-hidden="true" />Inscribir departamentos{selectedGroups.size > 0 ? ` (${selectedGroups.size})` : ""}</>
              ) : (
                <><i className="ti ti-user-plus text-base" aria-hidden="true" />Asignar{selectedUsers.size > 0 ? ` (${selectedUsers.size})` : ""}</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DeptoList({
  depts,
  selected,
  onToggle,
  onSelectAll,
}: {
  depts: DeptGroup[];
  selected: Set<number>;
  onToggle: (id: number) => void;
  onSelectAll: () => void;
}) {
  if (depts.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        <i className="ti ti-building-community text-3xl block mb-2 opacity-30" aria-hidden="true" />
        No hay departamentos que coincidan.
      </div>
    );
  }

  const available = depts.filter(d => d.total > d.enrolled);
  const fullyEnrolled = depts.filter(d => d.total > 0 && d.total === d.enrolled);

  return (
    <div className="space-y-4">
      {available.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Departamentos ({available.length})
            </p>
            {available.length > 1 && (
              <button type="button" onClick={onSelectAll}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                Seleccionar todos
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            {available.map(d => {
              const isSelected = selected.has(d.grupo_id);
              const pct = d.total > 0 ? Math.round((d.enrolled / d.total) * 100) : 0;
              return (
                <label key={d.grupo_id}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    isSelected
                      ? "border-indigo-500/40 bg-indigo-500/8"
                      : "border-border bg-background hover:border-indigo-500/30 hover:bg-indigo-500/5"
                  }`}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggle(d.grupo_id)}
                    className="w-4 h-4 rounded border-border text-indigo-600 bg-card focus:ring-indigo-500 focus:ring-offset-0"
                  />
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-base font-bold ${DEPT_COLORS[d.colorIdx]}`}>
                    {d.grupo_nombre.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{d.grupo_nombre}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {d.areas.slice(0, 2).map(a => (
                        <span key={a} className="text-[10px] px-1.5 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded">
                          {a}
                        </span>
                      ))}
                      {d.areas.length > 2 && (
                        <span className="text-[10px] text-muted-foreground">+{d.areas.length - 2}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-medium text-foreground">{d.total} usuarios</p>
                    {d.enrolled > 0 && (
                      <p className="text-[10px] text-muted-foreground">{pct}% ya inscrito</p>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {fullyEnrolled.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Ya inscritos ({fullyEnrolled.length})
          </p>
          <div className="space-y-1.5">
            {fullyEnrolled.map(d => (
              <div key={d.grupo_id}
                className="flex items-center gap-3 p-3 rounded-xl border border-border bg-background opacity-50">
                <div className="w-4 h-4 flex items-center justify-center shrink-0">
                  <i className="ti ti-circle-check text-emerald-400 text-sm" aria-hidden="true" />
                </div>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-base font-bold ${DEPT_COLORS[d.colorIdx]}`}>
                  {d.grupo_nombre.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{d.grupo_nombre}</p>
                </div>
                <span className="text-xs text-emerald-400 shrink-0">{d.total} inscritos</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function IndividualList({
  notEnrolled,
  alreadyEnrolled,
  selected,
  onToggle,
  onSelectAll,
}: {
  notEnrolled: CourseEnrollmentUser[];
  alreadyEnrolled: CourseEnrollmentUser[];
  selected: Set<number>;
  onToggle: (id: number) => void;
  onSelectAll: () => void;
}) {
  if (notEnrolled.length === 0 && alreadyEnrolled.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        <i className="ti ti-users text-3xl block mb-2 opacity-30" aria-hidden="true" />
        No hay usuarios que coincidan con la búsqueda.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {notEnrolled.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Sin inscribir ({notEnrolled.length})
            </p>
            {notEnrolled.length > 1 && (
              <button type="button" onClick={onSelectAll}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                Seleccionar todos
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            {notEnrolled.map(u => (
              <label key={u.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-border bg-background hover:border-indigo-500/30 hover:bg-indigo-500/5 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={selected.has(u.id)}
                  onChange={() => onToggle(u.id)}
                  className="w-4 h-4 rounded border-border text-indigo-600 bg-card focus:ring-indigo-500 focus:ring-offset-0"
                />
                <div className="w-8 h-8 rounded-full bg-indigo-500/15 flex items-center justify-center shrink-0 text-indigo-400 font-semibold text-xs">
                  {u.nombre.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{u.nombre}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs text-muted-foreground">{ROLE_LABELS[u.role] ?? u.role}</span>
                  {u.grupo_nombre && (
                    <p className="text-[10px] text-muted-foreground/70 truncate max-w-[100px]">{u.grupo_nombre}</p>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {alreadyEnrolled.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Ya inscritos ({alreadyEnrolled.length})
          </p>
          <div className="space-y-1.5">
            {alreadyEnrolled.map(u => {
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
  );
}
