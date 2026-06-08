/**
 * P27 — Create User Modal
 *
 * Validates all fields before submit; maps API errors to the correct fields.
 * Used from the User Management page (P26).
 */
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { usersService } from "../../services/usersService";
import type { AdminUser, UserRole } from "../../types/user";
import type { Group } from "../../types/groups";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const schema = z.object({
  email: z.string().email("Ingresa un correo electrónico válido."),
  first_name: z.string().min(1, "El nombre es obligatorio.").max(150),
  last_name: z.string().min(1, "El apellido es obligatorio.").max(150),
  role: z.enum(["ADMIN", "TRAINER", "USUARIO"] as const),
  area: z.string().max(150).optional(),
  cargo: z.string().max(150).optional(),
  grupo_id: z.number().nullable().optional(),
});

type FormData = z.infer<typeof schema>;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CreateUserModalProps {
  groups: Group[];
  onClose: () => void;
  onCreated: (user: AdminUser) => void;
}

export function CreateUserModal({ groups, onClose, onCreated }: CreateUserModalProps) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: "USUARIO" },
  });

  const onSubmit = async (data: FormData) => {
    try {
      const user = await usersService.createUser({
        email: data.email,
        first_name: data.first_name,
        last_name: data.last_name,
        role: data.role as UserRole,
        area: data.area,
        cargo: data.cargo,
        grupo_id: data.grupo_id ?? null,
      });
      onCreated(user);
      toast.success("Usuario creado. Se ha enviado un correo con la contraseña temporal.");
    } catch (err: unknown) {
      const resp = (err as { response?: { data?: Record<string, string[]> } }).response;
      const apiErrors = resp?.data;
      if (apiErrors) {
        // Map API field errors → React Hook Form
        (
          Object.entries(apiErrors) as [keyof FormData, string[]][]
        ).forEach(([field, msgs]) => {
          setError(field, { message: msgs[0] });
        });
      } else {
        toast.error("No se pudo crear el usuario. Inténtalo nuevamente.");
      }
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Crear nuevo usuario"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    >
      <div className="bg-card w-full max-w-md rounded-lg p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold">Nuevo Usuario</h2>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          {/* Email */}
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium">
              Correo electrónico *
            </label>
            <input
              id="email"
              type="email"
              autoComplete="off"
              className="border-input bg-background w-full rounded border px-3 py-2 text-sm"
              {...register("email")}
            />
            {errors.email && (
              <p className="mt-1 text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          {/* First / Last name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="first_name" className="mb-1 block text-sm font-medium">
                Nombre *
              </label>
              <input
                id="first_name"
                type="text"
                className="border-input bg-background w-full rounded border px-3 py-2 text-sm"
                {...register("first_name")}
              />
              {errors.first_name && (
                <p className="mt-1 text-sm text-destructive">{errors.first_name.message}</p>
              )}
            </div>
            <div>
              <label htmlFor="last_name" className="mb-1 block text-sm font-medium">
                Apellido *
              </label>
              <input
                id="last_name"
                type="text"
                className="border-input bg-background w-full rounded border px-3 py-2 text-sm"
                {...register("last_name")}
              />
              {errors.last_name && (
                <p className="mt-1 text-sm text-destructive">{errors.last_name.message}</p>
              )}
            </div>
          </div>

          {/* Role */}
          <div>
            <label htmlFor="role" className="mb-1 block text-sm font-medium">
              Rol *
            </label>
            <select
              id="role"
              className="border-input bg-background w-full rounded border px-3 py-2 text-sm"
              {...register("role")}
            >
              <option value="USUARIO">Usuario</option>
              <option value="TRAINER">Capacitador</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </div>

          {/* Area / Cargo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="area" className="mb-1 block text-sm font-medium">
                Área
              </label>
              <input
                id="area"
                type="text"
                className="border-input bg-background w-full rounded border px-3 py-2 text-sm"
                {...register("area")}
              />
            </div>
            <div>
              <label htmlFor="cargo" className="mb-1 block text-sm font-medium">
                Cargo
              </label>
              <input
                id="cargo"
                type="text"
                className="border-input bg-background w-full rounded border px-3 py-2 text-sm"
                {...register("cargo")}
              />
            </div>
          </div>

          {/* Group */}
          {groups.length > 0 && (
            <div>
              <label htmlFor="grupo_id" className="mb-1 block text-sm font-medium">
                Grupo
              </label>
              <select
                id="grupo_id"
                className="border-input bg-background w-full rounded border px-3 py-2 text-sm"
                {...register("grupo_id", {
                  setValueAs: (v) => (v === "" || v === null ? null : Number(v)),
                })}
              >
                <option value="">Sin grupo</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border px-4 py-2 text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-primary text-primary-foreground rounded px-4 py-2 text-sm disabled:opacity-50"
            >
              {isSubmitting ? "Creando..." : "Crear usuario"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
