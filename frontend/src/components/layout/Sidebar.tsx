import { NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { useTheme } from "../../context/ThemeContext";

interface NavItem {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
  badge?: boolean;
  dividerBefore?: boolean;
}

// Role-specific navigation maps
const NAV_BY_ROLE: Record<string, NavItem[]> = {
  ADMIN: [
    { to: "/admin", label: "Dashboard", icon: "ti-layout-dashboard", end: true },
    { to: "/admin/users", label: "Usuarios", icon: "ti-users" },
    { to: "/admin/courses", label: "Cursos", icon: "ti-books" },
    { to: "/admin/reports", label: "Reportes", icon: "ti-chart-bar" },
    { to: "/admin/certificates", label: "Certificados", icon: "ti-certificate" },
    { to: "/notifications", label: "Notificaciones", icon: "ti-bell", badge: true },
    { to: "/admin/config", label: "Configuración", icon: "ti-settings", dividerBefore: true },
  ],
  TRAINER: [
    { to: "/dashboard", label: "Inicio", icon: "ti-home", end: true },
    { to: "/admin/courses", label: "Gestión de cursos", icon: "ti-school" },
    { to: "/courses", label: "Catálogo", icon: "ti-books" },
    { to: "/my-certificates", label: "Mis certificados", icon: "ti-award" },
    { to: "/notifications", label: "Notificaciones", icon: "ti-bell", badge: true },
  ],
  USUARIO: [
    { to: "/dashboard", label: "Inicio", icon: "ti-home", end: true },
    { to: "/courses", label: "Catálogo de cursos", icon: "ti-books" },
    { to: "/my-courses", label: "Mis cursos", icon: "ti-school" },
    { to: "/my-certificates", label: "Mis certificados", icon: "ti-award" },
    { to: "/notifications", label: "Notificaciones", icon: "ti-bell", badge: true },
  ],
};

// ---------------------------------------------------------------------------
// Sidebar item
// ---------------------------------------------------------------------------
function SidebarItem({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      title={item.label}
      className={({ isActive }) =>
        [
          "relative w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-150 group",
          isActive
            ? "text-[#818CF8]"
            : "text-white/30 hover:text-white/70 hover:bg-white/5",
        ].join(" ")
      }
      style={({ isActive }) =>
        isActive ? { background: "rgba(79,70,229,0.25)" } : {}
      }
    >
      <i className={`ti ${item.icon} text-[18px]`} aria-hidden="true" />
      {item.badge && (
        <span
          className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
          style={{ background: "#EF4444" }}
        />
      )}
      {/* Tooltip */}
      <span
        className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity z-50"
        style={{
          background: "#1e293b",
          color: "#e2e8f0",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        {item.label}
      </span>
    </NavLink>
  );
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------
export function Sidebar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  const role = user?.role ?? "USUARIO";
  const initials = user?.full_name
    ? user.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : (user?.email?.[0]?.toUpperCase() ?? "U");

  const navItems = NAV_BY_ROLE[role] ?? NAV_BY_ROLE.USUARIO;

  return (
    <aside
      className="shrink-0 flex flex-col items-center py-3 min-h-screen gap-1 overflow-visible"
      style={{
        width: "52px",
        background: "#0a0f1e",
        borderRight: "1px solid #1e293b",
      }}
    >
      {/* Logo */}
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center mb-3 shrink-0"
        style={{ background: "#4F46E5" }}
      >
        <i className="ti ti-certificate text-white text-sm" aria-hidden="true" />
      </div>

      {/* Role-specific nav */}
      {navItems.map((item) => (
        <div key={item.to} className="flex flex-col items-center w-full gap-1">
          {item.dividerBefore && (
            <div
              className="w-5 my-1"
              style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
            />
          )}
          <SidebarItem item={item} />
        </div>
      ))}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Theme toggle */}
      <button
        type="button"
        title={theme === "dark" ? "Modo claro" : "Modo oscuro"}
        onClick={toggleTheme}
        className="relative w-9 h-9 rounded-lg flex items-center justify-center transition-colors group mb-1"
        style={{ color: "rgba(255,255,255,0.35)" }}
      >
        <i
          className={`ti ${theme === "dark" ? "ti-sun" : "ti-moon"} text-[18px]`}
          aria-hidden="true"
        />
        <span
          className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity z-50"
          style={{
            background: "#1e293b",
            color: "#e2e8f0",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          {theme === "dark" ? "Modo claro" : "Modo oscuro"}
        </span>
      </button>

      {/* Logout */}
      <button
        type="button"
        title="Cerrar sesión"
        onClick={() => void handleLogout()}
        className="relative w-9 h-9 rounded-lg flex items-center justify-center transition-colors group mb-1"
        style={{ color: "rgba(255,255,255,0.25)" }}
      >
        <i className="ti ti-logout text-[18px]" aria-hidden="true" />
        <span
          className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity z-50"
          style={{
            background: "#1e293b",
            color: "#e2e8f0",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          Cerrar sesión
        </span>
      </button>

      {/* User avatar */}
      <NavLink
        to="/profile"
        title={user?.full_name ?? user?.email ?? "Perfil"}
        className="relative w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-opacity hover:opacity-80 group"
        style={{ background: "rgba(79,70,229,0.4)", color: "#a5b4fc" }}
      >
        {initials}
        <span
          className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity z-50"
          style={{
            background: "#1e293b",
            color: "#e2e8f0",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          {user?.full_name ?? user?.email ?? "Perfil"}
        </span>
      </NavLink>
    </aside>
  );
}
