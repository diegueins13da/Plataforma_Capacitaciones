import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNotificationsStore, type AppNotification } from "../../store/notificationsStore";
import { useAuthStore } from "../../store/authStore";
import { useTrainerModeStore } from "../../store/trainerModeStore";

// ── Icon / color config per tipo ─────────────────────────────────────────────
interface TipoConfig {
  icon: string;
  iconColor: string;
  bg: string;
  badge: string;
  label: string;
  actionLabel?: string;
}

const TIPO_CONFIG: Record<string, TipoConfig> = {
  // ── Alumno-facing ───────────────────────────────────────────────────────────
  NUEVO_CURSO: {
    icon: "ti-book-upload",
    iconColor: "text-indigo-400",
    bg: "bg-indigo-500/15",
    badge: "bg-indigo-500/15 text-indigo-400",
    label: "Curso asignado",
    actionLabel: "Ir al curso",
  },
  VENCIMIENTO_7D: {
    icon: "ti-clock",
    iconColor: "text-amber-400",
    bg: "bg-amber-500/15",
    badge: "bg-amber-500/15 text-amber-400",
    label: "Vence en 7 días",
    actionLabel: "Ver curso",
  },
  VENCIMIENTO_1D: {
    icon: "ti-clock-exclamation",
    iconColor: "text-orange-400",
    bg: "bg-orange-500/15",
    badge: "bg-orange-500/15 text-orange-400",
    label: "Vence mañana",
    actionLabel: "Ver curso",
  },
  VENCIDO: {
    icon: "ti-calendar-x",
    iconColor: "text-red-400",
    bg: "bg-red-500/15",
    badge: "bg-red-500/15 text-red-400",
    label: "Vencido",
    actionLabel: "Ver curso",
  },
  EXAMEN_APROBADO: {
    icon: "ti-trophy",
    iconColor: "text-emerald-400",
    bg: "bg-emerald-500/15",
    badge: "bg-emerald-500/15 text-emerald-400",
    label: "Examen aprobado",
    actionLabel: "Ver certificado",
  },
  EXAMEN_REPROBADO: {
    icon: "ti-clipboard-x",
    iconColor: "text-yellow-400",
    bg: "bg-yellow-500/15",
    badge: "bg-yellow-500/15 text-yellow-400",
    label: "Examen no aprobado",
    actionLabel: "Reintentar",
  },
  // ── Instructor-facing ───────────────────────────────────────────────────────
  ALUMNO_INSCRITO: {
    icon: "ti-user-plus",
    iconColor: "text-sky-400",
    bg: "bg-sky-500/15",
    badge: "bg-sky-500/15 text-sky-400",
    label: "Nuevo inscrito",
    actionLabel: "Ver alumnos",
  },
  ALUMNO_COMPLETO: {
    icon: "ti-rosette-discount-check",
    iconColor: "text-emerald-400",
    bg: "bg-emerald-500/15",
    badge: "bg-emerald-500/15 text-emerald-400",
    label: "Curso completado",
    actionLabel: "Ver progreso",
  },
  ALUMNO_APROBADO: {
    icon: "ti-trophy",
    iconColor: "text-violet-400",
    bg: "bg-violet-500/15",
    badge: "bg-violet-500/15 text-violet-400",
    label: "Examen aprobado",
    actionLabel: "Ver resultados",
  },
  ALUMNO_REPROBADO: {
    icon: "ti-alert-triangle",
    iconColor: "text-rose-400",
    bg: "bg-rose-500/15",
    badge: "bg-rose-500/15 text-rose-400",
    label: "Necesita apoyo",
    actionLabel: "Ver alumnos",
  },
};

const FALLBACK_CONFIG: TipoConfig = {
  icon: "ti-bell",
  iconColor: "text-muted-foreground",
  bg: "bg-muted/20",
  badge: "bg-muted/20 text-muted-foreground",
  label: "Sistema",
};

// ── Time helpers ─────────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "Hace un momento";
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`;
  if (diff < 86400 * 7) return `Hace ${Math.floor(diff / 86400)} días`;
  return new Date(iso).toLocaleDateString("es-EC", { day: "numeric", month: "short", year: "numeric" });
}

type Group = "Hoy" | "Ayer" | "Esta semana" | "Anteriores";

function getGroup(iso: string): Group {
  const now = new Date();
  const date = new Date(iso);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  const weekStart = new Date(todayStart.getTime() - 6 * 86400000);
  if (date >= todayStart) return "Hoy";
  if (date >= yesterdayStart) return "Ayer";
  if (date >= weekStart) return "Esta semana";
  return "Anteriores";
}

const GROUP_ORDER: Group[] = ["Hoy", "Ayer", "Esta semana", "Anteriores"];

// ── Filter options ────────────────────────────────────────────────────────────
const FILTERS = [
  { value: "",                                                                    label: "Todas",        icon: "ti-bell" },
  { value: "NUEVO_CURSO",                                                         label: "Mis cursos",   icon: "ti-book-upload" },
  { value: "VENCIMIENTO_7D,VENCIMIENTO_1D,VENCIDO",                              label: "Vencimientos", icon: "ti-clock" },
  { value: "EXAMEN_APROBADO,EXAMEN_REPROBADO",                                   label: "Mis exámenes", icon: "ti-clipboard-check" },
  { value: "ALUMNO_INSCRITO,ALUMNO_COMPLETO,ALUMNO_APROBADO,ALUMNO_REPROBADO",   label: "Alumnos",      icon: "ti-users" },
];

// ── Nav helper ────────────────────────────────────────────────────────────────
const INSTRUCTOR_TIPOS = new Set(["ALUMNO_INSCRITO", "ALUMNO_COMPLETO", "ALUMNO_APROBADO", "ALUMNO_REPROBADO"]);

function getNavPath(n: AppNotification): string | null {
  // Instructor notifications: mark-read on card click is enough — no outbound navigation
  if (INSTRUCTOR_TIPOS.has(n.tipo)) return null;
  if (n.referencia_tipo === "course" && n.referencia_id) return `/courses/${n.referencia_id}`;
  if (n.referencia_tipo === "enrollment") return "/courses";
  return null;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function NotificationsPage() {
  const { notifications, unreadCount, loading, fetch, markRead } = useNotificationsStore();
  const user = useAuthStore((s) => s.user);
  const trainerMode = useTrainerModeStore((s) => s.mode);
  const isInstructor = user?.role === "TRAINER" && trainerMode === "INSTRUCTOR";
  const [filter, setFilter] = useState("");
  const navigate = useNavigate();

  useEffect(() => { void fetch(); }, [fetch]);

  const filtered = useMemo(() => {
    if (!filter) return notifications;
    const types = new Set(filter.split(","));
    return notifications.filter((n) => types.has(n.tipo));
  }, [notifications, filter]);

  const grouped = useMemo(() => {
    const map = new Map<Group, AppNotification[]>();
    GROUP_ORDER.forEach((g) => map.set(g, []));
    filtered.forEach((n) => {
      const g = getGroup(n.created_at);
      map.get(g)!.push(n);
    });
    return map;
  }, [filtered]);

  const hasAny = filtered.length > 0;

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Notificaciones</h1>
          {unreadCount > 0 ? (
            <p className="text-sm text-muted-foreground mt-0.5">
              <span className="text-indigo-400 font-medium">{unreadCount}</span> sin leer
            </p>
          ) : (
            <p className="text-sm text-muted-foreground mt-0.5">Estás al día</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => void markRead()}
            className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 hover:border-indigo-500/50 px-3 py-1.5 rounded-lg transition-colors">
            <i className="ti ti-checks text-sm" aria-hidden="true" />
            Marcar todas como leídas
          </button>
        )}
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setFilter(opt.value)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border transition-colors ${
              filter === opt.value
                ? "bg-indigo-600 text-white border-indigo-600"
                : "border-border text-muted-foreground hover:bg-background hover:text-foreground"
            }`}>
            <i className={`ti ${opt.icon} text-sm`} aria-hidden="true" />
            {opt.label}
          </button>
        ))}
      </div>

      {/* Notification list */}
      {loading && !hasAny ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        </div>
      ) : !hasAny ? (
        <div className="text-center py-16 border border-dashed border-border rounded-2xl">
          <div className="w-14 h-14 rounded-2xl bg-muted/20 flex items-center justify-center mx-auto mb-4">
            <i className="ti ti-bell-off text-3xl text-muted-foreground/40" aria-hidden="true" />
          </div>
          <p className="text-muted-foreground text-sm font-medium">Sin notificaciones</p>
          <p className="text-muted-foreground/60 text-xs mt-1">
            Aquí aparecerán tus alertas de cursos y exámenes
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {GROUP_ORDER.map((group) => {
            const items = grouped.get(group) ?? [];
            if (items.length === 0) return null;
            return (
              <div key={group}>
                {/* Group label */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {group}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">{items.length}</span>
                </div>

                {/* Cards */}
                <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
                  {items.map((n) => {
                    const cfg = TIPO_CONFIG[n.tipo] ?? FALLBACK_CONFIG;
                    const path = getNavPath(n);
                    return (
                      <div
                        key={n.id}
                        role={!n.leida ? "button" : undefined}
                        tabIndex={!n.leida ? 0 : undefined}
                        onClick={!n.leida ? () => void markRead(n.id) : undefined}
                        onKeyDown={!n.leida ? (e) => { if (e.key === "Enter" || e.key === " ") void markRead(n.id); } : undefined}
                        className={`flex items-start gap-4 px-4 py-4 transition-colors hover:bg-background ${
                          !n.leida ? "bg-indigo-500/5 cursor-pointer" : ""
                        }`}>

                        {/* Icon */}
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${cfg.bg}`}>
                          <i className={`ti ${cfg.icon} text-lg ${cfg.iconColor}`} aria-hidden="true" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate">{n.titulo}</p>
                              {!n.leida && (
                                <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cfg.badge}`}>
                                {cfg.label}
                              </span>
                              {/* Mark individual as read */}
                              {!n.leida && (
                                <button
                                  type="button"
                                  title="Marcar como leída"
                                  onClick={(e) => { e.stopPropagation(); void markRead(n.id); }}
                                  className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors">
                                  <i className="ti ti-check text-xs" aria-hidden="true" />
                                </button>
                              )}
                            </div>
                          </div>

                          <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{n.mensaje}</p>

                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-muted-foreground/60">{timeAgo(n.created_at)}</span>
                            {!isInstructor && path && cfg.actionLabel && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); void markRead(n.id); navigate(path); }}
                                className={`flex items-center gap-1 text-xs font-medium transition-colors ${cfg.iconColor} hover:opacity-80`}>
                                {cfg.actionLabel}
                                <i className="ti ti-arrow-right text-xs" aria-hidden="true" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
