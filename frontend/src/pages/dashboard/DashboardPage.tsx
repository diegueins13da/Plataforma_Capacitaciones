/**
 * P06 — User dashboard. Shows summary stats, active courses with urgency
 * traffic light, upcoming deadlines, and recent activity.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { usersService, type DashboardCourse, type DashboardData } from "../../services/usersService";

const URGENCY_CLASS: Record<string, string> = {
  verde: "bg-green-100 text-green-800",
  amarillo: "bg-yellow-100 text-yellow-800",
  rojo: "bg-red-100 text-red-800 animate-pulse",
};

const URGENCY_DOT: Record<string, string> = {
  verde: "bg-green-500",
  amarillo: "bg-yellow-500",
  rojo: "bg-red-500",
};

function DeadlineBadge({ course }: { course: DashboardCourse }) {
  if (!course.fecha_limite) return null;
  const label =
    course.days_left === 0
      ? "Vence hoy"
      : course.days_left === 1
      ? "Vence mañana"
      : `${course.days_left} días`;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${URGENCY_CLASS[course.urgency]}`}>
      {label}
    </span>
  );
}

function CourseCard({ course }: { course: DashboardCourse }) {
  return (
    <Link
      to={`/courses/${course.course_id}`}
      className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl hover:shadow-sm transition-shadow"
    >
      <span
        className={`w-3 h-3 rounded-full shrink-0 ${URGENCY_DOT[course.urgency]}`}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{course.titulo}</p>
        <div className="mt-1 flex items-center gap-3">
          <div className="flex-1 bg-gray-100 rounded-full h-1.5">
            <div
              className="bg-indigo-500 h-1.5 rounded-full"
              style={{ width: `${course.progreso}%` }}
            />
          </div>
          <span className="text-xs text-gray-500 shrink-0">{course.progreso}%</span>
        </div>
      </div>
      <DeadlineBadge course={course} />
    </Link>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className={`rounded-2xl p-5 ${color}`}>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-sm mt-1 opacity-80">{label}</p>
    </div>
  );
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "hace un momento";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return new Date(iso).toLocaleDateString("es-EC", { day: "numeric", month: "short" });
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    usersService
      .getDashboard()
      .then(setData)
      .catch(() => setError("No se pudo cargar el dashboard."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="w-8 h-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-500">{error ?? "Sin datos."}</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="En progreso"
          value={data.resumen.en_progreso}
          color="bg-indigo-50 text-indigo-900"
        />
        <StatCard
          label="Completados"
          value={data.resumen.completados}
          color="bg-green-50 text-green-900"
        />
        <StatCard
          label="Vencidos"
          value={data.resumen.vencidos}
          color="bg-red-50 text-red-900"
        />
      </div>

      {/* Active courses */}
      {data.cursos_activos.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-gray-700">Mis cursos activos</h2>
          <div className="space-y-2">
            {data.cursos_activos.map((c) => (
              <CourseCard key={c.enrollment_id} course={c} />
            ))}
          </div>
        </section>
      )}

      {/* Upcoming deadlines */}
      {data.proximos_vencimientos.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-gray-700">Próximos vencimientos</h2>
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            {data.proximos_vencimientos.map((c, i) => (
              <Link
                key={c.enrollment_id}
                to={`/courses/${c.course_id}`}
                className={`flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors ${
                  i < data.proximos_vencimientos.length - 1 ? "border-b border-gray-100" : ""
                }`}
              >
                <span className="text-sm text-gray-800">{c.titulo}</span>
                <DeadlineBadge course={c} />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Recent activity */}
      {data.actividad_reciente.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-gray-700">Actividad reciente</h2>
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            {data.actividad_reciente.map((a, i) => (
              <div
                key={i}
                className={`flex items-center justify-between px-4 py-3 ${
                  i < data.actividad_reciente.length - 1 ? "border-b border-gray-100" : ""
                }`}
              >
                <span className="text-sm text-gray-700">{a.accion}</span>
                <span className="text-xs text-gray-400">{timeAgo(a.timestamp)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.cursos_activos.length === 0 && data.actividad_reciente.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-400 text-sm">No hay actividad registrada aún.</p>
          <Link
            to="/courses"
            className="mt-3 inline-block text-indigo-600 text-sm hover:underline"
          >
            Explorar cursos disponibles →
          </Link>
        </div>
      )}
    </div>
  );
}
