/**
 * P26 — User Management Page
 *
 * Paginated user table with server-side filtering (role, area, search).
 * Row actions: change role (inline select), deactivate/activate.
 * FAB "Nuevo Usuario" opens P27 (CreateUserModal).
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { usersService } from "../../../services/usersService";
import { CreateUserModal } from "../../../components/shared/CreateUserModal";
import type { AdminUser, UserRole } from "../../../types/user";
import type { Group } from "../../../types/groups";

// ---------------------------------------------------------------------------
// Role label helpers
// ---------------------------------------------------------------------------

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Administrador",
  TRAINER: "Capacitador",
  USUARIO: "Usuario",
};

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

  // Filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "">("");
  const [statusFilter, setStatusFilter] = useState<"" | "true" | "false">("");

  // Modals
  const [showCreate, setShowCreate] = useState(false);

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

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

  const loadGroups = useCallback(async () => {
    try {
      const data = await usersService.getGroups();
      setGroups(data);
    } catch {
      // Groups are optional context for create modal
    }
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const handleChangeRole = async (user: AdminUser, newRole: UserRole) => {
    try {
      const updated = await usersService.changeUserRole(user.id, { new_role: newRole });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      toast.success(`Rol de ${user.full_name} actualizado a ${ROLE_LABELS[newRole]}.`);
    } catch {
      toast.error("No se pudo cambiar el rol.");
    }
  };

  const handleToggleActive = async (user: AdminUser) => {
    try {
      if (user.is_active) {
        const updated = await usersService.deactivateUser(user.id);
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
        toast.success(`${user.full_name} ha sido desactivado.`);
      } else {
        toast("La activación de usuarios se realiza desde el panel de soporte.");
      }
    } catch {
      toast.error("No se pudo cambiar el estado del usuario.");
    }
  };

  const handleCreated = (newUser: AdminUser) => {
    setUsers((prev) => [newUser, ...prev]);
    setTotalCount((c) => c + 1);
    setShowCreate(false);
  };

  // ---------------------------------------------------------------------------
  // Pagination helpers
  // ---------------------------------------------------------------------------

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestión de Usuarios</h1>
          <p className="text-muted-foreground text-sm">
            {totalCount} usuario{totalCount !== 1 ? "s" : ""} en total
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-primary text-primary-foreground rounded px-4 py-2 text-sm font-medium"
        >
          + Nuevo Usuario
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Buscar por nombre o correo..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          aria-label="Buscar usuarios"
          className="border-input bg-background rounded border px-3 py-2 text-sm"
        />

        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value as UserRole | "");
            setPage(1);
          }}
          aria-label="Filtrar por rol"
          className="border-input bg-background rounded border px-3 py-2 text-sm"
        >
          <option value="">Todos los roles</option>
          <option value="ADMIN">Administrador</option>
          <option value="TRAINER">Capacitador</option>
          <option value="USUARIO">Usuario</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as "" | "true" | "false");
            setPage(1);
          }}
          aria-label="Filtrar por estado"
          className="border-input bg-background rounded border px-3 py-2 text-sm"
        >
          <option value="">Todos los estados</option>
          <option value="true">Activo</option>
          <option value="false">Inactivo</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-muted-foreground" role="status">
          Cargando usuarios...
        </p>
      ) : users.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No se encontraron usuarios con los filtros seleccionados.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Nombre</th>
                <th className="px-4 py-3 text-left font-medium">Correo</th>
                <th className="px-4 py-3 text-left font-medium">Área / Cargo</th>
                <th className="px-4 py-3 text-center font-medium">Rol</th>
                <th className="px-4 py-3 text-center font-medium">Estado</th>
                <th className="px-4 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3 font-medium">{user.full_name}</td>
                  <td className="text-muted-foreground px-4 py-3">{user.email}</td>
                  <td className="text-muted-foreground px-4 py-3">
                    {user.area ? (
                      <>
                        <span>{user.area}</span>
                        {user.cargo && (
                          <span className="ml-1 text-xs">/ {user.cargo}</span>
                        )}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <select
                      value={user.role}
                      onChange={(e) => handleChangeRole(user, e.target.value as UserRole)}
                      aria-label={`Cambiar rol de ${user.full_name}`}
                      className="border-input bg-background rounded border px-2 py-1 text-xs"
                    >
                      <option value="USUARIO">Usuario</option>
                      <option value="TRAINER">Capacitador</option>
                      <option value="ADMIN">Administrador</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        user.is_active
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {user.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {user.is_active && (
                      <button
                        onClick={() => handleToggleActive(user)}
                        className="text-destructive text-xs hover:underline"
                        aria-label={`Desactivar ${user.full_name}`}
                      >
                        Desactivar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded border px-3 py-1 disabled:opacity-40"
          >
            ← Anterior
          </button>
          <span className="text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded border px-3 py-1 disabled:opacity-40"
          >
            Siguiente →
          </button>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateUserModal
          groups={groups}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
