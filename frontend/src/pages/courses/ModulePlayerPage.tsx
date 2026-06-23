import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";

import { coursesService } from "../../services/coursesService";
import { enrollmentsService } from "../../services/enrollmentsService";
import type { Course, CourseModuleWithStatus } from "../../types/course";

import { VideoPlayerPage } from "./VideoPlayerPage";
import { PdfPlayerPage } from "./PdfPlayerPage";
import { TextPlayerPage } from "./TextPlayerPage";

const MODULE_TIPO_ICON: Record<string, string> = {
  VIDEO: "ti-brand-youtube",
  PDF: "ti-file-type-pdf",
  TEXTO: "ti-file-text",
  SCORM: "ti-device-gamepad-2",
};

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

  const progreso = course.enrollment?.progreso_porcentaje ?? 0;
  const currentIndex = course.modules_with_status.findIndex((m) => m.id === module.id);

  function handleSidebarNavigate(targetModule: CourseModuleWithStatus) {
    if (!course) return;
    if (!targetModule.is_unlocked) {
      toast.error("Completa los módulos anteriores primero.");
      return;
    }
    navigate(`/courses/${course.id}/modules/${targetModule.id}`);
  }

  return (
    /* Full-viewport layout: cancels AppLayout's px-10 py-6 padding */
    <div
      className="-mx-10 -my-6 flex overflow-hidden"
      style={{ height: "calc(100vh - 56px)" }}
    >
      {/* ── Left sidebar: module navigation ── */}
      <aside
        className="w-72 shrink-0 flex flex-col border-r border-border overflow-hidden"
        style={{ background: "var(--color-card, #0f172a)" }}
      >
        {/* Course header */}
        <div className="px-4 pt-4 pb-3 border-b border-border shrink-0">
          <Link
            to={`/courses/${course.id}`}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2.5 transition-colors"
          >
            <i className="ti ti-arrow-left text-[10px]" />
            Volver al curso
          </Link>
          <h2 className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
            {course.titulo}
          </h2>

          {/* Progress */}
          <div className="mt-3">
            <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${progreso}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {progreso}% completado
            </p>
          </div>
        </div>

        {/* Module list (scrollable) */}
        <div className="flex-1 overflow-y-auto py-1">
          {course.modules_with_status.map((m, i) => {
            const isActive = m.id === module.id;
            const locked = !m.is_unlocked;

            return (
              <button
                key={m.id}
                onClick={() => handleSidebarNavigate(m)}
                className={[
                  "w-full flex items-start gap-2.5 px-3 py-3 text-left transition-colors border-l-2",
                  isActive
                    ? "border-indigo-500 bg-indigo-500/10"
                    : "border-transparent hover:bg-white/5",
                  locked ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
                ].join(" ")}
              >
                {/* Circle indicator */}
                <div
                  className={[
                    "w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[10px] font-semibold mt-0.5",
                    m.is_completed
                      ? "bg-emerald-500/20 text-emerald-400"
                      : isActive
                      ? "bg-indigo-500/20 text-indigo-400"
                      : "bg-muted/40 text-muted-foreground",
                  ].join(" ")}
                >
                  {m.is_completed ? <i className="ti ti-check text-[9px]" /> : i + 1}
                </div>

                {/* Content type icon */}
                <i
                  className={`ti ${MODULE_TIPO_ICON[m.tipo_contenido] ?? "ti-file"} text-sm shrink-0 mt-0.5 ${
                    isActive ? "text-indigo-400" : "text-muted-foreground"
                  }`}
                />

                {/* Title */}
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-xs font-medium leading-snug line-clamp-2 ${
                      isActive ? "text-indigo-300" : "text-foreground"
                    }`}
                  >
                    {m.titulo}
                  </p>
                  {m.duracion_minutos && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {m.duracion_minutos} min
                    </p>
                  )}
                </div>

                {locked && (
                  <i className="ti ti-lock text-[10px] text-muted-foreground/40 mt-1 shrink-0" />
                )}
              </button>
            );
          })}

          {/* Exam entry — locked until all modules complete */}
          {course.has_assessment && (
            <div className="border-t border-border mt-1">
              <button
                onClick={() => {
                  if (!course.modules_with_status.every((m) => m.is_completed)) {
                    toast.error("Completa todos los módulos primero.");
                    return;
                  }
                  navigate(`/courses/${course.id}/exam`);
                }}
                className={[
                  "w-full flex items-start gap-2.5 px-3 py-3 text-left transition-colors border-l-2 border-transparent",
                  !course.modules_with_status.every((m) => m.is_completed) ? "opacity-40 cursor-not-allowed" : "hover:bg-white/5 cursor-pointer",
                ].join(" ")}
              >
                <div className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[10px] mt-0.5 bg-muted/40 text-muted-foreground">
                  <i className="ti ti-rosette text-[9px]" />
                </div>
                <i className="ti ti-clipboard-check text-sm shrink-0 mt-0.5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium leading-snug text-foreground">Evaluación final</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Examen del curso</p>
                </div>
                {!course.modules_with_status.every((m) => m.is_completed) && (
                  <i className="ti ti-lock text-[10px] text-muted-foreground/40 mt-1 shrink-0" />
                )}
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Right content: player area ── */}
      <div className="flex-1 overflow-y-auto px-8 py-6 bg-background">
        {/* Module header */}
        <div className="mb-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
            <span>Módulo {currentIndex + 1} de {course.modules_with_status.length}</span>
            {module.duracion_minutos && (
              <>
                <span>·</span>
                <span>{module.duracion_minutos} min</span>
              </>
            )}
          </div>
          <h1 className="text-xl font-bold text-foreground">{module.titulo}</h1>
          {module.descripcion && (
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              {module.descripcion}
            </p>
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
            initialPage={initialPosition.page ?? 1}
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
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-6 text-center text-amber-400 text-sm">
            Los módulos SCORM estarán disponibles en la próxima versión de la plataforma.
          </div>
        )}
      </div>
    </div>
  );
}
