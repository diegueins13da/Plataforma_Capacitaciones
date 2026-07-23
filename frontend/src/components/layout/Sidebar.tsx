import { useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { useTheme } from "../../context/ThemeContext";
import { useTrainerModeStore } from "../../store/trainerModeStore";
import { useBrandingStore } from "../../store/brandingStore";

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
  { to: "/admin/users", label: "Usuarios", icon: "ti-user-cog" },
  { to: "/admin/reports", label: "Reportes", icon: "ti-report-analytics" },
  { to: "/admin/certificates", label: "Certificados", icon: "ti-award" },
  { to: "/admin/config", label: "Configuración", icon: "ti-adjustments-horizontal", dividerBefore: true },
];

const NAV_TRAINER_INSTRUCTOR: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: "ti-layout-dashboard", end: true },
  { to: "/admin/courses", label: "Mis cursos", icon: "ti-chalkboard" },
  { to: "/instructor/grades", label: "Calificaciones", icon: "ti-chart-infographic" },
  { to: "/notifications", label: "Notificaciones", icon: "ti-bell-ringing", badge: true },
];

const NAV_TRAINER_ALUMNO: NavItem[] = [
  { to: "/dashboard", label: "Inicio", icon: "ti-home-2", end: true },
  { to: "/courses", label: "Mis cursos", icon: "ti-books" },
  { to: "/my-certificates", label: "Mis certificados", icon: "ti-award" },
  { to: "/notifications", label: "Notificaciones", icon: "ti-bell-ringing", badge: true },
];

const NAV_USUARIO: NavItem[] = [
  { to: "/dashboard", label: "Inicio", icon: "ti-home-2", end: true },
  { to: "/courses", label: "Mis cursos", icon: "ti-books" },
  { to: "/my-certificates", label: "Mis certificados", icon: "ti-award" },
  { to: "/notifications", label: "Notificaciones", icon: "ti-bell-ringing", badge: true },
];

// Label: fades + slides in on sidebar hover
const LABEL_CLS =
  "text-[13px] font-medium whitespace-nowrap overflow-hidden " +
  "opacity-0 max-w-0 " +
  "group-hover:opacity-100 group-hover:max-w-[160px] " +
  "transition-[opacity,max-width] duration-[220ms] ease-in-out";

// ─────────────────────────────────────────────────────────────────
// Sidebar nav item
// ─────────────────────────────────────────────────────────────────
function SidebarItem({ item, accentColor }: { item: NavItem; accentColor: string }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      title={item.label}
      className={({ isActive }) =>
        [
          "relative w-full flex items-center rounded-lg",
          "py-[7px] px-[19px] group-hover:px-3",
          "gap-0 group-hover:gap-[10px]",
          "transition-all duration-[220ms] ease-in-out",
          isActive
            ? ""
            : "text-white/30 hover:text-white/70 hover:bg-white/[0.05]",
        ].join(" ")
      }
      style={({ isActive }) =>
        isActive
          ? {
              background: `${accentColor}22`,
              color: accentColor,
              boxShadow: `inset 2px 0 0 ${accentColor}`,
            }
          : {}
      }
    >
      {/* Icon */}
      <div className="relative flex-shrink-0">
        <i className={`ti ${item.icon} text-[17px]`} aria-hidden="true" />
        {item.badge && (
          <span
            className="absolute -top-0.5 -right-0.5 w-[7px] h-[7px] rounded-full ring-2"
            style={{ background: "#EF4444", ringColor: "#0a0f1e" }}
          />
        )}
      </div>
      <span className={LABEL_CLS}>{item.label}</span>
    </NavLink>
  );
}

// ─────────────────────────────────────────────────────────────────
// Trainer context toggle
// ─────────────────────────────────────────────────────────────────
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
      type="button"
      onClick={handleSwitch}
      aria-label={`Cambiar a modo ${isInstructor ? "Alumno" : "Instructor"}`}
      title={`Vista actual: ${isInstructor ? "Instructor" : "Alumno"} — clic para cambiar`}
      className="w-full flex items-center rounded-lg py-[7px] px-[19px] group-hover:px-3 gap-0 group-hover:gap-[10px] transition-all duration-[220ms] ease-in-out hover:bg-white/[0.05]"
      style={{ color: "rgba(255,255,255,0.35)" }}
    >
      {/* Mode badge icon */}
      <div className="relative flex-shrink-0 flex items-center justify-center">
        <i
          className={`ti ${isInstructor ? "ti-presentation" : "ti-user-star"} text-[16px]`}
          style={{ color: isInstructor ? "#a5b4fc" : "#6ee7b7" }}
          aria-hidden="true"
        />
      </div>

      {/* Expanded label */}
      <div className={`${LABEL_CLS} flex items-center justify-between flex-1`}>
        <span style={{ color: isInstructor ? "#a5b4fc" : "#6ee7b7" }}>
          {isInstructor ? "Instructor" : "Alumno"}
        </span>
        <i className="ti ti-arrows-exchange text-white/25 text-[11px]" aria-hidden="true" />
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────
// Bottom icon button (theme / logout)
// ─────────────────────────────────────────────────────────────────
function SidebarButton({
  icon,
  label,
  onClick,
}: {
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={[
        "w-full flex items-center rounded-lg",
        "py-[7px] px-[19px] group-hover:px-3",
        "gap-0 group-hover:gap-[10px]",
        "transition-all duration-[220ms] ease-in-out hover:bg-white/[0.05]",
      ].join(" ")}
      style={{ color: "rgba(255,255,255,0.30)" }}
    >
      <i className={`ti ${icon} text-[17px] flex-shrink-0`} aria-hidden="true" />
      <span className={LABEL_CLS}>{label}</span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────
// Sidebar
// ─────────────────────────────────────────────────────────────────
export function Sidebar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const trainerMode = useTrainerModeStore((s) => s.mode);
  const { appName, fetchBranding } = useBrandingStore();

  useEffect(() => { void fetchBranding(); }, [fetchBranding]);

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  const role = user?.role ?? "USUARIO";

  const initials = user?.full_name
    ? user.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : (user?.email?.[0]?.toUpperCase() ?? "U");

  const firstName = user?.full_name?.split(" ")[0] ?? "";
  const emailShort = user?.email ?? "";

  let navItems: NavItem[];
  let accentColor: string;
  let avatarBg: string;
  let avatarColor: string;

  if (role === "ADMIN") {
    navItems = NAV_ADMIN;
    accentColor = "#818CF8";
    avatarBg = "rgba(79,70,229,0.35)";
    avatarColor = "#a5b4fc";
  } else if (role === "TRAINER") {
    navItems = trainerMode === "INSTRUCTOR" ? NAV_TRAINER_INSTRUCTOR : NAV_TRAINER_ALUMNO;
    accentColor = trainerMode === "INSTRUCTOR" ? "#818CF8" : "#34D399";
    avatarBg = trainerMode === "INSTRUCTOR" ? "rgba(79,70,229,0.35)" : "rgba(16,185,129,0.25)";
    avatarColor = trainerMode === "INSTRUCTOR" ? "#a5b4fc" : "#6ee7b7";
  } else {
    navItems = NAV_USUARIO;
    accentColor = "#818CF8";
    avatarBg = "rgba(79,70,229,0.35)";
    avatarColor = "#a5b4fc";
  }

  return (
    <aside
      className={[
        "group shrink-0 flex flex-col items-center min-h-screen gap-0.5",
        "w-[68px] hover:w-[214px]",
        "py-3 px-[6px] hover:px-[8px]",
        "transition-[width,padding] duration-[220ms] ease-in-out",
        "overflow-hidden",
      ].join(" ")}
      style={{
        background: "#0a0f1e",
        borderRight: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* ── Logo / Brand ─────────────────────────────────────── */}
      <div className="w-full flex items-center px-[19px] group-hover:px-3 gap-0 group-hover:gap-[10px] transition-all duration-[220ms] mb-3 mt-1">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            background: "linear-gradient(135deg, #4F46E5 0%, #818CF8 100%)",
            boxShadow: "0 0 0 1px rgba(129,140,248,0.3), 0 2px 8px rgba(79,70,229,0.4)",
          }}
        >
          <i className="ti ti-certificate text-white text-[14px]" aria-hidden="true" />
        </div>
        <span
          className={`${LABEL_CLS} text-[13px] font-semibold`}
          style={{ color: "rgba(255,255,255,0.85)", letterSpacing: "0.01em" }}
        >
          {appName}
        </span>
      </div>

      {/* ── Trainer context toggle ────────────────────────────── */}
      {role === "TRAINER" && (
        <>
          <TrainerContextToggle />
          <div
            className="w-full my-1.5"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
          />
        </>
      )}

      {/* ── Navigation ───────────────────────────────────────── */}
      <nav className="w-full flex flex-col gap-0.5 flex-1">
        {navItems.map((item) => (
          <div key={item.to} className="w-full">
            {item.dividerBefore && (
              <div
                className="w-full my-2"
                style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
              />
            )}
            <SidebarItem item={item} accentColor={accentColor} />
          </div>
        ))}
      </nav>

      {/* ── Footer actions ────────────────────────────────────── */}
      <div
        className="w-full pt-2 mt-1 flex flex-col gap-0.5"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        <SidebarButton
          icon={theme === "dark" ? "ti-sun" : "ti-moon"}
          label={theme === "dark" ? "Modo claro" : "Modo oscuro"}
          onClick={toggleTheme}
        />
        <SidebarButton
          icon="ti-logout"
          label="Cerrar sesión"
          onClick={() => void handleLogout()}
        />

        {/* Avatar + user info */}
        <NavLink
          to="/profile"
          title={user?.full_name ?? user?.email ?? "Perfil"}
          className="w-full flex items-center rounded-lg py-[6px] px-[19px] group-hover:px-3 gap-0 group-hover:gap-[10px] transition-all duration-[220ms] mt-0.5 hover:bg-white/[0.05]"
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0 select-none ring-2"
            style={{
              background: avatarBg,
              color: avatarColor,
              ringColor: `${avatarColor}30`,
              transition: "background 0.2s ease, color 0.2s ease",
            }}
          >
            {initials}
          </div>

          <div
            className="overflow-hidden whitespace-nowrap opacity-0 max-w-0 group-hover:opacity-100 group-hover:max-w-[140px] transition-[opacity,max-width] duration-[220ms] ease-in-out"
          >
            {firstName && (
              <p className="text-[12px] font-medium leading-tight truncate" style={{ color: "rgba(255,255,255,0.75)" }}>
                {firstName}
              </p>
            )}
            <p className="text-[11px] leading-tight truncate" style={{ color: "rgba(255,255,255,0.30)" }}>
              {emailShort}
            </p>
          </div>
        </NavLink>
      </div>
    </aside>
  );
}
