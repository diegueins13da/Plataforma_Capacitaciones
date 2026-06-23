import { NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { useTheme } from "../../context/ThemeContext";
import { useTrainerModeStore } from "../../store/trainerModeStore";

interface NavItem {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
  badge?: boolean;
  dividerBefore?: boolean;
}

const NAV_ADMIN: NavItem[] = [
  { to: "/admin", label: "Dashboard", icon: "ti-layout-dashboard", end: true },
  { to: "/admin/courses", label: "Cursos", icon: "ti-books" },
  { to: "/admin/reports", label: "Reportes", icon: "ti-chart-bar" },
  { to: "/admin/certificates", label: "Certificados", icon: "ti-certificate" },
  { to: "/admin/config", label: "Configuración", icon: "ti-settings", dividerBefore: true },
];

const NAV_TRAINER_INSTRUCTOR: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: "ti-layout-dashboard", end: true },
  { to: "/admin/courses", label: "Mis cursos creados", icon: "ti-school" },
  { to: "/notifications", label: "Notificaciones", icon: "ti-bell", badge: true },
];

const NAV_TRAINER_ALUMNO: NavItem[] = [
  { to: "/dashboard", label: "Inicio", icon: "ti-home", end: true },
  { to: "/courses", label: "Mis cursos", icon: "ti-books" },
  { to: "/my-certificates", label: "Mis certificados", icon: "ti-award" },
  { to: "/notifications", label: "Notificaciones", icon: "ti-bell", badge: true },
];

const NAV_USUARIO: NavItem[] = [
  { to: "/dashboard", label: "Inicio", icon: "ti-home", end: true },
  { to: "/courses", label: "Mis cursos", icon: "ti-books" },
  { to: "/my-certificates", label: "Mis certificados", icon: "ti-award" },
  { to: "/notifications", label: "Notificaciones", icon: "ti-bell", badge: true },
];

// ---------------------------------------------------------------------------
// Sidebar item
// ---------------------------------------------------------------------------
function SidebarItem({ item, accentColor }: { item: NavItem; accentColor: string }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      title={item.label}
      className={({ isActive }) =>
        [
          "relative w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-150 group",
          isActive ? "" : "text-white/30 hover:text-white/70 hover:bg-white/5",
        ].join(" ")
      }
      style={({ isActive }) =>
        isActive
          ? { background: `${accentColor}28`, color: accentColor }
          : {}
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
        style={{ background: "#1e293b", color: "#e2e8f0", border: "1px solid rgba(255,255,255,0.1)" }}
      >
        {item.label}
      </span>
    </NavLink>
  );
}

// ---------------------------------------------------------------------------
// Context pill for TRAINER
// ---------------------------------------------------------------------------
function TrainerContextPill() {
  const { mode, toggle } = useTrainerModeStore();
  const navigate = useNavigate();
  const isInstructor = mode === "INSTRUCTOR";

  function handleSwitch() {
    toggle();
    navigate("/dashboard");
  }

  return (
    <button
      onClick={handleSwitch}
      title={`Cambiar a modo ${isInstructor ? "Alumno" : "Instructor"}`}
      style={{
        background: isInstructor ? "rgba(79,70,229,0.28)" : "rgba(16,185,129,0.18)",
        border: `1px solid ${isInstructor ? "rgba(129,140,248,0.35)" : "rgba(52,211,153,0.35)"}`,
        color: isInstructor ? "#a5b4fc" : "#6ee7b7",
        borderRadius: 20,
        fontSize: 9,
        fontWeight: 600,
        padding: "3px 7px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 3,
        letterSpacing: "0.3px",
        whiteSpace: "nowrap",
        transition: "all 0.2s ease",
      }}
    >
      <i
        className={`ti ${isInstructor ? "ti-school" : "ti-user"}`}
        style={{ fontSize: 9 }}
        aria-hidden="true"
      />
      {isInstructor ? "Instructor" : "Alumno"}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------
export function Sidebar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const trainerMode = useTrainerModeStore((s) => s.mode);

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  const role = user?.role ?? "USUARIO";

  const initials = user?.full_name
    ? user.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : (user?.email?.[0]?.toUpperCase() ?? "U");

  let navItems: NavItem[];
  let accentColor: string;
  let avatarBg: string;
  let avatarColor: string;

  if (role === "ADMIN") {
    navItems = NAV_ADMIN;
    accentColor = "#818CF8";
    avatarBg = "rgba(79,70,229,0.4)";
    avatarColor = "#a5b4fc";
  } else if (role === "TRAINER") {
    navItems = trainerMode === "INSTRUCTOR" ? NAV_TRAINER_INSTRUCTOR : NAV_TRAINER_ALUMNO;
    accentColor = trainerMode === "INSTRUCTOR" ? "#818CF8" : "#34D399";
    avatarBg = trainerMode === "INSTRUCTOR" ? "rgba(79,70,229,0.4)" : "rgba(16,185,129,0.25)";
    avatarColor = trainerMode === "INSTRUCTOR" ? "#a5b4fc" : "#6ee7b7";
  } else {
    navItems = NAV_USUARIO;
    accentColor = "#818CF8";
    avatarBg = "rgba(79,70,229,0.4)";
    avatarColor = "#a5b4fc";
  }

  return (
    <aside
      className="shrink-0 flex flex-col items-center py-3 min-h-screen gap-1 overflow-visible"
      style={{ width: "52px", background: "#0a0f1e", borderRight: "1px solid #1e293b" }}
    >
      {/* Logo */}
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center mb-2 shrink-0"
        style={{ background: "#4F46E5" }}
      >
        <i className="ti ti-certificate text-white text-sm" aria-hidden="true" />
      </div>

      {/* Context pill — only for TRAINER */}
      {role === "TRAINER" && (
        <>
          <TrainerContextPill />
          <div className="w-5 my-1" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }} />
        </>
      )}

      {/* Role-specific nav */}
      {navItems.map((item) => (
        <div key={item.to} className="flex flex-col items-center w-full gap-1">
          {item.dividerBefore && (
            <div className="w-5 my-1" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }} />
          )}
          <SidebarItem item={item} accentColor={accentColor} />
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
        <i className={`ti ${theme === "dark" ? "ti-sun" : "ti-moon"} text-[18px]`} aria-hidden="true" />
        <span
          className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity z-50"
          style={{ background: "#1e293b", color: "#e2e8f0", border: "1px solid rgba(255,255,255,0.1)" }}
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
          style={{ background: "#1e293b", color: "#e2e8f0", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          Cerrar sesión
        </span>
      </button>

      {/* User avatar */}
      <NavLink
        to="/profile"
        title={user?.full_name ?? user?.email ?? "Perfil"}
        className="relative w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-opacity hover:opacity-80 group"
        style={{ background: avatarBg, color: avatarColor, transition: "background 0.2s ease, color 0.2s ease" }}
      >
        {initials}
        <span
          className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity z-50"
          style={{ background: "#1e293b", color: "#e2e8f0", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          {user?.full_name ?? user?.email ?? "Perfil"}
        </span>
      </NavLink>
    </aside>
  );
}
