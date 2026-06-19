import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { coursesService } from "../../../services/coursesService";
import { configService } from "../../../services/configService";
import { useCourseWizardStore } from "../../../store/courseWizardStore";
import type { Area } from "../../../types/area";
import type { CourseEstado, CourseListItem } from "../../../types/course";

const ESTADO_BADGE: Record<CourseEstado, { label: string; cls: string }> = {
  BORRADOR: { label: "Borrador", cls: "bg-muted/40 text-muted-foreground" },
  PUBLICADO: { label: "Publicado", cls: "bg-emerald-500/10 text-emerald-400" },
  ARCHIVADO: { label: "Archivado", cls: "bg-amber-500/15 text-amber-400" },
};

const TIPO_LABELS: Record<string, string> = {
  ONLINE: "Online",
  PRESENCIAL: "Presencial",
  HIBRIDO: "Híbrido",
  AUTOAPRENDIZAJE: "Autoaprendizaje",
};

export default function CourseListPage() {
  const navigate = useNavigate();
  const { reset } = useCourseWizardStore();

  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterEstado, setFilterEstado] = useState<CourseEstado | "">("");
  const [filterArea, setFilterArea] = useState<number | "">("");

  async function load(p = 1) {
    setLoading(true);
    try {
      const res = await coursesService.getCourses({
        estado: filterEstado || undefined,
        area: filterArea || undefined,
        page: p,
      });
      setCourses(res.results);
      setTotal(res.count);
    } catch {
      toast.error("No se pudieron cargar los cursos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    configService.getAreas().then(setAreas).catch(() => void 0);
  }, []);

  useEffect(() => {
    void load(1);
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterEstado, filterArea]);

  function handleCreateNew() {
    reset();
    navigate("/admin/courses/new");
  }

  function handleEdit(course: CourseListItem) {
    navigate(`/admin/courses/${course.id}/edit`);
  }

  async function handlePublish(course: CourseListItem) {
    try {
      await coursesService.publishCourse(course.id);
      toast.success(`"${course.titulo}" publicado.`);
      void load(page);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? "No se pudo publicar.");
    }
  }

  async function handleDelete(course: CourseListItem) {
    if (!confirm(`¿Eliminar "${course.titulo}"?`)) return;
    try {
      await coursesService.deleteCourse(course.id);
      toast.success("Curso eliminado.");
      void load(page);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? "No se pudo eliminar el curso.");
    }
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cursos</h1>
          <p className="text-sm text-muted-foreground mt-1">{total} curso(s) en total</p>
        </div>
        <button
          onClick={handleCreateNew}
          className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all duration-300"
        >
          + Nuevo curso
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <select
          value={filterEstado}
          onChange={(e) => setFilterEstado(e.target.value as CourseEstado | "")}
          className="border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-300"
        >
          <option value="">Todos los estados</option>
          <option value="BORRADOR">Borrador</option>
          <option value="PUBLICADO">Publicado</option>
          <option value="ARCHIVADO">Archivado</option>
        </select>
        <select
          value={filterArea}
          onChange={(e) => setFilterArea(e.target.value ? parseInt(e.target.value) : "")}
          className="border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-300"
        >
          <option value="">Todas las áreas</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>{a.nombre}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          </div>
        ) : courses.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            No hay cursos. Crea el primero con el botón de arriba.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-background text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Área</th>
                <th className="px-4 py-3">Módulos</th>
                <th className="px-4 py-3">Fecha límite</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {courses.map((course) => {
                const badge = ESTADO_BADGE[course.estado];
                return (
                  <tr key={course.id} className="hover:bg-background transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-foreground">{course.titulo}</p>
                      {course.instructor_nombre && (
                        <p className="text-xs text-muted-foreground">{course.instructor_nombre}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {TIPO_LABELS[course.tipo] ?? course.tipo}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {course.area_nombre || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground text-center">
                      {course.module_count}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {course.fecha_limite
                        ? new Date(course.fecha_limite + "T00:00:00").toLocaleDateString("es-EC")
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(course)}
                          className="text-xs text-indigo-400 hover:underline"
                        >
                          Editar
                        </button>
                        {course.estado === "BORRADOR" && (
                          <button
                            onClick={() => handlePublish(course)}
                            disabled={course.module_count === 0}
                            className="text-xs text-emerald-400 hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
                            title={course.module_count === 0 ? "Agrega módulos antes de publicar" : ""}
                          >
                            Publicar
                          </button>
                        )}
                        {course.estado === "BORRADOR" && (
                          <button
                            onClick={() => handleDelete(course)}
                            className="text-xs text-red-400 hover:underline"
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button
            onClick={() => { const p = page - 1; setPage(p); void load(p); }}
            disabled={page === 1}
            className="px-3 py-1.5 border border-border text-sm rounded-lg hover:bg-background disabled:opacity-40"
          >
            ← Anterior
          </button>
          <span className="px-3 py-1.5 text-sm text-muted-foreground">
            Pág. {page} / {totalPages}
          </span>
          <button
            onClick={() => { const p = page + 1; setPage(p); void load(p); }}
            disabled={page === totalPages}
            className="px-3 py-1.5 border border-border text-sm rounded-lg hover:bg-background disabled:opacity-40"
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}
