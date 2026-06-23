/**
 * P50 — System Configuration Panel
 *
 * Tabbed admin panel for:
 *   - SMTP (email delivery)
 *   - Branding (company identity)
 *   - Security (password policy)
 *   - Notifications (email toggles)
 *   - Areas (organizational area catalog)
 */
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { configService } from "../../../services/configService";
import { usersService } from "../../../services/usersService";
import type { Area } from "../../../types/area";
import type { Cargo } from "../../../types/cargo";
import type { GroupedSettings, SettingCategory, SystemSetting } from "../../../types/config";
import type { Group } from "../../../types/groups";

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

type TabKey = SettingCategory | "CATALOGO";
type CatalogoSubTab = "areas" | "grupos" | "cargos";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "SMTP", label: "Correo electrónico", icon: "📧" },
  { key: "BRANDING", label: "Identidad visual", icon: "🎨" },
  { key: "SEGURIDAD", label: "Seguridad", icon: "🔒" },
  { key: "NOTIF", label: "Notificaciones", icon: "🔔" },
  { key: "CATALOGO", label: "Catálogo", icon: "🏢" },
];

const CATALOGO_SUBTABS: { key: CatalogoSubTab; label: string; icon: string }[] = [
  { key: "areas",  label: "Áreas",  icon: "ti-building" },
  { key: "grupos", label: "Grupos", icon: "ti-users-group" },
  { key: "cargos", label: "Cargos", icon: "ti-briefcase" },
];

// ---------------------------------------------------------------------------
// SettingRow — a single editable setting
// ---------------------------------------------------------------------------

interface SettingRowProps {
  setting: SystemSetting;
  onSave: (clave: string, valor: string) => Promise<void>;
}

function SettingRow({ setting, onSave }: SettingRowProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(setting.valor);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(setting.clave, value);
      setEditing(false);
      toast.success(`${setting.descripcion || setting.clave} actualizado.`);
    } catch {
      toast.error("No se pudo guardar el valor.");
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "h-9 rounded-lg border border-slate-700 bg-background px-3 text-sm text-foreground focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-300";

  return (
    <div className="flex items-start gap-4 py-4 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground">{setting.descripcion || setting.clave}</p>
          {setting.es_sensible && (
            <span className="text-xs bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20">
              sensible
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground font-mono mt-0.5">{setting.clave}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {editing ? (
          <>
            {setting.tipo_dato === "BOOLEAN" ? (
              <select
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className={inputCls}
                autoFocus
              >
                <option value="true">Activado</option>
                <option value="false">Desactivado</option>
              </select>
            ) : (
              <input
                type={setting.es_sensible ? "password" : "text"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className={`${inputCls} w-48`}
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && void handleSave()}
              />
            )}
            <button
              onClick={() => void handleSave()}
              disabled={saving}
              className="h-9 px-3 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 disabled:opacity-50 shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all duration-300"
            >
              {saving ? "..." : "Guardar"}
            </button>
            <button
              onClick={() => { setEditing(false); setValue(setting.valor); }}
              className="h-9 px-3 border border-border text-muted-foreground text-xs rounded-lg hover:bg-accent/50"
            >
              Cancelar
            </button>
          </>
        ) : (
          <>
            <span className="text-sm text-muted-foreground font-mono">
              {setting.tipo_dato === "BOOLEAN"
                ? setting.valor === "true"
                  ? <span className="text-emerald-400">✓ Activado</span>
                  : <span className="text-muted-foreground">✗ Desactivado</span>
                : setting.es_sensible
                ? (setting.valor ? "••••••" : "(vacío)")
                : setting.valor || "(vacío)"}
            </span>
            <button
              onClick={() => setEditing(true)}
              className="h-8 px-3 border border-border text-muted-foreground text-xs rounded-lg hover:text-foreground hover:bg-accent/50"
            >
              Editar
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ColorSettingRow — PRIMARY_COLOR with live swatch + HEX validation
// ---------------------------------------------------------------------------

function ColorSettingRow({ setting, onSave }: SettingRowProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(setting.valor);
  const [saving, setSaving] = useState(false);

  const isValidHex = (v: string) => /^#[0-9A-Fa-f]{6}$/.test(v);

  async function handleSave() {
    if (!isValidHex(value)) {
      toast.error("El color debe ser un HEX válido (ej: #4f46e5).");
      return;
    }
    setSaving(true);
    try {
      await onSave(setting.clave, value);
      setEditing(false);
      toast.success("Color primario actualizado.");
    } catch {
      toast.error("No se pudo guardar el color.");
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "h-9 rounded-lg border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all duration-300 w-36";

  return (
    <div className="flex items-start gap-4 py-4 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{setting.descripcion || setting.clave}</p>
        <p className="text-xs text-muted-foreground font-mono mt-0.5">{setting.clave}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {editing ? (
          <>
            <div
              className="w-7 h-7 rounded-md border border-slate-700 shrink-0 transition-all duration-150"
              style={{ background: isValidHex(value) ? value : "#1e293b" }}
            />
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
              placeholder="#4f46e5"
              onKeyDown={(e) => e.key === "Enter" && void handleSave()}
              className={`${inputCls} ${
                value && !isValidHex(value)
                  ? "border-red-500 focus:ring-red-500/20"
                  : "border-slate-700 focus:border-indigo-500"
              }`}
            />
            <button
              onClick={() => void handleSave()}
              disabled={saving || !isValidHex(value)}
              className="h-9 px-3 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 disabled:opacity-50 shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all duration-300"
            >
              {saving ? "..." : "Guardar"}
            </button>
            <button
              onClick={() => { setEditing(false); setValue(setting.valor); }}
              className="h-9 px-3 border border-border text-muted-foreground text-xs rounded-lg hover:bg-accent/50"
            >
              Cancelar
            </button>
          </>
        ) : (
          <>
            <div
              className="w-5 h-5 rounded border border-slate-700"
              style={{ background: isValidHex(setting.valor) ? setting.valor : "#1e293b" }}
              title={setting.valor}
            />
            <span className="text-sm text-muted-foreground font-mono">{setting.valor || "(vacío)"}</span>
            <button
              onClick={() => setEditing(true)}
              className="h-8 px-3 border border-border text-muted-foreground text-xs rounded-lg hover:text-foreground hover:bg-accent/50"
            >
              Editar
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LogoSettingRow — LOGO_URL with debounced image preview
// ---------------------------------------------------------------------------

function LogoSettingRow({ setting, onSave }: SettingRowProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(setting.valor);
  const [saving, setSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(setting.valor);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (!editing) return;
    setImgError(false);
    const t = setTimeout(() => setPreviewUrl(value), 800);
    return () => clearTimeout(t);
  }, [value, editing]);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(setting.clave, value);
      setEditing(false);
      toast.success("Logo actualizado.");
    } catch {
      toast.error("No se pudo guardar el logo.");
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "h-9 rounded-lg border border-slate-700 bg-background px-3 text-sm text-foreground focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-300";

  return (
    <div className="py-4 border-b border-border last:border-0">
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{setting.descripcion || setting.clave}</p>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">{setting.clave}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {editing ? (
            <>
              <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoFocus
                placeholder="https://..."
                onKeyDown={(e) => e.key === "Enter" && void handleSave()}
                className={`${inputCls} w-56`}
              />
              <button
                onClick={() => void handleSave()}
                disabled={saving}
                className="h-9 px-3 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 disabled:opacity-50 shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all duration-300"
              >
                {saving ? "..." : "Guardar"}
              </button>
              <button
                onClick={() => { setEditing(false); setValue(setting.valor); setPreviewUrl(setting.valor); }}
                className="h-9 px-3 border border-border text-muted-foreground text-xs rounded-lg hover:bg-accent/50"
              >
                Cancelar
              </button>
            </>
          ) : (
            <>
              {setting.valor && !imgError ? (
                <img
                  src={setting.valor}
                  alt="logo"
                  className="h-8 w-auto max-w-[80px] object-contain rounded"
                  onError={() => setImgError(true)}
                />
              ) : null}
              <span className="text-sm text-muted-foreground font-mono max-w-[160px] truncate">
                {setting.valor || "(vacío)"}
              </span>
              <button
                onClick={() => setEditing(true)}
                className="h-8 px-3 border border-border text-muted-foreground text-xs rounded-lg hover:text-foreground hover:bg-accent/50"
              >
                Editar
              </button>
            </>
          )}
        </div>
      </div>

      {/* Live preview while editing */}
      {editing && previewUrl && (
        <div className="mt-3 ml-0 flex items-center gap-3 p-3 bg-slate-800/40 rounded-lg border border-slate-700/50">
          <p className="text-xs text-muted-foreground shrink-0">Vista previa:</p>
          {imgError ? (
            <div className="flex items-center gap-1.5 text-xs text-amber-400">
              <i className="ti ti-photo-off text-sm" />
              No se pudo cargar la imagen
            </div>
          ) : (
            <img
              src={previewUrl}
              alt="preview"
              className="h-12 w-auto max-w-[200px] object-contain rounded"
              onError={() => setImgError(true)}
              onLoad={() => setImgError(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// GroupFormModal — create / edit a group
// ---------------------------------------------------------------------------

interface GroupFormModalProps {
  group?: Group;
  onClose: () => void;
  onSaved: (g: Group) => void;
}

function GroupFormModal({ group, onClose, onSaved }: GroupFormModalProps) {
  const isEdit = Boolean(group);
  const [nombre, setNombre] = useState(group?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(group?.descripcion ?? "");
  const [activo, setActivo] = useState(group?.activo ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) { setError("El nombre es obligatorio."); return; }
    setSaving(true);
    setError(null);
    try {
      const payload = { nombre: nombre.trim(), descripcion: descripcion.trim(), activo };
      const saved = isEdit
        ? await usersService.updateGroup(group!.id, payload)
        : await usersService.createGroup(payload);
      onSaved(saved);
      toast.success(isEdit ? "Grupo actualizado." : "Grupo creado.");
    } catch {
      setError("No se pudo guardar. Verifica que el nombre no esté duplicado.");
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full h-9 rounded-lg border border-slate-700 bg-background px-3 text-sm text-foreground focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-300";

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 w-full max-w-md rounded-xl p-6 shadow-xl border border-slate-800">
        <h2 className="mb-4 text-lg font-semibold">{isEdit ? "Editar grupo" : "Nuevo grupo"}</h2>
        {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Nombre</label>
            <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputCls} autoFocus />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Descripción</label>
            <textarea rows={3} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-background px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-300" />
          </div>
          {isEdit && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
              Grupo activo
            </label>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-accent/50">Cancelar</button>
            <button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50 shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all duration-300">
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GruposTab
// ---------------------------------------------------------------------------

function GruposTab() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [formModal, setFormModal] = useState<{ open: boolean; group?: Group }>({ open: false });
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

  useEffect(() => { void loadGroups(); }, [loadGroups]);

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
        setDeleteError("No se puede eliminar un grupo con miembros activos. Quita todos los miembros primero.");
      } else {
        toast.error("No se pudo eliminar el grupo.");
      }
    }
  };

  const handleToggle = async (group: Group) => {
    try {
      const updated = await usersService.updateGroup(group.id, { activo: !group.activo });
      setGroups((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
      toast.success(`Grupo ${group.activo ? "desactivado" : "activado"}.`);
    } catch {
      toast.error("No se pudo actualizar el grupo.");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          Organiza usuarios en grupos para asignarles cursos.
        </p>
        <button
          onClick={() => setFormModal({ open: true })}
          className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all duration-300"
        >
          + Nuevo grupo
        </button>
      </div>

      {deleteError && (
        <div role="alert" className="mb-4 bg-red-500/10 text-red-400 rounded-lg border border-red-500/20 px-4 py-3 text-sm">
          {deleteError}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No hay grupos creados. Crea el primero para poder asignar usuarios.
        </div>
      ) : (
        <div className="divide-y divide-border">
          {groups.map((g) => (
            <div key={g.id} className="flex items-center gap-4 py-3">
              <div className="flex-1 min-w-0">
                <span className={`text-sm font-medium ${g.activo ? "text-foreground" : "text-muted-foreground line-through"}`}>
                  {g.nombre}
                </span>
                {g.descripcion && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{g.descripcion}</p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                <span>{g.member_count} miembro(s)</span>
                <span
                  className={`px-2 py-0.5 rounded-full ${g.activo ? "bg-emerald-500/10 text-emerald-400" : "bg-muted/40 text-muted-foreground"}`}
                >
                  {g.activo ? "Activo" : "Inactivo"}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  to="/admin/groups"
                  className="text-xs text-indigo-400 hover:underline"
                >
                  Miembros
                </Link>
                <button onClick={() => setFormModal({ open: true, group: g })} className="text-xs text-indigo-400 hover:underline">
                  Editar
                </button>
                <button onClick={() => void handleToggle(g)} className="text-xs text-muted-foreground hover:text-foreground hover:underline">
                  {g.activo ? "Desactivar" : "Activar"}
                </button>
                <button
                  onClick={() => void handleDelete(g)}
                  disabled={g.member_count > 0}
                  className="text-xs text-red-400 hover:underline disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Para gestionar miembros de un grupo, usa la{" "}
        <Link to="/admin/groups" className="text-indigo-400 hover:underline">
          página dedicada de grupos
        </Link>
        .
      </p>

      {formModal.open && (
        <GroupFormModal
          group={formModal.group}
          onClose={() => setFormModal({ open: false })}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CargosTab
// ---------------------------------------------------------------------------

interface CargosTabProps { areas: Area[] }

function CargosTab({ areas }: CargosTabProps) {
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [loading, setLoading] = useState(true);
  const [areaFilter, setAreaFilter] = useState<number | "">("");
  const [creating, setCreating] = useState(false);
  const [newNombre, setNewNombre] = useState("");
  const [newArea, setNewArea] = useState<number | "">("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editArea, setEditArea] = useState<number | "">("");

  const loadCargos = useCallback(async () => {
    setLoading(true);
    try {
      const data = await configService.getCargos(areaFilter || undefined);
      setCargos(data);
    } catch {
      toast.error("No se pudieron cargar los cargos.");
    } finally {
      setLoading(false);
    }
  }, [areaFilter]);

  useEffect(() => { void loadCargos(); }, [loadCargos]);

  async function handleCreate() {
    if (!newNombre.trim()) return;
    setSaving(true);
    try {
      const created = await configService.createCargo({
        nombre: newNombre.trim(),
        area: newArea || null,
      });
      setCargos((prev) => [...prev, created].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setNewNombre("");
      setNewArea("");
      setCreating(false);
      toast.success("Cargo creado.");
    } catch {
      toast.error("No se pudo crear el cargo. Verifica que no esté duplicado en esa área.");
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit(id: number) {
    if (!editNombre.trim()) return;
    try {
      const updated = await configService.updateCargo(id, { nombre: editNombre.trim(), area: editArea || null });
      setCargos((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setEditingId(null);
      toast.success("Cargo actualizado.");
    } catch {
      toast.error("No se pudo actualizar el cargo.");
    }
  }

  async function handleToggle(cargo: Cargo) {
    try {
      const updated = await configService.updateCargo(cargo.id, { activo: !cargo.activo });
      setCargos((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      toast.success(`Cargo ${cargo.activo ? "desactivado" : "activado"}.`);
    } catch {
      toast.error("No se pudo actualizar el cargo.");
    }
  }

  async function handleDelete(cargo: Cargo) {
    try {
      await configService.deleteCargo(cargo.id);
      setCargos((prev) => prev.filter((c) => c.id !== cargo.id));
      toast.success("Cargo eliminado.");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { errors?: string[] } } })?.response?.data?.errors?.[0];
      toast.error(msg ?? "No se pudo eliminar el cargo.");
    }
  }

  const inputCls = "h-9 rounded-lg border border-slate-700 bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-300";
  const selectCls = `${inputCls} appearance-none`;

  return (
    <div>
      {/* Header + filter */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">Define los cargos de cada área.</p>
          <select
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value ? Number(e.target.value) : "")}
            className={`${selectCls} w-44`}
          >
            <option value="">Todas las áreas</option>
            {areas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all duration-300 shrink-0"
        >
          + Nuevo cargo
        </button>
      </div>

      {/* Create form */}
      {creating && (
        <div className="flex flex-col gap-2 mb-4 p-4 bg-indigo-500/5 border border-indigo-500/30 rounded-lg">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Nombre del cargo *"
              value={newNombre}
              onChange={(e) => setNewNombre(e.target.value)}
              className={`${inputCls} flex-1`}
              autoFocus
              maxLength={100}
            />
            <select
              value={newArea}
              onChange={(e) => setNewArea(e.target.value ? Number(e.target.value) : "")}
              className={`${selectCls} w-44`}
            >
              <option value="">Sin área</option>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => void handleCreate()}
              disabled={saving || !newNombre.trim()}
              className="h-9 px-4 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all duration-300"
            >
              {saving ? "Creando..." : "Crear"}
            </button>
            <button
              onClick={() => { setCreating(false); setNewNombre(""); setNewArea(""); }}
              className="h-9 px-4 border border-border text-muted-foreground text-sm rounded-lg hover:bg-accent/50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        </div>
      ) : cargos.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No hay cargos definidos{areaFilter ? " para esta área" : ""}. Crea el primero.
        </div>
      ) : (
        <div className="divide-y divide-border">
          {cargos.map((cargo) => (
            <div key={cargo.id} className="py-3">
              {editingId === cargo.id ? (
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={editNombre}
                    onChange={(e) => setEditNombre(e.target.value)}
                    className={`${inputCls} flex-1`}
                    autoFocus
                    maxLength={100}
                  />
                  <select
                    value={editArea}
                    onChange={(e) => setEditArea(e.target.value ? Number(e.target.value) : "")}
                    className={`${selectCls} w-40`}
                  >
                    <option value="">Sin área</option>
                    {areas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                  </select>
                  <button onClick={() => void handleEdit(cargo.id)} className="h-8 px-3 bg-indigo-600 text-white text-xs rounded-lg shadow-lg shadow-indigo-500/20 shrink-0">Guardar</button>
                  <button onClick={() => setEditingId(null)} className="h-8 px-3 border border-border text-muted-foreground text-xs rounded-lg shrink-0">Cancelar</button>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-medium ${cargo.activo ? "text-foreground" : "text-muted-foreground line-through"}`}>
                      {cargo.nombre}
                    </span>
                    {cargo.area_nombre && (
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-indigo-500/10 text-indigo-400">
                        {cargo.area_nombre}
                      </span>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${cargo.activo ? "bg-emerald-500/10 text-emerald-400" : "bg-muted/40 text-muted-foreground"}`}>
                    {cargo.activo ? "Activo" : "Inactivo"}
                  </span>
                  <button
                    onClick={() => { setEditingId(cargo.id); setEditNombre(cargo.nombre); setEditArea(cargo.area ?? ""); }}
                    className="text-xs text-indigo-400 hover:underline shrink-0"
                  >
                    Editar
                  </button>
                  <button onClick={() => void handleToggle(cargo)} className="text-xs text-muted-foreground hover:text-foreground hover:underline shrink-0">
                    {cargo.activo ? "Desactivar" : "Activar"}
                  </button>
                  <button
                    onClick={() => void handleDelete(cargo)}
                    className="text-xs text-red-400 hover:underline shrink-0"
                  >
                    Eliminar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AreasTab
// ---------------------------------------------------------------------------

interface AreasTabProps {
  areas: Area[];
  onRefresh: () => void;
}

function AreasTab({ areas, onRefresh }: AreasTabProps) {
  const [creating, setCreating] = useState(false);
  const [newNombre, setNewNombre] = useState("");
  const [newDescripcion, setNewDescripcion] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editDescripcion, setEditDescripcion] = useState("");

  const inputCls =
    "w-full h-9 rounded-lg border border-slate-700 bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-300";

  async function handleCreate() {
    if (!newNombre.trim()) return;
    setSaving(true);
    try {
      await configService.createArea({ nombre: newNombre.trim(), descripcion: newDescripcion.trim() });
      setNewNombre("");
      setNewDescripcion("");
      setCreating(false);
      onRefresh();
      toast.success("Área creada.");
    } catch {
      toast.error("No se pudo crear el área.");
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit(id: number) {
    if (!editNombre.trim()) return;
    try {
      await configService.updateArea(id, { nombre: editNombre.trim(), descripcion: editDescripcion.trim() });
      setEditingId(null);
      onRefresh();
      toast.success("Área actualizada.");
    } catch {
      toast.error("No se pudo actualizar el área.");
    }
  }

  async function handleToggle(area: Area) {
    try {
      await configService.updateArea(area.id, { activo: !area.activo });
      onRefresh();
      toast.success(`Área ${area.activo ? "desactivada" : "activada"}.`);
    } catch {
      toast.error("No se pudo actualizar el área.");
    }
  }

  async function handleDelete(area: Area) {
    if (area.user_count > 0) {
      toast.error(`No se puede eliminar: tiene ${area.user_count} usuario(s) asignado(s).`);
      return;
    }
    try {
      await configService.deleteArea(area.id);
      onRefresh();
      toast.success("Área eliminada.");
    } catch {
      toast.error("No se pudo eliminar el área.");
    }
  }

  function startEdit(area: Area) {
    setEditingId(area.id);
    setEditNombre(area.nombre);
    setEditDescripcion(area.descripcion ?? "");
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          Define las áreas de tu organización (TI, Riesgos, Cumplimiento, etc.).
        </p>
        <button
          onClick={() => setCreating(true)}
          className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all duration-300"
        >
          + Nueva área
        </button>
      </div>

      {creating && (
        <div className="flex flex-col gap-2 mb-4 p-4 bg-indigo-500/5 border border-indigo-500/30 rounded-lg">
          <input
            type="text"
            placeholder="Nombre del área *"
            value={newNombre}
            onChange={(e) => setNewNombre(e.target.value)}
            className={inputCls}
            autoFocus
            maxLength={150}
          />
          <input
            type="text"
            placeholder="Descripción (opcional, máx. 200 caracteres)"
            value={newDescripcion}
            onChange={(e) => setNewDescripcion(e.target.value)}
            className={inputCls}
            maxLength={200}
          />
          <p className="text-xs text-muted-foreground text-right">{newDescripcion.length}/200</p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => void handleCreate()}
              disabled={saving || !newNombre.trim()}
              className="h-9 px-4 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all duration-300"
            >
              {saving ? "Creando..." : "Crear"}
            </button>
            <button
              onClick={() => { setCreating(false); setNewNombre(""); setNewDescripcion(""); }}
              className="h-9 px-4 border border-border text-muted-foreground text-sm rounded-lg hover:bg-accent/50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {areas.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No hay áreas definidas. Crea la primera para poder asignar usuarios.
        </div>
      ) : (
        <div className="divide-y divide-border">
          {areas.map((area) => (
            <div key={area.id} className="py-3">
              {editingId === area.id ? (
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={editNombre}
                    onChange={(e) => setEditNombre(e.target.value)}
                    className={inputCls}
                    autoFocus
                    maxLength={150}
                  />
                  <input
                    type="text"
                    value={editDescripcion}
                    onChange={(e) => setEditDescripcion(e.target.value)}
                    placeholder="Descripción (opcional)"
                    className={inputCls}
                    maxLength={200}
                  />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => void handleEdit(area.id)} className="h-8 px-3 bg-indigo-600 text-white text-xs rounded-lg shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all duration-300">Guardar</button>
                    <button onClick={() => setEditingId(null)} className="h-8 px-3 border border-border text-muted-foreground text-xs rounded-lg hover:bg-accent/50">Cancelar</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${area.activo ? "text-foreground" : "text-muted-foreground line-through"}`}>
                        {area.nombre}
                      </span>
                      {area.user_count > 0 && (
                        <span className="text-xs text-muted-foreground">{area.user_count} usuario(s)</span>
                      )}
                    </div>
                    {area.descripcion && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{area.descripcion}</p>
                    )}
                  </div>
                  <button onClick={() => startEdit(area)} className="text-xs text-indigo-400 hover:underline shrink-0">Editar</button>
                  <button onClick={() => void handleToggle(area)} className="text-xs text-muted-foreground hover:text-foreground hover:underline shrink-0">
                    {area.activo ? "Desactivar" : "Activar"}
                  </button>
                  <button
                    onClick={() => void handleDelete(area)}
                    disabled={area.user_count > 0}
                    className="text-xs text-red-400 hover:underline disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                  >
                    Eliminar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface TestEmailResult {
  ok: boolean;
  message: string;
  config: Record<string, unknown>;
}

export default function SystemConfigPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("SMTP");
  const [catalogoSubTab, setCatalogoSubTab] = useState<CatalogoSubTab>("areas");
  const [settings, setSettings] = useState<GroupedSettings | null>(null);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);

  // Test email state
  const [testRecipient, setTestRecipient] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestEmailResult | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const [settingsData, areasData] = await Promise.all([
        configService.getSettings(),
        configService.getAreas(),
      ]);
      setSettings(settingsData);
      setAreas(areasData);
    } catch {
      toast.error("No se pudo cargar la configuración.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadData(); }, []);

  async function handleTestEmail() {
    if (!testRecipient.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await configService.testEmail(testRecipient.trim());
      setTestResult(result);
      if (result.ok) {
        toast.success("Correo de prueba enviado correctamente.");
      } else {
        toast.error("No se pudo enviar el correo de prueba.");
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Error al conectar con el servidor.";
      setTestResult({ ok: false, message: msg, config: {} });
      toast.error(msg);
    } finally {
      setTesting(false);
    }
  }

  async function handleSaveSetting(clave: string, valor: string) {
    const updated = await configService.updateSetting(clave, valor);
    setSettings((prev) => {
      if (!prev) return prev;
      const next = { ...prev };
      for (const cat of Object.keys(next) as SettingCategory[]) {
        next[cat] = next[cat].map((s) => (s.clave === updated.clave ? updated : s));
      }
      return next;
    });
  }

  const tabSettings = (activeTab !== "CATALOGO" && settings) ? (settings[activeTab as SettingCategory] ?? []) : [];

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Configuración del sistema</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Todas las opciones son configurables — ningún valor está quemado en el código.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/40 rounded-lg p-1 mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === t.key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-card rounded-xl border border-border p-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          </div>
        ) : activeTab === "CATALOGO" ? (
          <div>
            {/* Sub-tab bar */}
            <div className="flex gap-1 bg-muted/30 rounded-lg p-1 mb-6">
              {CATALOGO_SUBTABS.map((st) => (
                <button
                  key={st.key}
                  onClick={() => setCatalogoSubTab(st.key)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                    catalogoSubTab === st.key
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <i className={`ti ${st.icon} text-sm`} />
                  {st.label}
                </button>
              ))}
            </div>

            {catalogoSubTab === "areas" && (
              <AreasTab areas={areas} onRefresh={() => void configService.getAreas().then(setAreas)} />
            )}
            {catalogoSubTab === "grupos" && <GruposTab />}
            {catalogoSubTab === "cargos" && <CargosTab areas={areas} />}
          </div>
        ) : (
          <div>
            {tabSettings.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4">No hay configuraciones en esta sección.</p>
            ) : (
              tabSettings.map((s) => {
                if (activeTab === "BRANDING") {
                  if (s.clave === "PRIMARY_COLOR") return <ColorSettingRow key={s.clave} setting={s} onSave={handleSaveSetting} />;
                  if (s.clave === "LOGO_URL") return <LogoSettingRow key={s.clave} setting={s} onSave={handleSaveSetting} />;
                }
                return <SettingRow key={s.clave} setting={s} onSave={handleSaveSetting} />;
              })
            )}

            {/* Test email — only in SMTP tab */}
            {activeTab === "SMTP" && (
              <div className="mt-6 pt-6 border-t border-border">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0 mt-0.5">
                    <i className="ti ti-send text-indigo-400 text-base" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Probar configuración de correo</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Envía un correo de prueba para verificar que el servidor SMTP funciona correctamente.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    placeholder="correo@destinatario.com"
                    value={testRecipient}
                    onChange={(e) => setTestRecipient(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void handleTestEmail()}
                    className="h-9 flex-1 max-w-xs rounded-lg border border-slate-700 bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-300"
                  />
                  <button
                    onClick={() => void handleTestEmail()}
                    disabled={testing || !testRecipient.trim()}
                    className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {testing ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        Enviando…
                      </>
                    ) : (
                      <>
                        <i className="ti ti-send text-sm" />
                        Enviar prueba
                      </>
                    )}
                  </button>
                </div>

                {testResult && (
                  <div className={`mt-3 rounded-lg border p-4 ${
                    testResult.ok
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : "border-red-500/30 bg-red-500/5"
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      <i className={`ti ${testResult.ok ? "ti-circle-check text-emerald-400" : "ti-circle-x text-red-400"} text-lg`} />
                      <p className={`text-sm font-medium ${testResult.ok ? "text-emerald-400" : "text-red-400"}`}>
                        {testResult.ok ? "Correo enviado correctamente" : "Error al enviar"}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">{testResult.message}</p>
                    {testResult.ok && Object.keys(testResult.config).length > 0 && (
                      <div className="mt-2 text-xs text-muted-foreground/70 font-mono space-y-0.5">
                        <p>Servidor: {String(testResult.config.host)}:{String(testResult.config.port)}</p>
                        <p>Usuario: {String(testResult.config.username)}</p>
                        <p>TLS: {testResult.config.use_tls ? "Sí" : "No"}</p>
                        <p>Remitente: {String(testResult.config.from_email)}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
