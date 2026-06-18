import { NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";

interface NavItem {
  to: string;
  label: string;
  icon: string;
  roles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Inicio", icon: "🏠" },
  { to: "/courses", label: "Cursos", icon: "📚" },
  { to: "/my-courses", label: "Mis cursos", icon: "🎓" },
  { to: "/notifications", label: "Notificaciones", icon: "🔔" },
  { to: "/profile", label: "Mi perfil", icon: "👤" },
  // Admin-only
  { to: "/admin", label: "Panel admin", icon: "⚙️", roles: ["ADMIN"] },
  { to: "/admin/users", label: "Usuarios", icon: "👥", roles: ["ADMIN"] },
  { to: "/admin/courses", label: "Gestión cursos", icon: "📋", roles: ["ADMIN"] },
  { to: "/admin/reports", label: "Auditoría", icon: "📊", roles: ["ADMIN"] },
];

export function Sidebar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  const items = NAV_ITEMS.filter(
    (item) => !item.roles || (user?.role && item.roles.includes(user.role))
  );

  return (
    <aside className="w-60 shrink-0 bg-white border-r border-gray-200 flex flex-col min-h-screen">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-100">
        <span className="text-lg font-bold text-indigo-700 tracking-tight">LMS Corporativo</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/dashboard"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                isActive
                  ? "bg-indigo-50 text-indigo-700 font-medium"
                  : "text-gray-600 hover:bg-gray-50"
              }`
            }
          >
            <span>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* User footer */}
      <div className="border-t border-gray-100 p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-sm font-bold shrink-0">
            {user?.full_name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-900 truncate">
              {user?.full_name || user?.email}
            </p>
            <p className="text-xs text-gray-400 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="mt-3 w-full text-xs text-gray-500 hover:text-red-600 transition-colors text-left"
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
