import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { useAuthStore } from "../../store/authStore";
import { useTrainerModeStore } from "../../store/trainerModeStore";
import {
  usersService,
  type DashboardCourse,
  type DashboardData,
} from "../../services/usersService";
import InstructorDashboardPage from "./InstructorDashboardPage";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

function today(): string {
  return new Date().toLocaleDateString("es-EC", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------
interface KpiProps {
  label: string;
  value: number;
  icon: string;
  accent: string;       // border + icon bg tint
  iconColor: string;    // icon color
  valueColor: string;
}

function KpiCard({ label, value, icon, accent, iconColor, valueColor }: KpiProps) {
  return (
    <div
      className={`rounded-xl p-4 flex items-center gap-4 border ${accent} bg-card`}
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${iconColor}22` }}
      >
        <i className={`ti ${icon} text-xl`} style={{ color: iconColor }} aria-hidden="true" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className="text-2xl font-semibold leading-none" style={{ color: valueColor }}>
          {value}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Donut chart — course status distribution
// ---------------------------------------------------------------------------
const STATUS_COLORS = ["#4F46E5", "#10B981", "#EF4444"];

function StatusDonut({ resumen }: { resumen: DashboardData["resumen"] }) {
  const data = [
    { name: "En progreso", value: resumen.en_progreso },
    { name: "Completados", value: resumen.completados },
    { name: "Vencidos", value: resumen.vencidos },
  ].filter((d) => d.value > 0);

  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-5 h-full flex flex-col">
      <p className="text-sm font-medium text-foreground mb-4">Estado de cursos</p>
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <div className="relative w-full" style={{ height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={54}
                outerRadius={78}
                paddingAngle={3}
                dataKey="value"
                strokeWidth={0}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={STATUS_COLORS[i]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: number, name: string) => [`${v} cursos`, name]}
                contentStyle={{
                  background: "#1e2a3a",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8,
                  color: "#e2e8f0",
                  fontSize: 12,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Center label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl font-bold text-foreground">{total}</span>
            <span className="text-xs text-muted-foreground">total</span>
          </div>
        </div>
        {/* Legend */}
        <div className="w-full grid grid-cols-3 gap-2">
          {data.map((d, i) => (
            <div key={d.name} className="flex flex-col items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[i] }} />
              <span className="text-xs text-muted-foreground text-center leading-tight">{d.name}</span>
              <span className="text-sm font-semibold text-foreground">{d.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Horizontal bar chart — progress per active course
// ---------------------------------------------------------------------------
const URGENCY_COLOR: Record<string, string> = {
  verde: "#10B981",
  amarillo: "#F59E0B",
  rojo: "#EF4444",
};

interface BarPayload {
  name: string;
  progreso: number;
  urgency: string;
  course_id: number;
}

function CourseProgressChart({ courses }: { courses: DashboardCourse[] }) {
  if (courses.length === 0) return null;

  const data: BarPayload[] = courses.map((c) => ({
    name: c.titulo.length > 22 ? c.titulo.slice(0, 22) + "…" : c.titulo,
    progreso: c.progreso,
    urgency: c.urgency,
    course_id: c.course_id,
  }));

  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col h-full">
      <p className="text-sm font-medium text-foreground mb-4">Progreso por curso</p>
      <div className="flex-1" style={{ minHeight: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 36, left: 0, bottom: 0 }}
            barSize={10}
          >
            <CartesianGrid horizontal={false} stroke="rgba(255,255,255,0.05)" />
            <XAxis
              type="number"
              domain={[0, 100]}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "#64748b" }}
              tickFormatter={(v) => `${v}%`}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={130}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "#94a3b8" }}
            />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              formatter={(v: number) => [`${v}%`, "Progreso"]}
              contentStyle={{
                background: "#1e2a3a",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                color: "#e2e8f0",
                fontSize: 12,
              }}
            />
            <Bar
              dataKey="progreso"
              radius={[0, 5, 5, 0]}
              background={{ fill: "rgba(255,255,255,0.04)", radius: 5 }}
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={URGENCY_COLOR[entry.urgency] ?? "#4F46E5"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Upcoming deadlines
// ---------------------------------------------------------------------------
function DeadlineCard({ course }: { course: DashboardCourse }) {
  const urgency = course.urgency;
  const colorMap = {
    verde: { bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.25)", text: "#10B981" },
    amarillo: { bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.25)", text: "#F59E0B" },
    rojo: { bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.25)", text: "#EF4444" },
  };
  const c = colorMap[urgency];
  const label =
    course.days_left === 0
      ? "Vence hoy"
      : course.days_left === 1
      ? "Vence mañana"
      : `${course.days_left ?? "?"} días`;

  return (
    <Link
      to={`/courses/${course.course_id}`}
      className="flex items-center gap-3 p-3 rounded-xl border transition-colors hover:bg-accent/50"
      style={{ borderColor: c.border, background: c.bg }}
    >
      <i className="ti ti-clock text-base shrink-0" style={{ color: c.text }} aria-hidden="true" />
      <span className="flex-1 text-sm text-foreground truncate">{course.titulo}</span>
      <span className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0"
        style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
        {label}
      </span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const trainerMode = useTrainerModeStore((s) => s.mode);

  // Instructor mode → show instructor-specific dashboard
  if (user?.role === "TRAINER" && trainerMode === "INSTRUCTOR") {
    return <InstructorDashboardPage />;
  }

  return <StudentDashboard />;
}

function StudentDashboard() {
  const user = useAuthStore((s) => s.user);
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
        <div className="w-8 h-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">{error ?? "Sin datos."}</p>
      </div>
    );
  }

  const firstName = user?.full_name?.split(" ")[0] ?? user?.email ?? "Usuario";
  const total =
    data.resumen.en_progreso + data.resumen.completados + data.resumen.vencidos;
  const pctCompleted = total > 0 ? Math.round((data.resumen.completados / total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          {greeting()}, {firstName}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">{cap(today())}</p>
      </div>

      {/* ── KPI cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="En progreso"
          value={data.resumen.en_progreso}
          icon="ti-book-2"
          accent="border-indigo-500/20"
          iconColor="#4F46E5"
          valueColor="#818CF8"
        />
        <KpiCard
          label="Completados"
          value={data.resumen.completados}
          icon="ti-circle-check"
          accent="border-emerald-500/20"
          iconColor="#10B981"
          valueColor="#34D399"
        />
        <KpiCard
          label="Completación"
          value={pctCompleted}
          icon="ti-chart-pie"
          accent="border-amber-500/20"
          iconColor="#F59E0B"
          valueColor="#FCD34D"
        />
        <KpiCard
          label="Vencidos"
          value={data.resumen.vencidos}
          icon="ti-alert-triangle"
          accent={data.resumen.vencidos > 0 ? "border-red-500/30" : "border-border"}
          iconColor={data.resumen.vencidos > 0 ? "#EF4444" : "#64748b"}
          valueColor={data.resumen.vencidos > 0 ? "#F87171" : "#64748b"}
        />
      </div>

      {/* ── Charts row ──────────────────────────────────────────── */}
      {data.cursos_activos.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ minHeight: 280 }}>
          <div className="lg:col-span-2">
            <CourseProgressChart courses={data.cursos_activos} />
          </div>
          <div>
            <StatusDonut resumen={data.resumen} />
          </div>
        </div>
      )}

      {/* ── Vencimientos ────────────────────────────────────────── */}
      {data.proximos_vencimientos.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <i className="ti ti-clock-exclamation text-amber-500" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">Próximos vencimientos</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {data.proximos_vencimientos.map((c) => (
              <DeadlineCard key={c.enrollment_id} course={c} />
            ))}
          </div>
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────────── */}
      {data.cursos_activos.length === 0 && (
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center mx-auto mb-4">
            <i className="ti ti-books text-3xl text-indigo-500" aria-hidden="true" />
          </div>
          <p className="text-muted-foreground mb-3">No hay actividad registrada aún.</p>
          <Link
            to="/courses"
            className="inline-flex items-center gap-1.5 text-sm text-indigo-500 hover:text-indigo-400 transition-colors"
          >
            Explorar cursos disponibles
            <i className="ti ti-arrow-right text-xs" aria-hidden="true" />
          </Link>
        </div>
      )}
    </div>
  );
}
