/**
 * P07 — User profile page. Shows user info, editable fields, and change password.
 */
import { useState } from "react";
import { useAuthStore } from "../../store/authStore";
import { authService } from "../../services/authService";
import api from "../../services/api";
import type { MeResponse } from "../../types/auth";

interface ProfileForm {
  first_name: string;
  last_name: string;
  cargo: string;
}

interface PasswordForm {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2 border-b border-gray-50">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value || "—"}</span>
    </div>
  );
}

export default function ProfilePage() {
  const { user, restoreSession } = useAuthStore();

  const [editMode, setEditMode] = useState(false);
  const [profileForm, setProfileForm] = useState<ProfileForm>({
    first_name: user?.full_name?.split(" ")[0] ?? "",
    last_name: user?.full_name?.split(" ").slice(1).join(" ") ?? "",
    cargo: "",
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [pwForm, setPwForm] = useState<PasswordForm>({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setProfileSaving(true);
    setProfileError(null);
    setProfileSuccess(false);
    try {
      await api.patch<MeResponse>("/v1/auth/me/", {
        first_name: profileForm.first_name,
        last_name: profileForm.last_name,
        cargo: profileForm.cargo,
      });
      await restoreSession();
      setProfileSuccess(true);
      setEditMode(false);
    } catch {
      setProfileError("No se pudo guardar el perfil. Inténtalo de nuevo.");
    } finally {
      setProfileSaving(false);
    }
  }

  async function handlePasswordSave(e: React.FormEvent) {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!pwForm.current_password) errors.current_password = "Requerido";
    if (pwForm.new_password.length < 8) errors.new_password = "Mínimo 8 caracteres";
    if (pwForm.new_password !== pwForm.confirm_password)
      errors.confirm_password = "Las contraseñas no coinciden";
    if (Object.keys(errors).length) {
      setPwErrors(errors);
      return;
    }
    setPwSaving(true);
    setPwErrors({});
    setPwSuccess(false);
    try {
      await authService.changePassword({
        current_password: pwForm.current_password,
        new_password: pwForm.new_password,
      });
      setPwSuccess(true);
      setPwForm({ current_password: "", new_password: "", confirm_password: "" });
    } catch (err: unknown) {
      const apiErr = (err as { response?: { data?: { errors?: Record<string, string[]> } } })
        ?.response?.data?.errors;
      if (apiErr?.current_password) {
        setPwErrors({ current_password: apiErr.current_password[0] });
      } else {
        setPwErrors({ general: "No se pudo cambiar la contraseña." });
      }
    } finally {
      setPwSaving(false);
    }
  }

  const roleLabel: Record<string, string> = {
    ADMIN: "Administrador",
    TRAINER: "Capacitador",
    USUARIO: "Usuario",
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      {/* Profile info */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800">Mi perfil</h2>
          {!editMode && (
            <button
              type="button"
              onClick={() => setEditMode(true)}
              className="text-sm text-indigo-600 hover:underline"
            >
              Editar
            </button>
          )}
        </div>

        {!editMode ? (
          <div className="space-y-1">
            <FieldRow label="Nombre completo" value={user?.full_name ?? ""} />
            <FieldRow label="Correo electrónico" value={user?.email ?? ""} />
            <FieldRow label="Rol" value={roleLabel[user?.role ?? ""] ?? ""} />
            {profileSuccess && (
              <p className="text-xs text-green-600 pt-1">Perfil actualizado correctamente.</p>
            )}
          </div>
        ) : (
          <form onSubmit={(e) => void handleProfileSave(e)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nombre</label>
                <input
                  type="text"
                  value={profileForm.first_name}
                  onChange={(e) =>
                    setProfileForm((f) => ({ ...f, first_name: e.target.value }))
                  }
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Apellidos</label>
                <input
                  type="text"
                  value={profileForm.last_name}
                  onChange={(e) =>
                    setProfileForm((f) => ({ ...f, last_name: e.target.value }))
                  }
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Cargo</label>
              <input
                type="text"
                value={profileForm.cargo}
                onChange={(e) =>
                  setProfileForm((f) => ({ ...f, cargo: e.target.value }))
                }
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            {profileError && <p className="text-xs text-red-500">{profileError}</p>}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={profileSaving}
                className="flex-1 bg-indigo-600 text-white text-sm py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {profileSaving ? "Guardando…" : "Guardar cambios"}
              </button>
              <button
                type="button"
                onClick={() => setEditMode(false)}
                className="flex-1 border border-gray-200 text-gray-700 text-sm py-2 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Change password */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-800">Cambiar contraseña</h2>
        <form onSubmit={(e) => void handlePasswordSave(e)} className="space-y-4">
          {(["current_password", "new_password", "confirm_password"] as const).map((field) => {
            const labels: Record<string, string> = {
              current_password: "Contraseña actual",
              new_password: "Nueva contraseña",
              confirm_password: "Confirmar nueva contraseña",
            };
            return (
              <div key={field}>
                <label className="block text-xs text-gray-500 mb-1">{labels[field]}</label>
                <input
                  type="password"
                  value={pwForm[field]}
                  onChange={(e) =>
                    setPwForm((f) => ({ ...f, [field]: e.target.value }))
                  }
                  autoComplete={field === "current_password" ? "current-password" : "new-password"}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {pwErrors[field] && (
                  <p className="text-xs text-red-500 mt-1">{pwErrors[field]}</p>
                )}
              </div>
            );
          })}
          {pwErrors.general && (
            <p className="text-xs text-red-500">{pwErrors.general}</p>
          )}
          {pwSuccess && (
            <p className="text-xs text-green-600">Contraseña cambiada correctamente.</p>
          )}
          <button
            type="submit"
            disabled={pwSaving}
            className="w-full bg-indigo-600 text-white text-sm py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {pwSaving ? "Guardando…" : "Cambiar contraseña"}
          </button>
        </form>
      </div>
    </div>
  );
}
