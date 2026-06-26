import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";

import { coursesService } from "../../services/coursesService";
import { UrgencyBadge } from "../../components/shared/UrgencyBadge";
import { useAuthStore } from "../../store/authStore";
import { useTrainerModeStore } from "../../store/trainerModeStore";
import type { Course, CourseModuleWithStatus } from "../../types/course";

const TIPO_LABEL: Record<string, string> = {
  ONLINE: "Online",
  PRESENCIAL: "Presencial",
  HIBRIDO: "Híbrido",
  AUTOAPRENDIZAJE: "Autoaprendizaje",
};

const TEMA_TIPO_ICON: Record<string, string> = {
  VIDEO: "ti-player-play",
  PDF: "ti-file-type-pdf",
  TEXTO: "ti-file-text",
  IMAGEN: "ti-photo",
  IFRAME: "ti-world",
};

function ExamRow({
  courseId,
  locked,
}: {
  courseId: number;
  locked: boolean;
}) {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => !locked && navigate(`/courses/${courseId}/exam`)}
      className={`flex items-center gap-3 px-5 py-3.5 border-t border-border transition-colors ${
        locked
          ? "opacity-40 cursor-not-allowed"
          : "hover:bg-muted/20 cursor-pointer active:bg-muted/30"
      }`}
    >
      <div
        className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs ${
          locked ? "bg-muted/40 text-muted-foreground" : "bg-indigo-500/20 text-indigo-400"
        }`}
      >
        <i className="ti ti-rosette text-sm" />
      </div>

      <i className="ti ti-clipboard-check text-base text-muted-foreground shrink-0" />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">Evaluación final</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {locked ? "Completa todos los módulos para desbloquear" : "Lista para comenzar"}
        </p>
      </div>

      {locked ? (
        <i className="ti ti-lock text-muted-foreground/50 text-sm shrink-0" />
      ) : (
        <span className="text-xs text-indigo-400 font-medium flex items-center gap-1 shrink-0">
          Iniciar <i className="ti ti-arrow-right text-xs" />
        </span>
      )}
    </div>
  );
}

function ModuleRow({
  mod,
  index,
  onNavigate,
}: {
  mod: CourseModuleWithStatus;
  index: number;
  onNavigate: (id: number) => void;
}) {
  const locked = !mod.is_unlocked;

  return (
    <div
      onClick={() => !locked && onNavigate(mod.id)}
      className={`flex items-center gap-3 px-5 py-3.5 border-b border-border last:border-0 transition-colors ${
        locked
          ? "opacity-40 cursor-not-allowed"
          : "hover:bg-muted/20 cursor-pointer active:bg-muted/30"
      }`}
    >
      {/* Status circle */}
      <div
        className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-semibold ${
          mod.is_completed
            ? "bg-emerald-500/20 text-emerald-400"
            : "bg-muted/40 text-muted-foreground"
        }`}
      >
        {mod.is_completed ? (
          <i className="ti ti-check text-sm" />
        ) : (
          <span>{index + 1}</span>
        )}
      </div>

      {/* Content type icon (from first tema) */}
      <i
        className={`ti ${TEMA_TIPO_ICON[mod.temas[0]?.tipo_contenido ?? ""] ?? "ti-layout-list"} text-base text-muted-foreground shrink-0`}
      />

      {/* Title + tema count */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{mod.titulo}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {mod.temas.length} tema{mod.temas.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Right status */}
      {locked ? (
        <i className="ti ti-lock text-muted-foreground/50 text-sm shrink-0" />
      ) : mod.is_completed ? (
        <span className="text-xs text-emerald-500 font-medium shrink-0">Completado</span>
      ) : (
        <span className="text-xs text-indigo-400 font-medium flex items-center gap-1 shrink-0">
          Iniciar <i className="ti ti-arrow-right text-xs" />
        </span>
      )}
    </div>
  );
}

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const trainerMode = useTrainerModeStore((s) => s.mode);
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    coursesService
      .getCourse(Number(id))
      .then(setCourse)
      .catch(() => {
        toast.error("No se pudo cargar el curso.");
        navigate("/courses");
      })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!course) return null;

  const enrollment = course.enrollment;
  const isAdmin = user?.role === "ADMIN";
  const isTrainer = user?.role === "TRAINER";
  const canEdit = isAdmin || (isTrainer && trainerMode === "INSTRUCTOR");

  const modules = course.modules_with_status;
  const totalModules = modules.length;
  const completedCount = modules.filter((m) => m.is_completed).length;
  // Derive progress from completed modules so "X/Y módulos" and "Z%" always agree (F-AL1)
  const progreso = totalModules > 0 ? Math.round((completedCount / totalModules) * 100) : 0;

  // Next module to continue, or first for "revisar"
  const nextModule = modules.find((m) => m.is_unlocked && !m.is_completed);
  const firstModule = modules[0];
  const ctaTarget = nextModule ?? firstModule;

  const ctaLabel =
    progreso === 0 ? "Comenzar curso" : progreso === 100 ? "Revisar curso" : "Continuar";
  const ctaDisabled = !enrollment || totalModules === 0 || !ctaTarget;

  function handleCta() {
    if (!course || !ctaTarget) return;
    navigate(`/courses/${course.id}/modules/${ctaTarget.id}`);
  }

  function handleModuleNavigate(moduleId: number) {
    if (!course) return;
    navigate(`/courses/${course.id}/modules/${moduleId}`);
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Back link */}
      <Link
        to="/courses"
        className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
      >
        <i className="ti ti-arrow-left text-xs" />
        Mis cursos
      </Link>

      {/* ── Hero card ── */}
      <div className="rounded-2xl overflow-hidden border border-border bg-card shadow-sm">
        {/* Banner */}
        <div
          className="px-8 pt-7 pb-6"
          style={{
            background:
              "linear-gradient(135deg, #1e1b4b 0%, #312e81 55%, #4c46b0 100%)",
          }}
        >
          {/* Tags row */}
          <div className="flex flex-wrap gap-2 mb-4">
            {course.area_nombre && (
              <span className="text-xs bg-white/10 text-white/80 px-2.5 py-0.5 rounded-full">
                {course.area_nombre}
              </span>
            )}
            <span className="text-xs bg-white/10 text-white/80 px-2.5 py-0.5 rounded-full">
              {TIPO_LABEL[course.tipo] ?? course.tipo}
            </span>
            {course.duracion_horas && (
              <span className="text-xs bg-white/10 text-white/80 px-2.5 py-0.5 rounded-full">
                <i className="ti ti-clock mr-1" />
                {course.duracion_horas}h
              </span>
            )}
            <UrgencyBadge fechaLimite={course.fecha_limite} />
          </div>

          <h1 className="text-2xl font-bold text-white leading-snug">{course.titulo}</h1>

          {course.descripcion && (
            <p className="mt-2 text-sm text-white/65 max-w-lg leading-relaxed">
              {course.descripcion}
            </p>
          )}

          {course.instructor_nombre && (
            <p className="mt-3 text-xs text-white/45 flex items-center gap-1.5">
              <i className="ti ti-user-circle" />
              Instructor: {course.instructor_nombre}
            </p>
          )}
        </div>

        {/* Progress bar */}
        {enrollment && (
          <div className="px-8 py-4 border-b border-border">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs text-muted-foreground">
                {completedCount}/{totalModules} módulos completados
              </span>
              <span
                className={`text-xs font-semibold ${
                  progreso === 100 ? "text-emerald-400" : "text-indigo-400"
                }`}
              >
                {progreso}%
              </span>
            </div>
            <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  progreso === 100 ? "bg-emerald-500" : "bg-indigo-500"
                }`}
                style={{ width: `${progreso}%` }}
              />
            </div>
          </div>
        )}

        {/* CTA row */}
        <div className="px-8 py-4 flex items-center gap-3">
          {enrollment && (
            <button
              onClick={handleCta}
              disabled={ctaDisabled}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed shadow-lg ${
                progreso === 100
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20"
                  : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20"
              }`}
            >
              <i
                className={`ti ${progreso === 100 ? "ti-eye" : "ti-player-play"} text-sm`}
              />
              {ctaLabel}
            </button>
          )}
          {canEdit && (
            <Link
              to={`/admin/courses/${course.id}/edit`}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground px-3 py-2.5 rounded-xl hover:bg-muted/30 transition-colors"
            >
              <i className="ti ti-pencil text-sm" />
              Editar curso
            </Link>
          )}
        </div>
      </div>

      {/* ── Module list ── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Contenido del curso</h2>
          <span className="text-xs text-muted-foreground">
            {totalModules} módulo{totalModules !== 1 ? "s" : ""}
            {course.has_assessment && " · 1 evaluación"}
          </span>
        </div>

        {totalModules === 0 ? (
          <div className="px-5 py-10 text-center">
            <i className="ti ti-inbox text-3xl text-muted-foreground/40 block mb-2" />
            <p className="text-sm text-muted-foreground">Este curso aún no tiene módulos.</p>
          </div>
        ) : (
          modules.map((mod, i) => (
            <ModuleRow
              key={mod.id}
              mod={mod}
              index={i}
              onNavigate={handleModuleNavigate}
            />
          ))
        )}

        {course.has_assessment && enrollment && (
          <ExamRow courseId={course.id} locked={completedCount < totalModules} />
        )}
      </div>
    </div>
  );
}
