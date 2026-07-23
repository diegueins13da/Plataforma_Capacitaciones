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
import { Tooltip } from "../../components/ui/Tooltip";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

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
  COURSE_ENROLLED:        (n) => n ? `Te inscribiste en "${n}"` : "Inscripción a un curso",
  EXAM_STARTED:           (n) => n ? `Iniciaste el examen de "${n}"` : "Inicio de examen",
  EXAM_COMPLETED:         (n) => n ? `Completaste el examen de "${n}"` : "Examen completado",
  CERTIFICATE_GENERATED:  (n) => n ? `Certificado de "${n}" emitido` : "Certificado emitido",
  CERTIFICATE_DOWNLOADED: (n) => n ? `Descargaste el certificado de "${n}"` : "Certificado descargado",
  LOGIN_SUCCESS:          () => "Ingresaste al sistema",
  LOGOUT:                 () => "Cerraste sesión",
  PASSWORD_CHANGED:       () => "Cambiaste tu contraseña",
  PASSWORD_RESET:         () => "Restableciste tu contraseña",
};

const ACTIVITY_ICONS: Record<string, { icon: string; color: string; bg: string }> = {
  COURSE_ENROLLED:        { icon: "ti-circle-plus",  color: "#6366f1", bg: "rgba(99,102,241,0.12)"  },
  EXAM_STARTED:           { icon: "ti-writing",      color: "#f59e0b", bg: "rgba(245,158,11,0.12)"  },
  EXAM_COMPLETED:         { icon: "ti-circle-check", color: "#10b981", bg: "rgba(16,185,129,0.12)"  },
  CERTIFICATE_GENERATED:  { icon: "ti-award",        color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
  CERTIFICATE_DOWNLOADED: { icon: "ti-download",     color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
  LOGIN_SUCCESS:          { icon: "ti-login-2",      color: "#64748b", bg: "rgba(100,116,139,0.08)" },
  LOGOUT:                 { icon: "ti-logout-2",     color: "#64748b", bg: "rgba(100,116,139,0.08)" },
  PASSWORD_CHANGED:       { icon: "ti-lock-cog",     color: "#64748b", bg: "rgba(100,116,139,0.08)" },
  PASSWORD_RESET:         { icon: "ti-lock-open",    color: "#64748b", bg: "rgba(100,116,139,0.08)" },
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
// Skeleton
// ─────────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full skeleton flex-shrink-0" />
        <div className="space-y-2">
          <div className="h-5 w-52 skeleton rounded-lg" />
          <div className="h-4 w-36 skeleton rounded-lg" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-3">
            <div className="flex items-start justify-between">
              <div className="h-3.5 w-20 skeleton rounded" />
              <div className="w-9 h-9 skeleton rounded-xl" />
            </div>
            <div className="h-8 w-14 skeleton rounded-lg" />
            <div className="h-3 w-24 skeleton rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-4">
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="h-4 w-28 skeleton rounded" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="h-4 w-3/4 skeleton rounded" />
                <div className="h-5 w-14 skeleton rounded-full" />
              </div>
              <div className="h-1.5 w-full skeleton rounded-full" />
              <div className="h-4 w-16 skeleton rounded" />
            </div>
          ))}
        </div>
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="h-4 w-24 skeleton rounded" />
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-10 skeleton rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
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

  if (loading) return <DashboardSkeleton />;

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
          <i className="ti ti-wifi-off text-2xl text-destructive" aria-hidden="true" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground mb-1">No se pudo cargar el dashboard</p>
          <p className="text-sm text-muted-foreground">{error ?? "Sin datos."}</p>
        </div>
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
      {/* ── Greeting ──────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Tooltip label="Ver mi perfil" side="right">
            <Link
              to="/profile"
              className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 select-none ring-2 ring-offset-2 ring-offset-background ring-primary/20 hover:ring-primary/40 transition-all"
              style={{ background: "rgba(99,102,241,0.15)", color: "#818cf8" }}
            >
              {initials}
            </Link>
          </Tooltip>
          <div>
            <h1 className="text-xl font-semibold text-foreground leading-snug tracking-tight">
              {greeting()}, {firstName}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground hidden sm:block shrink-0 font-medium">
          {cap(today())}
        </p>
      </div>

      {/* ── Stat tiles ────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatTile
          label="En progreso"
          icon="ti-rocket"
          iconColor="#f59e0b"
          sub="cursos activos"
          tooltip="Cursos asignados y aún no completados"
        >
          {resumen.en_progreso}
        </StatTile>
        <StatTile
          label="Completados"
          icon="ti-trophy"
          iconColor="#10b981"
          sub="cursos finalizados"
          tooltip="Total de cursos que completaste exitosamente"
        >
          {resumen.completados}
        </StatTile>
        <StatTile
          label="Tasa de éxito"
          icon="ti-target"
          iconColor="#6366f1"
          sub="de cursos aprobados"
          tooltip="Porcentaje de cursos aprobados sobre el total finalizado"
        >
          {tasaExito !== null ? `${tasaExito}%` : "—"}
        </StatTile>
        <StatTile
          label="Certificados"
          icon="ti-award"
          iconColor="#a78bfa"
          sub={
            (resumen.certs_por_vencer ?? 0) > 0
              ? `${resumen.certs_por_vencer} próximos a vencer`
              : "certificados vigentes"
          }
          subColor={(resumen.certs_por_vencer ?? 0) > 0 ? "#f59e0b" : undefined}
          tooltip={
            (resumen.certs_por_vencer ?? 0) > 0
              ? `${resumen.certs_por_vencer} certificados próximos a vencer`
              : "Total de certificados vigentes obtenidos"
          }
        >
          {resumen.certificados ?? 0}
        </StatTile>
      </div>

      {/* ── Two-column content ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-4 items-start">
        <div className="rounded-xl border border-border bg-card p-5 card-elevated">
          <SectionLabel icon="ti-books">Mis cursos activos</SectionLabel>
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
            <EmptyState
              icon="ti-books"
              iconColor="#6366f1"
              title="Sin cursos en progreso"
              description="Explora el catálogo de cursos disponibles"
              action={{ to: "/courses", label: "Explorar cursos" }}
            />
          )}
        </div>

        <div className="space-y-4">
          {proximos_vencimientos.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4 card-elevated">
              <SectionLabel icon="ti-clock-exclamation">Próximos vencimientos</SectionLabel>
              <div className="space-y-1.5">
                {proximos_vencimientos.map((c) => (
                  <DeadlineItem key={c.enrollment_id} course={c} />
                ))}
              </div>
            </div>
          )}
          <div className="rounded-xl border border-border bg-card p-4 card-elevated">
            <SectionLabel icon="ti-award">Certificados</SectionLabel>
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
                    className="mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 pt-2 border-t border-border"
                  >
                    <i className="ti ti-layout-grid text-xs" aria-hidden="true" />
                    Ver todos ({resumen.certificados})
                  </Link>
                )}
              </>
            ) : (
              <EmptyState
                icon="ti-award"
                iconColor="#a78bfa"
                title="Sin certificados"
                description="Tus certificados aparecerán aquí"
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Activity timeline ─────────────────────────────── */}
      {actividad_reciente.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 card-elevated">
          <SectionLabel icon="ti-history">Actividad reciente</SectionLabel>
          <div className="space-y-1">
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

function SectionLabel({ children, icon }: { children: ReactNode; icon?: string }) {
  return (
    <p className="text-[11px] font-semibold text-muted-foreground tracking-widest uppercase mb-4 flex items-center gap-1.5">
      {icon && <i className={`ti ${icon} text-[13px]`} aria-hidden="true" />}
      {children}
    </p>
  );
}

function StatTile({
  label,
  icon,
  iconColor,
  sub,
  subColor,
  tooltip,
  children,
}: {
  label: string;
  icon: string;
  iconColor: string;
  sub: string;
  subColor?: string;
  tooltip: string;
  children: ReactNode;
}) {
  return (
    <Tooltip label={tooltip} side="bottom">
      <div className="w-full bg-card rounded-xl border border-border px-5 py-4 card-elevated transition-all cursor-default hover:-translate-y-px">
        <div className="flex items-start justify-between mb-3">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider leading-none">
            {label}
          </span>
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: `${iconColor}18`,
              boxShadow: `0 4px 14px ${iconColor}40, inset 0 1px 0 ${iconColor}25`,
            }}
          >
            <i className={`ti ${icon} text-[16px]`} style={{ color: iconColor }} aria-hidden="true" />
          </div>
        </div>
        <p className="text-2xl font-bold text-foreground leading-none tabular-nums">{children}</p>
        <p
          className={`text-xs mt-2 font-medium ${!subColor ? "text-muted-foreground" : ""}`}
          style={subColor ? { color: subColor } : undefined}
        >
          {sub}
        </p>
      </div>
    </Tooltip>
  );
}

function EmptyState({
  icon,
  iconColor,
  title,
  description,
  action,
}: {
  icon: string;
  iconColor: string;
  title: string;
  description: string;
  action?: { to: string; label: string };
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-3">
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center"
        style={{ background: `${iconColor}15`, boxShadow: `0 0 20px ${iconColor}20` }}
      >
        <i className={`ti ${icon} text-2xl`} style={{ color: iconColor }} aria-hidden="true" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-foreground mb-0.5">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {action && (
        <Link
          to={action.to}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:opacity-80 transition-opacity mt-1"
        >
          {action.label}
          <i className="ti ti-arrow-right text-xs" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

function ActiveCourseCard({ course }: { course: DashboardCourse }) {
  const styles = {
    verde:    { border: "border-border",       bg: "transparent",            bar: "#6366f1" },
    amarillo: { border: "border-amber-500/20", bg: "rgba(245,158,11,0.04)", bar: "#f59e0b" },
    rojo:     { border: "border-red-500/20",   bg: "rgba(239,68,68,0.04)",  bar: "#ef4444" },
  }[course.urgency] ?? { border: "border-border", bg: "transparent", bar: "#6366f1" };

  const badgeColor =
    course.urgency === "rojo"    ? { color: "#ef4444", bg: "rgba(239,68,68,0.1)"  } :
    course.urgency === "amarillo"? { color: "#f59e0b", bg: "rgba(245,158,11,0.1)" } : null;

  const label = deadlineLabel(course);

  return (
    <div className={`rounded-lg border ${styles.border} p-3.5 transition-colors`} style={{ background: styles.bg }}>
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <p className="text-[13px] font-medium text-foreground truncate flex-1 min-w-0 leading-snug">
          {course.titulo}
        </p>
        {badgeColor && label && (
          <span
            className="text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ color: badgeColor.color, background: badgeColor.bg }}
          >
            {label}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2.5 mb-3">
        <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${course.progreso}%`, background: styles.bar }}
          />
        </div>
        <span className="text-[11px] text-muted-foreground tabular-nums w-7 text-right flex-shrink-0">
          {course.progreso}%
        </span>
      </div>
      <Tooltip label="Continuar donde lo dejaste" side="right">
        <Link
          to={`/courses/${course.course_id}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:opacity-80 transition-opacity"
        >
          <i className="ti ti-player-play text-[11px]" aria-hidden="true" />
          Continuar
        </Link>
      </Tooltip>
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
        <p className="text-[13px] font-medium text-muted-foreground truncate">{course.titulo}</p>
        {course.fecha_completado && (
          <p className="text-xs text-muted-foreground/60 mt-0.5">
            Completado {fmtDate(course.fecha_completado)}
          </p>
        )}
      </div>
      <Tooltip label="Ver y descargar tu certificado" side="left">
        <div className="flex items-center gap-1.5 flex-shrink-0 cursor-default">
          <i className="ti ti-award text-sm text-emerald-500" aria-hidden="true" />
          <span className="text-xs font-semibold text-emerald-500">Certificado</span>
        </div>
      </Tooltip>
    </div>
  );
}

function DeadlineItem({ course }: { course: DashboardCourse }) {
  const color =
    course.urgency === "rojo"    ? "#ef4444" :
    course.urgency === "amarillo"? "#f59e0b" : "#10b981";
  const label = deadlineLabel(course);

  return (
    <Tooltip label={`Ir al curso — vence ${label.toLowerCase()}`} side="right">
      <Link
        to={`/courses/${course.course_id}`}
        className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent transition-colors group w-full"
      >
        <div className="w-0.5 h-7 rounded-full flex-shrink-0" style={{ background: color }} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-foreground truncate leading-snug">{course.titulo}</p>
          <p className="text-[11px] mt-0.5 flex items-center gap-1" style={{ color }}>
            <i className="ti ti-clock text-[11px]" aria-hidden="true" />
            {label}
          </p>
        </div>
        <i className="ti ti-chevron-right text-[10px] text-muted-foreground/30 flex-shrink-0" aria-hidden="true" />
      </Link>
    </Tooltip>
  );
}

function CertItem({ cert }: { cert: DashboardCertificate }) {
  const expiry = cert.fecha_vencimiento ? new Date(cert.fecha_vencimiento) : null;
  const daysLeft = expiry ? Math.floor((expiry.getTime() - Date.now()) / 86400000) : null;
  const color =
    daysLeft !== null
      ? daysLeft < 30 ? "#ef4444" : daysLeft < 90 ? "#f59e0b" : "#10b981"
      : "#10b981";

  return (
    <Tooltip label="Ver detalles del certificado" side="left">
      <div className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border bg-card/50 hover:bg-accent/30 transition-colors cursor-default w-full">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${color}15`, boxShadow: `0 0 8px ${color}25` }}
        >
          <i className="ti ti-award text-sm" style={{ color }} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-foreground truncate">{cert.titulo}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {cert.fecha_vencimiento
              ? `Válido hasta ${fmtDate(cert.fecha_vencimiento)}`
              : `Emitido ${fmtDate(cert.fecha_emision)}`}
          </p>
        </div>
      </div>
    </Tooltip>
  );
}

function ActivityRow({ activity }: { activity: DashboardActivity }) {
  const def = ACTIVITY_ICONS[activity.accion] ?? {
    icon: "ti-point",
    color: "#64748b",
    bg: "rgba(100,116,139,0.08)",
  };
  const labelFn =
    ACTIVITY_LABELS[activity.accion] ?? (() => activity.accion.replace(/_/g, " ").toLowerCase());
  const label = labelFn(activity.entidad_nombre);

  return (
    <div className="flex items-center gap-3 px-1 py-2 rounded-lg hover:bg-accent/30 transition-colors">
      <Tooltip label={label} side="right">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 cursor-default"
          style={{ background: def.bg }}
        >
          <i className={`ti ${def.icon} text-xs`} style={{ color: def.color }} aria-hidden="true" />
        </div>
      </Tooltip>
      <p className="flex-1 text-sm text-muted-foreground min-w-0 truncate">{label}</p>
      <span className="text-[11px] text-muted-foreground/60 flex-shrink-0 whitespace-nowrap">
        {fmtRelative(activity.timestamp)}
      </span>
    </div>
  );
}
