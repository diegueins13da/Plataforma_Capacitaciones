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
import type { CourseModule, ModuleTipo } from "../../types/course";
import type { Assessment, CreateQuestionPayload, Question } from "../../types/assessment";

// ── Schema ──────────────────────────────────────────────────────────────────
const schema = z.object({
  titulo: z.string().min(3, "El título debe tener al menos 3 caracteres"),
  descripcion: z.string().optional(),
  tipo: z.enum(["ONLINE", "PRESENCIAL", "HIBRIDO", "AUTOAPRENDIZAJE"], {
    required_error: "Selecciona el tipo de entrega",
  }),
  area: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
    z.number({ required_error: "El área es obligatoria" }).int().positive("Selecciona un área")
  ),
  version: z.string().min(1, "La versión es obligatoria"),
  fecha_limite: z.string().optional(),
  duracion_horas: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
    z.number().int().positive("Debe ser un número positivo").nullable().optional()
  ),
  cert_expira_meses: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
    z.number().int().min(1, "Mínimo 1 mes").nullable().optional()
  ),
  imagen_portada: z.string().url("Debe ser una URL válida").or(z.literal("")).optional(),
});
type FormValues = z.infer<typeof schema>;

// ── Constants ────────────────────────────────────────────────────────────────
const MOD_ICONS: Record<ModuleTipo, string> = {
  VIDEO: "ti-player-play", PDF: "ti-file-text", TEXTO: "ti-file-description", SCORM: "ti-package",
};
const MOD_LABELS: Record<ModuleTipo, string> = {
  VIDEO: "Video", PDF: "PDF", TEXTO: "Texto HTML", SCORM: "SCORM",
};
const Q_LABELS: Record<string, string> = {
  MULTIPLE_CHOICE: "Selección única", MULTIPLE_SELECT: "Selección múltiple", TRUE_FALSE: "V / F",
};

interface ModForm {
  titulo: string; tipo_contenido: ModuleTipo; url_video: string;
  contenido_html: string; duracion_minutos: string; pdfFile: File | null;
}
function emptyMod(): ModForm {
  return { titulo: "", tipo_contenido: "TEXTO", url_video: "", contenido_html: "", duracion_minutos: "", pdfFile: null };
}

// ── Props ────────────────────────────────────────────────────────────────────
interface Props {
  onClose: () => void;
  onCreated: () => void;
}

// ── CSS tokens ───────────────────────────────────────────────────────────────
const INPUT = "w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-colors";
const LABEL = "block text-xs font-medium text-muted-foreground mb-1";

// ── Component ────────────────────────────────────────────────────────────────
export function CourseCreateModal({ onClose, onCreated }: Props) {
  type TabKey = "info" | "modules" | "eval";
  const [activeTab, setActiveTab] = useState<TabKey>("info");

  // Course lifecycle
  const [courseId, setCourseId] = useState<number | null>(null);
  const [courseTitle, setCourseTitle] = useState("");
  const [courseEstado, setCourseEstado] = useState<"BORRADOR" | "PUBLICADO">("BORRADOR");

  // Data
  const [areas, setAreas] = useState<Area[]>([]);
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);

  // UI state
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showModForm, setShowModForm] = useState(false);
  const [editingModId, setEditingModId] = useState<number | null>(null);
  const [modForm, setModForm] = useState<ModForm>(emptyMod());
  const [modSaving, setModSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [puntajeMin, setPuntajeMin] = useState("70");
  const [maxIntentos, setMaxIntentos] = useState("3");
  const [tiempoLimite, setTiempoLimite] = useState("");
  const [showQForm, setShowQForm] = useState(false);
  const [editingQ, setEditingQ] = useState<Question | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { version: "1.0", tipo: "ONLINE" },
  });

  // Lock scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // Load areas
  useEffect(() => {
    configService.getAreas().then(setAreas).catch(() => void 0);
  }, []);

  // Load assessment once course exists
  useEffect(() => {
    if (!courseId) return;
    assessmentsService
      .getAssessmentForCourse(courseId)
      .then(async (ass) => {
        setAssessment(ass);
        setPuntajeMin(String(ass.puntaje_minimo));
        setMaxIntentos(String(ass.max_intentos));
        setTiempoLimite(ass.tiempo_limite_minutos ? String(ass.tiempo_limite_minutos) : "");
        const qs = await assessmentsService.listQuestions(ass.id);
        setQuestions(qs);
      })
      .catch(() => void 0);
  }, [courseId]);

  // ── Create course ────────────────────────────────────────────────────────
  async function onSubmitCreate(values: FormValues) {
    setCreating(true);
    try {
      const course = await coursesService.createCourse({
        titulo: values.titulo,
        descripcion: values.descripcion,
        tipo: values.tipo,
        area: values.area as number,
        fecha_limite: values.fecha_limite || null,
        version: values.version,
        imagen_portada: values.imagen_portada || undefined,
        duracion_horas: values.duracion_horas ?? null,
        cert_expira_meses: values.cert_expira_meses ?? null,
      });
      setCourseId(course.id);
      setCourseTitle(values.titulo);
      onCreated();
      toast.success(`"${values.titulo}" creado correctamente`, {
        description: "Ahora agrega los módulos de contenido.",
        duration: 5000,
      });
      setActiveTab("modules");
    } catch (err: unknown) {
      type ApiErr = { response?: { data?: Record<string, unknown> } };
      const data = (err as ApiErr)?.response?.data;
      const first = data ? Object.values(data)[0] : null;
      const msg = Array.isArray(first) ? String(first[0]) : typeof first === "string" ? first : "No se pudo crear el curso. Verifica los datos e intenta de nuevo.";
      toast.error(msg, { duration: 6000 });
    } finally {
      setCreating(false);
    }
  }

  // ── Save info (after creation) ────────────────────────────────────────────
  async function onSubmitSave(values: FormValues) {
    if (!courseId) return;
    setSaving(true);
    try {
      await coursesService.updateCourse(courseId, {
        titulo: values.titulo,
        descripcion: values.descripcion,
        tipo: values.tipo,
        area: values.area as number,
        fecha_limite: values.fecha_limite || null,
        version: values.version,
        imagen_portada: values.imagen_portada || undefined,
        duracion_horas: values.duracion_horas ?? null,
        cert_expira_meses: values.cert_expira_meses ?? null,
      });
      await coursesService.publishCourse(courseId);
      setCourseEstado("PUBLICADO");
      setCourseTitle(values.titulo);
      onCreated();
      toast.success("Curso publicado exitosamente.");
      onClose();
    } catch (err: unknown) {
      type ApiErr = { response?: { data?: { error?: string; detail?: string } } };
      const d = (err as ApiErr)?.response?.data;
      toast.error(d?.error ?? d?.detail ?? "No se pudo guardar.", { duration: 6000 });
    } finally {
      setSaving(false);
    }
  }

  // ── Modules ──────────────────────────────────────────────────────────────
  function openCreateMod() { setEditingModId(null); setModForm(emptyMod()); setShowModForm(true); }
  function openEditMod(m: CourseModule) {
    setEditingModId(m.id);
    setModForm({ titulo: m.titulo, tipo_contenido: m.tipo_contenido, url_video: m.url_video ?? "",
      contenido_html: m.contenido_html ?? "", duracion_minutos: m.duracion_minutos ? String(m.duracion_minutos) : "", pdfFile: null });
    setShowModForm(true);
  }

  async function handleSaveMod() {
    if (!courseId) return;
    if (!modForm.titulo.trim()) { toast.error("El título del módulo es obligatorio."); return; }
    if (modForm.tipo_contenido === "VIDEO" && !modForm.url_video.trim()) { toast.error("La URL del video es obligatoria."); return; }
    if (modForm.tipo_contenido === "PDF" && !editingModId && !modForm.pdfFile) { toast.error("Selecciona un archivo PDF."); return; }
    setModSaving(true); setUploadProgress(0);
    try {
      const payload = { titulo: modForm.titulo.trim(), tipo_contenido: modForm.tipo_contenido,
        url_video: modForm.url_video, contenido_html: modForm.contenido_html,
        duracion_minutos: modForm.duracion_minutos ? parseInt(modForm.duracion_minutos) : null };
      let saved: CourseModule;
      if (editingModId) {
        saved = await coursesService.updateModule(courseId, editingModId, payload, modForm.pdfFile ?? undefined, setUploadProgress);
        setModules((ms) => ms.map((m) => (m.id === editingModId ? saved : m)));
      } else {
        saved = await coursesService.createModule(courseId, payload, modForm.pdfFile ?? undefined, setUploadProgress);
        setModules((ms) => [...ms, saved]);
      }
      setShowModForm(false);
      toast.success(editingModId ? "Módulo actualizado." : "Módulo agregado.");
    } catch { toast.error("No se pudo guardar el módulo."); }
    finally { setModSaving(false); setUploadProgress(0); }
  }

  async function handleDeleteMod(m: CourseModule) {
    if (!courseId) return;
    try {
      await coursesService.deleteModule(courseId, m.id);
      setModules((ms) => ms.filter((x) => x.id !== m.id));
      toast.success("Módulo eliminado.");
    } catch { toast.error("No se pudo eliminar el módulo."); }
  }

  // ── Assessment ────────────────────────────────────────────────────────────
  const saveAssessmentConfig = useCallback((field: string, value: string) => {
    if (!assessment) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const payload: Record<string, number | null> = {};
      if (field === "puntaje_minimo") payload.puntaje_minimo = Number(value) || 70;
      if (field === "max_intentos") payload.max_intentos = Number(value) || 3;
      if (field === "tiempo_limite_minutos") payload.tiempo_limite_minutos = value ? Number(value) : null;
      try { await assessmentsService.updateAssessment(assessment.id, payload); } catch { /* silent */ }
    }, 800);
  }, [assessment]);

  async function handleSaveQuestion(payload: CreateQuestionPayload) {
    if (!assessment || !courseId) return;
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
    } catch { toast.error("No se pudo guardar la pregunta."); }
    finally {
      setShowQForm(false); setEditingQ(null);
      const a = await assessmentsService.getAssessmentForCourse(courseId);
      setAssessment(a);
    }
  }

  async function handleDeleteQuestion(qId: number) {
    if (!assessment || !courseId) return;
    try {
      await assessmentsService.deleteQuestion(assessment.id, qId);
      setQuestions((qs) => qs.filter((q) => q.id !== qId));
      toast.success("Pregunta eliminada.");
      const a = await assessmentsService.getAssessmentForCourse(courseId);
      setAssessment(a);
    } catch { toast.error("No se pudo eliminar la pregunta."); }
  }

  // ── Tab click guard ───────────────────────────────────────────────────────
  function handleTabClick(key: TabKey) {
    if (key !== "info" && !courseId) {
      toast.info("Primero completa la información y crea el curso.");
      return;
    }
    setActiveTab(key);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const tabs = [
    { key: "info" as const, icon: "ti-info-circle", label: "Información" },
    { key: "modules" as const, icon: "ti-books", label: `Módulos${courseId ? ` (${modules.length})` : ""}` },
    { key: "eval" as const, icon: "ti-clipboard-check", label: `Evaluación${courseId && questions.length > 0 ? ` (${questions.length})` : ""}` },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background rounded-t-2xl shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 flex items-center justify-center shrink-0">
              <i className={`ti ${courseId ? "ti-books" : "ti-plus"} text-indigo-400 text-lg`} aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground leading-tight">
                {courseId ? courseTitle : "Nuevo curso"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {courseId ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                    Guardado como borrador — edita los módulos y evaluación
                  </span>
                ) : "Completa la información para crear el curso"}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-accent/50 text-muted-foreground transition-colors"
            aria-label="Cerrar">
            <i className="ti ti-x text-base" aria-hidden="true" />
          </button>
        </div>

        {/* ── Tabs ──────────────────────────────────────────────────────────── */}
        <div className="flex border-b border-border bg-background px-6 shrink-0">
          {tabs.map((tab) => {
            const locked = tab.key !== "info" && !courseId;
            return (
              <button key={tab.key} type="button" onClick={() => handleTabClick(tab.key)}
                className={[
                  "flex items-center gap-2 px-4 py-3 text-sm border-b-2 -mb-px transition-colors",
                  locked ? "cursor-not-allowed opacity-40" : "",
                  activeTab === tab.key
                    ? "border-indigo-500 text-indigo-400"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
                ].join(" ")}
                title={locked ? "Primero crea el curso en la pestaña Información" : undefined}>
                <i className={`ti ${tab.icon} text-base`} aria-hidden="true" />
                {tab.label}
                {locked && <i className="ti ti-lock text-xs opacity-60" aria-hidden="true" />}
              </button>
            );
          })}
        </div>

        {/* ── Body ──────────────────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit(courseId ? onSubmitSave : onSubmitCreate)} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5">

            {/* ─── INFORMACIÓN ─────────────────────────────────────────────── */}
            {activeTab === "info" && (
              <div className="space-y-5">

                {/* Banner informativo antes de crear */}
                {!courseId && (
                  <div className="flex items-start gap-2.5 p-3 bg-indigo-500/8 border border-indigo-500/20 rounded-xl">
                    <i className="ti ti-bulb text-indigo-400 text-base mt-0.5 shrink-0" aria-hidden="true" />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      El curso se creará como <strong className="text-foreground">borrador</strong> — podrás
                      agregar módulos y configurar la evaluación antes de publicarlo.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {/* Título — full width */}
                  <div className="col-span-2">
                    <label className={LABEL}>Título del curso <span className="text-red-500">*</span></label>
                    <input {...register("titulo")} className={INPUT} placeholder="Ej: Introducción a Riesgos Operativos" autoFocus />
                    {errors.titulo && <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><i className="ti ti-alert-circle text-xs" aria-hidden="true" />{errors.titulo.message}</p>}
                  </div>

                  {/* Descripción — full width */}
                  <div className="col-span-2">
                    <label className={LABEL}>Descripción / objetivo</label>
                    <textarea {...register("descripcion")} rows={3} className={INPUT + " resize-none"}
                      placeholder="¿Qué aprenderá el participante?" />
                  </div>

                  {/* Tipo */}
                  <div>
                    <label className={LABEL}>Tipo de entrega <span className="text-red-500">*</span></label>
                    <select {...register("tipo")} className={INPUT}>
                      <option value="ONLINE">Online</option>
                      <option value="PRESENCIAL">Presencial</option>
                      <option value="HIBRIDO">Híbrido</option>
                      <option value="AUTOAPRENDIZAJE">Autoaprendizaje</option>
                    </select>
                    {errors.tipo && <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><i className="ti ti-alert-circle text-xs" aria-hidden="true" />{errors.tipo.message}</p>}
                  </div>

                  {/* Área */}
                  <div>
                    <label className={LABEL}>Área <span className="text-red-500">*</span></label>
                    <select {...register("area")} className={INPUT}>
                      <option value="">— Selecciona un área —</option>
                      {areas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                    </select>
                    {errors.area && <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><i className="ti ti-alert-circle text-xs" aria-hidden="true" />{errors.area.message}</p>}
                  </div>

                  {/* Versión */}
                  <div>
                    <label className={LABEL}>Versión <span className="text-red-500">*</span></label>
                    <input {...register("version")} className={INPUT} placeholder="1.0" />
                    {errors.version && <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><i className="ti ti-alert-circle text-xs" aria-hidden="true" />{errors.version.message}</p>}
                  </div>

                  {/* Fecha límite */}
                  <div>
                    <label className={LABEL}>Fecha límite <span className="text-muted-foreground font-normal">(opcional)</span></label>
                    <input {...register("fecha_limite")} type="date" className={INPUT} />
                  </div>

                  {/* Duración */}
                  <div>
                    <label className={LABEL}>Duración <span className="text-muted-foreground font-normal">(horas)</span></label>
                    <input {...register("duracion_horas")} type="number" min={1} className={INPUT} placeholder="Ej: 8" />
                    {errors.duracion_horas && <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><i className="ti ti-alert-circle text-xs" aria-hidden="true" />{errors.duracion_horas.message}</p>}
                  </div>

                  {/* Cert expira */}
                  <div>
                    <label className={LABEL}>Certificado vigente <span className="text-muted-foreground font-normal">(meses)</span></label>
                    <input {...register("cert_expira_meses")} type="number" min={1} className={INPUT} placeholder="Ej: 12" />
                    {errors.cert_expira_meses && <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><i className="ti ti-alert-circle text-xs" aria-hidden="true" />{errors.cert_expira_meses.message}</p>}
                  </div>

                  {/* Imagen */}
                  <div className="col-span-2">
                    <label className={LABEL}>URL imagen de portada <span className="text-muted-foreground font-normal">(opcional)</span></label>
                    <input {...register("imagen_portada")} type="url" className={INPUT} placeholder="https://..." />
                    {errors.imagen_portada && <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><i className="ti ti-alert-circle text-xs" aria-hidden="true" />{errors.imagen_portada.message}</p>}
                  </div>
                </div>
              </div>
            )}

            {/* ─── MÓDULOS ─────────────────────────────────────────────────── */}
            {activeTab === "modules" && courseId && (
              <div className="space-y-3">
                {modules.length === 0 && !showModForm && (
                  <div className="text-center py-12 text-muted-foreground text-sm border-2 border-dashed border-border rounded-xl">
                    <i className="ti ti-books text-3xl block mb-2 opacity-30" aria-hidden="true" />
                    No hay módulos aún. Agrega el primero.
                  </div>
                )}
                {modules.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 p-3 bg-background border border-border rounded-xl">
                    <div className="w-9 h-9 rounded-lg bg-indigo-500/15 flex items-center justify-center shrink-0">
                      <i className={`ti ${MOD_ICONS[m.tipo_contenido]} text-indigo-400`} aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{m.titulo}</p>
                      <p className="text-xs text-muted-foreground">{MOD_LABELS[m.tipo_contenido]}{m.duracion_minutos ? ` · ${m.duracion_minutos} min` : ""}</p>
                    </div>
                    <button type="button" onClick={() => openEditMod(m)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-colors">
                      <i className="ti ti-edit text-sm" aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => void handleDeleteMod(m)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
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
                        <input value={modForm.titulo} onChange={(e) => setModForm({ ...modForm, titulo: e.target.value })} className={INPUT} autoFocus />
                      </div>
                      <div>
                        <label className={LABEL}>Tipo de contenido</label>
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
                        <label className={LABEL}>Archivo PDF {!editingModId && <span className="text-red-500">*</span>}</label>
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
                        <label className={LABEL}>Contenido del módulo</label>
                        <RichTextEditor value={modForm.contenido_html} onChange={(html) => setModForm({ ...modForm, contenido_html: html })} />
                      </div>
                    )}
                    {modForm.tipo_contenido === "SCORM" && (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-sm text-amber-400">
                        SCORM estará disponible en la próxima versión.
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
                      <button type="button" onClick={() => void handleSaveMod()}
                        disabled={modSaving || modForm.tipo_contenido === "SCORM"}
                        className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2">
                        {modSaving
                          ? <><div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Guardando...</>
                          : <><i className="ti ti-device-floppy text-base" aria-hidden="true" />{editingModId ? "Actualizar" : "Agregar módulo"}</>}
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

            {/* ─── EVALUACIÓN ──────────────────────────────────────────────── */}
            {activeTab === "eval" && courseId && (
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
                      <label className={LABEL}>Tiempo límite (min) <span className="text-muted-foreground font-normal">opcional</span></label>
                      <input type="number" min={1} placeholder="Sin límite" value={tiempoLimite}
                        onChange={(e) => { setTiempoLimite(e.target.value); saveAssessmentConfig("tiempo_limite_minutos", e.target.value); }}
                        className={INPUT} />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-foreground">Banco de preguntas ({questions.length})</p>
                    {!showQForm && (
                      <button type="button" onClick={() => { setEditingQ(null); setShowQForm(true); }}
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
                        onSave={(p) => void handleSaveQuestion(p)}
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
                        <button type="button" onClick={() => void handleDeleteQuestion(q.id)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
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

          {/* ── Footer ──────────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-background rounded-b-2xl shrink-0">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <i className="ti ti-info-circle text-sm" aria-hidden="true" />
              {!courseId
                ? "Los campos marcados con * son obligatorios"
                : activeTab === "info"
                ? "Guardar publicará el curso y estará visible para los alumnos"
                : activeTab === "modules"
                ? `${modules.length} módulo${modules.length !== 1 ? "s" : ""} — los cambios se guardan inmediatamente`
                : "La evaluación se guarda automáticamente al modificar"}
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={onClose}
                className="px-4 py-2 border border-border text-muted-foreground text-sm rounded-lg hover:bg-accent/50 transition-colors">
                {courseId ? "Cerrar" : "Cancelar"}
              </button>

              {/* Show submit only on Info tab */}
              {activeTab === "info" && (
                <button type="submit" disabled={creating || saving}
                  className="px-5 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 transition-colors">
                  {creating || saving ? (
                    <><div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />{creating ? "Creando..." : "Guardando..."}</>
                  ) : courseId ? (
                    <><i className="ti ti-rocket text-base" aria-hidden="true" />Guardar y publicar</>
                  ) : (
                    <><i className="ti ti-plus text-base" aria-hidden="true" />Crear curso</>
                  )}
                </button>
              )}

              {/* Nav button in Modules/Eval tab */}
              {activeTab === "modules" && (
                <button type="button" onClick={() => setActiveTab("eval")}
                  className="px-5 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 flex items-center gap-2 transition-colors">
                  Configurar evaluación
                  <i className="ti ti-arrow-right text-base" aria-hidden="true" />
                </button>
              )}
              {activeTab === "eval" && (
                <button type="button" onClick={() => { onCreated(); onClose(); }}
                  className="px-5 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 flex items-center gap-2 transition-colors">
                  <i className="ti ti-check text-base" aria-hidden="true" />
                  Listo
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
