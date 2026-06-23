/**
 * P40 — Notification dropdown in the header.
 * Shows badge, last 5 notifications, and "mark all read" action.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useNotificationsStore } from "../../store/notificationsStore";

const TIPO_ICONS: Record<string, string> = {
  NUEVO_CURSO: "📚",
  VENCIMIENTO_7D: "⏰",
  VENCIMIENTO_1D: "🚨",
  VENCIDO: "❌",
  EXAMEN_APROBADO: "🏆",
  EXAMEN_REPROBADO: "📋",
};

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "ahora";
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  return `${Math.floor(diff / 86400)} d`;
}

export function NotificationDropdown() {
  const { notifications, unreadCount, fetch, markRead } = useNotificationsStore();
  const [open, setOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Fetch on mount and poll every 60s
  useEffect(() => {
    void fetch();
    const timer = setInterval(() => void fetch(), 60_000);
    return () => clearInterval(timer);
  }, [fetch]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function getNavPath(n: { tipo: string; referencia_id: number | null; referencia_tipo: string }): string {
    if (n.referencia_tipo === "course" && n.referencia_id) {
      return `/courses/${n.referencia_id}`;
    }
    if (n.referencia_tipo === "enrollment" && n.referencia_id) {
      return `/courses`;
    }
    return "/notifications";
  }

  async function handleClickNotification(id: number, tipo: string, referencia_id: number | null, referencia_tipo: string) {
    await markRead(id);
    setOpen(false);
    navigate(getNavPath({ tipo, referencia_id, referencia_tipo }));
  }

  const recent = notifications.slice(0, 5);

  return (
    <div ref={dropRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg hover:bg-muted/40 transition-colors"
        aria-label="Notificaciones"
      >
        <span className="text-xl">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-card border border-border rounded-2xl shadow-lg z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-semibold text-foreground">
              Notificaciones
              {unreadCount > 0 && (
                <span className="ml-1.5 text-xs text-indigo-400 font-normal">{unreadCount} nueva{unreadCount !== 1 ? "s" : ""}</span>
              )}
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void markRead()}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Marcar todas como leídas
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-72 overflow-y-auto">
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin notificaciones</p>
            ) : (
              recent.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => void handleClickNotification(n.id, n.tipo, n.referencia_id, n.referencia_tipo)}
                  className={`w-full flex items-start gap-3 px-4 py-3 hover:bg-background text-left transition-colors ${
                    !n.leida ? "bg-indigo-500/10" : ""
                  }`}
                >
                  <span className="text-lg shrink-0 mt-0.5">{TIPO_ICONS[n.tipo] ?? "📌"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground">
                      {n.titulo}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.mensaje}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(n.created_at)}</span>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border px-4 py-2">
            <button
              type="button"
              onClick={() => { setOpen(false); navigate("/notifications"); }}
              className="w-full text-xs text-indigo-600 hover:underline text-center py-1"
            >
              Ver todas las notificaciones →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
