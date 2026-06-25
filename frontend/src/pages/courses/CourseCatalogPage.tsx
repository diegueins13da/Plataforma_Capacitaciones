/**
 * Course Catalog — shows all published courses.
 * ADMIN and course instructor see edit/delete actions per card.
 */
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { coursesService } from "../../services/coursesService";
import { CourseEditModal } from "../../components/shared/CourseEditModal";
import { UrgencyBadge } from "../../components/shared/UrgencyBadge";
import { useAuthStore } from "../../store/authStore";
import { useTrainerModeStore } from "../../store/trainerModeStore";
import type { CourseListItem } from "../../types/course";

const TIPO_ICONS: Record<string, string> = {
  ONLINE: "ti-monitor",
  PRESENCIAL: "ti-building",
  HIBRIDO: "ti-arrows-exchange",
  AUTOAPRENDIZAJE: "ti-books",
};

const ESTADO_LABELS = [
  { value: "", label: "Todos" },
  { value: "EN_PROGRESO", label: "En progreso" },
  { value: "COMPLETADO", label: "Completados" },
  { value: "VENCIDO", label: "Vencidos" },
];

// ---------------------------------------------------------------------------
// Course card
// ---------------------------------------------------------------------------

function CourseCard({
  course,
  onEdit,
}: {
  course: CourseListItem;
  onEdit: (c: CourseListItem) => void;
}) {
  const enrollment = course.enrollment;
  const progreso = enrollment?.progreso_porcentaje ?? 0;
  const icon = TIPO_ICONS[course.tipo] ?? "ti-book";

  return (
    <div className="relative group bg-card border border-border rounded-xl overflow-hidden hover:shadow-lg hover:border-indigo-500/30 transition-all">
      {/* Edit/Delete overlay — only visible when can_edit */}
      {course.can_edit && (
        <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
          <button
            type="button"
            title="Editar curso"
            onClick={(e) => { e.preventDefault(); onEdit(course); }}
            className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-md hover:bg-indigo-700 transition-colors"
          >
            <i className="ti ti-edit text-xs" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Card link area */}
      <Link to={`/courses/${course.id}`} className="block">
        {/* Header */}
        <div className="bg-gradient-to-br from-indigo-900/30 to-indigo-800/10 px-4 py-7 flex items-center justify-center">
          <i className={`ti ${icon} text-4xl text-indigo-400/70`} aria-hidden="true" />
        </div>

        {/* Body */}
        <div className="p-4 space-y-2.5">
          <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
            {course.titulo}
          </h3>

          {course.instructor_nombre && (
            <p className="text-xs text-muted-foreground truncate">
              <i className="ti ti-user mr-1" aria-hidden="true" />
              {course.instructor_nombre}
            </p>
          )}

          <div className="flex items-center justify-between gap-2">
            <UrgencyBadge fechaLimite={course.fecha_limite} />
            {enrollment?.estado === "COMPLETADO" && (
              <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">
                Completado
              </span>
            )}
            {enrollment?.estado === "VENCIDO" && (
              <span className="text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full font-medium">
                Vencido
              </span>
            )}
          </div>

          {/* Progress bar */}
          {enrollment && enrollment.estado !== "COMPLETADO" && (
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Progreso</span>
                <span>{progreso}%</span>
              </div>
              <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all"
                  style={{ width: `${progreso}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-0.5">
            <span>{course.module_count} módulo{course.module_count !== 1 ? "s" : ""}</span>
            {course.duracion_horas && <span>· {course.duracion_horas}h</span>}
            {course.area_nombre && (
              <span className="truncate">· {course.area_nombre}</span>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CourseCatalogPage() {
  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterEstado, setFilterEstado] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [editCourse, setEditCourse] = useState<CourseListItem | null>(null);
  const { user } = useAuthStore();
  const trainerMode = useTrainerModeStore((s) => s.mode);

  // Trainers in Alumno mode see enrolled courses (same as a regular user)
  const asStudent = user?.role === "TRAINER" && trainerMode === "ALUMNO";

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await coursesService.getCourses({
        estado: "PUBLICADO",
        page: p,
        as_student: asStudent || undefined,
      });
      setCourses(res.results);
      setTotal(res.count);
    } catch {
      toast.error("No se pudieron cargar los cursos.");
    } finally {
      setLoading(false);
    }
  }, [asStudent]);

  useEffect(() => { void load(1); setPage(1); }, [load]);

  // Client-side filter by enrollment estado and search query
  const filtered = courses.filter((c) => {
    const matchesEstado = !filterEstado || c.enrollment?.estado === filterEstado;
    const matchesSearch = !searchQuery || c.titulo.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesEstado && matchesSearch;
  });

  const totalPages = Math.ceil(total / 20);

  function handleSaved(updated: CourseListItem) {
    setCourses((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    setEditCourse(null);
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Catálogo de cursos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {total} curso{total !== 1 ? "s" : ""} disponible{total !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Search bar */}
      <div className="relative mb-4">
        <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none" aria-hidden="true" />
        <input
          type="text"
          placeholder="Buscar curso por nombre…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-colors"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <i className="ti ti-x text-xs" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Enrollment status filter (client-side) */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {ESTADO_LABELS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilterEstado(f.value)}
            className={`px-3 py-1.5 text-sm rounded-full border transition-colors whitespace-nowrap ${
              filterEstado === f.value
                ? "bg-indigo-600 text-white border-indigo-600"
                : "border-border text-muted-foreground hover:bg-accent/50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center mx-auto mb-4">
            <i className="ti ti-books text-3xl text-indigo-500" aria-hidden="true" />
          </div>
          <p className="text-muted-foreground text-sm">
            {filterEstado ? "No hay cursos con ese filtro." : "No hay cursos publicados aún."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((course) => (
            <CourseCard key={course.id} course={course} onEdit={setEditCourse} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            type="button"
            onClick={() => { const p = page - 1; setPage(p); void load(p); }}
            disabled={page === 1}
            className="px-3 py-1.5 border border-border text-sm rounded-lg hover:bg-accent/50 disabled:opacity-40"
          >
            ← Anterior
          </button>
          <span className="px-3 py-1.5 text-sm text-muted-foreground">{page} / {totalPages}</span>
          <button
            type="button"
            onClick={() => { const p = page + 1; setPage(p); void load(p); }}
            disabled={page === totalPages}
            className="px-3 py-1.5 border border-border text-sm rounded-lg hover:bg-accent/50 disabled:opacity-40"
          >
            Siguiente →
          </button>
        </div>
      )}

      {/* Edit modal */}
      {editCourse && (
        <CourseEditModal
          course={editCourse}
          onClose={() => setEditCourse(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
