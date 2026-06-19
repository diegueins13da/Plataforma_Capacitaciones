import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { coursesService } from "../../services/coursesService";
import { configService } from "../../services/configService";
import type { Area } from "../../types/area";
import type { CourseEstado, CourseListItem, CourseTipo } from "../../types/course";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CourseEditModalProps {
  course: CourseListItem;
  onClose: () => void;
  onSaved: (updated: CourseListItem) => void;
}

interface FormState {
  titulo: string;
  descripcion: string;
  tipo: CourseTipo;
  estado: CourseEstado;
  fecha_limite: string;
  duracion_horas: string;
  area: string;
}

// ---------------------------------------------------------------------------
// Draggable hook
// ---------------------------------------------------------------------------

function useDraggable() {
  const ref = useRef<HTMLDivElement>(null);
  const pos = useRef({ x: 0, y: 0, startX: 0, startY: 0 });

  function onMouseDown(e: React.MouseEvent) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    pos.current = {
      x: rect.left,
      y: rect.top,
      startX: e.clientX,
      startY: e.clientY,
    };
    el.style.left = `${rect.left}px`;
    el.style.top = `${rect.top}px`;
    el.style.transform = "none";
    el.style.margin = "0";

    function onMove(ev: MouseEvent) {
      const dx = ev.clientX - pos.current.startX;
      const dy = ev.clientY - pos.current.startY;
      const newX = Math.max(0, Math.min(pos.current.x + dx, window.innerWidth - (el?.offsetWidth ?? 200)));
      const newY = Math.max(0, Math.min(pos.current.y + dy, window.innerHeight - (el?.offsetHeight ?? 100)));
      el!.style.left = `${newX}px`;
      el!.style.top = `${newY}px`;
    }

    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return { ref, onMouseDown };
}

// ---------------------------------------------------------------------------
// Delete confirmation dialog
// ---------------------------------------------------------------------------

function DeleteConfirm({
  title, onConfirm, onCancel, loading,
}: {
  title: string; onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="rounded-xl border border-red-500/30 bg-card p-6 w-80 shadow-2xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
            <i className="ti ti-trash text-red-400 text-xl" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Eliminar curso</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
              ¿Eliminar <strong className="text-foreground">"{title}"</strong>? Esta acción no se puede deshacer.
            </p>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-3 py-1.5 text-sm rounded-lg border border-border text-muted-foreground hover:bg-accent transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="px-3 py-1.5 text-sm rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
          >
            {loading ? "Eliminando…" : "Eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

export function CourseEditModal({ course, onClose, onSaved }: CourseEditModalProps) {
  const { ref: modalRef, onMouseDown } = useDraggable();
  const [areas, setAreas] = useState<Area[]>([]);
  const [saving, setSaving] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState<FormState>({
    titulo: course.titulo,
    descripcion: course.descripcion ?? "",
    tipo: course.tipo,
    estado: course.estado,
    fecha_limite: course.fecha_limite ?? "",
    duracion_horas: course.duracion_horas != null ? String(course.duracion_horas) : "",
    area: "",
  });

  useEffect(() => {
    configService.getAreas().then(setAreas).catch(() => void 0);
  }, []);

  function set(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.titulo.trim()) {
      toast.error("El título es obligatorio.");
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        titulo: form.titulo.trim(),
        descripcion: form.descripcion,
        tipo: form.tipo,
        estado: form.estado,
        fecha_limite: form.fecha_limite || null,
        duracion_horas: form.duracion_horas ? parseFloat(form.duracion_horas) : null,
      };
      if (form.area) payload.area = parseInt(form.area);
      await coursesService.updateCourse(course.id, payload);
      toast.success("Curso actualizado.");
      // Build an updated CourseListItem and pass it back
      const updated: CourseListItem = {
        ...course,
        titulo: form.titulo.trim(),
        descripcion: form.descripcion,
        tipo: form.tipo,
        estado: form.estado,
        fecha_limite: form.fecha_limite || null,
        duracion_horas: form.duracion_horas ? parseFloat(form.duracion_horas) : null,
        area_nombre: form.area
          ? (areas.find((a) => a.id === parseInt(form.area))?.nombre ?? course.area_nombre)
          : course.area_nombre,
      };
      onSaved(updated);
    } catch {
      toast.error("No se pudo guardar el curso.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await coursesService.deleteCourse(course.id);
      toast.success("Curso eliminado.");
      onClose();
      window.location.reload();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? "No se pudo eliminar el curso.");
      setDeleting(false);
    }
  }

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !showDelete) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, showDelete]);

  const inputCls =
    "w-full rounded-lg border border-slate-700 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 transition-all duration-300";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal — positioned fixed, draggable */}
      <div
        ref={modalRef}
        className="fixed z-50 w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl"
        style={{
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      >
        {/* Header — drag handle */}
        <div
          onMouseDown={onMouseDown}
          className="flex items-center justify-between px-5 py-4 border-b border-border cursor-grab active:cursor-grabbing select-none"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/15 flex items-center justify-center">
              <i className="ti ti-edit text-indigo-400 text-base" aria-hidden="true" />
            </div>
            <p className="text-sm font-semibold text-foreground">Editar curso</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <i className="ti ti-x text-base" aria-hidden="true" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={(e) => void handleSave(e)} className="p-5 space-y-4">
          {/* Título */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Título <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.titulo}
              onChange={(e) => set("titulo", e.target.value)}
              className={inputCls}
              placeholder="Nombre del curso"
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Descripción
            </label>
            <textarea
              value={form.descripcion}
              onChange={(e) => set("descripcion", e.target.value)}
              rows={3}
              className={`${inputCls} resize-none`}
              placeholder="Descripción breve del curso"
            />
          </div>

          {/* Row: Tipo + Estado */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Tipo</label>
              <select value={form.tipo} onChange={(e) => set("tipo", e.target.value as CourseTipo)}
                className={inputCls}>
                <option value="ONLINE">Online</option>
                <option value="PRESENCIAL">Presencial</option>
                <option value="HIBRIDO">Híbrido</option>
                <option value="AUTOAPRENDIZAJE">Autoaprendizaje</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Estado</label>
              <select value={form.estado} onChange={(e) => set("estado", e.target.value as CourseEstado)}
                className={inputCls}>
                <option value="BORRADOR">Borrador</option>
                <option value="PUBLICADO">Publicado</option>
                <option value="ARCHIVADO">Archivado</option>
              </select>
            </div>
          </div>

          {/* Row: Fecha límite + Duración */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Fecha límite</label>
              <input
                type="date"
                value={form.fecha_limite}
                onChange={(e) => set("fecha_limite", e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Duración (horas)</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={form.duracion_horas}
                onChange={(e) => set("duracion_horas", e.target.value)}
                className={inputCls}
                placeholder="0"
              />
            </div>
          </div>

          {/* Área */}
          {areas.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Área</label>
              <select value={form.area} onChange={(e) => set("area", e.target.value)} className={inputCls}>
                <option value="">Sin cambiar ({course.area_nombre || "Sin área"})</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>{a.nombre}</option>
                ))}
              </select>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setShowDelete(true)}
              className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              <i className="ti ti-trash text-sm" aria-hidden="true" />
              Eliminar curso
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:bg-accent transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all duration-300 disabled:opacity-50"
              >
                {saving ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </div>
        </form>
      </div>

      {showDelete && (
        <DeleteConfirm
          title={course.titulo}
          loading={deleting}
          onConfirm={() => void handleDelete()}
          onCancel={() => setShowDelete(false)}
        />
      )}
    </>
  );
}
