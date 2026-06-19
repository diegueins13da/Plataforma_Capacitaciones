/**
 * P11 — Course Detail
 * Shows course info, module list with lock/completion state, enrollment progress,
 * and a "Comenzar/Continuar" CTA. Module players will be wired in T19.
 */
import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";

import { coursesService } from "../../services/coursesService";
import { UrgencyBadge } from "../../components/shared/UrgencyBadge";
import { useAuthStore } from "../../store/authStore";
import type { Course, CourseModuleWithStatus } from "../../types/course";

const TIPO_LABEL: Record<string, string> = {
  ONLINE: "Online",
  PRESENCIAL: "Presencial",
  HIBRIDO: "Híbrido",
  AUTOAPRENDIZAJE: "Autoaprendizaje",
};

const MODULE_TIPO_ICON: Record<string, string> = {
  VIDEO: "▶",
  PDF: "📄",
  TEXTO: "📝",
  SCORM: "🎮",
};

function ModuleRow({ mod, index }: { mod: CourseModuleWithStatus; index: number }) {
  const locked = !mod.is_unlocked;
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 ${
        locked ? "opacity-50 cursor-not-allowed" : "hover:bg-background cursor-pointer"
      }`}
    >
      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-muted/40 text-muted-foreground shrink-0">
        {mod.is_completed ? (
          <span className="text-emerald-500 text-base">✓</span>
        ) : (
          <span>{index + 1}</span>
        )}
      </div>

      <span className="text-base">{MODULE_TIPO_ICON[mod.tipo_contenido] ?? "📋"}</span>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{mod.titulo}</p>
        {mod.duracion_minutos && (
          <p className="text-xs text-muted-foreground">{mod.duracion_minutos} min</p>
        )}
      </div>

      {locked ? (
        <span className="text-muted-foreground text-sm">🔒</span>
      ) : mod.is_completed ? (
        <span className="text-xs text-emerald-500 font-medium">Completado</span>
      ) : (
        <span className="text-xs text-indigo-500 font-medium">Iniciar →</span>
      )}
    </div>
  );
}

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
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
  const progreso = enrollment?.progreso_porcentaje ?? 0;
  const isAdmin = user?.role === "ADMIN";
  const isTrainer = user?.role === "TRAINER";

  // First module that is unlocked and not completed
  const nextModule = course.modules_with_status.find((m) => m.is_unlocked && !m.is_completed);
  const ctaLabel = progreso === 0 ? "Comenzar curso" : progreso === 100 ? "Revisar curso" : "Continuar";

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Back */}
      <Link to="/courses" className="text-sm text-indigo-600 hover:underline mb-4 inline-block">
        ← Mis cursos
      </Link>

      {/* Header */}
      <div className="bg-card border border-border rounded-xl overflow-hidden mb-6">
        <div className="bg-gradient-to-br from-indigo-500/10 to-indigo-500/20 px-6 py-10 text-center">
          <h1 className="text-2xl font-bold text-foreground">{course.titulo}</h1>
          {course.descripcion && (
            <p className="mt-2 text-sm text-muted-foreground max-w-xl mx-auto">{course.descripcion}</p>
          )}
        </div>

        {/* Meta */}
        <div className="px-6 py-4 flex flex-wrap gap-3 items-center border-b border-border">
          {course.area_nombre && (
            <span className="text-xs bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full">
              {course.area_nombre}
            </span>
          )}
          <span className="text-xs bg-muted/40 text-muted-foreground px-2 py-0.5 rounded-full">
            {TIPO_LABEL[course.tipo] ?? course.tipo}
          </span>
          {course.duracion_horas && (
            <span className="text-xs text-muted-foreground">{course.duracion_horas}h estimadas</span>
          )}
          <UrgencyBadge fechaLimite={course.fecha_limite} />
          {course.instructor_nombre && (
            <span className="text-xs text-muted-foreground">Instructor: {course.instructor_nombre}</span>
          )}
        </div>

        {/* Enrollment progress */}
        {enrollment && (
          <div className="px-6 py-4 border-b border-border">
            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
              <span>Progreso del curso</span>
              <span className="font-medium">{progreso}%</span>
            </div>
            <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all"
                style={{ width: `${progreso}%` }}
              />
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="px-6 py-4 flex items-center gap-3">
          {enrollment && (
            <button
              onClick={() => {
                if (nextModule) {
                  // T19 will implement the player route
                  navigate(`/courses/${course.id}/modules/${nextModule.id}`);
                }
              }}
              disabled={!nextModule && progreso < 100}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium py-2.5 px-4 rounded-lg shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all duration-300"
            >
              {ctaLabel}
            </button>
          )}
          {(isAdmin || isTrainer) && (
            <Link
              to={`/admin/courses/${course.id}/edit`}
              className="text-sm text-indigo-600 hover:underline px-2"
            >
              Editar curso
            </Link>
          )}
        </div>
      </div>

      {/* Module list */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">
            Contenido del curso ({course.modules_with_status.length} módulo
            {course.modules_with_status.length !== 1 ? "s" : ""})
          </h2>
        </div>

        {course.modules_with_status.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            Este curso no tiene módulos aún.
          </div>
        ) : (
          course.modules_with_status.map((mod, i) => (
            <ModuleRow key={mod.id} mod={mod} index={i} />
          ))
        )}
      </div>
    </div>
  );
}
