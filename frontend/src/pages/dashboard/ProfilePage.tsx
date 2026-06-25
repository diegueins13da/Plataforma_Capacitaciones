import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuthStore } from "../../store/authStore";
import { authService } from "../../services/authService";
import api from "../../services/api";

// ── Shared styles ─────────────────────────────────────────────────────────────
const INPUT =
  "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground " +
  "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-colors";
const LABEL = "block text-xs font-medium text-muted-foreground mb-1";

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

// ── Read-only field row ───────────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2.5 border-b border-border last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground text-right">{value || "—"}</span>
    </div>
  );
}

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Administrador",
  TRAINER: "Capacitador",
  USUARIO: "Usuario",
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { user, restoreSession } = useAuthStore();

  // ── Profile edit ────────────────────────────────────────────────────────────
  const [editMode, setEditMode] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [cargo, setCargo] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setFirstName(user.first_name ?? user.full_name?.split(" ")[0] ?? "");
      setLastName(user.last_name ?? user.full_name?.split(" ").slice(1).join(" ") ?? "");
      setCargo(user.cargo ?? "");
    }
  }, [user]);

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch("/v1/auth/me/", { first_name: firstName, last_name: lastName, cargo });
      await restoreSession();
      setEditMode(false);
      toast.success("Perfil actualizado correctamente.");
    } catch {
      toast.error("No se pudo guardar el perfil.");
    } finally {
      setSaving(false);
    }
  }

  // ── Rubrica ─────────────────────────────────────────────────────────────────
  const [rubricaUrl, setRubricaUrl] = useState<string | null>(user?.rubrica_url ?? null);
  const [rubricaPreview, setRubricaPreview] = useState<string | null>(null);
  const [uploadMode, setUploadMode] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const rubricaRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRubricaUrl(user?.rubrica_url ?? null);
  }, [user?.rubrica_url]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast.error("Solo se permiten imágenes PNG, JPG o WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("La imagen no puede superar 5 MB.");
      return;
    }
    setRubricaPreview(URL.createObjectURL(file));
  }

  async function handleRubricaUpload(e: React.FormEvent) {
    e.preventDefault();
    const file = rubricaRef.current?.files?.[0];
    if (!file) { toast.error("Selecciona una imagen primero."); return; }
    setUploading(true);
    const form = new FormData();
    form.append("rubrica", file);
    try {
      const res = await api.post<{ rubrica_url: string }>("/v1/users/me/rubrica/", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setRubricaUrl(res.data.rubrica_url);
      setRubricaPreview(null);
      setUploadMode(false);
      await restoreSession();
      toast.success(rubricaUrl ? "Rúbrica reemplazada correctamente." : "Rúbrica guardada correctamente.");
    } catch {
      toast.error("No se pudo subir la rúbrica.");
    } finally {
      setUploading(false);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await api.post<{ rubrica_url: string }>("/v1/users/me/rubrica/generate/");
      setRubricaUrl(res.data.rubrica_url);
      await restoreSession();
      toast.success("Rúbrica generada automáticamente.");
    } catch {
      toast.error("No se pudo generar la rúbrica.");
    } finally {
      setGenerating(false);
    }
  }

  // ── Password ─────────────────────────────────────────────────────────────────
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});
  const [showPwCurrent, setShowPwCurrent] = useState(false);
  const [showPwNew, setShowPwNew] = useState(false);
  const [showPwConfirm, setShowPwConfirm] = useState(false);

  function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
    if (!pw) return { score: 0, label: "", color: "" };
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    if (score <= 1) return { score, label: "Débil", color: "#ef4444" };
    if (score <= 3) return { score, label: "Media", color: "#f59e0b" };
    return { score, label: "Fuerte", color: "#10b981" };
  }

  const pwStrength = getPasswordStrength(pwNew);

  async function handlePasswordSave(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!pwCurrent) errs.current = "Requerido";
    if (pwNew.length < 8) errs.new = "Mínimo 8 caracteres";
    if (pwNew !== pwConfirm) errs.confirm = "Las contraseñas no coinciden";
    if (Object.keys(errs).length) { setPwErrors(errs); return; }
    setPwSaving(true);
    setPwErrors({});
    try {
      await authService.changePassword({ current_password: pwCurrent, new_password: pwNew });
      setPwCurrent(""); setPwNew(""); setPwConfirm("");
      toast.success("Contraseña cambiada correctamente.");
    } catch (err: unknown) {
      const apiErr = (err as { response?: { data?: { errors?: Record<string, string[]> } } })
        ?.response?.data?.errors;
      if (apiErr?.current_password) {
        setPwErrors({ current: apiErr.current_password[0] });
      } else {
        toast.error("No se pudo cambiar la contraseña.");
      }
    } finally {
      setPwSaving(false);
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Mi perfil</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Información personal y configuración de cuenta</p>
      </div>

      {/* ── Info / edit ───────────────────────────────────────────────────── */}
      <Section
        title="Información personal"
        subtitle="Nombre, cargo y datos de la cuenta"
      >
        {!editMode ? (
          <>
            <div>
              <InfoRow label="Nombre completo" value={user?.full_name ?? ""} />
              <InfoRow label="Correo electrónico" value={user?.email ?? ""} />
              <InfoRow label="Rol" value={ROLE_LABEL[user?.role ?? ""] ?? ""} />
              <InfoRow label="Área" value={user?.area ?? ""} />
              <InfoRow label="Cargo" value={user?.cargo ?? ""} />
              {user?.grupo && <InfoRow label="Grupo" value={user.grupo.name} />}
            </div>
            <button
              type="button"
              onClick={() => setEditMode(true)}
              className="flex items-center gap-1.5 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              <i className="ti ti-edit text-base" aria-hidden="true" />
              Editar nombre y cargo
            </button>
          </>
        ) : (
          <form onSubmit={(e) => void handleProfileSave(e)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>Nombre</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={INPUT}
                  autoFocus
                />
              </div>
              <div>
                <label className={LABEL}>Apellidos</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={INPUT}
                />
              </div>
            </div>
            <div>
              <label className={LABEL}>Cargo</label>
              <input
                type="text"
                value={cargo}
                onChange={(e) => setCargo(e.target.value)}
                placeholder="Ej. Analista de Riesgos"
                className={INPUT}
              />
            </div>
            <p className="text-xs text-muted-foreground/60">
              El correo, rol y área son gestionados por el administrador.
            </p>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-indigo-600 text-white text-sm py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
              >
                {saving ? (
                  <><div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Guardando…</>
                ) : (
                  <><i className="ti ti-device-floppy text-sm" aria-hidden="true" />Guardar cambios</>
                )}
              </button>
              <button
                type="button"
                onClick={() => { setEditMode(false); if (user) { setFirstName(user.first_name ?? ""); setLastName(user.last_name ?? ""); setCargo(user.cargo ?? ""); } }}
                className="px-4 py-2 border border-border text-muted-foreground text-sm rounded-lg hover:bg-background transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </Section>

      {/* ── Rubrica — TRAINER only ────────────────────────────────────────── */}
      {user?.role === "TRAINER" && (
        <Section
          title="Rúbrica (firma)"
          subtitle="Aparece en los certificados de los cursos que impartas"
        >
          {/* Current rubrica preview */}
          {rubricaUrl && !uploadMode && (
            <div className="flex flex-col items-center gap-3 p-4 bg-background border border-border rounded-xl">
              <img
                src={rubricaUrl}
                alt="Rúbrica actual"
                className="max-h-24 max-w-full object-contain"
              />
              <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                <i className="ti ti-circle-check" aria-hidden="true" />
                Rúbrica registrada
              </div>
            </div>
          )}

          {/* No rubrica yet */}
          {!rubricaUrl && !uploadMode && (
            <div className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-border rounded-xl text-center">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <i className="ti ti-writing text-amber-400 text-xl" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Sin rúbrica registrada</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Sube tu propia imagen o genera una automáticamente
                </p>
              </div>
            </div>
          )}

          {/* Action buttons when not in upload mode */}
          {!uploadMode && (
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setUploadMode(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <i className="ti ti-upload text-sm" aria-hidden="true" />
                {rubricaUrl ? "Reemplazar rúbrica" : "Subir rúbrica"}
              </button>

              {/* Generate button — only active when no rubrica exists */}
              <button
                type="button"
                disabled={generating}
                onClick={() => {
                  if (rubricaUrl) {
                    toast.info("Ya tienes una rúbrica registrada. Usa 'Reemplazar rúbrica' para cambiarla.", { duration: 4000 });
                    return;
                  }
                  void handleGenerate();
                }}
                className={`flex items-center gap-1.5 px-4 py-2 border text-sm rounded-lg transition-colors disabled:opacity-50 ${
                  rubricaUrl
                    ? "border-border/40 text-muted-foreground/40 cursor-not-allowed"
                    : "border-border text-muted-foreground hover:bg-background cursor-pointer"
                }`}
              >
                {generating ? (
                  <div className="w-4 h-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                ) : (
                  <i className="ti ti-wand text-sm" aria-hidden="true" />
                )}
                Generar automáticamente
              </button>
            </div>
          )}

          {/* Upload form */}
          {uploadMode && (
            <form onSubmit={(e) => void handleRubricaUpload(e)} className="space-y-3">
              <div
                className="border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center gap-2 cursor-pointer hover:border-indigo-500/50 transition-colors"
                onClick={() => rubricaRef.current?.click()}
              >
                {rubricaPreview ? (
                  <img src={rubricaPreview} alt="Vista previa" className="max-h-20 max-w-full object-contain" />
                ) : (
                  <>
                    <i className="ti ti-photo-up text-3xl text-muted-foreground/50" aria-hidden="true" />
                    <p className="text-sm text-muted-foreground">Clic para seleccionar imagen</p>
                    <p className="text-xs text-muted-foreground/60">PNG, JPG o WebP — máx. 5 MB</p>
                  </>
                )}
              </div>
              <input
                ref={rubricaRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={uploading || !rubricaPreview}
                  className="flex-1 bg-indigo-600 text-white text-sm py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                >
                  {uploading ? (
                    <><div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Subiendo…</>
                  ) : (
                    <><i className="ti ti-upload text-sm" aria-hidden="true" />Subir rúbrica</>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => { setUploadMode(false); setRubricaPreview(null); }}
                  className="px-4 py-2 border border-border text-muted-foreground text-sm rounded-lg hover:bg-background transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </Section>
      )}

      {/* ── Change password ───────────────────────────────────────────────── */}
      <Section title="Cambiar contraseña">
        <form onSubmit={(e) => void handlePasswordSave(e)} className="space-y-3">
          <div>
            <label className={LABEL}>Contraseña actual</label>
            <div className="relative">
              <input
                type={showPwCurrent ? "text" : "password"}
                value={pwCurrent}
                onChange={(e) => setPwCurrent(e.target.value)}
                autoComplete="current-password"
                className={INPUT}
              />
              <button
                type="button"
                onClick={() => setShowPwCurrent((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
                aria-label={showPwCurrent ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                <i className={`ti ${showPwCurrent ? "ti-eye-off" : "ti-eye"} text-sm`} aria-hidden="true" />
              </button>
            </div>
            {pwErrors.current && <p className="text-xs text-red-400 mt-1">{pwErrors.current}</p>}
          </div>
          <div>
            <label className={LABEL}>Nueva contraseña</label>
            <div className="relative">
              <input
                type={showPwNew ? "text" : "password"}
                value={pwNew}
                onChange={(e) => setPwNew(e.target.value)}
                autoComplete="new-password"
                className={INPUT}
              />
              <button
                type="button"
                onClick={() => setShowPwNew((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
                aria-label={showPwNew ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                <i className={`ti ${showPwNew ? "ti-eye-off" : "ti-eye"} text-sm`} aria-hidden="true" />
              </button>
            </div>
            {pwNew && (
              <div className="mt-1.5 space-y-1">
                <div className="flex gap-1 h-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-full transition-colors duration-300"
                      style={{ background: i <= pwStrength.score ? pwStrength.color : "rgba(255,255,255,0.08)" }}
                    />
                  ))}
                </div>
                <p className="text-[11px]" style={{ color: pwStrength.color }}>
                  {pwStrength.label}
                </p>
              </div>
            )}
            {pwErrors.new && <p className="text-xs text-red-400 mt-1">{pwErrors.new}</p>}
          </div>
          <div>
            <label className={LABEL}>Confirmar nueva contraseña</label>
            <div className="relative">
              <input
                type={showPwConfirm ? "text" : "password"}
                value={pwConfirm}
                onChange={(e) => setPwConfirm(e.target.value)}
                autoComplete="new-password"
                className={INPUT}
              />
              <button
                type="button"
                onClick={() => setShowPwConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
                aria-label={showPwConfirm ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                <i className={`ti ${showPwConfirm ? "ti-eye-off" : "ti-eye"} text-sm`} aria-hidden="true" />
              </button>
            </div>
            {pwErrors.confirm && <p className="text-xs text-red-400 mt-1">{pwErrors.confirm}</p>}
          </div>
          <button
            type="submit"
            disabled={pwSaving}
            className="w-full bg-indigo-600 text-white text-sm py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
          >
            {pwSaving ? (
              <><div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Guardando…</>
            ) : (
              <><i className="ti ti-lock text-sm" aria-hidden="true" />Cambiar contraseña</>
            )}
          </button>
        </form>
      </Section>
    </div>
  );
}
