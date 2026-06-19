import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { usersService } from "../../../services/usersService";
import { CreateUserModal } from "../../../components/shared/CreateUserModal";
import type { AdminUser, UserRole } from "../../../types/user";
import type { Group } from "../../../types/groups";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROLE_CONFIG: Record<UserRole, { label: string; color: string; bg: string }> = {
  ADMIN:   { label: "Administrador", color: "#818CF8", bg: "rgba(79,70,229,0.12)" },
  TRAINER: { label: "Capacitador",   color: "#34D399", bg: "rgba(16,185,129,0.12)" },
  USUARIO: { label: "Usuario",       color: "#94a3b8", bg: "rgba(100,116,139,0.12)" },
};

function userInitials(name: string, email: string): string {
  if (name?.trim()) {
    return name.trim().split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  }
  return email[0]?.toUpperCase() ?? "U";
}

const AVATAR_COLORS = [
  "#4F46E5", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4",
];

function avatarColor(id: number) {
  return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Avatar({ user }: { user: AdminUser }) {
  const color = avatarColor(user.id);
  return (
    <div
      className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0"
      style={{ background: color }}
    >
      {userInitials(user.full_name, user.email)}
    </div>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  const cfg = ROLE_CONFIG[role];
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
      style={{ color: cfg.color, background: cfg.bg }}
    >
      {cfg.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function UserManagementPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "">("");
  const [statusFilter, setStatusFilter] = useState<"" | "true" | "false">("");
  const [showCreate, setShowCreate] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await usersService.getUsers({
        search: search || undefined,
        role: roleFilter || undefined,
        is_active: statusFilter === "" ? undefined : statusFilter === "true",
        page,
      });
      setUsers(resp.results);
      setTotalCount(resp.count);
    } catch {
      toast.error("No se pudieron cargar los usuarios.");
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, statusFilter, page]);

  useEffect(() => {
    usersService.getGroups().then(setGroups).catch(() => void 0);
  }, []);

  useEffect(() => { void loadUsers(); }, [loadUsers]);

  const handleChangeRole = async (user: AdminUser, newRole: UserRole) => {
    try {
      const updated = await usersService.changeUserRole(user.id, { new_role: newRole });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      toast.success(`Rol de ${user.full_name} actualizado.`);
    } catch {
      toast.error("No se pudo cambiar el rol.");
    }
  };

  const handleToggleActive = async (user: AdminUser) => {
    try {
      if (user.is_active) {
        const updated = await usersService.deactivateUser(user.id);
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
        toast.success(`${user.full_name} desactivado.`);
      } else {
        toast("La activación se gestiona desde soporte.");
      }
    } catch {
      toast.error("No se pudo cambiar el estado.");
    }
  };

  const handleCreated = (newUser: AdminUser) => {
    setUsers((prev) => [newUser, ...prev]);
    setTotalCount((c) => c + 1);
    setShowCreate(false);
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const selectCls =
    "h-9 rounded-lg border border-slate-700 bg-background px-3 text-sm text-foreground focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-300 appearance-none pr-8";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Usuarios</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {totalCount} usuario{totalCount !== 1 ? "s" : ""} registrado{totalCount !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/admin/users/import"
            className="h-9 inline-flex items-center gap-1.5 px-3 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <i className="ti ti-upload text-base" aria-hidden="true" />
            Importar
          </Link>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="h-9 inline-flex items-center gap-1.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all duration-300"
          >
            <i className="ti ti-user-plus text-base" aria-hidden="true" />
            Nuevo usuario
          </button>
        </div>
      </div>

      {/* Filters toolbar */}
      <div className="flex flex-wrap gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-base pointer-events-none" aria-hidden="true" />
          <input
            type="text"
            placeholder="Buscar por nombre o correo…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-700 bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-300"
          />
        </div>
        {/* Role filter */}
        <div className="relative">
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value as UserRole | ""); setPage(1); }}
            className={selectCls}
          >
            <option value="">Todos los roles</option>
            <option value="ADMIN">Administrador</option>
            <option value="TRAINER">Capacitador</option>
            <option value="USUARIO">Usuario</option>
          </select>
          <i className="ti ti-chevron-down absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none" aria-hidden="true" />
        </div>
        {/* Status filter */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as "" | "true" | "false"); setPage(1); }}
            className={selectCls}
          >
            <option value="">Todos los estados</option>
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
          </select>
          <i className="ti ti-chevron-down absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none" aria-hidden="true" />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-7 h-7 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
          </div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-muted/40 flex items-center justify-center mx-auto mb-3">
              <i className="ti ti-users text-2xl text-muted-foreground" aria-hidden="true" />
            </div>
            <p className="text-sm text-muted-foreground">No se encontraron usuarios.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Usuario
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide hidden md:table-cell">
                  Área / Cargo
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Rol
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Estado
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-accent/30 transition-colors group">
                  {/* User */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar user={user} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{user.full_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  {/* Area */}
                  <td className="px-4 py-3 hidden md:table-cell">
                    {user.area ? (
                      <div>
                        <p className="text-xs text-foreground">{user.area}</p>
                        {user.cargo && (
                          <p className="text-xs text-muted-foreground">{user.cargo}</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  {/* Role */}
                  <td className="px-4 py-3">
                    <div className="relative inline-block">
                      <select
                        value={user.role}
                        onChange={(e) => void handleChangeRole(user, e.target.value as UserRole)}
                        className="appearance-none pl-2.5 pr-6 py-1 rounded-full text-xs font-medium border-0 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer"
                        style={{
                          color: ROLE_CONFIG[user.role].color,
                          background: ROLE_CONFIG[user.role].bg,
                        }}
                      >
                        <option value="USUARIO">Usuario</option>
                        <option value="TRAINER">Capacitador</option>
                        <option value="ADMIN">Administrador</option>
                      </select>
                      <i className="ti ti-chevron-down absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] pointer-events-none"
                        style={{ color: ROLE_CONFIG[user.role].color }} aria-hidden="true" />
                    </div>
                  </td>
                  {/* Status */}
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                      user.is_active
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-muted/40 text-muted-foreground"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${user.is_active ? "bg-emerald-400" : "bg-muted-foreground"}`} />
                      {user.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  {/* Actions */}
                  <td className="px-4 py-3 text-right">
                    {user.is_active && (
                      <button
                        type="button"
                        onClick={() => void handleToggleActive(user)}
                        title="Desactivar usuario"
                        className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-all px-2 py-1 rounded-lg hover:bg-red-500/10"
                      >
                        <i className="ti ti-user-off text-sm" aria-hidden="true" />
                        Desactivar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
            className="h-8 px-3 text-sm border border-border rounded-lg disabled:opacity-40 hover:bg-accent/50 transition-colors text-muted-foreground">
            ← Anterior
          </button>
          <span className="text-sm text-muted-foreground px-2">
            {page} / {totalPages}
          </span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
            className="h-8 px-3 text-sm border border-border rounded-lg disabled:opacity-40 hover:bg-accent/50 transition-colors text-muted-foreground">
            Siguiente →
          </button>
        </div>
      )}

      {showCreate && (
        <CreateUserModal groups={groups} onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      )}
    </div>
  );
}
