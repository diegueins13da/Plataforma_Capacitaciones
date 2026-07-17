import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { useTrainerModeStore } from "../../store/trainerModeStore";
import {
  usersService,
  type DashboardCourse,
  type DashboardActivity,
  type DashboardCertificate,
  type DashboardCompletedCourse,
  type DashboardData,
} from "../../services/usersService";
import InstructorDashboardPage from "./InstructorDashboardPage";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function today(): string {
  return new Date().toLocaleDateString("es-EC", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString("es-EC", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtRelative(ts: string): string {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return "hace un momento";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  const days = Math.floor(diff / 86400);
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} días`;
  return new Date(ts).toLocaleDateString("es-EC", { day: "numeric", month: "short" });
}

function deadlineLabel(course: DashboardCourse): string {
  const d = course.days_left;
  if (d === null) return "";
  if (d <= 0) return "Vence hoy";
  if (d === 1) return "Vence mañana";
  return `${d} días`;
}

const ACTIVITY_LABELS: Record<string, (nombre?: string | null) => string> = {
  COURSE_ENROLLED: (n) => n ? `Te inscribiste en "${n}"` : "Te inscribiste en un curso",
  EXAM_STARTED: (n) => n ? `Iniciaste el examen de "${n}"` : "Iniciaste un examen",
  EXAM_COMPLETED: (n) => n ? `Completaste el examen de "${n}"` : "Completaste un examen",
  CERTIFICATE_GENERATED: (n) => n ? `Certificado de "${n}" emitido` : "Certificado emitido",
  CERTIFICATE_DOWNLOADED: (n) => n ? `Descargaste el certificado de "${n}"` : "Descargaste un certificado",
  LOGIN_SUCCESS: () => "Ingresaste al sistema",
  LOGOUT: () => "Cerraste sesión",
  PASSWORD_CHANGED: () => "Cambiaste tu contraseña",
  PASSWORD_RESET: () => "Restableciste tu contraseña",
};

const ACTIVITY_ICONS: Record<string, { icon: string; color: string; bg: string }> = {
  COURSE_ENROLLED: { icon: "ti-plus", color: "#6366f1", bg: "rgba(99,102,241,0.12)" },
  EXAM_STARTED: { icon: "ti-pencil", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  EXAM_COMPLETED: { icon: "ti-check", color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  CERTIFICATE_GENERATED: { icon: "ti-certificate", color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
  CERTIFICATE_DOWNLOADED: { icon: "ti-download", color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
  LOGIN_SUCCESS: { icon: "ti-login", color: "#64748b", bg: "rgba(100,116,139,0.08)" },
  LOGOUT: { icon: "ti-logout", color: "#64748b", bg: "rgba(100,116,139,0.08)" },
  PASSWORD_CHANGED: { icon: "ti-key", color: "#64748b", bg: "rgba(100,116,139,0.08)" },
  PASSWORD_RESET: { icon: "ti-key", color: "#64748b", bg: "rgba(100,116,139,0.08)" },
};

// ─────────────────────────────────────────────────────────────
// Root export
// ─────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const trainerMode = useTrainerModeStore((s) => s.mode);
  if (user?.role === "TRAINER" && trainerMode === "INSTRUCTOR") {
    return <InstructorDashboardPage />;
  }
  return <StudentDashboard />;
}

// ─────────────────────────────────────────────────────────────
// Main student dashboard
// ─────────────────────────────────────────────────────────────

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
  const initials = (user?.full_name ?? user?.email ?? "?")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const {
    resumen,
    cursos_activos,
    cursos_completados = [],
    proximos_vencimientos,
    certificados = [],
    actividad_reciente,
  } = data;

  const totalFinished = resumen.completados + resumen.vencidos;
  const tasaExito = totalFinished > 0 ? Math.round((resumen.completados / totalFinished) * 100) : null;

  const subtitle =
    resumen.completados > 0
      ? `${resumen.completados} curso${resumen.completados !== 1 ? "s" : ""} completado${resumen.completados !== 1 ? "s" : ""}${resumen.en_progreso > 0 ? ` · ${resumen.en_progreso} en progreso` : ""}`
      : resumen.en_progreso > 0
      ? `${resumen.en_progreso} curso${resumen.en_progreso !== 1 ? "s" : ""} en progreso`
      : "Bienvenido a tu espacio de aprendizaje";

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-sm font-medium text-indigo-300 shrink-0 select-none">
            {initials}
          </div>
          <div>
            <h1 className="text-xl font-medium text-foreground leading-snug">
              {greeting()}, {firstName}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground hidden sm:block shrink-0">{cap(today())}</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border rounded-xl overflow-hidden border border-border">
        <StatTile label="En progreso" icon="ti-flame" iconColor="#f59e0b" sub="cursos activos">
          {resumen.en_progreso}
        </StatTile>
        <StatTile label="Completados" icon="ti-circle-check" iconColor="#10b981" sub="cursos finalizados">
          {resumen.completados}
        </StatTile>
        <StatTile
          label="Tasa de éxito"
          icon="ti-trending-up"
          iconColor="#6366f1"
          sub="de cursos aprobados"
        >
          {tasaExito !== null ? `${tasaExito}%` : "—"}
        </StatTile>
        <StatTile
          label="Certificados"
          icon="ti-certificate"
          iconColor="#a78bfa"
          sub={
            (resumen.certs_por_vencer ?? 0) > 0
              ? `${resumen.certs_por_vencer} próximos a vencer`
              : "certificados activos"
          }
          subColor={(resumen.certs_por_vencer ?? 0) > 0 ? "#f59e0b" : undefined}
        >
          {resumen.certificados ?? 0}
        </StatTile>
      </div>

      {/* Main two-column area */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-4 items-start">
        {/* Left: active courses */}
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs font-medium text-muted-foreground tracking-wider uppercase mb-4">
            Mis cursos activos
          </p>

          {cursos_activos.length > 0 ? (
            <div className="space-y-3">
              {cursos_activos.map((c) => (
                <ActiveCourseCard key={c.enrollment_id} course={c} />
              ))}
              {cursos_completados.slice(0, 2).map((c) => (
                <CompletedCourseRow key={c.enrollment_id} course={c} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center mx-auto mb-3">
                <i className="ti ti-books text-2xl text-indigo-500" aria-hidden="true" />
              </div>
              <p className="text-sm text-muted-foreground mb-2">No tienes cursos en progreso.</p>
              <Link
                to="/courses"
                className="inline-flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Explorar cursos
                <i className="ti ti-arrow-right text-xs" aria-hidden="true" />
              </Link>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {proximos_vencimientos.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground tracking-wider uppercase mb-3">
                Vencimientos
              </p>
              <div className="space-y-2">
                {proximos_vencimientos.map((c) => (
                  <DeadlineItem key={c.enrollment_id} course={c} />
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground tracking-wider uppercase mb-3">
              Certificados
            </p>
            {certificados.length > 0 ? (
              <>
                <div className="space-y-2">
                  {certificados.map((c) => (
                    <CertItem key={c.id} cert={c} />
                  ))}
                </div>
                {(resumen.certificados ?? 0) > 3 && (
                  <Link
                    to="/my-certificates"
                    className="mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  >
                    <i className="ti ti-dots text-sm" aria-hidden="true" />
                    Ver todos ({resumen.certificados})
                  </Link>
                )}
              </>
            ) : (
              <div className="text-center py-4">
                <i
                  className="ti ti-certificate text-2xl text-muted-foreground/30 block mb-1.5"
                  aria-hidden="true"
                />
                <p className="text-xs text-muted-foreground">
                  Tus certificados aparecerán aquí
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Activity timeline */}
      {actividad_reciente.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs font-medium text-muted-foreground tracking-wider uppercase mb-4">
            Actividad reciente
          </p>
          <div className="space-y-3">
            {actividad_reciente.map((a, i) => (
              <ActivityRow key={i} activity={a} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function StatTile({
  label,
  icon,
  iconColor,
  sub,
  subColor,
  children,
}: {
  label: string;
  icon: string;
  iconColor: string;
  sub: string;
  subColor?: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-card px-5 py-4">
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <i className={`ti ${icon} text-sm`} style={{ color: iconColor }} aria-hidden="true" />
      </div>
      <p className="text-2xl font-medium text-foreground leading-none tabular-nums">{children}</p>
      <p
        className={`text-xs mt-1.5 ${!subColor ? "text-muted-foreground" : ""}`}
        style={subColor ? { color: subColor } : undefined}
      >
        {sub}
      </p>
    </div>
  );
}

function ActiveCourseCard({ course }: { course: DashboardCourse }) {
  const styles = {
    verde: { border: "border-border", bg: "transparent", bar: "#6366f1", badge: null as null | { color: string; bg: string } },
    amarillo: { border: "border-amber-500/20", bg: "rgba(245,158,11,0.04)", bar: "#f59e0b", badge: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)" } },
    rojo: { border: "border-red-500/20", bg: "rgba(239,68,68,0.04)", bar: "#ef4444", badge: { color: "#ef4444", bg: "rgba(239,68,68,0.1)" } },
  }[course.urgency] ?? { border: "border-border", bg: "transparent", bar: "#6366f1", badge: null };

  const label = deadlineLabel(course);

  return (
    <div className={`rounded-lg border ${styles.border} p-3.5`} style={{ background: styles.bg }}>
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <p className="text-sm font-medium text-foreground truncate flex-1 min-w-0">{course.titulo}</p>
        {styles.badge && label && (
          <span
            className="text-xs font-medium px-2 py-0.5 rounded shrink-0"
            style={{ color: styles.badge.color, background: styles.badge.bg }}
          >
            {label}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${course.progreso}%`, background: styles.bar }}
          />
        </div>
        <span className="text-xs text-muted-foreground tabular-nums w-7 text-right shrink-0">
          {course.progreso}%
        </span>
      </div>
      <Link
        to={`/courses/${course.course_id}`}
        className="inline-flex items-center gap-1 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
      >
        Continuar
        <i className="ti ti-arrow-right text-xs" aria-hidden="true" />
      </Link>
    </div>
  );
}

function CompletedCourseRow({ course }: { course: DashboardCompletedCourse }) {
  return (
    <div
      className="rounded-lg border border-emerald-500/15 p-3.5 flex items-center justify-between gap-3"
      style={{ background: "rgba(16,185,129,0.03)" }}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-muted-foreground truncate">{course.titulo}</p>
        {course.fecha_completado && (
          <p className="text-xs text-muted-foreground/60 mt-0.5">
            Completado {fmtDate(course.fecha_completado)}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <i className="ti ti-certificate text-sm text-emerald-500" aria-hidden="true" />
        <span className="text-xs text-emerald-500">Certificado</span>
      </div>
    </div>
  );
}

function DeadlineItem({ course }: { course: DashboardCourse }) {
  const color =
    course.urgency === "rojo" ? "#ef4444" : course.urgency === "amarillo" ? "#f59e0b" : "#10b981";
  const label = deadlineLabel(course);

  return (
    <Link
      to={`/courses/${course.course_id}`}
      className="block p-2.5 rounded-sm hover:bg-accent/40 transition-colors"
      style={{ borderLeft: `2px solid ${color}` }}
    >
      <p className="text-xs font-medium text-foreground truncate">{course.titulo}</p>
      <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color }}>
        <i className="ti ti-clock text-xs" aria-hidden="true" />
        {label}
      </p>
    </Link>
  );
}

function CertItem({ cert }: { cert: DashboardCertificate }) {
  const expiry = cert.fecha_vencimiento ? new Date(cert.fecha_vencimiento) : null;
  const daysLeft = expiry ? Math.floor((expiry.getTime() - Date.now()) / 86400000) : null;
  const color =
    daysLeft !== null
      ? daysLeft < 30
        ? "#ef4444"
        : daysLeft < 90
        ? "#f59e0b"
        : "#10b981"
      : "#10b981";

  return (
    <div
      className="flex items-center gap-2.5 p-2.5 rounded-lg border border-emerald-500/15"
      style={{ background: "rgba(16,185,129,0.04)" }}
    >
      <i className="ti ti-certificate text-base shrink-0" style={{ color }} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-foreground truncate">{cert.titulo}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {cert.fecha_vencimiento
            ? `Válido hasta ${fmtDate(cert.fecha_vencimiento)}`
            : `Emitido ${fmtDate(cert.fecha_emision)}`}
        </p>
      </div>
    </div>
  );
}

function ActivityRow({ activity }: { activity: DashboardActivity }) {
  const def = ACTIVITY_ICONS[activity.accion] ?? {
    icon: "ti-point",
    color: "#64748b",
    bg: "rgba(100,116,139,0.08)",
  };
  const labelFn =
    ACTIVITY_LABELS[activity.accion] ??
    (() => activity.accion.replace(/_/g, " ").toLowerCase());
  const label = labelFn(activity.entidad_nombre);

  return (
    <div className="flex items-center gap-3">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 border"
        style={{ background: def.bg, borderColor: def.color + "30" }}
      >
        <i className={`ti ${def.icon} text-xs`} style={{ color: def.color }} aria-hidden="true" />
      </div>
      <p className="flex-1 text-sm text-muted-foreground min-w-0 truncate">{label}</p>
      <span className="text-xs text-muted-foreground/60 shrink-0 whitespace-nowrap">
        {fmtRelative(activity.timestamp)}
      </span>
    </div>
  );
}
