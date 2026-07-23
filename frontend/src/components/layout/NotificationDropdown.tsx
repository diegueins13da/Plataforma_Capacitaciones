import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNotificationsStore } from "../../store/notificationsStore";

// Notification type → Tabler icon + color
const TIPO_META: Record<string, { icon: string; color: string; bg: string }> = {
  NUEVO_CURSO:        { icon: "ti-books",           color: "#6366f1", bg: "rgba(99,102,241,0.12)"  },
  VENCIMIENTO_7D:     { icon: "ti-clock",            color: "#f59e0b", bg: "rgba(245,158,11,0.12)"  },
  VENCIMIENTO_1D:     { icon: "ti-alert-triangle",   color: "#f97316", bg: "rgba(249,115,22,0.12)"  },
  VENCIDO:            { icon: "ti-circle-x",         color: "#ef4444", bg: "rgba(239,68,68,0.12)"   },
  EXAMEN_APROBADO:    { icon: "ti-trophy",           color: "#10b981", bg: "rgba(16,185,129,0.12)"  },
  EXAMEN_REPROBADO:   { icon: "ti-clipboard-x",      color: "#f59e0b", bg: "rgba(245,158,11,0.12)"  },
};

const DEFAULT_META = { icon: "ti-bell", color: "#64748b", bg: "rgba(100,116,139,0.10)" };

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

  useEffect(() => {
    void fetch();
    const timer = setInterval(() => void fetch(), 60_000);
    return () => clearInterval(timer);
  }, [fetch]);

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
    if (n.referencia_tipo === "course" && n.referencia_id) return `/courses/${n.referencia_id}`;
    return "/notifications";
  }

  async function handleClickNotification(
    id: number,
    tipo: string,
    referencia_id: number | null,
    referencia_tipo: string,
  ) {
    await markRead(id);
    setOpen(false);
    navigate(getNavPath({ tipo, referencia_id, referencia_tipo }));
  }

  const recent = notifications.slice(0, 5);

  return (
    <div ref={dropRef} className="relative">
      {/* Bell button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notificaciones${unreadCount > 0 ? ` (${unreadCount} sin leer)` : ""}`}
        className="relative w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors duration-150"
      >
        <i className="ti ti-bell text-[17px]" aria-hidden="true" />
        {unreadCount > 0 && (
          <span
            className="absolute top-1.5 right-1.5 min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-0.5 ring-2 ring-background"
            aria-hidden="true"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute right-0 mt-2 w-80 border border-border rounded-xl shadow-card-lg z-50 overflow-hidden"
          style={{ background: "hsl(var(--card))" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">Notificaciones</span>
              {unreadCount > 0 && (
                <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-primary/15 text-primary text-[11px] font-semibold">
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void markRead()}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Marcar leídas
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[280px] overflow-y-auto">
            {recent.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                  <i className="ti ti-bell-off text-xl text-muted-foreground" aria-hidden="true" />
                </div>
                <p className="text-sm text-muted-foreground">Sin notificaciones</p>
              </div>
            ) : (
              recent.map((n) => {
                const meta = TIPO_META[n.tipo] ?? DEFAULT_META;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() =>
                      void handleClickNotification(n.id, n.tipo, n.referencia_id, n.referencia_tipo)
                    }
                    className={[
                      "w-full flex items-start gap-3 px-4 py-3 text-left",
                      "hover:bg-accent/50 transition-colors duration-150",
                      !n.leida ? "bg-primary/[0.05]" : "",
                    ].join(" ")}
                  >
                    {/* Icon */}
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: meta.bg }}
                    >
                      <i
                        className={`ti ${meta.icon} text-sm`}
                        style={{ color: meta.color }}
                        aria-hidden="true"
                      />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-foreground leading-snug">
                        {n.titulo}
                      </p>
                      <p className="text-[12px] text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
                        {n.mensaje}
                      </p>
                    </div>

                    {/* Time + unread dot */}
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <span className="text-[11px] text-muted-foreground">{timeAgo(n.created_at)}</span>
                      {!n.leida && (
                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border px-4 py-2.5">
            <button
              type="button"
              onClick={() => { setOpen(false); navigate("/notifications"); }}
              className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors py-0.5"
            >
              Ver todas las notificaciones
              <i className="ti ti-arrow-right text-[11px]" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
