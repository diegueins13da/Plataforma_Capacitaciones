import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";

import { coursesService } from "../../services/coursesService";
import { enrollmentsService } from "../../services/enrollmentsService";
import type { Course, CourseModuleWithStatus, Tema } from "../../types/course";

import { VideoPlayerPage } from "./VideoPlayerPage";
import { PdfPlayerPage } from "./PdfPlayerPage";
import { TextPlayerPage } from "./TextPlayerPage";
import { ImagePlayerPage } from "./ImagePlayerPage";
import { IframePlayerPage } from "./IframePlayerPage";

const TEMA_TIPO_ICON: Record<string, string> = {
  VIDEO: "ti-player-play",
  PDF: "ti-file-type-pdf",
  TEXTO: "ti-file-text",
  IMAGEN: "ti-photo",
  IFRAME: "ti-world",
};

export default function ModulePlayerPage() {
  const { courseId, moduleId } = useParams<{ courseId: string; moduleId: string }>();
  const navigate = useNavigate();

  const [course, setCourse] = useState<Course | null>(null);
  const [module, setModule] = useState<CourseModuleWithStatus | null>(null);
  const [currentTema, setCurrentTema] = useState<Tema | null>(null);
  const [enrollmentId, setEnrollmentId] = useState<number | null>(null);
  const [initialPosition, setInitialPosition] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [expandedModules, setExpandedModules] = useState<Set<number>>(new Set());
  const [iframeAllDone, setIframeAllDone] = useState(false);

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
        setExpandedModules(new Set([mId]));
        if (mod.is_completed) setIframeAllDone(true);

        let savedPosition: Record<string, number> = {};
        if (c.enrollment) {
          setEnrollmentId(c.enrollment.id);
          const progress = await enrollmentsService.getModuleProgress(c.enrollment.id, mId);
          savedPosition = progress.last_position_json;
          setInitialPosition(savedPosition);
        }

        // Resume at last-visited tema, or default to first
        const savedTemaId = savedPosition.tema_id;
        const startTema = (savedTemaId ? mod.temas.find((t) => t.id === savedTemaId) : null)
          ?? mod.temas[0]
          ?? null;
        setCurrentTema(startTema);
      } catch {
        toast.error("No se pudo cargar el módulo.");
        navigate(`/courses/${cId}`);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [courseId, moduleId, navigate]);

  // Navigate to a different module
  function navigateToModule(mod: CourseModuleWithStatus) {
    if (!course) return;
    if (!mod.is_unlocked) {
      toast.error("Completa los módulos anteriores primero.");
      return;
    }
    navigate(`/courses/${course.id}/modules/${mod.id}`);
  }

  // Switch tema within the current module (no URL change)
  function selectTema(tema: Tema) {
    setCurrentTema(tema);
    setInitialPosition({});
  }

  const temas = module?.temas ?? [];
  const isLastTema = currentTema ? temas[temas.length - 1]?.id === currentTema.id : false;

  // Called by players when they detect the content has been consumed
  const handleTemaComplete = useCallback(async () => {
    if (!module || !currentTema || !course) return;

    if (!isLastTema) {
      // Advance to next tema
      const idx = temas.findIndex((t) => t.id === currentTema.id);
      const next = temas[idx + 1];
      if (next) { setCurrentTema(next); setInitialPosition({}); }
      return;
    }

    // Last tema → complete the module
    if (enrollmentId === null) return;
    try {
      const result = await enrollmentsService.completeModule(enrollmentId, module.id);
      toast.success("¡Módulo completado!");

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
  }, [course, module, currentTema, enrollmentId, isLastTema, navigate, temas]);

  const handlePositionUpdate = useCallback(
    async (position: Record<string, number>) => {
      if (!enrollmentId || !module || !currentTema) return;
      try {
        await enrollmentsService.updateModulePosition(enrollmentId, module.id, {
          ...position,
          tema_id: currentTema.id,
        });
      } catch {
        // best-effort
      }
    },
    [enrollmentId, module, currentTema]
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
  const moduleIndex = course.modules_with_status.findIndex((m) => m.id === module.id);
  const isModuleCompleted = module.is_completed;

  return (
    <div
      className="-mx-10 -my-6 flex overflow-hidden"
      style={{ height: "calc(100vh - 56px)" }}
    >
      {/* ── Left sidebar ── */}
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
          <div className="mt-3">
            <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${progreso}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">{progreso}% completado</p>
          </div>
        </div>

        {/* Module list (scrollable) */}
        <div className="flex-1 overflow-y-auto py-1">
          {course.modules_with_status.map((m, i) => {
            const isActiveModule = m.id === module.id;
            const locked = !m.is_unlocked;
            const isExpanded = expandedModules.has(m.id);

            return (
              <div key={m.id} className="border-b border-border/30 last:border-0">
                {/* Module header row */}
                <button
                  onClick={() => {
                    if (locked) { toast.error("Completa los módulos anteriores primero."); return; }
                    if (!isActiveModule) { navigateToModule(m); return; }
                    setExpandedModules((s) => {
                      const n = new Set(s);
                      n.has(m.id) ? n.delete(m.id) : n.add(m.id);
                      return n;
                    });
                  }}
                  className={[
                    "w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors border-l-2",
                    isActiveModule ? "border-indigo-500 bg-indigo-500/10" : "border-transparent hover:bg-white/5",
                    locked ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
                  ].join(" ")}
                >
                  <div
                    className={[
                      "w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[10px] font-semibold",
                      m.is_completed
                        ? "bg-emerald-500/20 text-emerald-400"
                        : isActiveModule
                        ? "bg-indigo-500/20 text-indigo-400"
                        : "bg-muted/40 text-muted-foreground",
                    ].join(" ")}
                  >
                    {m.is_completed ? <i className="ti ti-check text-[9px]" /> : i + 1}
                  </div>
                  <span
                    className={`text-xs font-medium flex-1 text-left truncate ${
                      isActiveModule ? "text-indigo-300" : "text-foreground"
                    }`}
                  >
                    {m.titulo}
                  </span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {m.temas.length}t
                  </span>
                  {locked ? (
                    <i className="ti ti-lock text-[10px] text-muted-foreground/40 shrink-0" />
                  ) : (
                    <i className={`ti ${isExpanded ? "ti-chevron-down" : "ti-chevron-right"} text-[10px] text-muted-foreground shrink-0`} />
                  )}
                </button>

                {/* Temas (visible when module is expanded) */}
                {isExpanded && m.temas.map((tema) => {
                  const isActiveTema = isActiveModule && currentTema?.id === tema.id;
                  return (
                    <button
                      key={tema.id}
                      onClick={() => {
                        if (!isActiveModule) { navigateToModule(m); return; }
                        selectTema(tema);
                      }}
                      className={[
                        "w-full flex items-center gap-2 px-3 py-2 pl-9 text-left transition-colors border-l-2",
                        isActiveTema
                          ? "border-indigo-500 bg-indigo-500/10"
                          : "border-transparent hover:bg-white/5",
                      ].join(" ")}
                    >
                      <i className={`ti ${TEMA_TIPO_ICON[tema.tipo_contenido] ?? "ti-file"} text-xs shrink-0 ${
                        isActiveTema ? "text-indigo-400" : "text-muted-foreground"
                      }`} />
                      <span className={`text-xs flex-1 truncate ${isActiveTema ? "text-indigo-300" : "text-foreground/80"}`}>
                        {tema.titulo}
                      </span>
                      {tema.duracion_minutos && (
                        <span className="text-[10px] text-muted-foreground shrink-0">{tema.duracion_minutos}m</span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}

          {/* Evaluación final */}
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
                  "w-full flex items-center gap-2.5 px-3 py-3 text-left transition-colors border-l-2 border-transparent",
                  !course.modules_with_status.every((m) => m.is_completed)
                    ? "opacity-40 cursor-not-allowed"
                    : "hover:bg-white/5 cursor-pointer",
                ].join(" ")}
              >
                <div className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[10px] bg-muted/40 text-muted-foreground">
                  <i className="ti ti-rosette text-[9px]" />
                </div>
                <i className="ti ti-clipboard-check text-sm shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium leading-snug text-foreground">Evaluación final</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Examen del curso</p>
                </div>
                {!course.modules_with_status.every((m) => m.is_completed) && (
                  <i className="ti ti-lock text-[10px] text-muted-foreground/40 shrink-0" />
                )}
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Right content: player area ── */}
      <div className="flex-1 overflow-y-auto px-8 py-6 bg-background">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
          <span>Módulo {moduleIndex + 1}</span>
          <i className="ti ti-chevron-right text-[10px]" />
          <span className="text-foreground">{module.titulo}</span>
          {currentTema && (
            <>
              <i className="ti ti-chevron-right text-[10px]" />
              <span className="text-indigo-300">{currentTema.titulo}</span>
            </>
          )}
        </div>

        {/* Tema title */}
        {currentTema && (
          <div className="mb-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <i className={`ti ${TEMA_TIPO_ICON[currentTema.tipo_contenido]} text-xs`} />
              <span>
                Tema {temas.findIndex((t) => t.id === currentTema.id) + 1} de {temas.length}
              </span>
              {currentTema.duracion_minutos && <span>· {currentTema.duracion_minutos} min</span>}
            </div>
            <h1 className="text-xl font-bold text-foreground">{currentTema.titulo}</h1>
          </div>
        )}

        {/* Module description */}
        {module.descripcion && (
          <p className="text-sm text-muted-foreground mb-5 leading-relaxed">{module.descripcion}</p>
        )}

        {/* No temas yet */}
        {temas.length === 0 && (
          <div className="text-center py-16 text-muted-foreground text-sm border-2 border-dashed border-border rounded-xl">
            Este módulo aún no tiene temas.
          </div>
        )}

        {/* Player */}
        {currentTema && currentTema.tipo_contenido === "VIDEO" && (
          <VideoPlayerPage
            key={`video-${currentTema.id}`}
            tema={currentTema}
            isCompleted={isModuleCompleted}
            enrollmentId={enrollmentId!}
            initialSecond={initialPosition.tema_id === currentTema.id ? (initialPosition.second ?? 0) : 0}
            onComplete={handleTemaComplete}
            onPositionUpdate={handlePositionUpdate}
          />
        )}

        {currentTema && currentTema.tipo_contenido === "PDF" && (
          <PdfPlayerPage
            key={`pdf-${currentTema.id}`}
            tema={currentTema}
            isCompleted={isModuleCompleted}
            initialPage={initialPosition.tema_id === currentTema.id ? (initialPosition.page ?? 1) : 1}
            onComplete={handleTemaComplete}
            onPositionUpdate={handlePositionUpdate}
          />
        )}

        {currentTema && currentTema.tipo_contenido === "TEXTO" && (
          <TextPlayerPage
            key={`texto-${currentTema.id}`}
            tema={currentTema}
            isCompleted={isModuleCompleted}
            initialScrollY={initialPosition.tema_id === currentTema.id ? (initialPosition.scroll ?? 0) : 0}
            onComplete={handleTemaComplete}
            onPositionUpdate={handlePositionUpdate}
          />
        )}

        {currentTema && currentTema.tipo_contenido === "IMAGEN" && (
          <ImagePlayerPage
            key={`imagen-${currentTema.id}`}
            tema={currentTema}
            isCompleted={isModuleCompleted}
            onComplete={handleTemaComplete}
          />
        )}

        {currentTema && currentTema.tipo_contenido === "IFRAME" && (
          <IframePlayerPage
            key={`iframe-${currentTema.id}`}
            tema={currentTema}
            isCompleted={isModuleCompleted}
            onComplete={handleTemaComplete}
            onPositionUpdate={handlePositionUpdate}
            onAllSlidesVisited={() => setIframeAllDone(true)}
          />
        )}

        {/* Tema navigation footer */}
        {temas.length > 1 && currentTema && (
          <div className="flex items-center justify-between mt-8 pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => {
                const idx = temas.findIndex((t) => t.id === currentTema.id);
                if (idx > 0) { setCurrentTema(temas[idx - 1]); setInitialPosition({}); }
              }}
              disabled={temas[0]?.id === currentTema.id}
              className="flex items-center gap-1.5 px-4 py-2 text-sm border border-border rounded-lg text-muted-foreground hover:bg-background disabled:opacity-30 transition-colors"
            >
              <i className="ti ti-arrow-left text-xs" /> Tema anterior
            </button>

            <span className="text-xs text-muted-foreground">
              {temas.findIndex((t) => t.id === currentTema.id) + 1} / {temas.length}
            </span>

            {isLastTema ? (
              <button
                type="button"
                onClick={handleTemaComplete}
                disabled={isModuleCompleted || (currentTema?.tipo_contenido === "IFRAME" && !iframeAllDone)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98]"
              >
                {isModuleCompleted ? "Módulo completado ✓" : "Completar módulo →"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  const idx = temas.findIndex((t) => t.id === currentTema.id);
                  if (idx < temas.length - 1) { setCurrentTema(temas[idx + 1]); setInitialPosition({}); }
                }}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 transition-all active:scale-[0.98]"
              >
                Siguiente tema <i className="ti ti-arrow-right text-xs" />
              </button>
            )}
          </div>
        )}

        {/* Single-tema module: show Completar directly */}
        {temas.length === 1 && currentTema && (
          <div className="flex justify-end mt-8 pt-4 border-t border-border">
            <button
              type="button"
              onClick={handleTemaComplete}
              disabled={isModuleCompleted || (currentTema.tipo_contenido === "IFRAME" && !iframeAllDone)}
              className="flex items-center gap-1.5 px-5 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98]"
            >
              {isModuleCompleted ? "Módulo completado ✓" : "Completar módulo →"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
