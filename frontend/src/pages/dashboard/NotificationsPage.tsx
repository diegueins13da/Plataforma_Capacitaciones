/**
 * P09 — Full notifications page.
 * Shows all notifications with type filter and mark-read actions.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useNotificationsStore, type AppNotification } from "../../store/notificationsStore";

const TIPO_ICONS: Record<string, string> = {
  NUEVO_CURSO: "📚",
  VENCIMIENTO_7D: "⏰",
  VENCIMIENTO_1D: "🚨",
  VENCIDO: "❌",
  EXAMEN_APROBADO: "🏆",
  EXAMEN_REPROBADO: "📋",
};

const TIPO_LABELS: Record<string, string> = {
  NUEVO_CURSO: "Curso asignado",
  VENCIMIENTO_7D: "Vencimiento",
  VENCIMIENTO_1D: "Vencimiento",
  VENCIDO: "Vencido",
  EXAMEN_APROBADO: "Examen aprobado",
  EXAMEN_REPROBADO: "Examen reprobado",
};

const FILTER_OPTIONS = [
  { value: "", label: "Todas" },
  { value: "NUEVO_CURSO", label: "Cursos" },
  { value: "VENCIMIENTO_7D,VENCIMIENTO_1D,VENCIDO", label: "Vencimientos" },
  { value: "EXAMEN_APROBADO,EXAMEN_REPROBADO", label: "Exámenes" },
];

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "hace un momento";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  if (diff < 86400 * 7) return `hace ${Math.floor(diff / 86400)} días`;
  return new Date(iso).toLocaleDateString("es-EC", { day: "numeric", month: "short" });
}

export default function NotificationsPage() {
  const { notifications, unreadCount, loading, fetch, markRead } = useNotificationsStore();
  const [filter, setFilter] = useState("");
  const navigate = useNavigate();

  useEffect(() => { void fetch(); }, [fetch]);

  function matchesFilter(n: AppNotification): boolean {
    if (!filter) return true;
    return filter.split(",").includes(n.tipo);
  }

  const filtered = notifications.filter(matchesFilter);

  function getNavPath(n: AppNotification): string {
    if (n.referencia_tipo === "course" && n.referencia_id) return `/courses/${n.referencia_id}`;
    if (n.referencia_tipo === "enrollment") return `/my-courses`;
    return "#";
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Notificaciones</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-muted-foreground mt-0.5">{unreadCount} sin leer</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => void markRead()}
            className="text-sm text-indigo-400 hover:underline"
          >
            Marcar todas como leídas
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setFilter(opt.value)}
            className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
              filter === opt.value
                ? "bg-indigo-600 text-white border-indigo-600"
                : "border-border text-muted-foreground hover:bg-background"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {loading && filtered.length === 0 ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">
            No hay notificaciones en esta categoría.
          </p>
        ) : (
          filtered.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={async () => {
                await markRead(n.id);
                const path = getNavPath(n);
                if (path !== "#") navigate(path);
              }}
              className={`w-full flex items-start gap-3 px-4 py-4 border-b border-border last:border-0 hover:bg-background text-left transition-colors ${
                !n.leida ? "bg-indigo-500/10" : ""
              }`}
            >
              <span className="text-xl shrink-0">{TIPO_ICONS[n.tipo] ?? "📌"}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">
                    {n.titulo}
                  </p>
                  <span className="text-[10px] text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded-full">
                    {TIPO_LABELS[n.tipo] ?? n.tipo}
                  </span>
                  {!n.leida && (
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{n.mensaje}</p>
                <p className="text-xs text-muted-foreground mt-1">{timeAgo(n.created_at)}</p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
