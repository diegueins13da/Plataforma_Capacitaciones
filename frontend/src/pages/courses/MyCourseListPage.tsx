/**
 * P12 — My Courses List
 * Shows enrolled courses sorted by deadline proximity.
 * Three tabs: En progreso / Completados / Vencidos.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { differenceInDays, parseISO } from "date-fns";

import { coursesService } from "../../services/coursesService";
import { UrgencyBadge } from "../../components/shared/UrgencyBadge";
import { useAuthStore } from "../../store/authStore";
import { useTrainerModeStore } from "../../store/trainerModeStore";
import type { CourseListItem } from "../../types/course";

type Tab = "EN_PROGRESO" | "COMPLETADO" | "VENCIDO";

const TABS: { value: Tab; label: string }[] = [
  { value: "EN_PROGRESO", label: "En progreso" },
  { value: "COMPLETADO", label: "Completados" },
  { value: "VENCIDO", label: "Vencidos" },
];

function deadlineSortKey(course: CourseListItem): number {
  if (!course.fecha_limite) return Infinity;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return differenceInDays(parseISO(course.fecha_limite), today);
}

export default function MyCourseListPage() {
  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("EN_PROGRESO");
  const { user } = useAuthStore();
  const trainerMode = useTrainerModeStore((s) => s.mode);

  useEffect(() => {
    setLoading(true);
    // Trainers in Alumno mode must see their enrolled courses, not their created ones
    const asStudent = user?.role === "TRAINER" && trainerMode === "ALUMNO";
    coursesService
      .getCourses({ estado: "PUBLICADO", as_student: asStudent || undefined })
      .then((res) => setCourses(res.results))
      .catch(() => toast.error("No se pudieron cargar tus cursos."))
      .finally(() => setLoading(false));
  }, [user, trainerMode]);

  const byTab: Record<Tab, CourseListItem[]> = {
    EN_PROGRESO: courses
      .filter((c) => c.enrollment?.estado === "EN_PROGRESO")
      .sort((a, b) => deadlineSortKey(a) - deadlineSortKey(b)),
    COMPLETADO: courses.filter((c) => c.enrollment?.estado === "COMPLETADO"),
    VENCIDO: courses.filter((c) => c.enrollment?.estado === "VENCIDO"),
  };

  const visible = byTab[activeTab];

  const counts: Record<Tab, number> = {
    EN_PROGRESO: byTab.EN_PROGRESO.length,
    COMPLETADO: byTab.COMPLETADO.length,
    VENCIDO: byTab.VENCIDO.length,
  };

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Mi aprendizaje</h1>
        <p className="text-sm text-muted-foreground mt-1">Seguimiento de tus cursos</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.value
                ? "border-indigo-600 text-indigo-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            {counts[tab.value] > 0 && (
              <span
                className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.value
                    ? "bg-indigo-500/20 text-indigo-400"
                    : "bg-muted/40 text-muted-foreground"
                }`}
              >
                {counts[tab.value]}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          {activeTab === "EN_PROGRESO"
            ? "No tienes cursos en progreso."
            : activeTab === "COMPLETADO"
              ? "Aún no has completado ningún curso."
              : "No tienes cursos vencidos."}
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((course) => {
            const enrollment = course.enrollment!;
            const progreso = enrollment.progreso_porcentaje;
            return (
              <Link
                key={course.id}
                to={`/courses/${course.id}`}
                className="flex items-center gap-4 bg-card border border-border rounded-xl p-4 hover:shadow-sm transition-shadow"
              >
                {/* Left: circular progress */}
                <div className="relative w-12 h-12 shrink-0">
                  <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
                    <circle cx="24" cy="24" r="20" stroke="#e5e7eb" strokeWidth="4" fill="none" />
                    <circle
                      cx="24"
                      cy="24"
                      r="20"
                      stroke={activeTab === "COMPLETADO" ? "#16a34a" : "#6366f1"}
                      strokeWidth="4"
                      fill="none"
                      strokeDasharray={`${(progreso / 100) * 125.6} 125.6`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-muted-foreground">
                    {progreso}%
                  </span>
                </div>

                {/* Center: info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{course.titulo}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <UrgencyBadge fechaLimite={course.fecha_limite} />
                    {course.area_nombre && (
                      <span className="text-xs text-muted-foreground">{course.area_nombre}</span>
                    )}
                  </div>
                  {/* Thin progress bar */}
                  {activeTab === "EN_PROGRESO" && (
                    <div className="mt-2 h-1 bg-muted/40 rounded-full overflow-hidden w-full">
                      <div
                        className="h-full bg-indigo-400 rounded-full"
                        style={{ width: `${progreso}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Right: modules */}
                <div className="text-right text-xs text-muted-foreground shrink-0">
                  <span>
                    {course.module_count} módulo{course.module_count !== 1 ? "s" : ""}
                  </span>
                  {course.duracion_horas && <div>{course.duracion_horas}h</div>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
