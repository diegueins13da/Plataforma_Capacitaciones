import { useRef, useState } from "react";
import { toast } from "sonner";

import { coursesService } from "../../../../services/coursesService";
import { useCourseWizardStore } from "../../../../store/courseWizardStore";
import { RichTextEditor } from "../../../../components/shared/RichTextEditor";
import type { CourseModule, CreateTemaPayload, Tema, TemaTipo } from "../../../../types/course";

const TEMA_TIPO_ICONS: Record<TemaTipo, string> = {
  VIDEO: "ti-player-play",
  PDF: "ti-file-type-pdf",
  TEXTO: "ti-file-text",
  IMAGEN: "ti-photo",
  IFRAME: "ti-world",
};

const TEMA_TIPO_LABELS: Record<TemaTipo, string> = {
  VIDEO: "Video",
  PDF: "PDF",
  TEXTO: "Texto HTML",
  IMAGEN: "Imagen",
  IFRAME: "Enlace externo (iFrame)",
};

interface TemaFormState {
  titulo: string;
  tipo_contenido: TemaTipo;
  url_video: string;
  contenido_html: string;
  url_iframe: string;
  duracion_minutos: string;
  pdfFile: File | null;
  videoFile: File | null;
  imagenFile: File | null;
}

const emptyTemaForm = (): TemaFormState => ({
  titulo: "",
  tipo_contenido: "TEXTO",
  url_video: "",
  contenido_html: "",
  url_iframe: "",
  duracion_minutos: "",
  pdfFile: null,
  videoFile: null,
  imagenFile: null,
});

interface Props {
  onNext: () => void;
  onBack: () => void;
}

export function Step2Modules({ onNext, onBack }: Props) {
  const { courseId, modules, setModules, setStep } = useCourseWizardStore();

  // Module editing
  const [editingModuleId, setEditingModuleId] = useState<number | null>(null);
  const [moduleTitle, setModuleTitle] = useState("");
  const [showModuleForm, setShowModuleForm] = useState(false);

  // Tema editing
  const [temaTargetModuleId, setTemaTargetModuleId] = useState<number | null>(null);
  const [editingTemaId, setEditingTemaId] = useState<number | null>(null);
  const [temaForm, setTemaForm] = useState<TemaFormState>(emptyTemaForm());
  const [uploadProgress, setUploadProgress] = useState(0);
  const [saving, setSaving] = useState(false);

  // Expanded modules (show temas)
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  // Drag-and-drop (module level)
  const dragItem = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  // Scroll target
  const formRef = useRef<HTMLDivElement | null>(null);

  function scrollToForm() {
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  // ---------------------------------------------------------------------------
  // Module CRUD
  // ---------------------------------------------------------------------------

  function openCreateModule() {
    setEditingModuleId(null);
    setModuleTitle("");
    setShowModuleForm(true);
    setTemaTargetModuleId(null);
    scrollToForm();
  }

  function openEditModule(mod: CourseModule) {
    setEditingModuleId(mod.id);
    setModuleTitle(mod.titulo);
    setShowModuleForm(true);
    setTemaTargetModuleId(null);
    scrollToForm();
  }

  async function saveModule() {
    if (!courseId) { toast.error("Primero guarda el paso 1."); return; }
    if (!moduleTitle.trim()) { toast.error("El título del módulo es obligatorio."); return; }
    setSaving(true);
    try {
      if (editingModuleId) {
        const saved = await coursesService.updateModule(courseId, editingModuleId, { titulo: moduleTitle.trim() });
        setModules(modules.map((m) => m.id === editingModuleId ? { ...m, titulo: saved.titulo } : m));
        toast.success("Módulo actualizado.");
      } else {
        const saved = await coursesService.createModule(courseId, { titulo: moduleTitle.trim() });
        setModules([...modules, { ...saved, temas: [] }]);
        setExpanded((s) => new Set([...s, saved.id]));
        toast.success("Módulo creado. Ahora añade el primer tema.");
        // Auto-open the tema form so the instructor immediately adds content
        setShowModuleForm(false);
        setTemaTargetModuleId(saved.id);
        setEditingTemaId(null);
        setTemaForm(emptyTemaForm());
        scrollToForm();
        return;
      }
      setShowModuleForm(false);
    } catch {
      toast.error("No se pudo guardar el módulo.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteModule(mod: CourseModule) {
    if (!courseId) return;
    if (!confirm(`¿Eliminar el módulo "${mod.titulo}" y todos sus temas?`)) return;
    try {
      await coursesService.deleteModule(courseId, mod.id);
      setModules(modules.filter((m) => m.id !== mod.id));
      toast.success("Módulo eliminado.");
    } catch {
      toast.error("No se pudo eliminar el módulo.");
    }
  }

  async function handleModuleDrop(targetIndex: number) {
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

  // ---------------------------------------------------------------------------
  // Tema CRUD
  // ---------------------------------------------------------------------------

  function openCreateTema(moduleId: number) {
    setTemaTargetModuleId(moduleId);
    setEditingTemaId(null);
    setTemaForm(emptyTemaForm());
    setShowModuleForm(false);
    setExpanded((s) => new Set([...s, moduleId]));
    scrollToForm();
  }

  function openEditTema(moduleId: number, tema: Tema) {
    setTemaTargetModuleId(moduleId);
    setEditingTemaId(tema.id);
    setTemaForm({
      titulo: tema.titulo,
      tipo_contenido: tema.tipo_contenido,
      url_video: tema.url_video,
      contenido_html: tema.contenido_html,
      url_iframe: tema.url_iframe,
      duracion_minutos: tema.duracion_minutos ? String(tema.duracion_minutos) : "",
      pdfFile: null,
      videoFile: null,
      imagenFile: null,
    });
    setShowModuleForm(false);
    scrollToForm();
  }

  async function saveTema() {
    if (!courseId || !temaTargetModuleId) return;
    if (!temaForm.titulo.trim()) { toast.error("El título del tema es obligatorio."); return; }
    if (temaForm.tipo_contenido === "VIDEO" && !temaForm.url_video.trim() && !temaForm.videoFile) {
      toast.error("Ingresa una URL de video o sube un archivo MP4."); return;
    }
    if (temaForm.tipo_contenido === "PDF" && !editingTemaId && !temaForm.pdfFile) {
      toast.error("Selecciona un archivo PDF."); return;
    }
    if (temaForm.tipo_contenido === "IMAGEN" && !editingTemaId && !temaForm.imagenFile) {
      toast.error("Selecciona una imagen."); return;
    }
    if (temaForm.tipo_contenido === "IFRAME" && !temaForm.url_iframe.trim()) {
      toast.error("Ingresa la URL del contenido externo."); return;
    }

    setSaving(true);
    setUploadProgress(0);

    const payload: CreateTemaPayload = {
      titulo: temaForm.titulo.trim(),
      tipo_contenido: temaForm.tipo_contenido,
      url_video: temaForm.url_video,
      contenido_html: temaForm.contenido_html,
      url_iframe: temaForm.url_iframe,
      duracion_minutos: temaForm.duracion_minutos ? parseInt(temaForm.duracion_minutos) : null,
    };
    const files = {
      pdfFile: temaForm.pdfFile ?? undefined,
      videoFile: temaForm.videoFile ?? undefined,
      imagenFile: temaForm.imagenFile ?? undefined,
    };

    try {
      let saved: Tema;
      if (editingTemaId) {
        saved = await coursesService.updateTema(courseId, temaTargetModuleId, editingTemaId, payload, files, setUploadProgress);
      } else {
        saved = await coursesService.createTema(courseId, temaTargetModuleId, payload, files, setUploadProgress);
      }
      setModules(modules.map((m) =>
        m.id === temaTargetModuleId
          ? {
              ...m,
              temas: editingTemaId
                ? m.temas.map((t) => (t.id === editingTemaId ? saved : t))
                : [...m.temas, saved],
            }
          : m
      ));
      setTemaTargetModuleId(null);
      setEditingTemaId(null);
      toast.success(editingTemaId ? "Tema actualizado." : "Tema creado.");
    } catch {
      toast.error("No se pudo guardar el tema.");
    } finally {
      setSaving(false);
      setUploadProgress(0);
    }
  }

  async function deleteTema(moduleId: number, tema: Tema) {
    if (!courseId) return;
    if (!confirm(`¿Eliminar el tema "${tema.titulo}"?`)) return;
    try {
      await coursesService.deleteTema(courseId, moduleId, tema.id);
      setModules(modules.map((m) =>
        m.id === moduleId ? { ...m, temas: m.temas.filter((t) => t.id !== tema.id) } : m
      ));
      toast.success("Tema eliminado.");
    } catch {
      toast.error("No se pudo eliminar el tema.");
    }
  }

  const isEditingTema = temaTargetModuleId !== null;

  return (
    <div className="space-y-3">
      {modules.length === 0 && !showModuleForm && !isEditingTema && (
        <div className="text-center py-10 text-muted-foreground text-sm border-2 border-dashed border-border rounded-lg">
          Aún no hay módulos. Agrega el primero.
        </div>
      )}

      {/* Module list */}
      {modules.map((mod, idx) => (
        <div
          key={mod.id}
          draggable
          onDragStart={() => { dragItem.current = idx; }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(idx); }}
          onDragLeave={() => setDragOver(null)}
          onDrop={() => handleModuleDrop(idx)}
          className={`border rounded-xl overflow-hidden transition-colors ${
            dragOver === idx ? "border-indigo-500/60 bg-indigo-500/5" : "border-border bg-card"
          }`}
        >
          {/* Module header row */}
          <div className="flex items-center gap-2 px-3 py-2.5">
            <span className="text-muted-foreground cursor-grab select-none text-lg">⠿</span>
            <button
              type="button"
              onClick={() => setExpanded((s) => {
                const n = new Set(s);
                n.has(mod.id) ? n.delete(mod.id) : n.add(mod.id);
                return n;
              })}
              className="flex items-center gap-2 flex-1 text-left min-w-0"
            >
              <i className={`ti ${expanded.has(mod.id) ? "ti-chevron-down" : "ti-chevron-right"} text-xs text-muted-foreground`} />
              <span className="text-sm font-semibold text-foreground truncate">{mod.titulo}</span>
              <span className="text-xs text-muted-foreground shrink-0 ml-1">
                {mod.temas.length} tema{mod.temas.length !== 1 ? "s" : ""}
              </span>
            </button>
            <button
              type="button"
              onClick={() => openEditModule(mod)}
              className="text-xs text-indigo-400 hover:text-indigo-300 px-2 py-1 rounded hover:bg-indigo-500/10 transition-colors"
            >
              <i className="ti ti-edit text-sm" />
            </button>
            <button
              type="button"
              onClick={() => deleteModule(mod)}
              className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
            >
              <i className="ti ti-trash text-sm" />
            </button>
          </div>

          {/* Temas (expandable) */}
          {expanded.has(mod.id) && (
            <div className="border-t border-border bg-background/40">
              {mod.temas.length === 0 && (
                <p className="text-xs text-muted-foreground px-8 py-2 italic">Sin temas aún.</p>
              )}
              {mod.temas.map((tema) => (
                <div
                  key={tema.id}
                  className="flex items-center gap-2 px-8 py-2 border-b border-border/50 last:border-0 hover:bg-white/3 transition-colors"
                >
                  <i className={`ti ${TEMA_TIPO_ICONS[tema.tipo_contenido]} text-sm text-muted-foreground shrink-0`} />
                  <span className="text-xs text-foreground flex-1 truncate">{tema.titulo}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">{TEMA_TIPO_LABELS[tema.tipo_contenido]}</span>
                  {tema.duracion_minutos && (
                    <span className="text-[10px] text-muted-foreground shrink-0">· {tema.duracion_minutos} min</span>
                  )}
                  <button
                    type="button"
                    onClick={() => openEditTema(mod.id, tema)}
                    className="text-indigo-400 hover:text-indigo-300 px-1.5 py-0.5 rounded hover:bg-indigo-500/10 transition-colors"
                  >
                    <i className="ti ti-edit text-xs" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteTema(mod.id, tema)}
                    className="text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded hover:bg-red-500/10 transition-colors"
                  >
                    <i className="ti ti-trash text-xs" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => openCreateTema(mod.id)}
                className="w-full text-xs text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/5 py-2 px-8 text-left transition-colors flex items-center gap-1"
              >
                <i className="ti ti-plus text-xs" /> Añadir tema
              </button>
            </div>
          )}
        </div>
      ))}

      {/* Module form */}
      {showModuleForm && (
        <div ref={formRef} className="border border-indigo-500/40 rounded-xl p-4 bg-background space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            {editingModuleId ? "Editar módulo" : "Nuevo módulo"}
          </h3>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Título del módulo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={moduleTitle}
              onChange={(e) => setModuleTitle(e.target.value)}
              placeholder="Ej: Introducción, Variables, Funciones…"
              className="w-full border border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowModuleForm(false)} className="px-4 py-1.5 text-sm text-muted-foreground border border-border rounded-lg hover:bg-background">
              Cancelar
            </button>
            <button type="button" onClick={saveModule} disabled={saving} className="px-4 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {saving ? "Guardando…" : editingModuleId ? "Actualizar" : "Crear módulo"}
            </button>
          </div>
        </div>
      )}

      {/* Tema form */}
      {isEditingTema && (
        <div ref={formRef} className="border border-emerald-500/40 rounded-xl p-4 bg-background space-y-4">
          <h3 className="text-sm font-semibold text-foreground">
            {editingTemaId ? "Editar tema" : "Nuevo tema"}
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Título <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={temaForm.titulo}
                onChange={(e) => setTemaForm({ ...temaForm, titulo: e.target.value })}
                className="w-full border border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Tipo</label>
              <select
                value={temaForm.tipo_contenido}
                onChange={(e) => setTemaForm({ ...temaForm, tipo_contenido: e.target.value as TemaTipo })}
                className="w-full border border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
              >
                {(Object.keys(TEMA_TIPO_LABELS) as TemaTipo[]).map((t) => (
                  <option key={t} value={t}>{TEMA_TIPO_LABELS[t]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* VIDEO */}
          {temaForm.tipo_contenido === "VIDEO" && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">URL del video (YouTube, Vimeo)</label>
                <input
                  type="url"
                  value={temaForm.url_video}
                  onChange={(e) => setTemaForm({ ...temaForm, url_video: e.target.value })}
                  placeholder="https://youtube.com/watch?v=..."
                  className="w-full border border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  O subir archivo MP4/WebM {editingTemaId && <span className="text-muted-foreground">(dejar vacío para mantener el actual)</span>}
                </label>
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/ogg"
                  onChange={(e) => setTemaForm({ ...temaForm, videoFile: e.target.files?.[0] ?? null })}
                  className="w-full text-sm text-muted-foreground"
                />
              </div>
            </div>
          )}

          {/* PDF */}
          {temaForm.tipo_contenido === "PDF" && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Archivo PDF {!editingTemaId && <span className="text-red-500">*</span>}
                {editingTemaId && <span className="text-muted-foreground"> (dejar vacío para mantener el actual)</span>}
              </label>
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => setTemaForm({ ...temaForm, pdfFile: e.target.files?.[0] ?? null })}
                className="w-full text-sm text-muted-foreground"
              />
            </div>
          )}

          {/* TEXTO */}
          {temaForm.tipo_contenido === "TEXTO" && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Contenido</label>
              <RichTextEditor
                value={temaForm.contenido_html}
                onChange={(html) => setTemaForm({ ...temaForm, contenido_html: html })}
              />
            </div>
          )}

          {/* IMAGEN */}
          {temaForm.tipo_contenido === "IMAGEN" && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Imagen (JPG, PNG, WebP) {!editingTemaId && <span className="text-red-500">*</span>}
                {editingTemaId && <span className="text-muted-foreground"> (dejar vacío para mantener la actual)</span>}
              </label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={(e) => setTemaForm({ ...temaForm, imagenFile: e.target.files?.[0] ?? null })}
                className="w-full text-sm text-muted-foreground"
              />
            </div>
          )}

          {/* IFRAME */}
          {temaForm.tipo_contenido === "IFRAME" && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                URL del contenido externo <span className="text-red-500">*</span>
              </label>
              <input
                type="url"
                value={temaForm.url_iframe}
                onChange={(e) => setTemaForm({ ...temaForm, url_iframe: e.target.value })}
                placeholder="https://docs.google.com/presentation/..."
                className="w-full border border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Google Slides, Miro, Genially, simuladores web, etc.</p>
            </div>
          )}

          {/* Upload progress */}
          {uploadProgress > 0 && uploadProgress < 100 && (
            <div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{uploadProgress}%</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Duración estimada (minutos)</label>
            <input
              type="number"
              value={temaForm.duracion_minutos}
              onChange={(e) => setTemaForm({ ...temaForm, duracion_minutos: e.target.value })}
              placeholder="Ej: 15"
              min={1}
              className="w-40 border border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => { setTemaTargetModuleId(null); setEditingTemaId(null); }}
              className="px-4 py-2 border border-border text-muted-foreground text-sm rounded-lg hover:bg-background"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={saveTema}
              disabled={saving}
              className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50 shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all"
            >
              {saving ? "Guardando…" : editingTemaId ? "Actualizar tema" : "Crear tema"}
            </button>
          </div>
        </div>
      )}

      {/* Add module button */}
      {!showModuleForm && !isEditingTema && (
        <button
          type="button"
          onClick={openCreateModule}
          className="w-full py-2 border-2 border-dashed border-indigo-500/40 text-indigo-400 text-sm rounded-lg hover:bg-indigo-500/10 transition-colors"
        >
          + Añadir módulo
        </button>
      )}

      {/* Actions */}
      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={() => { setStep(1); onBack(); }}
          className="px-4 py-2 border border-border text-muted-foreground text-sm rounded-lg hover:bg-background"
        >
          ← Anterior
        </button>
        <button
          type="button"
          onClick={() => { setStep(3); onNext(); }}
          className="px-6 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all"
        >
          Siguiente →
        </button>
      </div>
    </div>
  );
}
