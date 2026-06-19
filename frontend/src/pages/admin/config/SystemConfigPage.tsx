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
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { configService } from "../../../services/configService";
import type { Area } from "../../../types/area";
import type { GroupedSettings, SettingCategory, SystemSetting } from "../../../types/config";

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

type TabKey = SettingCategory | "AREAS";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "SMTP", label: "Correo electrónico", icon: "📧" },
  { key: "BRANDING", label: "Identidad visual", icon: "🎨" },
  { key: "SEGURIDAD", label: "Seguridad", icon: "🔒" },
  { key: "NOTIF", label: "Notificaciones", icon: "🔔" },
  { key: "AREAS", label: "Catálogo de áreas", icon: "🏢" },
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
// AreasTab
// ---------------------------------------------------------------------------

interface AreasTabProps {
  areas: Area[];
  onRefresh: () => void;
}

function AreasTab({ areas, onRefresh }: AreasTabProps) {
  const [creating, setCreating] = useState(false);
  const [newNombre, setNewNombre] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNombre, setEditNombre] = useState("");

  const inputCls =
    "flex-1 h-9 rounded-lg border border-slate-700 bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-300";

  async function handleCreate() {
    if (!newNombre.trim()) return;
    setSaving(true);
    try {
      await configService.createArea({ nombre: newNombre.trim() });
      setNewNombre("");
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
      await configService.updateArea(id, { nombre: editNombre.trim() });
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
        <div className="flex items-center gap-2 mb-4 p-3 bg-indigo-500/5 border border-indigo-500/30 rounded-lg">
          <input
            type="text"
            placeholder="Nombre del área"
            value={newNombre}
            onChange={(e) => setNewNombre(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void handleCreate()}
            className={inputCls}
            autoFocus
          />
          <button
            onClick={() => void handleCreate()}
            disabled={saving || !newNombre.trim()}
            className="h-9 px-3 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all duration-300"
          >
            Crear
          </button>
          <button
            onClick={() => { setCreating(false); setNewNombre(""); }}
            className="h-9 px-3 border border-border text-muted-foreground text-sm rounded-lg hover:bg-accent/50"
          >
            Cancelar
          </button>
        </div>
      )}

      {areas.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No hay áreas definidas. Crea la primera para poder asignar usuarios.
        </div>
      ) : (
        <div className="divide-y divide-border">
          {areas.map((area) => (
            <div key={area.id} className="flex items-center gap-4 py-3">
              {editingId === area.id ? (
                <>
                  <input
                    type="text"
                    value={editNombre}
                    onChange={(e) => setEditNombre(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void handleEdit(area.id)}
                    className={inputCls}
                    autoFocus
                  />
                  <button onClick={() => void handleEdit(area.id)} className="h-8 px-3 bg-indigo-600 text-white text-xs rounded-lg shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all duration-300">Guardar</button>
                  <button onClick={() => setEditingId(null)} className="h-8 px-3 border border-border text-muted-foreground text-xs rounded-lg hover:bg-accent/50">Cancelar</button>
                </>
              ) : (
                <>
                  <div className="flex-1">
                    <span className={`text-sm font-medium ${area.activo ? "text-foreground" : "text-muted-foreground line-through"}`}>
                      {area.nombre}
                    </span>
                    {area.user_count > 0 && (
                      <span className="ml-2 text-xs text-muted-foreground">{area.user_count} usuario(s)</span>
                    )}
                  </div>
                  <button
                    onClick={() => { setEditingId(area.id); setEditNombre(area.nombre); }}
                    className="text-xs text-indigo-400 hover:underline"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => void handleToggle(area)}
                    className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                  >
                    {area.activo ? "Desactivar" : "Activar"}
                  </button>
                  <button
                    onClick={() => void handleDelete(area)}
                    disabled={area.user_count > 0}
                    className="text-xs text-red-400 hover:underline disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Eliminar
                  </button>
                </>
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

export default function SystemConfigPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("SMTP");
  const [settings, setSettings] = useState<GroupedSettings | null>(null);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);

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

  const tabSettings = activeTab !== "AREAS" && settings ? (settings[activeTab] ?? []) : [];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
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
        ) : activeTab === "AREAS" ? (
          <AreasTab areas={areas} onRefresh={() => void configService.getAreas().then(setAreas)} />
        ) : (
          <div>
            {tabSettings.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4">No hay configuraciones en esta sección.</p>
            ) : (
              tabSettings.map((s) => (
                <SettingRow key={s.clave} setting={s} onSave={handleSaveSetting} />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
