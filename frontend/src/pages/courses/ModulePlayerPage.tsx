/**
 * Module player dispatcher.
 * Route: /courses/:courseId/modules/:moduleId
 *
 * Loads the course and enrollment, finds the requested module,
 * fetches the resume position, then renders the appropriate player.
 * On completion it navigates to the next module or to P16 (CourseCompletedPage).
 */
import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";

import { coursesService } from "../../services/coursesService";
import { enrollmentsService } from "../../services/enrollmentsService";
import type { Course, CourseModuleWithStatus } from "../../types/course";

import { VideoPlayerPage } from "./VideoPlayerPage";
import { PdfPlayerPage } from "./PdfPlayerPage";
import { TextPlayerPage } from "./TextPlayerPage";

export default function ModulePlayerPage() {
  const { courseId, moduleId } = useParams<{ courseId: string; moduleId: string }>();
  const navigate = useNavigate();

  const [course, setCourse] = useState<Course | null>(null);
  const [module, setModule] = useState<CourseModuleWithStatus | null>(null);
  const [enrollmentId, setEnrollmentId] = useState<number | null>(null);
  const [initialPosition, setInitialPosition] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!courseId || !moduleId) return;
    const cId = Number(courseId);
    const mId = Number(moduleId);

    async function load() {
      try {
        const c = await coursesService.getCourse(cId);
        const mod = c.modules_with_status.find((m) => m.id === mId);
        if (!mod) {
          toast.error("Módulo no encontrado.");
          navigate(`/courses/${cId}`);
          return;
        }
        if (!mod.is_unlocked) {
          toast.error("Debes completar los módulos anteriores primero.");
          navigate(`/courses/${cId}`);
          return;
        }
        setCourse(c);
        setModule(mod);

        if (c.enrollment) {
          setEnrollmentId(c.enrollment.id);
          const progress = await enrollmentsService.getModuleProgress(c.enrollment.id, mId);
          setInitialPosition(progress.last_position_json);
        }
      } catch {
        toast.error("No se pudo cargar el módulo.");
        navigate(`/courses/${cId}`);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [courseId, moduleId, navigate]);

  const handleComplete = useCallback(async () => {
    if (!course || !module || enrollmentId === null) return;
    try {
      const result = await enrollmentsService.completeModule(enrollmentId, module.id);
      toast.success("Módulo completado.");

      if (result.estado === "COMPLETADO") {
        navigate(`/courses/${course.id}/completed`);
        return;
      }

      // Navigate to next unlocked+incomplete module, or back to course detail
      const ordered = [...course.modules_with_status].sort((a, b) => a.orden - b.orden);
      const nextIdx = ordered.findIndex((m) => m.id === module.id) + 1;
      const nextMod = ordered.slice(nextIdx).find((m) => !m.is_completed);
      if (nextMod) {
        navigate(`/courses/${course.id}/modules/${nextMod.id}`);
      } else {
        navigate(`/courses/${course.id}`);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? "No se pudo registrar la completación.");
    }
  }, [course, module, enrollmentId, navigate]);

  const handlePositionUpdate = useCallback(
    async (position: Record<string, number>) => {
      if (!enrollmentId || !module) return;
      try {
        await enrollmentsService.updateModulePosition(enrollmentId, module.id, position);
      } catch {
        // silent — position saving is best-effort
      }
    },
    [enrollmentId, module]
  );

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!course || !module) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-400 mb-4 flex items-center gap-2">
        <Link to="/courses" className="hover:text-indigo-600">Mis cursos</Link>
        <span>/</span>
        <Link to={`/courses/${course.id}`} className="hover:text-indigo-600 max-w-[200px] truncate">
          {course.titulo}
        </Link>
        <span>/</span>
        <span className="text-gray-600 truncate">{module.titulo}</span>
      </nav>

      {/* Module header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">{module.titulo}</h1>
        {module.descripcion && (
          <p className="text-sm text-gray-500 mt-1">{module.descripcion}</p>
        )}
        {module.duracion_minutos && (
          <p className="text-xs text-gray-400 mt-1">{module.duracion_minutos} min estimados</p>
        )}
      </div>

      {/* Player */}
      {module.tipo_contenido === "VIDEO" && (
        <VideoPlayerPage
          module={module}
          enrollmentId={enrollmentId!}
          initialSecond={initialPosition.second ?? 0}
          onComplete={handleComplete}
          onPositionUpdate={handlePositionUpdate}
        />
      )}

      {module.tipo_contenido === "PDF" && (
        <PdfPlayerPage
          module={module}
          onComplete={handleComplete}
          onPositionUpdate={handlePositionUpdate}
        />
      )}

      {module.tipo_contenido === "TEXTO" && (
        <TextPlayerPage
          module={module}
          initialScrollY={initialPosition.scroll ?? 0}
          onComplete={handleComplete}
          onPositionUpdate={handlePositionUpdate}
        />
      )}

      {module.tipo_contenido === "SCORM" && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center text-amber-700 text-sm">
          Los módulos SCORM estarán disponibles en la próxima versión de la plataforma.
        </div>
      )}
    </div>
  );
}
