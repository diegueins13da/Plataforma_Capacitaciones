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
import type { Course, CourseModule, ModuleTipo } from "../../types/course";
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
    z.number({ required_error: "El área es obligatoria" }).int().positive("El área es obligatoria")
  ),
  fecha_limite: z.string().optional(),
  version: z.string().min(1, "Requerido"),
  imagen_portada: z.string().optional(),
  duracion_horas: z.coerce.number().nullable().optional(),
  cert_expira_meses: z.coerce.number().min(1, "Mínimo 1 mes").nullable().optional(),
});
type InfoValues = z.infer<typeof infoSchema>;

// ---------------------------------------------------------------------------
// Module form state
// ---------------------------------------------------------------------------
interface ModuleFormState {
  titulo: string;
  tipo_contenido: ModuleTipo;
  url_video: string;
  contenido_html: string;
  duracion_minutos: string;
  pdfFile: File | null;
}

const MOD_ICONS: Record<ModuleTipo, string> = {
  VIDEO: "ti-player-play",
  PDF: "ti-file-text",
  TEXTO: "ti-file-description",
  SCORM: "ti-package",
};

const MOD_LABELS: Record<ModuleTipo, string> = {
  VIDEO: "Video",
  PDF: "PDF",
  TEXTO: "Texto HTML",
  SCORM: "SCORM",
};

const Q_LABELS: Record<string, string> = {
  MULTIPLE_CHOICE: "Selección única",
  MULTIPLE_SELECT: "Selección múltiple",
  TRUE_FALSE: "V / F",
};

function emptyMod(): ModuleFormState {
  return { titulo: "", tipo_contenido: "TEXTO", url_video: "", contenido_html: "", duracion_minutos: "", pdfFile: null };
}

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
  const [editingModId, setEditingModId] = useState<number | null>(null);
  const [modForm, setModForm] = useState<ModuleFormState>(emptyMod());
  const [modSaving, setModSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

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
    setEditingModId(null);
    setModForm(emptyMod());
    setShowModForm(true);
  }

  function openEditMod(m: CourseModule) {
    setEditingModId(m.id);
    setModForm({
      titulo: m.titulo,
      tipo_contenido: m.tipo_contenido,
      url_video: m.url_video ?? "",
      contenido_html: m.contenido_html ?? "",
      duracion_minutos: m.duracion_minutos ? String(m.duracion_minutos) : "",
      pdfFile: null,
    });
    setShowModForm(true);
  }

  async function handleSaveMod() {
    if (!modForm.titulo.trim()) { toast.error("El título es obligatorio."); return; }
    if (modForm.tipo_contenido === "VIDEO" && !modForm.url_video.trim()) { toast.error("La URL del video es obligatoria."); return; }
    if (modForm.tipo_contenido === "PDF" && !editingModId && !modForm.pdfFile) { toast.error("Selecciona un archivo PDF."); return; }
    setModSaving(true);
    setUploadProgress(0);
    try {
      const payload = {
        titulo: modForm.titulo.trim(),
        tipo_contenido: modForm.tipo_contenido,
        url_video: modForm.url_video,
        contenido_html: modForm.contenido_html,
        duracion_minutos: modForm.duracion_minutos ? parseInt(modForm.duracion_minutos) : null,
      };
      let saved: CourseModule;
      if (editingModId) {
        saved = await coursesService.updateModule(courseId, editingModId, payload, modForm.pdfFile ?? undefined, setUploadProgress);
        setModules((ms) => ms.map((m) => (m.id === editingModId ? saved : m)));
      } else {
        saved = await coursesService.createModule(courseId, payload, modForm.pdfFile ?? undefined, setUploadProgress);
        setModules((ms) => [...ms, saved]);
      }
      setShowModForm(false);
      toast.success(editingModId ? "Módulo actualizado." : "Módulo creado.");
    } catch {
      toast.error("No se pudo guardar el módulo.");
    } finally {
      setModSaving(false);
      setUploadProgress(0);
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
      <div className="bg-card border border-border rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">

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

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">

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

              {/* ── Modules ───────────────────────────────────────── */}
              {activeTab === "modules" && (
                <div className="space-y-3">
                  {modules.length === 0 && !showModForm && (
                    <div className="text-center py-10 text-muted-foreground text-sm border-2 border-dashed border-border rounded-xl">
                      No hay módulos. Agrega el primero.
                    </div>
                  )}
                  {modules.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 p-3 bg-background border border-border rounded-xl">
                      <div className="w-9 h-9 rounded-lg bg-indigo-500/15 flex items-center justify-center shrink-0">
                        <i className={`ti ${MOD_ICONS[m.tipo_contenido]} text-indigo-400`} aria-hidden="true" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{m.titulo}</p>
                        <p className="text-xs text-muted-foreground">
                          {MOD_LABELS[m.tipo_contenido]}{m.duracion_minutos ? ` · ${m.duracion_minutos} min` : ""}
                        </p>
                      </div>
                      <button type="button" onClick={() => openEditMod(m)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-colors">
                        <i className="ti ti-edit text-sm" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteMod(m)}
                        title={isPublished ? "No se pueden eliminar módulos de un curso publicado" : "Eliminar módulo"}
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

                  {showModForm ? (
                    <div className="border border-border rounded-xl p-5 bg-background space-y-4 mt-2">
                      <h3 className="text-sm font-semibold text-foreground">
                        {editingModId ? "Editar módulo" : "Nuevo módulo"}
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className={LABEL}>Título <span className="text-red-500">*</span></label>
                          <input value={modForm.titulo} onChange={(e) => setModForm({ ...modForm, titulo: e.target.value })} className={INPUT} />
                        </div>
                        <div>
                          <label className={LABEL}>Tipo</label>
                          <select value={modForm.tipo_contenido}
                            onChange={(e) => setModForm({ ...modForm, tipo_contenido: e.target.value as ModuleTipo })}
                            className={INPUT}>
                            {(Object.keys(MOD_LABELS) as ModuleTipo[]).map((t) => (
                              <option key={t} value={t}>{MOD_LABELS[t]}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      {modForm.tipo_contenido === "VIDEO" && (
                        <div>
                          <label className={LABEL}>URL del video <span className="text-red-500">*</span></label>
                          <input type="url" value={modForm.url_video}
                            onChange={(e) => setModForm({ ...modForm, url_video: e.target.value })}
                            placeholder="https://youtube.com/watch?v=..." className={INPUT} />
                        </div>
                      )}
                      {modForm.tipo_contenido === "PDF" && (
                        <div>
                          <label className={LABEL}>
                            Archivo PDF {!editingModId && <span className="text-red-500">*</span>}
                            {editingModId && <span className="text-muted-foreground"> (vacío = mantener actual)</span>}
                          </label>
                          <input type="file" accept=".pdf,application/pdf"
                            onChange={(e) => setModForm({ ...modForm, pdfFile: e.target.files?.[0] ?? null })}
                            className="w-full text-sm text-muted-foreground" />
                          {uploadProgress > 0 && uploadProgress < 100 && (
                            <div className="mt-2">
                              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500 transition-all" style={{ width: `${uploadProgress}%` }} />
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{uploadProgress}%</p>
                            </div>
                          )}
                        </div>
                      )}
                      {modForm.tipo_contenido === "TEXTO" && (
                        <div>
                          <label className={LABEL}>Contenido</label>
                          <RichTextEditor value={modForm.contenido_html} onChange={(html) => setModForm({ ...modForm, contenido_html: html })} />
                        </div>
                      )}
                      {modForm.tipo_contenido === "SCORM" && (
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-sm text-amber-400">
                          SCORM estará disponible en la Fase 2 del proyecto.
                        </div>
                      )}
                      <div>
                        <label className={LABEL}>Duración estimada (minutos)</label>
                        <input type="number" value={modForm.duracion_minutos}
                          onChange={(e) => setModForm({ ...modForm, duracion_minutos: e.target.value })}
                          placeholder="Ej: 30" min={1} className={INPUT} />
                      </div>
                      <div className="flex gap-2 justify-end pt-1">
                        <button type="button" onClick={() => setShowModForm(false)}
                          className="px-4 py-2 border border-border text-muted-foreground text-sm rounded-lg hover:bg-accent/50 transition-colors">
                          Cancelar
                        </button>
                        <button type="button" onClick={handleSaveMod}
                          disabled={modSaving || modForm.tipo_contenido === "SCORM"}
                          className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                          {modSaving ? "Guardando..." : editingModId ? "Actualizar" : "Agregar"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={openCreateMod}
                      className="w-full border border-dashed border-border rounded-xl py-3 text-sm text-muted-foreground hover:text-foreground hover:border-indigo-500/40 transition-colors flex items-center justify-center gap-2 mt-1">
                      <i className="ti ti-plus text-base" aria-hidden="true" /> Agregar módulo
                    </button>
                  )}
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
