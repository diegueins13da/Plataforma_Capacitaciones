import { useLocation } from "react-router-dom";
import { NotificationDropdown } from "./NotificationDropdown";

const BREADCRUMB_LABELS: Record<string, string> = {
  dashboard: "Inicio",
  courses: "Cursos",
  "my-courses": "Mis cursos",
  profile: "Mi perfil",
  notifications: "Notificaciones",
  admin: "Administración",
  users: "Usuarios",
  reports: "Auditoría",
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
    if (/^\d+$/.test(part)) continue; // skip numeric IDs
    const label = BREADCRUMB_LABELS[part] ?? part;
    crumbs.push(label);
  }
  return crumbs;
}

export function Header() {
  const crumbs = useBreadcrumbs();

  return (
    <header className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-6 shrink-0">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500">
        {crumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-gray-300">/</span>}
            <span className={i === crumbs.length - 1 ? "text-gray-900 font-medium" : ""}>
              {crumb}
            </span>
          </span>
        ))}
      </nav>

      {/* Right actions */}
      <div className="flex items-center gap-3">
        <NotificationDropdown />
      </div>
    </header>
  );
}
