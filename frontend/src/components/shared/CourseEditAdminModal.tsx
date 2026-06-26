import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { coursesService } from "../../services/coursesService";
import { configService } from "../../services/configService";
import { assessmentsService } from "../../services/assessmentsService";
import { RichTextEditor } from "./RichTextEditor";
import { QuestionForm } from "./QuestionForm";
import type { Area } from "../../types/area";
import type { Course, CourseModule, CreateTemaPayload, Tema, TemaTipo } from "../../types/course";
import type { Assessment, CreateQuestionPayload, Question } from "../../types/assessment";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
const infoSchema = z.object({
  titulo: z.string().min(3, "Mínimo 3 caracteres"),
  descripcion: z.string().optional(),
  tipo: z.enum(["ONLINE", "PRESENCIAL", "HIBRIDO", "AUTOAPRENDIZAJE"]),
  area: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
    z.number({ required_error: "El área es obligatoria", invalid_type_error: "El área es obligatoria" }).int().positive("El área es obligatoria")
  ),
  fecha_limite: z.string().optional(),
  version: z.string().min(1, "Requerido"),
  imagen_portada: z.string().optional(),
  duracion_horas: z.coerce.number().nullable().optional(),
  cert_expira_meses: z.coerce.number().min(1, "Mínimo 1 mes").nullable().optional(),
});
type InfoValues = z.infer<typeof infoSchema>;

// ---------------------------------------------------------------------------
// Module + Tema form state
// ---------------------------------------------------------------------------
interface ModuleFormState { titulo: string; }

const TEMA_TIPO_ICONS: Record<TemaTipo, string> = {
  VIDEO: "ti-player-play", PDF: "ti-file-type-pdf", TEXTO: "ti-file-text",
  IMAGEN: "ti-photo", IFRAME: "ti-world",
};
const TEMA_TIPO_LABELS: Record<TemaTipo, string> = {
  VIDEO: "Video", PDF: "PDF", TEXTO: "Texto HTML",
  IMAGEN: "Imagen", IFRAME: "Enlace externo (iFrame)",
};

interface TemaFormState {
  titulo: string; tipo_contenido: TemaTipo; url_video: string;
  contenido_html: string; url_iframe: string; duracion_minutos: string;
  pdfFile: File | null; videoFile: File | null; imagenFile: File | null;
}
function emptyTema(): TemaFormState {
  return { titulo: "", tipo_contenido: "TEXTO", url_video: "", contenido_html: "",
    url_iframe: "", duracion_minutos: "", pdfFile: null, videoFile: null, imagenFile: null };
}

const Q_LABELS: Record<string, string> = {
  MULTIPLE_CHOICE: "Selección única", MULTIPLE_SELECT: "Selección múltiple", TRUE_FALSE: "V / F",
};

function emptyMod(): ModuleFormState { return { titulo: "" }; }

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface Props {
  courseId: number;
  onClose: () => void;
  onSaved: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function CourseEditAdminModal({ courseId, onClose, onSaved }: Props) {
  type TabKey = "info" | "modules" | "eval";
  const [activeTab, setActiveTab] = useState<TabKey>("info");
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Module inline form
  const [showModForm, setShowModForm] = useState(false);
  const [modForm, setModForm] = useState<ModuleFormState>(emptyMod());
  const [modSaving, setModSaving] = useState(false);
  const [expandedMods, setExpandedMods] = useState<Set<number>>(new Set());
  const [expandedModTitles, setExpandedModTitles] = useState<Record<number, string>>({});

  // Tema inline form
  const [temaModuleId, setTemaModuleId] = useState<number | null>(null);
  const [editingTemaId, setEditingTemaId] = useState<number | null>(null);
  const [temaForm, setTemaForm] = useState<TemaFormState>(emptyTema());
  const [temaSaving, setTemaSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  // temaFormRef removed — form lives in fixed right panel, no scrolling needed

  // Assessment config
  const [puntajeMin, setPuntajeMin] = useState("70");
  const [maxIntentos, setMaxIntentos] = useState("3");
  const [tiempoLimite, setTiempoLimite] = useState("");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Question form
  const [showQForm, setShowQForm] = useState(false);
  const [editingQ, setEditingQ] = useState<Question | null>(null);

  // Info react-hook-form
  const { register, handleSubmit, reset, formState: { errors } } = useForm<InfoValues>({
    resolver: zodResolver(infoSchema),
  });

  // ── Load all data ────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    Promise.all([
      coursesService.getCourse(courseId),
      coursesService.getModules(courseId),
      configService.getAreas(),
      assessmentsService.getAssessmentForCourse(courseId),
    ])
      .then(async ([c, mods, ar, ass]) => {
        setCourse(c);
        setModules(mods);
        setAreas(ar);
        setAssessment(ass);
        setPuntajeMin(String(ass.puntaje_minimo));
        setMaxIntentos(String(ass.max_intentos));
        setTiempoLimite(ass.tiempo_limite_minutos ? String(ass.tiempo_limite_minutos) : "");
        reset({
          titulo: c.titulo,
          descripcion: c.descripcion ?? "",
          tipo: c.tipo,
          area: c.area ?? null,
          fecha_limite: c.fecha_limite ?? "",
          version: c.version ?? "1.0",
          imagen_portada: c.imagen_portada ?? "",
          duracion_horas: c.duracion_horas ?? null,
          cert_expira_meses: c.cert_expira_meses ?? 1,
        });
        const qs = await assessmentsService.listQuestions(ass.id);
        setQuestions(qs);
      })
      .catch(() => toast.error("No se pudieron cargar los datos del curso."))
      .finally(() => setLoading(false));
  }, [courseId, reset]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // ── Save info + (optional) publish ─────────────────────────────────────
  async function onSubmit(values: InfoValues) {
    setSaving(true);
    try {
      await coursesService.updateCourse(courseId, {
        titulo: values.titulo,
        descripcion: values.descripcion,
        tipo: values.tipo,
        area: values.area ?? null,
        fecha_limite: values.fecha_limite || null,
        version: values.version,
        imagen_portada: values.imagen_portada || undefined,
        duracion_horas: values.duracion_horas ?? null,
        cert_expira_meses: values.cert_expira_meses ?? null,
      });
      if (course?.estado === "BORRADOR") {
        await coursesService.publishCourse(courseId);
        toast.success("Curso guardado y publicado exitosamente.");
      } else {
        toast.success("Cambios guardados correctamente.");
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      type ApiErr = { response?: { data?: { error?: string; detail?: string; [k: string]: unknown } } };
      const data = (err as ApiErr)?.response?.data;
      const msg =
        data?.error ??
        data?.detail ??
        (typeof data === "string" ? data : null) ??
        "Error inesperado al guardar. Revisa los datos e inténtalo de nuevo.";
      toast.error(msg as string, { duration: 6000 });
    } finally {
      setSaving(false);
    }
  }

  // ── Module handlers ──────────────────────────────────────────────────────
  function openCreateMod() {
    setModForm(emptyMod());
    setShowModForm(true);
  }

  function toggleExpand(m: CourseModule) {
    setExpandedMods((s) => {
      const n = new Set(s);
      if (n.has(m.id)) {
        n.delete(m.id);
        if (temaModuleId === m.id) { setTemaModuleId(null); setEditingTemaId(null); }
      } else {
        n.add(m.id);
        setExpandedModTitles((t) => ({ ...t, [m.id]: m.titulo }));
      }
      return n;
    });
  }

  async function saveModuleTitle(modId: number) {
    const title = (expandedModTitles[modId] ?? "").trim();
    if (!title) { toast.error("El título es obligatorio."); return; }
    try {
      const saved = await coursesService.updateModule(courseId, modId, { titulo: title });
      setModules((ms) => ms.map((m) => m.id === modId ? { ...m, titulo: saved.titulo } : m));
      toast.success("Título actualizado.");
    } catch {
      toast.error("No se pudo actualizar el título.");
    }
  }

  async function handleSaveMod() {
    if (!modForm.titulo.trim()) { toast.error("El título es obligatorio."); return; }
    setModSaving(true);
    try {
      const saved = await coursesService.createModule(courseId, { titulo: modForm.titulo.trim() });
      setModules((ms) => [...ms, { ...saved, temas: [] }]);
      setShowModForm(false);
      toast.success("Módulo creado. Ahora añade el primer tema.");
      setExpandedMods((s) => new Set([...s, saved.id]));
      setExpandedModTitles((t) => ({ ...t, [saved.id]: saved.titulo }));
      setTemaModuleId(saved.id); setEditingTemaId(null); setTemaForm(emptyTema());
    } catch {
      toast.error("No se pudo crear el módulo.");
    } finally {
      setModSaving(false);
    }
  }

  async function handleDeleteMod(m: CourseModule) {
    if (course?.estado === "PUBLICADO") {
      toast.warning("No se pueden eliminar módulos de un curso publicado. El progreso de usuarios inscritos depende de ellos. Archiva el curso primero si ya no está activo.");
      return;
    }
    try {
      await coursesService.deleteModule(courseId, m.id);
      setModules((ms) => ms.filter((x) => x.id !== m.id));
      toast.success("Módulo eliminado.");
    } catch {
      toast.error("No se pudo eliminar el módulo.");
    }
  }

  // ── Tema handlers ────────────────────────────────────────────────────────
  function openCreateTema(moduleId: number) {
    setTemaModuleId(moduleId);
    setEditingTemaId(null);
    setTemaForm(emptyTema());
    setShowModForm(false);
    setExpandedMods((s) => new Set([...s, moduleId]));
  }

  function openEditTema(moduleId: number, tema: Tema) {
    setTemaModuleId(moduleId);
    setEditingTemaId(tema.id);
    setTemaForm({
      titulo: tema.titulo, tipo_contenido: tema.tipo_contenido,
      url_video: tema.url_video, contenido_html: tema.contenido_html,
      url_iframe: tema.url_iframe, duracion_minutos: tema.duracion_minutos ? String(tema.duracion_minutos) : "",
      pdfFile: null, videoFile: null, imagenFile: null,
    });
    setShowModForm(false);
  }

  async function handleSaveTema() {
    if (!temaModuleId) return;
    if (!temaForm.titulo.trim()) { toast.error("El título del tema es obligatorio."); return; }
    if (temaForm.tipo_contenido === "VIDEO" && !temaForm.url_video.trim() && !temaForm.videoFile) {
      toast.error("Ingresa una URL de video o sube un archivo."); return;
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
    setTemaSaving(true); setUploadProgress(0);
    const payload: CreateTemaPayload = {
      titulo: temaForm.titulo.trim(), tipo_contenido: temaForm.tipo_contenido,
      url_video: temaForm.url_video, contenido_html: temaForm.contenido_html,
      url_iframe: temaForm.url_iframe,
      duracion_minutos: temaForm.duracion_minutos ? parseInt(temaForm.duracion_minutos) : null,
    };
    const files = { pdfFile: temaForm.pdfFile ?? undefined, videoFile: temaForm.videoFile ?? undefined, imagenFile: temaForm.imagenFile ?? undefined };
    try {
      let saved: Tema;
      if (editingTemaId) {
        saved = await coursesService.updateTema(courseId, temaModuleId, editingTemaId, payload, files, setUploadProgress);
      } else {
        saved = await coursesService.createTema(courseId, temaModuleId, payload, files, setUploadProgress);
      }
      setModules((ms) => ms.map((m) =>
        m.id === temaModuleId
          ? { ...m, temas: editingTemaId ? m.temas.map((t) => t.id === editingTemaId ? saved : t) : [...m.temas, saved] }
          : m
      ));
      setTemaModuleId(null); setEditingTemaId(null);
      toast.success(editingTemaId ? "Tema actualizado." : "Tema creado.");
    } catch { toast.error("No se pudo guardar el tema."); }
    finally { setTemaSaving(false); setUploadProgress(0); }
  }

  async function handleDeleteTema(moduleId: number, tema: Tema) {
    if (!confirm(`¿Eliminar el tema "${tema.titulo}"?`)) return;
    try {
      await coursesService.deleteTema(courseId, moduleId, tema.id);
      setModules((ms) => ms.map((m) => m.id === moduleId ? { ...m, temas: m.temas.filter((t) => t.id !== tema.id) } : m));
      toast.success("Tema eliminado.");
    } catch { toast.error("No se pudo eliminar el tema."); }
  }

  // ── Assessment config auto-save ──────────────────────────────────────────
  const saveAssessmentConfig = useCallback(
    (field: string, value: string) => {
      if (!assessment) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        const payload: Record<string, number | null> = {};
        if (field === "puntaje_minimo") payload.puntaje_minimo = Number(value) || 70;
        if (field === "max_intentos") payload.max_intentos = Number(value) || 3;
        if (field === "tiempo_limite_minutos") payload.tiempo_limite_minutos = value ? Number(value) : null;
        try { await assessmentsService.updateAssessment(assessment.id, payload); } catch { /* silent */ }
      }, 800);
    },
    [assessment]
  );

  // ── Question handlers ────────────────────────────────────────────────────
  async function handleSaveQuestion(payload: CreateQuestionPayload) {
    if (!assessment) return;
    try {
      if (editingQ) {
        const updated = await assessmentsService.updateQuestion(assessment.id, editingQ.id, payload);
        setQuestions((qs) => qs.map((q) => (q.id === updated.id ? updated : q)));
        toast.success("Pregunta actualizada.");
      } else {
        const created = await assessmentsService.createQuestion(assessment.id, { ...payload, orden: questions.length + 1 });
        setQuestions((qs) => [...qs, created]);
        toast.success("Pregunta creada.");
      }
    } catch {
      toast.error("No se pudo guardar la pregunta.");
    } finally {
      setShowQForm(false);
      setEditingQ(null);
      const a = await assessmentsService.getAssessmentForCourse(courseId);
      setAssessment(a);
    }
  }

  async function handleDeleteQuestion(qId: number) {
    if (!assessment) return;
    if (course?.estado === "PUBLICADO") {
      toast.warning("No se pueden eliminar preguntas de un curso publicado. Los exámenes ya completados por usuarios quedarían inconsistentes. Archiva el curso primero si ya no está activo.");
      return;
    }
    try {
      await assessmentsService.deleteQuestion(assessment.id, qId);
      setQuestions((qs) => qs.filter((q) => q.id !== qId));
      toast.success("Pregunta eliminada.");
      const a = await assessmentsService.getAssessmentForCourse(courseId);
      setAssessment(a);
    } catch {
      toast.error("No se pudo eliminar la pregunta.");
    }
  }

  // ── Shared classes ───────────────────────────────────────────────────────
  const INPUT = "w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/40";
  const LABEL = "block text-xs font-medium text-muted-foreground mb-1";

  // ── Render ───────────────────────────────────────────────────────────────
  const isPublished = course?.estado === "PUBLICADO";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-4xl h-[90vh] max-h-[720px] min-h-[480px] flex flex-col shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background rounded-t-2xl shrink-0">
          <div className="flex items-center gap-3">
            <i className="ti ti-edit text-indigo-400 text-xl" aria-hidden="true" />
            <div>
              <h2 className="text-base font-semibold text-foreground leading-tight">
                {course?.titulo ?? "Cargando..."}
              </h2>
              <p className="text-xs text-muted-foreground">Editar curso</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-accent/50 text-muted-foreground transition-colors"
            aria-label="Cerrar"
          >
            <i className="ti ti-x text-base" aria-hidden="true" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border bg-background px-6 shrink-0">
          {([
            { key: "info" as const, icon: "ti-info-circle", label: "Información" },
            { key: "modules" as const, icon: "ti-books", label: `Módulos (${modules.length})` },
            { key: "eval" as const, icon: "ti-clipboard-check", label: `Evaluación (${questions.length})` },
          ] satisfies { key: TabKey; icon: string; label: string }[]).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={[
                "flex items-center gap-2 px-4 py-3 text-sm border-b-2 -mb-px transition-colors",
                activeTab === tab.key
                  ? "border-indigo-500 text-indigo-400"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
              ].join(" ")}
            >
              <i className={`ti ${tab.icon} text-base`} aria-hidden="true" />
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-20">
            <div className="w-8 h-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">

            {/* Body — modules tab manages its own split layout and scroll */}
            <div className={`flex-1 min-h-0 ${activeTab !== "modules" ? "overflow-y-auto px-6 py-5" : "overflow-hidden flex flex-col"}`}>

              {/* ── Info ──────────────────────────────────────────── */}
              {activeTab === "info" && (
                <div className="grid grid-cols-2 gap-4">
                  {/* Banner publicado / archivado */}
                  {course?.estado !== "BORRADOR" && (
                    <div className="col-span-2 flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-400">
                      <i className="ti ti-lock text-sm shrink-0 mt-0.5" aria-hidden="true" />
                      <span>
                        Curso <strong>{course?.estado === "PUBLICADO" ? "publicado" : "archivado"}</strong>: el campo <em>Tipo de entrega</em> está bloqueado
                        {course?.estado === "PUBLICADO" ? " para no afectar a usuarios ya inscritos" : ""}.
                        El resto de campos son editables.
                      </span>
                    </div>
                  )}

                  <div className="col-span-2">
                    <label className={LABEL}>Título <span className="text-red-500">*</span></label>
                    <input {...register("titulo")} className={INPUT} />
                    {errors.titulo && <p className="text-xs text-red-400 mt-1">{errors.titulo.message}</p>}
                  </div>
                  <div className="col-span-2">
                    <label className={LABEL}>Descripción</label>
                    <textarea {...register("descripcion")} rows={3} className={INPUT + " resize-none"} />
                  </div>
                  <div>
                    <label className={LABEL}>
                      Tipo <span className="text-red-500">*</span>
                      {isPublished && <span className="ml-1 text-muted-foreground font-normal">(bloqueado)</span>}
                    </label>
                    <select
                      {...register("tipo")}
                      disabled={isPublished || course?.estado === "ARCHIVADO"}
                      className={INPUT + (isPublished || course?.estado === "ARCHIVADO" ? " opacity-50 cursor-not-allowed" : "")}
                    >
                      <option value="ONLINE">Online</option>
                      <option value="PRESENCIAL">Presencial</option>
                      <option value="HIBRIDO">Híbrido</option>
                      <option value="AUTOAPRENDIZAJE">Autoaprendizaje</option>
                    </select>
                  </div>
                  <div>
                    <label className={LABEL}>Área <span className="text-red-500">*</span></label>
                    <select {...register("area")} className={INPUT}>
                      <option value="">— Selecciona un área —</option>
                      {areas.map((a) => (
                        <option key={a.id} value={a.id}>{a.nombre}</option>
                      ))}
                    </select>
                    {errors.area && <p className="text-xs text-red-400 mt-1">{errors.area.message}</p>}
                  </div>
                  <div>
                    <label className={LABEL}>Versión <span className="text-red-500">*</span></label>
                    <input {...register("version")} className={INPUT} placeholder="1.0" />
                    {errors.version && <p className="text-xs text-red-400 mt-1">{errors.version.message}</p>}
                  </div>
                  <div>
                    <label className={LABEL}>Fecha límite</label>
                    <input {...register("fecha_limite")} type="date" className={INPUT} />
                  </div>
                  <div>
                    <label className={LABEL}>Duración (horas)</label>
                    <input {...register("duracion_horas")} type="number" min={1} className={INPUT} />
                  </div>
                  <div>
                    <label className={LABEL}>Cert. expira (meses) <span className="text-red-500">*</span></label>
                    <input {...register("cert_expira_meses")} type="number" min={1} className={INPUT} />
                    {errors.cert_expira_meses && <p className="text-xs text-red-400 mt-1">{errors.cert_expira_meses.message}</p>}
                  </div>
                  <div className="col-span-2">
                    <label className={LABEL}>URL portada</label>
                    <input {...register("imagen_portada")} type="url" className={INPUT} placeholder="https://..." />
                  </div>
                </div>
              )}

              {/* ── Modules — split layout ────────────────────────── */}
              {activeTab === "modules" && (
                <div className="flex-1 flex min-h-0 overflow-hidden">

                  {/* ── LEFT: accordion list ── */}
                  <div className="w-3/5 min-w-0 overflow-y-auto px-5 py-4 space-y-2">
                    {modules.length === 0 && !showModForm && (
                      <div className="text-center py-10 text-muted-foreground text-sm border-2 border-dashed border-border rounded-xl">
                        No hay módulos. Agrega el primero.
                      </div>
                    )}

                  {modules.map((m) => {
                    const isOpen = expandedMods.has(m.id);
                    const currentTitle = expandedModTitles[m.id] ?? m.titulo;
                    const titleChanged = currentTitle.trim() !== m.titulo;
                    return (
                      <div key={m.id} className={`border rounded-xl overflow-hidden transition-colors ${isOpen ? "border-indigo-500/40 bg-card" : "border-border bg-card"}`}>

                        {/* ── Module header ── */}
                        <div className="flex items-center gap-1.5 px-3 py-2.5">
                          <button type="button" onClick={() => toggleExpand(m)}
                            className="flex items-center gap-2.5 flex-1 text-left min-w-0">
                            <i className={`ti ${isOpen ? "ti-chevron-down" : "ti-chevron-right"} text-xs text-muted-foreground shrink-0`} aria-hidden="true" />
                            <span className="text-sm font-semibold text-foreground truncate">{m.titulo}</span>
                          </button>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${m.temas.length > 0 ? "bg-indigo-500/10 text-indigo-400" : "bg-muted/50 text-muted-foreground"}`}>
                            {m.temas.length} tema{m.temas.length !== 1 ? "s" : ""}
                          </span>
                          <button type="button" onClick={() => toggleExpand(m)} title="Editar módulo"
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors ml-0.5">
                            <i className="ti ti-edit text-xs" aria-hidden="true" />
                          </button>
                          <button type="button" onClick={() => void handleDeleteMod(m)}
                            disabled={isPublished}
                            title={isPublished ? "No se puede eliminar en curso publicado" : "Eliminar módulo"}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                            <i className="ti ti-trash text-xs" aria-hidden="true" />
                          </button>
                        </div>

                        {/* ── Expanded body ── */}
                        {isOpen && (
                          <div className="border-t border-border/50 bg-background/50">

                            {/* Inline title edit */}
                            <div className="px-4 pt-3 pb-2.5 flex gap-2 items-center">
                              <input
                                value={currentTitle}
                                onChange={(e) => setExpandedModTitles((t) => ({ ...t, [m.id]: e.target.value }))}
                                className={INPUT + " flex-1"}
                                placeholder="Título del módulo"
                              />
                              {titleChanged && (
                                <button type="button" onClick={() => void saveModuleTitle(m.id)}
                                  className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors shrink-0">
                                  Guardar
                                </button>
                              )}
                            </div>

                            {/* Temas list */}
                            {m.temas.length > 0 && (
                              <div className="px-2 pb-1 space-y-0.5">
                                {m.temas.map((tema) => (
                                  <div key={tema.id}
                                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-accent/40 transition-colors group ${temaModuleId === m.id && editingTemaId === tema.id ? "bg-indigo-500/8 ring-1 ring-inset ring-indigo-500/25" : ""}`}>
                                    <div className="w-6 h-6 rounded-md bg-indigo-500/10 flex items-center justify-center shrink-0">
                                      <i className={`ti ${TEMA_TIPO_ICONS[tema.tipo_contenido]} text-[11px] text-indigo-400`} aria-hidden="true" />
                                    </div>
                                    <span className="text-xs text-foreground flex-1 truncate">{tema.titulo}</span>
                                    <span className="text-[10px] text-muted-foreground shrink-0">{TEMA_TIPO_LABELS[tema.tipo_contenido]}</span>
                                    {tema.duracion_minutos && (
                                      <span className="text-[10px] text-muted-foreground shrink-0">· {tema.duracion_minutos}m</span>
                                    )}
                                    <button type="button" onClick={() => openEditTema(m.id, tema)}
                                      className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded text-indigo-400 hover:bg-indigo-500/15 transition-all shrink-0">
                                      <i className="ti ti-edit text-xs" aria-hidden="true" />
                                    </button>
                                    <button type="button" onClick={() => void handleDeleteTema(m.id, tema)}
                                      className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded text-red-400 hover:bg-red-500/15 transition-all shrink-0">
                                      <i className="ti ti-trash text-xs" aria-hidden="true" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                            {m.temas.length === 0 && (
                              <p className="text-xs text-muted-foreground px-5 pb-2 italic">Sin temas aún.</p>
                            )}

                            {/* Add tema */}
                            <button type="button" onClick={() => openCreateTema(m.id)}
                              className="w-full text-xs text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/5 py-2 px-5 text-left transition-colors flex items-center gap-1.5 border-t border-border/40 font-medium">
                              <i className="ti ti-plus text-xs" aria-hidden="true" /> Añadir tema
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* New module form */}
                  {showModForm && (
                    <div className="border border-indigo-500/40 rounded-xl p-4 bg-background space-y-3">
                      <h3 className="text-sm font-semibold text-foreground">Nuevo módulo</h3>
                      <div>
                        <label className={LABEL}>Título <span className="text-red-500">*</span></label>
                        <input value={modForm.titulo} onChange={(e) => setModForm({ titulo: e.target.value })} className={INPUT} placeholder="Ej: Introducción, Variables…" autoFocus />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button type="button" onClick={() => setShowModForm(false)} className="px-4 py-1.5 border border-border text-muted-foreground text-sm rounded-lg hover:bg-accent/50 transition-colors">Cancelar</button>
                        <button type="button" onClick={() => void handleSaveMod()} disabled={modSaving} className="px-4 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                          {modSaving ? "Guardando..." : "Crear módulo"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Add module button */}
                  {!showModForm && (
                    <button type="button" onClick={openCreateMod}
                      className="w-full border border-dashed border-border rounded-xl py-2.5 text-sm text-muted-foreground hover:text-foreground hover:border-indigo-500/50 transition-colors flex items-center justify-center gap-2">
                      <i className="ti ti-plus text-base" aria-hidden="true" /> Agregar módulo
                    </button>
                  )}
                  </div>{/* end left panel */}

                  {/* ── RIGHT: Tema form panel ── */}
                  <div className="w-2/5 border-l border-border flex flex-col overflow-hidden min-h-0">
                    {temaModuleId === null ? (
                      /* Placeholder */
                      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
                          <i className="ti ti-file-plus text-2xl text-indigo-400/60" aria-hidden="true" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground mb-1.5">Sin tema seleccionado</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            Expande un módulo y pulsa <span className="text-indigo-400 font-medium">Añadir tema</span>, o el ícono ✎ de un tema existente.
                          </p>
                        </div>
                      </div>
                    ) : (
                      /* Tema form */
                      <>
                        {/* Panel header */}
                        <div className="px-4 py-3 border-b border-border flex items-start justify-between shrink-0">
                          <div className="min-w-0">
                            <p className="text-[10px] text-muted-foreground truncate mb-0.5">
                              {modules.find((mod) => mod.id === temaModuleId)?.titulo ?? "Módulo"}
                            </p>
                            <h3 className="text-sm font-semibold text-foreground">
                              {editingTemaId ? "Editar tema" : "Nuevo tema"}
                            </h3>
                          </div>
                          <button type="button"
                            onClick={() => { setTemaModuleId(null); setEditingTemaId(null); setTemaForm(emptyTema()); }}
                            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-accent/50 text-muted-foreground transition-colors shrink-0 ml-2 mt-0.5">
                            <i className="ti ti-x text-sm" aria-hidden="true" />
                          </button>
                        </div>

                        {/* Form body */}
                        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
                          {/* Título */}
                          <div>
                            <label className={LABEL}>Título <span className="text-red-500">*</span></label>
                            <input value={temaForm.titulo} onChange={(e) => setTemaForm({ ...temaForm, titulo: e.target.value })}
                              className={INPUT} placeholder="Nombre del tema" autoFocus />
                          </div>

                          {/* Tipo — chip selector */}
                          <div>
                            <label className={LABEL}>Tipo de contenido</label>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {(Object.keys(TEMA_TIPO_LABELS) as TemaTipo[]).map((t) => (
                                <button key={t} type="button"
                                  onClick={() => setTemaForm({ ...temaForm, tipo_contenido: t, pdfFile: null, videoFile: null, imagenFile: null })}
                                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                                    temaForm.tipo_contenido === t
                                      ? "bg-indigo-600 text-white shadow-sm"
                                      : "bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                                  }`}>
                                  <i className={`ti ${TEMA_TIPO_ICONS[t]} text-[11px]`} aria-hidden="true" />
                                  {TEMA_TIPO_LABELS[t]}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Content fields */}
                          {temaForm.tipo_contenido === "VIDEO" && (
                            <div className="space-y-3">
                              <div>
                                <label className={LABEL}>URL (YouTube, Vimeo)</label>
                                <input type="url" value={temaForm.url_video} onChange={(e) => setTemaForm({ ...temaForm, url_video: e.target.value })}
                                  placeholder="https://youtube.com/watch?v=…" className={INPUT} />
                              </div>
                              <div>
                                <label className={LABEL}>O subir archivo MP4/WebM {editingTemaId && <span className="font-normal text-muted-foreground">(vacío = mantener)</span>}</label>
                                <input type="file" accept="video/mp4,video/webm,video/ogg"
                                  onChange={(e) => setTemaForm({ ...temaForm, videoFile: e.target.files?.[0] ?? null })}
                                  className="w-full text-xs text-muted-foreground" />
                              </div>
                            </div>
                          )}
                          {temaForm.tipo_contenido === "PDF" && (
                            <div>
                              <label className={LABEL}>Archivo PDF {!editingTemaId && <span className="text-red-500">*</span>}{editingTemaId && <span className="font-normal text-muted-foreground"> (vacío = mantener)</span>}</label>
                              <input type="file" accept=".pdf,application/pdf"
                                onChange={(e) => setTemaForm({ ...temaForm, pdfFile: e.target.files?.[0] ?? null })}
                                className="w-full text-xs text-muted-foreground" />
                            </div>
                          )}
                          {temaForm.tipo_contenido === "TEXTO" && (
                            <div>
                              <label className={LABEL}>Contenido</label>
                              <RichTextEditor value={temaForm.contenido_html} onChange={(html) => setTemaForm({ ...temaForm, contenido_html: html })} />
                            </div>
                          )}
                          {temaForm.tipo_contenido === "IMAGEN" && (
                            <div>
                              <label className={LABEL}>Imagen {!editingTemaId && <span className="text-red-500">*</span>}{editingTemaId && <span className="font-normal text-muted-foreground"> (vacío = mantener)</span>}</label>
                              <input type="file" accept="image/jpeg,image/png,image/gif,image/webp"
                                onChange={(e) => setTemaForm({ ...temaForm, imagenFile: e.target.files?.[0] ?? null })}
                                className="w-full text-xs text-muted-foreground" />
                            </div>
                          )}
                          {temaForm.tipo_contenido === "IFRAME" && (
                            <div>
                              <label className={LABEL}>URL del contenido externo <span className="text-red-500">*</span></label>
                              <input type="url" value={temaForm.url_iframe} onChange={(e) => setTemaForm({ ...temaForm, url_iframe: e.target.value })}
                                placeholder="https://docs.google.com/presentation/…" className={INPUT} />
                              <p className="text-[10px] text-muted-foreground mt-1">Google Slides, Miro, Genially, simuladores web…</p>
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

                          {/* Duration */}
                          <div>
                            <label className={LABEL}>Duración estimada (min)</label>
                            <input type="number" value={temaForm.duracion_minutos}
                              onChange={(e) => setTemaForm({ ...temaForm, duracion_minutos: e.target.value })}
                              placeholder="Ej: 15" min={1}
                              className="w-28 border border-border rounded-lg px-3 py-1.5 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-colors" />
                          </div>
                        </div>

                        {/* Form footer */}
                        <div className="px-4 py-3 border-t border-border flex gap-2 justify-end shrink-0">
                          <button type="button"
                            onClick={() => { setTemaModuleId(null); setEditingTemaId(null); setTemaForm(emptyTema()); }}
                            className="px-4 py-1.5 border border-border text-muted-foreground text-sm rounded-lg hover:bg-accent/50 transition-colors">
                            Cancelar
                          </button>
                          <button type="button" onClick={() => void handleSaveTema()} disabled={temaSaving}
                            className="px-4 py-1.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 shadow-sm shadow-emerald-500/20 transition-all active:scale-[0.98]">
                            {temaSaving ? "Guardando…" : editingTemaId ? "Actualizar tema" : "Crear tema"}
                          </button>
                        </div>
                      </>
                    )}
                  </div>{/* end right panel */}

                </div>
              )}

              {/* ── Eval ──────────────────────────────────────────── */}
              {activeTab === "eval" && (
                <div className="space-y-5">
                  <div className="bg-background border border-border rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-foreground mb-4">Política de evaluación</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className={LABEL}>Puntaje mínimo (%)</label>
                        <input type="number" min={1} max={100} value={puntajeMin}
                          onChange={(e) => { setPuntajeMin(e.target.value); saveAssessmentConfig("puntaje_minimo", e.target.value); }}
                          className={INPUT} />
                      </div>
                      <div>
                        <label className={LABEL}>Intentos máximos</label>
                        <input type="number" min={1} value={maxIntentos}
                          onChange={(e) => { setMaxIntentos(e.target.value); saveAssessmentConfig("max_intentos", e.target.value); }}
                          className={INPUT} />
                      </div>
                      <div>
                        <label className={LABEL}>
                          Tiempo límite (min){" "}
                          <span className="text-muted-foreground font-normal">opcional</span>
                        </label>
                        <input type="number" min={1} placeholder="Sin límite" value={tiempoLimite}
                          onChange={(e) => { setTiempoLimite(e.target.value); saveAssessmentConfig("tiempo_limite_minutos", e.target.value); }}
                          className={INPUT} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-semibold text-foreground">
                        Banco de preguntas ({questions.length})
                      </p>
                      {!showQForm && (
                        <button type="button"
                          onClick={() => { setEditingQ(null); setShowQForm(true); }}
                          className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-1.5 transition-colors">
                          <i className="ti ti-plus text-sm" aria-hidden="true" /> Nueva pregunta
                        </button>
                      )}
                    </div>

                    {showQForm && (
                      <div className="mb-4 border border-border rounded-xl overflow-hidden">
                        <QuestionForm
                          initial={editingQ ?? undefined}
                          defaultOrden={questions.length + 1}
                          onSave={handleSaveQuestion}
                          onCancel={() => { setShowQForm(false); setEditingQ(null); }}
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      {questions.map((q, i) => (
                        <div key={q.id} className="flex items-center gap-3 p-3 bg-background border border-border rounded-xl">
                          <div className="w-6 h-6 rounded-full bg-indigo-500/15 flex items-center justify-center text-xs text-indigo-400 font-medium shrink-0">
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground truncate">{q.texto}</p>
                            <span className="text-xs bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded mt-1 inline-block">
                              {Q_LABELS[q.tipo] ?? q.tipo}
                            </span>
                          </div>
                          <button type="button" onClick={() => { setEditingQ(q); setShowQForm(true); }}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-colors">
                            <i className="ti ti-edit text-sm" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteQuestion(q.id)}
                            title={isPublished ? "No se pueden eliminar preguntas de un curso publicado" : "Eliminar pregunta"}
                            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                              isPublished
                                ? "bg-muted/20 text-muted-foreground/40 cursor-not-allowed"
                                : "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                            }`}
                          >
                            <i className="ti ti-trash text-sm" aria-hidden="true" />
                          </button>
                        </div>
                      ))}
                      {questions.length === 0 && !showQForm && (
                        <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed border-border rounded-xl">
                          No hay preguntas. Agrega la primera.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-background rounded-b-2xl shrink-0">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <i className="ti ti-info-circle text-sm" aria-hidden="true" />
                {course?.estado === "BORRADOR"
                  ? "Guardar publicará el curso automáticamente"
                  : "Los cambios se aplicarán sin alterar el estado del curso"}
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={onClose}
                  className="px-4 py-2 border border-border text-muted-foreground text-sm rounded-lg hover:bg-accent/50 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={saving}
                  className="px-5 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 transition-colors">
                  {saving ? (
                    <><div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Guardando...</>
                  ) : course?.estado === "BORRADOR" ? (
                    <><i className="ti ti-rocket text-base" aria-hidden="true" />Guardar y publicar</>
                  ) : (
                    <><i className="ti ti-device-floppy text-base" aria-hidden="true" />Guardar cambios</>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
