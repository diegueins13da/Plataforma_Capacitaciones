import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { configService } from "../../services/configService";
import { usersService } from "../../services/usersService";
import type { Area } from "../../types/area";
import type { Cargo } from "../../types/cargo";
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
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: "USUARIO" },
  });

  const [areas, setAreas] = useState<Area[]>([]);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<number | "">("");

  useEffect(() => {
    configService.getAreas().then((list) => setAreas(list.filter((a) => a.activo))).catch(() => void 0);
  }, []);

  useEffect(() => {
    if (!selectedAreaId) { setCargos([]); return; }
    configService.getCargos(Number(selectedAreaId)).then((list) => setCargos(list.filter((c) => c.activo))).catch(() => void 0);
  }, [selectedAreaId]);

  const handleAreaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value ? Number(e.target.value) : "";
    setSelectedAreaId(id);
    const found = areas.find((a) => a.id === Number(e.target.value));
    setValue("area", found?.nombre ?? "");
    setValue("cargo", "");
  };

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
      const resp = (err as { response?: { data?: { errors?: Record<string, string[]> } } }).response;
      const apiErrors = resp?.data?.errors;
      if (apiErrors && Object.keys(apiErrors).length > 0) {
        (Object.entries(apiErrors) as [keyof FormData, string[]][]).forEach(([field, msgs]) => {
          setError(field, { message: msgs[0] });
        });
      } else {
        toast.error("No se pudo crear el usuario. Inténtalo nuevamente.");
      }
    }
  };

  const inputCls =
    "w-full h-10 rounded-xl border border-slate-700 bg-background pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-300";

  const labelCls = "block text-xs font-medium mb-1.5 text-slate-500";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Crear nuevo usuario"
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(2,6,23,0.8)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "#0f172a", border: "1px solid #1e293b" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid #1e293b" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: "rgba(79,70,229,0.15)" }}
            >
              <i className="ti ti-user-plus text-base" style={{ color: "#818cf8" }} aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "#f1f5f9" }}>Nuevo usuario</p>
              <p className="text-xs" style={{ color: "#475569" }}>Completa los datos para crear la cuenta</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: "#475569" }}
            onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#1e293b"; }}
            onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
          >
            <i className="ti ti-x text-base" aria-hidden="true" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="p-5 space-y-4">

          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="first_name" className={labelCls}>
                Nombre <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <i className="ti ti-user absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 text-base pointer-events-none" aria-hidden="true" />
                <input
                  id="first_name"
                  type="text"
                  placeholder="Juan"
                  className={inputCls}
                  {...register("first_name")}
                />
              </div>
              {errors.first_name && (
                <p className="text-xs text-red-400 mt-1">{errors.first_name.message}</p>
              )}
            </div>
            <div>
              <label htmlFor="last_name" className={labelCls}>
                Apellido <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <i className="ti ti-user absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 text-base pointer-events-none" aria-hidden="true" />
                <input
                  id="last_name"
                  type="text"
                  placeholder="Pérez"
                  className={inputCls}
                  {...register("last_name")}
                />
              </div>
              {errors.last_name && (
                <p className="text-xs text-red-400 mt-1">{errors.last_name.message}</p>
              )}
            </div>
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className={labelCls}>
              Correo electrónico <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <i className="ti ti-mail absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 text-base pointer-events-none" aria-hidden="true" />
              <input
                id="email"
                type="email"
                autoComplete="off"
                placeholder="juan@empresa.com"
                className={inputCls}
                {...register("email")}
              />
            </div>
            {errors.email && (
              <p className="text-xs text-red-400 mt-1">{errors.email.message}</p>
            )}
          </div>

          {/* Role + Area */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="role" className={labelCls}>
                Rol <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <i className="ti ti-shield absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 text-base pointer-events-none" aria-hidden="true" />
                <select
                  id="role"
                  className={`${inputCls} appearance-none pr-8`}
                  {...register("role")}
                >
                  <option value="USUARIO">Usuario</option>
                  <option value="TRAINER">Capacitador</option>
                  <option value="ADMIN">Administrador</option>
                </select>
                <i className="ti ti-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 text-xs pointer-events-none" aria-hidden="true" />
              </div>
            </div>
            <div>
              <label htmlFor="area" className={labelCls}>Área</label>
              <div className="relative">
                <i className="ti ti-building absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 text-base pointer-events-none" aria-hidden="true" />
                <select
                  id="area"
                  value={selectedAreaId}
                  onChange={handleAreaChange}
                  className={`${inputCls} appearance-none pr-8`}
                >
                  <option value="">Sin área</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>{a.nombre}</option>
                  ))}
                </select>
                <i className="ti ti-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 text-xs pointer-events-none" aria-hidden="true" />
              </div>
            </div>
          </div>

          {/* Cargo */}
          <div>
            <label htmlFor="cargo" className={labelCls}>Cargo</label>
            <div className="relative">
              <i className="ti ti-briefcase absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 text-base pointer-events-none" aria-hidden="true" />
              <select
                id="cargo"
                className={`${inputCls} appearance-none pr-8`}
                disabled={!selectedAreaId}
                {...register("cargo")}
              >
                <option value="">
                  {selectedAreaId ? "Sin cargo" : "Selecciona un área primero"}
                </option>
                {cargos.map((c) => (
                  <option key={c.id} value={c.nombre}>{c.nombre}</option>
                ))}
              </select>
              <i className="ti ti-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 text-xs pointer-events-none" aria-hidden="true" />
            </div>
          </div>

          {/* Group */}
          {groups.length > 0 && (
            <div>
              <label htmlFor="grupo_id" className={labelCls}>Grupo</label>
              <div className="relative">
                <i className="ti ti-users-group absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 text-base pointer-events-none" aria-hidden="true" />
                <select
                  id="grupo_id"
                  className={`${inputCls} appearance-none pr-8`}
                  {...register("grupo_id", {
                    setValueAs: (v) => (v === "" || v === null ? null : Number(v)),
                  })}
                >
                  <option value="">Sin grupo</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.nombre}</option>
                  ))}
                </select>
                <i className="ti ti-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 text-xs pointer-events-none" aria-hidden="true" />
              </div>
            </div>
          )}

          {/* Footer */}
          <div
            className="flex items-center justify-between pt-3 mt-1"
            style={{ borderTop: "1px solid #1e293b" }}
          >
            <p className="text-xs" style={{ color: "#334155" }}>
              Se enviará un correo con acceso temporal
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="h-9 px-4 rounded-xl text-sm transition-all duration-300"
                style={{ border: "1px solid #1e293b", color: "#94a3b8", background: "transparent" }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="h-9 px-4 rounded-xl text-sm font-medium text-white flex items-center gap-2 transition-all duration-300 active:scale-[0.98] disabled:opacity-50"
                style={{
                  background: "#4F46E5",
                  boxShadow: "0 4px 14px rgba(79,70,229,0.25)",
                }}
              >
                <i className="ti ti-user-plus text-base" aria-hidden="true" />
                {isSubmitting ? "Creando…" : "Crear usuario"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
