import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { configService } from "../../../services/configService";
import { usersService } from "../../../services/usersService";
import { CreateUserModal } from "../../../components/shared/CreateUserModal";
import type { Area } from "../../../types/area";
import type { Cargo } from "../../../types/cargo";
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
// EditUserModal
// ---------------------------------------------------------------------------

interface EditUserModalProps {
  user: AdminUser;
  onClose: () => void;
  onUpdated: (u: AdminUser) => void;
}

function EditUserModal({ user, onClose, onUpdated }: EditUserModalProps) {
  const [firstName, setFirstName] = useState(user.first_name);
  const [lastName, setLastName] = useState(user.last_name);
  const [areas, setAreas] = useState<Area[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<number | "">("");
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [selectedCargoNombre, setSelectedCargoNombre] = useState(user.cargo ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    configService.getAreas().then((list) => {
      setAreas(list);
      const found = list.find((a) => a.nombre === user.area);
      if (found) setSelectedAreaId(found.id);
    }).catch(() => void 0);
  }, [user.area]);

  useEffect(() => {
    if (!selectedAreaId) { setCargos([]); return; }
    configService.getCargos(Number(selectedAreaId)).then((list) => {
      setCargos(list.filter((c) => c.activo));
    }).catch(() => void 0);
  }, [selectedAreaId]);

  const handleAreaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedAreaId(e.target.value ? Number(e.target.value) : "");
    setSelectedCargoNombre("");
  };

  async function handleSubmit() {
    setSaving(true);
    try {
      const areaName = areas.find((a) => a.id === selectedAreaId)?.nombre ?? "";
      const updated = await usersService.updateUser(user.id, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        area: areaName,
        cargo: selectedCargoNombre,
      });
      onUpdated(updated);
      toast.success("Usuario actualizado.");
    } catch {
      toast.error("No se pudo actualizar el usuario.");
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "w-full h-9 rounded-lg border border-slate-700 bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-300";
  const selectCls = `${inputCls} appearance-none`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Editar usuario</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-accent/50 text-muted-foreground transition-colors"
          >
            <i className="ti ti-x text-sm" />
          </button>
        </div>
        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-4">
          {/* Email (read-only context) */}
          <p className="text-xs text-muted-foreground px-3 py-2 bg-muted/20 rounded-lg truncate">
            <i className="ti ti-mail mr-1.5" />{user.email}
          </p>
          {/* First + Last name */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Nombre</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={inputCls}
                maxLength={150}
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Apellido</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={inputCls}
                maxLength={150}
              />
            </div>
          </div>
          {/* Area */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Área</label>
            <div className="relative">
              <select value={selectedAreaId} onChange={handleAreaChange} className={selectCls}>
                <option value="">Sin área</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>{a.nombre}</option>
                ))}
              </select>
              <i className="ti ti-chevron-down absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none" />
            </div>
          </div>
          {/* Cargo (filtered by area) */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Cargo</label>
            <div className="relative">
              <select
                value={selectedCargoNombre}
                onChange={(e) => setSelectedCargoNombre(e.target.value)}
                className={selectCls}
                disabled={!selectedAreaId && cargos.length === 0}
              >
                <option value="">Sin cargo</option>
                {cargos.map((c) => (
                  <option key={c.id} value={c.nombre}>{c.nombre}</option>
                ))}
              </select>
              <i className="ti ti-chevron-down absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none" />
            </div>
            {!selectedAreaId && (
              <p className="text-xs text-muted-foreground mt-1">Selecciona un área para ver los cargos disponibles.</p>
            )}
          </div>
        </div>
        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
          <button
            onClick={onClose}
            className="h-9 px-4 border border-border text-muted-foreground text-sm rounded-lg hover:bg-accent/50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={saving || !firstName.trim() || !lastName.trim()}
            className="h-9 px-5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all duration-300"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
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
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

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
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { errors?: string[] } } })
        ?.response?.data?.errors?.[0];
      toast.error(msg ?? "No se pudo cambiar el rol.");
    }
  };

  const handleActivate = async (user: AdminUser) => {
    try {
      const updated = await usersService.activateUser(user.id);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      toast.success(`${user.full_name} activado.`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { errors?: string[] } } })
        ?.response?.data?.errors?.[0];
      toast.error(msg ?? "No se pudo activar el usuario.");
    }
  };

  const handleDeactivate = async (user: AdminUser) => {
    try {
      const updated = await usersService.deactivateUser(user.id);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      toast.success(`${user.full_name} desactivado.`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { errors?: string[] } } })
        ?.response?.data?.errors?.[0];
      toast.error(msg ?? "No se pudo desactivar el usuario.");
    }
  };

  const handleDelete = async (user: AdminUser) => {
    try {
      await usersService.deleteUser(user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      setTotalCount((c) => c - 1);
      setPendingDeleteId(null);
      toast.success(`Usuario ${user.full_name} eliminado.`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { errors?: string[] } } })
        ?.response?.data?.errors?.[0];
      toast.error(msg ?? "No se pudo eliminar el usuario.");
      setPendingDeleteId(null);
    }
  };

  const handleCreated = (newUser: AdminUser) => {
    setUsers((prev) => [newUser, ...prev]);
    setTotalCount((c) => c + 1);
    setShowCreate(false);
  };

  const handleUpdated = (updated: AdminUser) => {
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    setEditingUser(null);
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
                    {user.is_superuser ? (
                      <span
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
                        title="El rol del administrador del sistema no puede modificarse"
                        style={{ color: ROLE_CONFIG[user.role].color, background: ROLE_CONFIG[user.role].bg }}
                      >
                        <i className="ti ti-lock text-[10px]" aria-hidden="true" />
                        {ROLE_CONFIG[user.role].label}
                      </span>
                    ) : (
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
                    )}
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
                    <div className="flex items-center justify-end gap-1">
                      {/* Editar */}
                      <button
                        type="button"
                        onClick={() => setEditingUser(user)}
                        title="Editar usuario"
                        className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors"
                      >
                        <i className="ti ti-pencil text-sm" aria-hidden="true" />
                      </button>

                      {/* Activar / Desactivar */}
                      {user.is_active ? (
                        <button
                          type="button"
                          onClick={() => void handleDeactivate(user)}
                          title="Desactivar usuario"
                          className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 transition-colors"
                        >
                          <i className="ti ti-user-off text-sm" aria-hidden="true" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleActivate(user)}
                          title="Activar usuario"
                          className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors"
                        >
                          <i className="ti ti-user-check text-sm" aria-hidden="true" />
                        </button>
                      )}

                      {/* Eliminar — confirmación en dos pasos */}
                      {pendingDeleteId === user.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void handleDelete(user)}
                            title="Confirmar eliminación"
                            className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-white bg-red-600 hover:bg-red-700 transition-colors"
                          >
                            <i className="ti ti-check text-sm" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingDeleteId(null)}
                            title="Cancelar"
                            className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:bg-accent/50 transition-colors"
                          >
                            <i className="ti ti-x text-sm" aria-hidden="true" />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPendingDeleteId(user.id)}
                          title="Eliminar usuario"
                          className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                        >
                          <i className="ti ti-trash text-sm" aria-hidden="true" />
                        </button>
                      )}
                    </div>
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
      {editingUser && (
        <EditUserModal user={editingUser} onClose={() => setEditingUser(null)} onUpdated={handleUpdated} />
      )}
    </div>
  );
}
