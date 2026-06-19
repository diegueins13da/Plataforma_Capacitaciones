/**
 * P45 — Group Management
 *
 * Admin-only page to create, edit, delete groups and manage their members.
 * Accessible at /admin/groups.
 */
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { usersService } from "../../../services/usersService";
import type { Group, GroupMember } from "../../../types/groups";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const groupSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio.").max(150),
  descripcion: z.string().max(500).optional(),
  activo: z.boolean().optional(),
});

type GroupFormData = z.infer<typeof groupSchema>;

const addMembersSchema = z.object({
  user_ids_raw: z
    .string()
    .min(1, "Ingresa al menos un ID de usuario.")
    .refine((val) => val.split(",").every((s) => /^\d+$/.test(s.trim())), {
      message: "Ingresa IDs numéricos separados por coma.",
    }),
});

type AddMembersFormData = z.infer<typeof addMembersSchema>;

// ---------------------------------------------------------------------------
// GroupFormModal — create / edit
// ---------------------------------------------------------------------------

interface GroupFormModalProps {
  group?: Group;
  onClose: () => void;
  onSaved: (g: Group) => void;
}

function GroupFormModal({ group, onClose, onSaved }: GroupFormModalProps) {
  const isEdit = Boolean(group);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<GroupFormData>({
    resolver: zodResolver(groupSchema),
    defaultValues: {
      nombre: group?.nombre ?? "",
      descripcion: group?.descripcion ?? "",
      activo: group?.activo ?? true,
    },
  });

  const onSubmit = async (data: GroupFormData) => {
    try {
      const saved = isEdit
        ? await usersService.updateGroup(group!.id, data)
        : await usersService.createGroup(data);
      onSaved(saved);
      toast.success(isEdit ? "Grupo actualizado." : "Grupo creado.");
    } catch {
      toast.error("No se pudo guardar el grupo. Verifica que el nombre no esté duplicado.");
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? "Editar grupo" : "Nuevo grupo"}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
    >
      <div className="bg-slate-900 w-full max-w-md rounded-xl p-6 shadow-xl border border-slate-800">
        <h2 className="mb-4 text-lg font-semibold">
          {isEdit ? "Editar grupo" : "Nuevo grupo"}
        </h2>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div>
            <label htmlFor="nombre" className="mb-1 block text-sm font-medium">
              Nombre del grupo
            </label>
            <input
              id="nombre"
              type="text"
              className="w-full rounded-lg border border-slate-700 bg-background px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-300"
              {...register("nombre")}
            />
            {errors.nombre && (
              <p className="mt-1 text-sm text-destructive">{errors.nombre.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="descripcion" className="mb-1 block text-sm font-medium">
              Descripción
            </label>
            <textarea
              id="descripcion"
              rows={3}
              className="w-full rounded-lg border border-slate-700 bg-background px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-300"
              {...register("descripcion")}
            />
          </div>

          {isEdit && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register("activo")} />
              Grupo activo
            </label>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-accent/50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50 shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all duration-300"
            >
              {isSubmitting ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GroupMembersModal
// ---------------------------------------------------------------------------

interface GroupMembersModalProps {
  group: Group;
  onClose: () => void;
  onMembersChanged: () => void;
}

function GroupMembersModal({ group, onClose, onMembersChanged }: GroupMembersModalProps) {
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddMembersFormData>({
    resolver: zodResolver(addMembersSchema),
  });

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await usersService.getGroupMembers(group.id);
      setMembers(data);
    } finally {
      setLoading(false);
    }
  }, [group.id]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleRemove = async (userId: number) => {
    try {
      await usersService.removeGroupMember(group.id, userId);
      setMembers((prev) => prev.filter((m) => m.id !== userId));
      onMembersChanged();
      toast.success("Miembro eliminado del grupo.");
    } catch {
      toast.error("No se pudo eliminar el miembro.");
    }
  };

  const handleAddMembers = async (data: AddMembersFormData) => {
    const user_ids = data.user_ids_raw
      .split(",")
      .map((s) => parseInt(s.trim(), 10));
    try {
      await usersService.addGroupMembers(group.id, { user_ids });
      await loadMembers();
      onMembersChanged();
      reset();
      toast.success("Miembros agregados al grupo.");
    } catch {
      toast.error("No se pudieron agregar los miembros. Verifica los IDs ingresados.");
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Miembros de ${group.nombre}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
    >
      <div className="bg-slate-900 w-full max-w-lg rounded-xl p-6 shadow-xl border border-slate-800">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Miembros — {group.nombre}</h2>
          <button onClick={onClose} className="text-muted-foreground text-sm">
            ✕ Cerrar
          </button>
        </div>

        {/* Add members form */}
        <form onSubmit={handleSubmit(handleAddMembers)} className="mb-4 flex gap-2">
          <div className="flex-1">
            <input
              type="text"
              placeholder="IDs de usuario separados por coma (ej: 1,2,3)"
              className="w-full rounded-lg border border-slate-700 bg-background px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-300"
              {...register("user_ids_raw")}
            />
            {errors.user_ids_raw && (
              <p className="mt-1 text-sm text-destructive">{errors.user_ids_raw.message}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-3 py-2 text-sm disabled:opacity-50 shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all duration-300"
          >
            Agregar
          </button>
        </form>

        {/* Members list */}
        {loading ? (
          <p className="text-muted-foreground text-sm">Cargando miembros...</p>
        ) : members.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Este grupo no tiene miembros todavía.
          </p>
        ) : (
          <ul className="max-h-64 divide-y overflow-y-auto text-sm">
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between py-2">
                <div>
                  <span className="font-medium">{m.full_name}</span>
                  <span className="text-muted-foreground ml-2">{m.email}</span>
                </div>
                <button
                  onClick={() => handleRemove(m.id)}
                  className="text-destructive text-xs hover:underline"
                  aria-label={`Eliminar ${m.full_name} del grupo`}
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GroupManagementPage — P45
// ---------------------------------------------------------------------------

export default function GroupManagementPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [formModal, setFormModal] = useState<{ open: boolean; group?: Group }>({
    open: false,
  });
  const [membersModal, setMembersModal] = useState<{ open: boolean; group?: Group }>({
    open: false,
  });
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadGroups = useCallback(async () => {
    setLoading(true);
    try {
      const data = await usersService.getGroups();
      setGroups(data);
    } catch {
      toast.error("No se pudieron cargar los grupos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const handleSaved = (saved: Group) => {
    setGroups((prev) => {
      const exists = prev.find((g) => g.id === saved.id);
      return exists ? prev.map((g) => (g.id === saved.id ? saved : g)) : [...prev, saved];
    });
    setFormModal({ open: false });
  };

  const handleDelete = async (group: Group) => {
    setDeleteError(null);
    try {
      await usersService.deleteGroup(group.id);
      setGroups((prev) => prev.filter((g) => g.id !== group.id));
      toast.success("Grupo eliminado.");
    } catch (err: unknown) {
      const resp = (err as { response?: { status: number } }).response;
      if (resp?.status === 400) {
        setDeleteError(
          "No se puede eliminar un grupo que tiene miembros activos. Quita todos los miembros primero."
        );
      } else {
        toast.error("No se pudo eliminar el grupo.");
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestión de Grupos</h1>
          <p className="text-muted-foreground text-sm">
            Organiza a los usuarios en grupos para asignarles cursos.
          </p>
        </div>
        <button
          onClick={() => setFormModal({ open: true })}
          className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 text-sm font-medium shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all duration-300"
        >
          + Nuevo Grupo
        </button>
      </div>

      {/* Delete error banner */}
      {deleteError && (
        <div
          role="alert"
          className="bg-destructive/10 text-destructive rounded border border-current px-4 py-3 text-sm"
        >
          {deleteError}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <p className="text-muted-foreground" role="status">
          Cargando grupos...
        </p>
      ) : groups.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No hay grupos creados todavía. Crea el primero haciendo clic en "+ Nuevo Grupo".
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Nombre</th>
                <th className="px-4 py-3 text-left font-medium">Descripción</th>
                <th className="px-4 py-3 text-center font-medium">Miembros</th>
                <th className="px-4 py-3 text-center font-medium">Cursos activos</th>
                <th className="px-4 py-3 text-center font-medium">Estado</th>
                <th className="px-4 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {groups.map((group) => (
                <tr key={group.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3 font-medium">{group.nombre}</td>
                  <td className="text-muted-foreground px-4 py-3">
                    {group.descripcion || "—"}
                  </td>
                  <td className="px-4 py-3 text-center">{group.member_count}</td>
                  <td className="px-4 py-3 text-center">{group.cursos_activos}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        group.activo
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-muted/40 text-muted-foreground"
                      }`}
                    >
                      {group.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setMembersModal({ open: true, group })}
                        className="text-indigo-400 text-xs hover:underline"
                      >
                        Miembros
                      </button>
                      <button
                        onClick={() => setFormModal({ open: true, group })}
                        className="text-indigo-400 text-xs hover:underline"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(group)}
                        className="text-destructive text-xs hover:underline"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {formModal.open && (
        <GroupFormModal
          group={formModal.group}
          onClose={() => setFormModal({ open: false })}
          onSaved={handleSaved}
        />
      )}

      {membersModal.open && membersModal.group && (
        <GroupMembersModal
          group={membersModal.group}
          onClose={() => setMembersModal({ open: false })}
          onMembersChanged={loadGroups}
        />
      )}
    </div>
  );
}
