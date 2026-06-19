/**
 * P34 — AI Generator
 * Section A: document upload → module proposals (approve/edit/discard)
 * Section B: question generation config → question proposals (approve/edit/discard/regenerate)
 */
import { useCallback, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { assessmentsService } from "../../../services/assessmentsService";
import { coursesService } from "../../../services/coursesService";
import { aiService, type ProposedModule, type ProposedQuestion } from "../../../services/aiService";
import { useTaskPolling } from "../../../hooks/useTaskPolling";
import type { CreateQuestionPayload } from "../../../types/assessment";

const ALLOWED_TYPES = [".pdf", ".pptx", ".ppt"];
const MAX_SIZE_MB = 20;

// ---------------------------------------------------------------------------
// Section A — Module proposals
// ---------------------------------------------------------------------------

interface ModuleState {
  data: ProposedModule;
  status: "pending" | "approved" | "discarded";
  editing: boolean;
  draft: ProposedModule;
}

function ModuleCard({
  mod,
  onApprove,
  onDiscard,
  onEdit,
  onSaveEdit,
  onCancelEdit,
}: {
  mod: ModuleState;
  onApprove: () => void;
  onDiscard: () => void;
  onEdit: () => void;
  onSaveEdit: (d: ProposedModule) => void;
  onCancelEdit: () => void;
}) {
  const [draft, setDraft] = useState(mod.draft);

  if (mod.editing) {
    return (
      <div className="border border-indigo-500/30 rounded-xl p-4 bg-indigo-500/10 space-y-3">
        <input
          className="w-full border border-border rounded-lg px-3 py-2 text-sm font-medium"
          value={draft.title}
          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          placeholder="Título del módulo"
        />
        <input
          className="w-full border border-border rounded-lg px-3 py-2 text-sm"
          value={draft.objetivo}
          onChange={(e) => setDraft((d) => ({ ...d, objetivo: e.target.value }))}
          placeholder="Objetivo de aprendizaje"
        />
        <textarea
          className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none"
          rows={3}
          value={draft.descripcion}
          onChange={(e) => setDraft((d) => ({ ...d, descripcion: e.target.value }))}
          placeholder="Descripción"
        />
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onCancelEdit} className="text-xs text-muted-foreground hover:underline">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onSaveEdit(draft)}
            className="text-xs text-indigo-600 font-medium hover:underline"
          >
            Guardar
          </button>
        </div>
      </div>
    );
  }

  const statusColor =
    mod.status === "approved"
      ? "border-emerald-500/30 bg-emerald-500/10"
      : mod.status === "discarded"
      ? "border-border bg-background opacity-50"
      : "border-border bg-card";

  return (
    <div className={`border rounded-xl p-4 space-y-2 ${statusColor}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">{mod.data.title}</p>
        {mod.status === "approved" && (
          <span className="shrink-0 text-xs text-emerald-500 font-medium">✓ Aprobado</span>
        )}
      </div>
      <p className="text-xs text-indigo-600">{mod.data.objetivo}</p>
      <p className="text-xs text-muted-foreground">{mod.data.descripcion}</p>
      {mod.status !== "discarded" && (
        <div className="flex gap-3 pt-1">
          {mod.status !== "approved" && (
            <button type="button" onClick={onApprove} className="text-xs text-emerald-500 hover:underline font-medium">
              Aprobar
            </button>
          )}
          <button type="button" onClick={onEdit} className="text-xs text-indigo-500 hover:underline">
            Editar
          </button>
          <button type="button" onClick={onDiscard} className="text-xs text-red-400 hover:underline">
            Descartar
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section B — Question proposals
// ---------------------------------------------------------------------------

interface QuestionState {
  data: ProposedQuestion;
  status: "pending" | "approved" | "discarded";
  editing: boolean;
}

const TIPO_LABELS: Record<string, string> = {
  MULTIPLE_CHOICE: "Única",
  MULTIPLE_SELECT: "Múltiple",
  TRUE_FALSE: "V/F",
};

function QuestionCard({
  q,
  index,
  onApprove,
  onDiscard,
  onRegenerate,
}: {
  q: QuestionState;
  index: number;
  onApprove: () => void;
  onDiscard: () => void;
  onRegenerate: () => void;
}) {
  const statusColor =
    q.status === "approved"
      ? "border-emerald-500/30 bg-emerald-500/10"
      : q.status === "discarded"
      ? "border-border bg-background opacity-40"
      : "border-border bg-card";

  return (
    <div className={`border rounded-xl p-4 space-y-2 ${statusColor}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-muted/40 flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
            {index + 1}
          </span>
          <span className="text-xs text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full">
            {TIPO_LABELS[q.data.tipo] ?? q.data.tipo}
          </span>
          <span className="text-xs text-muted-foreground">{q.data.dificultad}</span>
        </div>
        {q.status === "approved" && (
          <span className="shrink-0 text-xs text-emerald-500 font-medium">✓ Aprobada</span>
        )}
      </div>
      <p className="text-sm text-foreground font-medium">{q.data.texto}</p>
      {q.data.opciones.length > 0 && (
        <ul className="text-xs text-muted-foreground space-y-0.5 ml-2">
          {q.data.opciones.map((op, i) => {
            const isCorrect =
              q.data.tipo === "MULTIPLE_CHOICE"
                ? q.data.respuesta_correcta === i
                : Array.isArray(q.data.respuesta_correcta)
                ? (q.data.respuesta_correcta as number[]).includes(i)
                : false;
            return (
              <li key={i} className={isCorrect ? "text-emerald-500 font-medium" : ""}>
                {isCorrect ? "✓ " : "○ "}
                {op}
              </li>
            );
          })}
        </ul>
      )}
      {q.data.tipo === "TRUE_FALSE" && (
        <p className="text-xs text-emerald-500 font-medium">
          ✓ {q.data.respuesta_correcta ? "Verdadero" : "Falso"}
        </p>
      )}
      {q.status !== "discarded" && (
        <div className="flex gap-3 pt-1">
          {q.status !== "approved" && (
            <button type="button" onClick={onApprove} className="text-xs text-emerald-500 hover:underline font-medium">
              Aprobar
            </button>
          )}
          <button type="button" onClick={onRegenerate} className="text-xs text-indigo-500 hover:underline">
            Regenerar
          </button>
          <button type="button" onClick={onDiscard} className="text-xs text-red-400 hover:underline">
            Descartar
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AIGeneratorPage() {
  const { id: courseId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // --- Section A state ---
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [moduleCount, setModuleCount] = useState(5);
  const [modules, setModules] = useState<ModuleState[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [addingModules, setAddingModules] = useState(false);
  const modulePolling = useTaskPolling();

  // --- Section B state ---
  const [qContent, setQContent] = useState("");
  const [qCantidad, setQCantidad] = useState(5);
  const [qDificultad, setQDificultad] = useState<"FACIL" | "MEDIO" | "DIFICIL">("MEDIO");
  const [qTipos, setQTipos] = useState<string[]>(["MULTIPLE_CHOICE"]);
  const [questions, setQuestions] = useState<QuestionState[]>([]);
  const [savingQuestions, setSavingQuestions] = useState(false);
  const questionPolling = useTaskPolling();

  // --- File validation ---
  function validateFile(file: File): string | null {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_TYPES.includes(ext)) return `Solo se aceptan: ${ALLOWED_TYPES.join(", ")}`;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) return `El archivo supera ${MAX_SIZE_MB} MB`;
    return null;
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateFile(file);
    if (err) { toast.error(err); return; }
    setSelectedFile(file);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const err = validateFile(file);
    if (err) { toast.error(err); return; }
    setSelectedFile(file);
  }

  // --- Upload & analyze ---
  async function handleAnalyze() {
    if (!selectedFile) return;
    setUploadingDoc(true);
    modulePolling.reset();
    setModules([]);
    try {
      const { task_id } = await aiService.uploadDocument(selectedFile, moduleCount);
      modulePolling.startPolling(task_id);
    } catch {
      toast.error("No se pudo iniciar el análisis.");
    } finally {
      setUploadingDoc(false);
    }
  }

  // Load modules when polling succeeds
  const prevModuleStatus = useRef(modulePolling.status);
  if (modulePolling.status === "success" && prevModuleStatus.current !== "success") {
    prevModuleStatus.current = "success";
    const raw = modulePolling.taskStatus?.result?.modules ?? [];
    setModules(
      raw.map((m) => ({ data: m, status: "pending", editing: false, draft: { ...m } }))
    );
  }
  if (modulePolling.status !== "success") prevModuleStatus.current = modulePolling.status;

  // Load questions when polling succeeds
  const prevQStatus = useRef(questionPolling.status);
  if (questionPolling.status === "success" && prevQStatus.current !== "success") {
    prevQStatus.current = "success";
    const raw = questionPolling.taskStatus?.result?.questions ?? [];
    setQuestions(
      raw.map((q) => ({ data: q, status: "pending", editing: false }))
    );
  }
  if (questionPolling.status !== "success") prevQStatus.current = questionPolling.status;

  // --- Module actions ---
  const updateModule = useCallback((idx: number, patch: Partial<ModuleState>) => {
    setModules((prev) => prev.map((m, i) => (i === idx ? { ...m, ...patch } : m)));
  }, []);

  async function handleAddApprovedModules() {
    if (!courseId) return;
    const approved = modules.filter((m) => m.status === "approved");
    if (approved.length === 0) { toast.error("Aprueba al menos un módulo primero."); return; }
    setAddingModules(true);
    let added = 0;
    for (const mod of approved) {
      try {
        await coursesService.createModule(Number(courseId), {
          titulo: mod.data.title,
          descripcion: mod.data.descripcion,
          tipo_contenido: "TEXTO",
          orden: mod.data.orden,
          contenido_html: `<p><strong>Objetivo:</strong> ${mod.data.objetivo}</p><p>${mod.data.descripcion}</p>`,
        });
        added++;
      } catch { /* skip individual failures */ }
    }
    toast.success(`${added} módulo${added !== 1 ? "s" : ""} agregado${added !== 1 ? "s" : ""} al curso.`);
    navigate(`/admin/courses/${courseId}/edit`);
  }

  // --- Question actions ---
  async function handleGenerateQuestions() {
    if (qContent.trim().length < 50) { toast.error("El contenido es muy corto (mínimo 50 caracteres)."); return; }
    if (qTipos.length === 0) { toast.error("Selecciona al menos un tipo de pregunta."); return; }
    questionPolling.reset();
    setQuestions([]);
    try {
      const { task_id } = await aiService.generateQuestions(qContent, {
        cantidad: qCantidad,
        tipos: qTipos,
        dificultad: qDificultad,
      });
      questionPolling.startPolling(task_id);
    } catch {
      toast.error("No se pudo iniciar la generación.");
    }
  }

  async function handleSaveApprovedQuestions() {
    const approved = questions.filter((q) => q.status === "approved");
    if (approved.length === 0 || !courseId) return;
    setSavingQuestions(true);
    try {
      const assessment = await assessmentsService.getAssessmentForCourse(Number(courseId));
      let saved = 0;
      for (const q of approved) {
        const payload: CreateQuestionPayload = {
          texto: q.data.texto,
          tipo: q.data.tipo,
          opciones: q.data.opciones,
          respuesta_correcta: q.data.respuesta_correcta ?? 0,
          orden: saved + 1,
        };
        try {
          await assessmentsService.createQuestion(assessment.id, payload);
          saved++;
        } catch { /* skip */ }
      }
      toast.success(`${saved} pregunta${saved !== 1 ? "s" : ""} guardada${saved !== 1 ? "s" : ""} en el banco.`);
      setQuestions([]);
      questionPolling.reset();
    } catch {
      toast.error("Error al guardar las preguntas.");
    } finally {
      setSavingQuestions(false);
    }
  }

  const approvedModules = modules.filter((m) => m.status === "approved").length;
  const approvedQuestions = questions.filter((q) => q.status === "approved").length;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Generador IA</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Sube un documento para generar módulos y preguntas de evaluación automáticamente.
        </p>
      </div>

      {/* ================================================================
          SECTION A — Document upload + module proposals
      ================================================================ */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold">A</span>
          Propuesta de módulos desde documento
        </h2>

        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-colors"
        >
          <input ref={fileInputRef} type="file" accept=".pdf,.pptx,.ppt" onChange={handleFileChange} className="hidden" />
          {selectedFile ? (
            <div className="space-y-1">
              <p className="text-sm font-medium text-indigo-600">📄 {selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">({(selectedFile.size / 1024 / 1024).toFixed(1)} MB)</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-2xl">📂</p>
              <p className="text-sm text-muted-foreground">Arrastra un PDF o PPT, o haz clic para seleccionar</p>
              <p className="text-xs text-muted-foreground">Máx. {MAX_SIZE_MB} MB · {ALLOWED_TYPES.join(", ")}</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <label className="text-xs text-muted-foreground shrink-0">Módulos a generar:</label>
          <input
            type="number"
            value={moduleCount}
            onChange={(e) => setModuleCount(Math.max(1, Math.min(15, Number(e.target.value))))}
            min={1} max={15}
            className="w-20 border border-slate-700 rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-300"
          />
          <button
            type="button"
            onClick={() => void handleAnalyze()}
            disabled={!selectedFile || uploadingDoc || modulePolling.status === "polling"}
            className="px-5 py-2 bg-indigo-600 text-white text-sm rounded-xl hover:bg-indigo-700 disabled:opacity-50 shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all duration-300"
          >
            {uploadingDoc || modulePolling.status === "polling" ? "Analizando…" : "Analizar con IA"}
          </button>
          {modulePolling.status !== "idle" && (
            <button type="button" onClick={() => { modulePolling.reset(); setModules([]); }} className="text-xs text-muted-foreground hover:underline">
              Reiniciar
            </button>
          )}
        </div>

        {/* Polling states */}
        {modulePolling.status === "polling" && (
          <div className="flex items-center gap-3 py-4 text-sm text-muted-foreground">
            <div className="w-5 h-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            Analizando contenido con IA…
          </div>
        )}
        {modulePolling.status === "error" && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400 flex items-center justify-between">
            <span>Error al analizar el documento.</span>
            <button type="button" onClick={() => void handleAnalyze()} className="text-xs font-medium underline">
              Reintentar
            </button>
          </div>
        )}

        {/* Module proposals */}
        {modules.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">
                {modules.length} módulo{modules.length !== 1 ? "s" : ""} propuesto{modules.length !== 1 ? "s" : ""}
              </p>
              <button
                type="button"
                onClick={() => setModules((prev) => prev.map((m) => ({ ...m, status: "approved" })))}
                className="text-xs text-indigo-600 hover:underline"
              >
                Aprobar todos
              </button>
            </div>
            {modules.map((mod, i) => (
              <ModuleCard
                key={i}
                mod={mod}
                onApprove={() => updateModule(i, { status: "approved" })}
                onDiscard={() => updateModule(i, { status: "discarded" })}
                onEdit={() => updateModule(i, { editing: true, draft: { ...mod.data } })}
                onSaveEdit={(d) => updateModule(i, { data: d, editing: false, status: "approved" })}
                onCancelEdit={() => updateModule(i, { editing: false })}
              />
            ))}
            {approvedModules > 0 && (
              <button
                type="button"
                onClick={() => void handleAddApprovedModules()}
                disabled={addingModules}
                className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all duration-300"
              >
                {addingModules ? "Agregando…" : `Agregar ${approvedModules} módulo${approvedModules !== 1 ? "s" : ""} al curso`}
              </button>
            )}
          </div>
        )}
      </section>

      <div className="border-t border-border" />

      {/* ================================================================
          SECTION B — Question generation
      ================================================================ */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold">B</span>
          Generación de preguntas de evaluación
        </h2>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Contenido fuente <span className="text-muted-foreground">(pega el texto del módulo o tema)</span>
            </label>
            <textarea
              value={qContent}
              onChange={(e) => setQContent(e.target.value)}
              rows={4}
              placeholder="Pega aquí el contenido del módulo para generar preguntas relacionadas…"
              className="w-full border border-slate-700 rounded-xl px-3 py-2 text-sm resize-none bg-background focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-300"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Cantidad (1-20)</label>
              <input
                type="number"
                value={qCantidad}
                onChange={(e) => setQCantidad(Math.max(1, Math.min(20, Number(e.target.value))))}
                min={1} max={20}
                className="w-full border border-slate-700 rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Dificultad</label>
              <select
                value={qDificultad}
                onChange={(e) => setQDificultad(e.target.value as typeof qDificultad)}
                className="w-full border border-slate-700 rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-300"
              >
                <option value="FACIL">Fácil</option>
                <option value="MEDIO">Medio</option>
                <option value="DIFICIL">Difícil</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Tipos</label>
              <div className="flex flex-wrap gap-1.5">
                {(["MULTIPLE_CHOICE", "MULTIPLE_SELECT", "TRUE_FALSE"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() =>
                      setQTipos((prev) =>
                        prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
                      )
                    }
                    className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                      qTipos.includes(t)
                        ? "bg-purple-600 text-white border-purple-600"
                        : "border-border text-muted-foreground hover:bg-background"
                    }`}
                  >
                    {TIPO_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleGenerateQuestions()}
            disabled={questionPolling.status === "polling"}
            className="px-5 py-2 bg-purple-600 text-white text-sm rounded-xl hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {questionPolling.status === "polling" ? "Generando…" : "Generar preguntas"}
          </button>
        </div>

        {questionPolling.status === "polling" && (
          <div className="flex items-center gap-3 py-4 text-sm text-muted-foreground">
            <div className="w-5 h-5 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
            Generando preguntas con IA…
          </div>
        )}
        {questionPolling.status === "error" && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400 flex items-center justify-between">
            <span>Error al generar preguntas.</span>
            <button type="button" onClick={() => void handleGenerateQuestions()} className="text-xs font-medium underline">
              Reintentar
            </button>
          </div>
        )}

        {questions.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">
              {questions.length} pregunta{questions.length !== 1 ? "s" : ""} propuesta{questions.length !== 1 ? "s" : ""}
            </p>
            {questions.map((q, i) => (
              <QuestionCard
                key={i}
                q={q}
                index={i}
                onApprove={() =>
                  setQuestions((prev) => prev.map((x, j) => (j === i ? { ...x, status: "approved" } : x)))
                }
                onDiscard={() =>
                  setQuestions((prev) => prev.map((x, j) => (j === i ? { ...x, status: "discarded" } : x)))
                }
                onRegenerate={() => {
                  setQuestions((prev) => prev.map((x, j) => (j === i ? { ...x, status: "discarded" } : x)));
                  toast.info("Genera nuevamente para obtener preguntas adicionales.");
                }}
              />
            ))}
            {approvedQuestions > 0 && (
              <button
                type="button"
                onClick={() => void handleSaveApprovedQuestions()}
                disabled={savingQuestions}
                className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all duration-300"
              >
                {savingQuestions
                  ? "Guardando…"
                  : `Guardar ${approvedQuestions} pregunta${approvedQuestions !== 1 ? "s" : ""} en el banco`}
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
