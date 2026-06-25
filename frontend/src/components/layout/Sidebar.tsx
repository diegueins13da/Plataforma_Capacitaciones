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
  { to: "/admin/courses", label: "Mis cursos", icon: "ti-school" },
  { to: "/instructor/grades", label: "Calificaciones", icon: "ti-chart-bar" },
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
// Sidebar item — icon + short label
// ---------------------------------------------------------------------------
function SidebarItem({ item, accentColor }: { item: NavItem; accentColor: string }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      title={item.label}
      className={({ isActive }) =>
        [
          "relative w-full flex flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 px-1 transition-all duration-150 group",
          isActive ? "" : "text-white/30 hover:text-white/70 hover:bg-white/5",
        ].join(" ")
      }
      style={({ isActive }) =>
        isActive
          ? { background: `${accentColor}28`, color: accentColor }
          : {}
      }
    >
      <div className="relative">
        <i className={`ti ${item.icon} text-[17px]`} aria-hidden="true" />
        {item.badge && (
          <span
            className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full"
            style={{ background: "#EF4444" }}
          />
        )}
      </div>
      <span className="text-[9px] font-medium leading-none tracking-wide truncate w-full text-center">
        {item.label}
      </span>
    </NavLink>
  );
}

// ---------------------------------------------------------------------------
// Context toggle for TRAINER — visually clear mode switcher
// ---------------------------------------------------------------------------
function TrainerContextToggle() {
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
      aria-label={`Cambiar a modo ${isInstructor ? "Alumno" : "Instructor"}`}
      title={`Vista actual: ${isInstructor ? "Instructor" : "Alumno"} — clic para cambiar`}
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 10,
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
        padding: "6px 4px 4px",
        width: "100%",
        transition: "all 0.2s ease",
      }}
      className="hover:bg-white/8 group"
    >
      {/* Active mode badge */}
      <span
        style={{
          background: isInstructor ? "rgba(79,70,229,0.35)" : "rgba(16,185,129,0.25)",
          color: isInstructor ? "#a5b4fc" : "#6ee7b7",
          borderRadius: 6,
          fontSize: 8,
          fontWeight: 700,
          padding: "2px 5px",
          letterSpacing: "0.4px",
          lineHeight: 1.4,
        }}
      >
        {isInstructor ? "INST." : "ALU."}
      </span>
      {/* Arrows indicating it's switchable */}
      <i
        className="ti ti-arrows-exchange text-white/30 group-hover:text-white/60 transition-colors"
        style={{ fontSize: 11 }}
        aria-hidden="true"
      />
      <span style={{ fontSize: 8, color: "rgba(255,255,255,0.28)", lineHeight: 1 }}>
        cambiar
      </span>
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
      style={{ width: "68px", background: "#0a0f1e", borderRight: "1px solid #1e293b", padding: "12px 6px" }}
    >
      {/* Logo */}
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center mb-2 shrink-0"
        style={{ background: "#4F46E5" }}
      >
        <i className="ti ti-certificate text-white text-sm" aria-hidden="true" />
      </div>

      {/* Context toggle — only for TRAINER */}
      {role === "TRAINER" && (
        <>
          <TrainerContextToggle />
          <div className="w-full my-1" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }} />
        </>
      )}

      {/* Role-specific nav */}
      {navItems.map((item) => (
        <div key={item.to} className="flex flex-col items-center w-full gap-0.5">
          {item.dividerBefore && (
            <div className="w-full my-1" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }} />
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
        className="w-full flex flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 px-1 transition-colors hover:bg-white/5 mb-0.5"
        style={{ color: "rgba(255,255,255,0.35)" }}
      >
        <i className={`ti ${theme === "dark" ? "ti-sun" : "ti-moon"} text-[17px]`} aria-hidden="true" />
        <span className="text-[9px] font-medium leading-none">
          {theme === "dark" ? "Claro" : "Oscuro"}
        </span>
      </button>

      {/* Logout */}
      <button
        type="button"
        title="Cerrar sesión"
        onClick={() => void handleLogout()}
        className="w-full flex flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 px-1 transition-colors hover:bg-white/5 mb-1"
        style={{ color: "rgba(255,255,255,0.25)" }}
      >
        <i className="ti ti-logout text-[17px]" aria-hidden="true" />
        <span className="text-[9px] font-medium leading-none">Salir</span>
      </button>

      {/* User avatar */}
      <NavLink
        to="/profile"
        title={user?.full_name ?? user?.email ?? "Perfil"}
        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-opacity hover:opacity-80"
        style={{ background: avatarBg, color: avatarColor, transition: "background 0.2s ease, color 0.2s ease" }}
      >
        {initials}
      </NavLink>
    </aside>
  );
}
