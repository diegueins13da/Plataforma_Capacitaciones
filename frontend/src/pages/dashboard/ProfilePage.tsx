import { useRef, useState } from "react";
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
    <div className="flex justify-between py-2 border-b border-border">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value || "—"}</span>
    </div>
  );
}

type RubricaStatus = "idle" | "uploading" | "done" | "already_set" | "error";

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

  const [rubricaStatus, setRubricaStatus] = useState<RubricaStatus>("idle");
  const [rubricaError, setRubricaError] = useState<string | null>(null);
  const [rubricaPreview, setRubricaPreview] = useState<string | null>(null);
  const rubricaInputRef = useRef<HTMLInputElement>(null);

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

  function handleRubricaFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ["image/png", "image/jpeg", "image/webp"];
    if (!allowed.includes(file.type)) {
      setRubricaError("Solo se permiten imágenes PNG, JPG o WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setRubricaError("La imagen no puede superar 5 MB.");
      return;
    }
    setRubricaError(null);
    setRubricaPreview(URL.createObjectURL(file));
  }

  async function handleRubricaUpload(e: React.FormEvent) {
    e.preventDefault();
    const file = rubricaInputRef.current?.files?.[0];
    if (!file) {
      setRubricaError("Selecciona una imagen primero.");
      return;
    }
    setRubricaStatus("uploading");
    setRubricaError(null);
    const formData = new FormData();
    formData.append("rubrica", file);
    try {
      await api.post("/v1/users/me/rubrica/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setRubricaStatus("done");
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 400) {
        setRubricaStatus("already_set");
      } else {
        setRubricaStatus("error");
        setRubricaError("No se pudo subir la rúbrica. Inténtalo de nuevo.");
      }
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
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Mi perfil</h2>
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
              <p className="text-xs text-emerald-500 pt-1">Perfil actualizado correctamente.</p>
            )}
          </div>
        ) : (
          <form onSubmit={(e) => void handleProfileSave(e)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Nombre</label>
                <input
                  type="text"
                  value={profileForm.first_name}
                  onChange={(e) =>
                    setProfileForm((f) => ({ ...f, first_name: e.target.value }))
                  }
                  className="w-full border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-300"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Apellidos</label>
                <input
                  type="text"
                  value={profileForm.last_name}
                  onChange={(e) =>
                    setProfileForm((f) => ({ ...f, last_name: e.target.value }))
                  }
                  className="w-full border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-300"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Cargo</label>
              <input
                type="text"
                value={profileForm.cargo}
                onChange={(e) =>
                  setProfileForm((f) => ({ ...f, cargo: e.target.value }))
                }
                className="w-full border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-300"
              />
            </div>
            {profileError && <p className="text-xs text-red-500">{profileError}</p>}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={profileSaving}
                className="flex-1 bg-indigo-600 text-white text-sm py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all duration-300"
              >
                {profileSaving ? "Guardando…" : "Guardar cambios"}
              </button>
              <button
                type="button"
                onClick={() => setEditMode(false)}
                className="flex-1 border border-border text-foreground text-sm py-2 rounded-lg hover:bg-background"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Rubrica upload — TRAINER only */}
      {user?.role === "TRAINER" && (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Mi rúbrica (firma)</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              La rúbrica aparecerá en los certificados de los cursos que impartas.
              Una vez subida no puede modificarse.
            </p>
          </div>

          {rubricaStatus === "done" || rubricaStatus === "already_set" ? (
            <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
              <i className="ti ti-circle-check text-emerald-400 text-xl" aria-hidden="true" />
              <p className="text-sm text-emerald-400">
                {rubricaStatus === "done"
                  ? "Rúbrica subida correctamente. Ya no se puede reemplazar."
                  : "Ya tienes una rúbrica registrada. Solo puede subirse una vez."}
              </p>
            </div>
          ) : (
            <form onSubmit={(e) => void handleRubricaUpload(e)} className="space-y-4">
              <div
                className="border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-indigo-300 transition-colors"
                onClick={() => rubricaInputRef.current?.click()}
                style={{ cursor: "pointer" }}
              >
                {rubricaPreview ? (
                  <img
                    src={rubricaPreview}
                    alt="Vista previa de rúbrica"
                    className="max-h-24 max-w-full object-contain"
                  />
                ) : (
                  <>
                    <i className="ti ti-upload text-3xl text-muted-foreground" aria-hidden="true" />
                    <p className="text-sm text-muted-foreground">
                      Haz clic para seleccionar una imagen
                    </p>
                    <p className="text-xs text-muted-foreground">PNG, JPG o WebP — máx. 5 MB</p>
                  </>
                )}
              </div>
              <input
                ref={rubricaInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleRubricaFileChange}
              />
              {rubricaError && (
                <p className="text-xs text-red-500">{rubricaError}</p>
              )}
              <button
                type="submit"
                disabled={rubricaStatus === "uploading" || !rubricaPreview}
                className="w-full bg-indigo-600 text-white text-sm py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2"
              >
                {rubricaStatus === "uploading" ? (
                  <>
                    <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Subiendo…
                  </>
                ) : (
                  <>
                    <i className="ti ti-upload text-sm" aria-hidden="true" />
                    Subir rúbrica
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Change password */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <h2 className="text-base font-semibold text-foreground">Cambiar contraseña</h2>
        <form onSubmit={(e) => void handlePasswordSave(e)} className="space-y-4">
          {(["current_password", "new_password", "confirm_password"] as const).map((field) => {
            const labels: Record<string, string> = {
              current_password: "Contraseña actual",
              new_password: "Nueva contraseña",
              confirm_password: "Confirmar nueva contraseña",
            };
            return (
              <div key={field}>
                <label className="block text-xs text-muted-foreground mb-1">{labels[field]}</label>
                <input
                  type="password"
                  value={pwForm[field]}
                  onChange={(e) =>
                    setPwForm((f) => ({ ...f, [field]: e.target.value }))
                  }
                  autoComplete={field === "current_password" ? "current-password" : "new-password"}
                  className="w-full border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-300"
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
            <p className="text-xs text-emerald-500">Contraseña cambiada correctamente.</p>
          )}
          <button
            type="submit"
            disabled={pwSaving}
            className="w-full bg-indigo-600 text-white text-sm py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all duration-300"
          >
            {pwSaving ? "Guardando…" : "Cambiar contraseña"}
          </button>
        </form>
      </div>
    </div>
  );
}
