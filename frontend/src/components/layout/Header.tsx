import { useLocation } from "react-router-dom";
import { NotificationDropdown } from "./NotificationDropdown";

const BREADCRUMB_LABELS: Record<string, string> = {
  dashboard: "Inicio",
  courses: "Cursos",
  modules: "Módulo",
  instructor: "Instructor",
  grades: "Calificaciones",
  "my-courses": "Mis cursos",
  "my-certificates": "Mis certificados",
  profile: "Mi perfil",
  notifications: "Notificaciones",
  admin: "Administración",
  users: "Usuarios",
  reports: "Reportes",
  certificates: "Certificados",
  config: "Configuración",
  groups: "Grupos",
  import: "Importación",
  "ai-generator": "Generador IA",
  new: "Nuevo",
  edit: "Editar",
  exam: "Evaluación",
  "in-progress": "En progreso",
  result: "Resultado",
  completed: "Completado",
};

function useBreadcrumbs(): string[] {
  const { pathname } = useLocation();
  const parts = pathname.split("/").filter(Boolean);
  const crumbs: string[] = [];
  for (const part of parts) {
    if (/^\d+$/.test(part)) continue;
    crumbs.push(BREADCRUMB_LABELS[part] ?? part);
  }
  return crumbs;
}

export function Header() {
  const crumbs = useBreadcrumbs();

  return (
    <header className="h-14 border-b border-border bg-background/80 backdrop-blur-sm flex items-center justify-between px-6 shrink-0 sticky top-0 z-20">
      {/* Breadcrumbs */}
      <nav aria-label="Navegación" className="flex items-center gap-1.5 min-w-0">
        {crumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1.5 min-w-0">
            {i > 0 && (
              <i
                className="ti ti-chevron-right text-[10px] flex-shrink-0"
                style={{ color: "hsl(var(--border))" }}
                aria-hidden="true"
              />
            )}
            <span
              className={[
                "text-sm truncate",
                i === crumbs.length - 1
                  ? "text-foreground font-medium"
                  : "text-muted-foreground",
              ].join(" ")}
            >
              {crumb}
            </span>
          </span>
        ))}
      </nav>

      {/* Right actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <NotificationDropdown />
      </div>
    </header>
  );
}
