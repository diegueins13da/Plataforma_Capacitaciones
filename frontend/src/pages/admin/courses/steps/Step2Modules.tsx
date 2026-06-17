import { useRef, useState } from "react";
import { toast } from "sonner";

import { coursesService } from "../../../../services/coursesService";
import { useCourseWizardStore } from "../../../../store/courseWizardStore";
import { RichTextEditor } from "../../../../components/shared/RichTextEditor";
import type { CourseModule, ModuleTipo } from "../../../../types/course";

const TIPO_ICONS: Record<ModuleTipo, string> = {
  VIDEO: "▶",
  PDF: "📄",
  TEXTO: "📝",
  SCORM: "📦",
};

const TIPO_LABELS: Record<ModuleTipo, string> = {
  VIDEO: "Video",
  PDF: "PDF",
  TEXTO: "Texto HTML",
  SCORM: "SCORM",
};

interface ModuleFormState {
  titulo: string;
  tipo_contenido: ModuleTipo;
  url_video: string;
  contenido_html: string;
  duracion_minutos: string;
  pdfFile: File | null;
}

const emptyForm = (): ModuleFormState => ({
  titulo: "",
  tipo_contenido: "TEXTO",
  url_video: "",
  contenido_html: "",
  duracion_minutos: "",
  pdfFile: null,
});

interface Props {
  onNext: () => void;
  onBack: () => void;
}

export function Step2Modules({ onNext, onBack }: Props) {
  const { courseId, modules, setModules, setStep } = useCourseWizardStore();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ModuleFormState>(emptyForm());
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const dragItem = useRef<number | null>(null);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setShowForm(true);
  }

  function openEdit(module: CourseModule) {
    setEditingId(module.id);
    setForm({
      titulo: module.titulo,
      tipo_contenido: module.tipo_contenido,
      url_video: module.url_video,
      contenido_html: module.contenido_html,
      duracion_minutos: module.duracion_minutos ? String(module.duracion_minutos) : "",
      pdfFile: null,
    });
    setShowForm(true);
  }

  async function handleSaveModule() {
    if (!courseId) { toast.error("Primero guarda el paso 1."); return; }
    if (!form.titulo.trim()) { toast.error("El título es obligatorio."); return; }
    if (form.tipo_contenido === "VIDEO" && !form.url_video.trim()) {
      toast.error("La URL del video es obligatoria."); return;
    }
    if (form.tipo_contenido === "PDF" && !editingId && !form.pdfFile) {
      toast.error("Selecciona un archivo PDF."); return;
    }

    setSaving(true);
    setUploadProgress(0);
    try {
      const payload = {
        titulo: form.titulo.trim(),
        tipo_contenido: form.tipo_contenido,
        url_video: form.url_video,
        contenido_html: form.contenido_html,
        duracion_minutos: form.duracion_minutos ? parseInt(form.duracion_minutos) : null,
      };
      let saved: CourseModule;
      if (editingId) {
        saved = await coursesService.updateModule(
          courseId, editingId, payload,
          form.pdfFile ?? undefined,
          setUploadProgress
        );
        setModules(modules.map((m) => m.id === editingId ? saved : m));
      } else {
        saved = await coursesService.createModule(
          courseId, payload,
          form.pdfFile ?? undefined,
          setUploadProgress
        );
        setModules([...modules, saved]);
      }
      setShowForm(false);
      toast.success(editingId ? "Módulo actualizado." : "Módulo creado.");
    } catch {
      toast.error("No se pudo guardar el módulo.");
    } finally {
      setSaving(false);
      setUploadProgress(0);
    }
  }

  async function handleDelete(module: CourseModule) {
    if (!courseId) return;
    if (!confirm(`¿Eliminar "${module.titulo}"?`)) return;
    try {
      await coursesService.deleteModule(courseId, module.id);
      setModules(modules.filter((m) => m.id !== module.id));
      toast.success("Módulo eliminado.");
    } catch {
      toast.error("No se pudo eliminar el módulo.");
    }
  }

  // Drag-and-drop reorder
  async function handleDrop(targetIndex: number) {
    if (dragItem.current === null || dragItem.current === targetIndex) return;
    const reordered = [...modules];
    const [dragged] = reordered.splice(dragItem.current, 1);
    reordered.splice(targetIndex, 0, dragged);
    const withOrder = reordered.map((m, i) => ({ ...m, orden: i + 1 }));
    setModules(withOrder);
    setDragOver(null);
    dragItem.current = null;
    if (!courseId) return;
    try {
      for (const m of withOrder) {
        await coursesService.updateModule(courseId, m.id, { orden: m.orden });
      }
    } catch {
      toast.error("No se pudo guardar el nuevo orden.");
    }
  }

  return (
    <div className="space-y-4">
      {/* Module list */}
      {modules.length === 0 && !showForm && (
        <div className="text-center py-10 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-lg">
          Aún no hay módulos. Agrega el primero.
        </div>
      )}

      <div className="space-y-2">
        {modules.map((module, idx) => (
          <div
            key={module.id}
            draggable
            onDragStart={() => { dragItem.current = idx; }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(idx); }}
            onDragLeave={() => setDragOver(null)}
            onDrop={() => handleDrop(idx)}
            className={`flex items-center gap-3 p-3 bg-white border rounded-lg cursor-grab
              ${dragOver === idx ? "border-indigo-400 bg-indigo-50" : "border-gray-200"}`}
          >
            <span className="text-gray-400 select-none">⠿</span>
            <span className="text-lg">{TIPO_ICONS[module.tipo_contenido]}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{module.titulo}</p>
              <p className="text-xs text-gray-400">
                {TIPO_LABELS[module.tipo_contenido]}
                {module.duracion_minutos ? ` · ${module.duracion_minutos} min` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => openEdit(module)}
              className="text-xs text-indigo-600 hover:underline px-2"
            >
              Editar
            </button>
            <button
              type="button"
              onClick={() => handleDelete(module)}
              className="text-xs text-red-500 hover:underline px-2"
            >
              Eliminar
            </button>
          </div>
        ))}
      </div>

      {/* Module form */}
      {showForm ? (
        <div className="border border-gray-200 rounded-xl p-5 bg-gray-50 space-y-4">
          <h3 className="text-sm font-semibold text-gray-800">
            {editingId ? "Editar módulo" : "Nuevo módulo"}
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Título <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
              <select
                value={form.tipo_contenido}
                onChange={(e) => setForm({ ...form, tipo_contenido: e.target.value as ModuleTipo })}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {(Object.keys(TIPO_LABELS) as ModuleTipo[]).map((t) => (
                  <option key={t} value={t}>{TIPO_LABELS[t]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* VIDEO */}
          {form.tipo_contenido === "VIDEO" && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                URL del video (YouTube, Vimeo) <span className="text-red-500">*</span>
              </label>
              <input
                type="url"
                value={form.url_video}
                onChange={(e) => setForm({ ...form, url_video: e.target.value })}
                placeholder="https://youtube.com/watch?v=..."
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          {/* PDF */}
          {form.tipo_contenido === "PDF" && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Archivo PDF {!editingId && <span className="text-red-500">*</span>}
                {editingId && <span className="text-gray-400"> (dejar vacío para mantener el actual)</span>}
              </label>
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => setForm({ ...form, pdfFile: e.target.files?.[0] ?? null })}
                className="w-full text-sm text-gray-600"
              />
              {uploadProgress > 0 && uploadProgress < 100 && (
                <div className="mt-2">
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{uploadProgress}%</p>
                </div>
              )}
            </div>
          )}

          {/* TEXTO */}
          {form.tipo_contenido === "TEXTO" && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Contenido HTML</label>
              <RichTextEditor
                value={form.contenido_html}
                onChange={(html) => setForm({ ...form, contenido_html: html })}
              />
            </div>
          )}

          {/* SCORM warning */}
          {form.tipo_contenido === "SCORM" && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
              SCORM estará disponible en la Fase 2 del proyecto.
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Duración estimada (minutos)</label>
            <input
              type="number"
              value={form.duracion_minutos}
              onChange={(e) => setForm({ ...form, duracion_minutos: e.target.value })}
              placeholder="Ej: 30"
              min={1}
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSaveModule}
              disabled={saving || form.tipo_contenido === "SCORM"}
              className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar módulo"}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={openCreate}
          className="w-full py-2 border-2 border-dashed border-indigo-300 text-indigo-600 text-sm rounded-lg hover:bg-indigo-50 transition-colors"
        >
          + Añadir módulo
        </button>
      )}

      {/* Actions */}
      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={() => { setStep(1); onBack(); }}
          className="px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50"
        >
          ← Anterior
        </button>
        <button
          type="button"
          onClick={() => { setStep(3); onNext(); }}
          className="px-6 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
        >
          Siguiente →
        </button>
      </div>
    </div>
  );
}
