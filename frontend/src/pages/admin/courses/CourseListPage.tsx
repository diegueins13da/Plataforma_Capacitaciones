import { useEffect, useState } from "react";
import { toast } from "sonner";

import { coursesService } from "../../../services/coursesService";
import { configService } from "../../../services/configService";
import { CourseCreateModal } from "../../../components/shared/CourseCreateModal";
import { CourseEditAdminModal } from "../../../components/shared/CourseEditAdminModal";
import { CourseAssignUsersModal } from "../../../components/shared/CourseAssignUsersModal";
import { ConfirmDeleteModal } from "../../../components/shared/ConfirmDeleteModal";
import type { Area } from "../../../types/area";
import type { CourseEstado, CourseListItem } from "../../../types/course";

const ACTION_TIPS: Record<CourseEstado, string | null> = {
  BORRADOR:  null,
  PUBLICADO: "Puedes editar información, módulos y evaluación. Para eliminar el curso, archívalo primero.",
  ARCHIVADO: "Curso archivado. Solo edición de metadatos permitida.",
};

const ESTADO_BADGE: Record<CourseEstado, { label: string; cls: string }> = {
  BORRADOR:  { label: "Borrador",  cls: "bg-muted/40 text-muted-foreground" },
  PUBLICADO: { label: "Publicado", cls: "bg-emerald-500/10 text-emerald-400" },
  ARCHIVADO: { label: "Archivado", cls: "bg-amber-500/15 text-amber-400" },
};

const TIPO_LABELS: Record<string, string> = {
  ONLINE:         "Online",
  PRESENCIAL:     "Presencial",
  HIBRIDO:        "Híbrido",
  AUTOAPRENDIZAJE:"Autoaprendizaje",
};

const SELECT_CLS =
  "bg-card border border-border text-foreground rounded-lg px-3 py-2 text-sm " +
  "focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-colors";

export default function CourseListPage() {
  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterEstado, setFilterEstado] = useState<CourseEstado | "">("");
  const [filterArea, setFilterArea] = useState<number | "">("");

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editCourseId, setEditCourseId] = useState<number | null>(null);
  const [assignTarget, setAssignTarget] = useState<CourseListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CourseListItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<CourseListItem | null>(null);
  const [archiving, setArchiving] = useState(false);

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
    setShowCreateModal(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await coursesService.deleteCourse(deleteTarget.id);
      toast.success("Curso eliminado.");
      setDeleteTarget(null);
      void load(page);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? "No se pudo eliminar el curso.");
    } finally {
      setDeleting(false);
    }
  }

  async function confirmArchive() {
    if (!archiveTarget) return;
    setArchiving(true);
    try {
      await coursesService.archiveCourse(archiveTarget.id);
      toast.success(`"${archiveTarget.titulo}" archivado. Ya no recibirá nuevas inscripciones.`);
      setArchiveTarget(null);
      void load(page);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? "No se pudo archivar el curso.");
    } finally {
      setArchiving(false);
    }
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Cursos</h1>
            <p className="text-sm text-muted-foreground mt-1">{total} curso(s) en total</p>
          </div>
          <button
            onClick={handleCreateNew}
            className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 flex items-center gap-2 transition-colors"
          >
            <i className="ti ti-plus text-base" aria-hidden="true" />
            Nuevo curso
          </button>
        </div>

        {/* Filters — dark-mode styled */}
        <div className="flex gap-3">
          <select
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value as CourseEstado | "")}
            className={SELECT_CLS}
          >
            <option value="">Todos los estados</option>
            <option value="BORRADOR">Borrador</option>
            <option value="PUBLICADO">Publicado</option>
            <option value="ARCHIVADO">Archivado</option>
          </select>
          <select
            value={filterArea}
            onChange={(e) => setFilterArea(e.target.value ? parseInt(e.target.value) : "")}
            className={SELECT_CLS}
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
                  <th className="px-4 py-3 text-center">Mód.</th>
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
                          {/* Assign users — published only */}
                          {course.estado === "PUBLICADO" && (
                            <button
                              type="button"
                              onClick={() => setAssignTarget(course)}
                              title="Asignar usuarios"
                              className="w-8 h-8 flex items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors">
                              <i className="ti ti-user-plus text-sm" aria-hidden="true" />
                            </button>
                          )}
                          {/* Edit — all courses */}
                          <button
                            type="button"
                            onClick={() => setEditCourseId(course.id)}
                            title="Editar curso"
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-colors"
                          >
                            <i className="ti ti-edit text-sm" aria-hidden="true" />
                          </button>
                          {/* Archive — only PUBLICADO */}
                          {course.estado === "PUBLICADO" && (
                            <button
                              type="button"
                              onClick={() => setArchiveTarget(course)}
                              title="Archivar curso (detiene nuevas inscripciones)"
                              className="w-8 h-8 flex items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors"
                            >
                              <i className="ti ti-archive text-sm" aria-hidden="true" />
                            </button>
                          )}
                          {/* Delete — only BORRADOR */}
                          {course.estado === "BORRADOR" && (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(course)}
                              title="Eliminar curso"
                              className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                            >
                              <i className="ti ti-trash text-sm" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                        {ACTION_TIPS[course.estado] && (
                          <p className="text-[10px] text-muted-foreground/60 mt-1 max-w-[140px] leading-tight">
                            {ACTION_TIPS[course.estado]}
                          </p>
                        )}
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
          <div className="flex justify-center gap-2">
            <button
              onClick={() => { const p = page - 1; setPage(p); void load(p); }}
              disabled={page === 1}
              className="px-3 py-1.5 border border-border text-sm rounded-lg hover:bg-accent/50 disabled:opacity-40 transition-colors"
            >
              ← Anterior
            </button>
            <span className="px-3 py-1.5 text-sm text-muted-foreground">
              Pág. {page} / {totalPages}
            </span>
            <button
              onClick={() => { const p = page + 1; setPage(p); void load(p); }}
              disabled={page === totalPages}
              className="px-3 py-1.5 border border-border text-sm rounded-lg hover:bg-accent/50 disabled:opacity-40 transition-colors"
            >
              Siguiente →
            </button>
          </div>
        )}
      </div>

      {/* Assign users modal */}
      {assignTarget && (
        <CourseAssignUsersModal
          courseId={assignTarget.id}
          courseTitle={assignTarget.titulo}
          onClose={() => setAssignTarget(null)}
        />
      )}

      {/* Create modal */}
      {showCreateModal && (
        <CourseCreateModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => void load(page)}
        />
      )}

      {/* Edit modal */}
      {editCourseId !== null && (
        <CourseEditAdminModal
          courseId={editCourseId}
          onClose={() => setEditCourseId(null)}
          onSaved={() => void load(page)}
        />
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <ConfirmDeleteModal
          title="¿Eliminar curso?"
          message={`"${deleteTarget.titulo}" se eliminará permanentemente. Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar curso"
          deleting={deleting}
          onConfirm={confirmDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      {/* Archive confirmation modal */}
      {archiveTarget && (
        <ConfirmDeleteModal
          title="¿Archivar curso?"
          message={`"${archiveTarget.titulo}" dejará de recibir nuevas inscripciones. Los usuarios inscritos y los certificados se conservan. Esta acción no se puede deshacer.`}
          confirmLabel="Archivar curso"
          variant="warning"
          deleting={archiving}
          onConfirm={confirmArchive}
          onClose={() => setArchiveTarget(null)}
        />
      )}
    </>
  );
}
