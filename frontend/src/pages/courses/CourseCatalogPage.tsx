/**
 * P10 — Course Catalog
 * Shows the current user's enrolled courses with urgency semaphore and progress.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { coursesService } from "../../services/coursesService";
import { UrgencyBadge } from "../../components/shared/UrgencyBadge";
import type { CourseListItem } from "../../types/course";

const TIPO_ICONS: Record<string, string> = {
  ONLINE: "💻",
  PRESENCIAL: "🏢",
  HIBRIDO: "🔀",
  AUTOAPRENDIZAJE: "📚",
};

const ENROLLMENT_ESTADO_FILTER = [
  { value: "", label: "Todos" },
  { value: "EN_PROGRESO", label: "En progreso" },
  { value: "COMPLETADO", label: "Completados" },
  { value: "VENCIDO", label: "Vencidos" },
];

export default function CourseCatalogPage() {
  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterEstado, setFilterEstado] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  async function load(p = 1) {
    setLoading(true);
    try {
      const res = await coursesService.getCourses({ estado: "PUBLICADO", page: p });
      setCourses(res.results);
      setTotal(res.count);
    } catch {
      toast.error("No se pudieron cargar los cursos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(1); setPage(1); }, []);

  const filtered = filterEstado
    ? courses.filter((c) => c.enrollment?.estado === filterEstado)
    : courses;

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Mis cursos</h1>
        <p className="text-sm text-gray-500 mt-1">
          {total} curso{total !== 1 ? "s" : ""} asignado{total !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-5 overflow-x-auto">
        {ENROLLMENT_ESTADO_FILTER.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilterEstado(f.value)}
            className={`px-3 py-1.5 text-sm rounded-full border transition-colors whitespace-nowrap ${
              filterEstado === f.value
                ? "bg-indigo-600 text-white border-indigo-600"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
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
        <div className="text-center py-16 text-gray-400 text-sm">
          No tienes cursos asignados aún.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((course) => {
            const enrollment = course.enrollment;
            const progreso = enrollment?.progreso_porcentaje ?? 0;
            return (
              <Link
                key={course.id}
                to={`/courses/${course.id}`}
                className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Card header */}
                <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 px-4 py-6 flex items-center justify-center text-4xl">
                  {TIPO_ICONS[course.tipo] ?? "📋"}
                </div>

                {/* Card body */}
                <div className="p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-gray-800 leading-snug line-clamp-2">
                    {course.titulo}
                  </h3>

                  <div className="flex items-center justify-between">
                    <UrgencyBadge fechaLimite={course.fecha_limite} />
                    {enrollment?.estado === "COMPLETADO" && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                        Completado
                      </span>
                    )}
                    {enrollment?.estado === "VENCIDO" && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                        Vencido
                      </span>
                    )}
                  </div>

                  {/* Progress bar */}
                  {enrollment && enrollment.estado !== "COMPLETADO" && (
                    <div>
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Progreso</span>
                        <span>{progreso}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full transition-all"
                          style={{ width: `${progreso}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-xs text-gray-400 pt-1">
                    <span>{course.module_count} módulo{course.module_count !== 1 ? "s" : ""}</span>
                    {course.duracion_horas && <span>· {course.duracion_horas}h</span>}
                    {course.area_nombre && <span>· {course.area_nombre}</span>}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            onClick={() => { const p = page - 1; setPage(p); void load(p); }}
            disabled={page === 1}
            className="px-3 py-1.5 border border-gray-200 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-40"
          >
            ← Anterior
          </button>
          <span className="px-3 py-1.5 text-sm text-gray-600">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => { const p = page + 1; setPage(p); void load(p); }}
            disabled={page === totalPages}
            className="px-3 py-1.5 border border-gray-200 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-40"
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}
