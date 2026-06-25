import { useLocation } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
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
  reports: "Auditoría",
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
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="h-14 border-b border-border bg-background flex items-center justify-between px-6 shrink-0">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        {crumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-border">/</span>}
            <span className={i === crumbs.length - 1 ? "text-foreground font-medium" : ""}>
              {crumb}
            </span>
          </span>
        ))}
      </nav>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          onClick={toggleTheme}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <i
            className={`ti ${theme === "dark" ? "ti-sun" : "ti-moon"} text-base`}
            aria-hidden="true"
          />
        </button>
        <NotificationDropdown />
      </div>
    </header>
  );
}
