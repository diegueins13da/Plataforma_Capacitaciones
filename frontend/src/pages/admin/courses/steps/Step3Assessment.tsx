/**
 * P32 — Step 3: Assessment configuration + question bank.
 * Loads the assessment for the current course via GET /courses/:id/assessment/,
 * then allows editing config and managing the question bank inline.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { assessmentsService } from "../../../../services/assessmentsService";
import { useCourseWizardStore } from "../../../../store/courseWizardStore";
import { QuestionForm } from "../../../../components/shared/QuestionForm";
import type { Assessment, CreateQuestionPayload, Question } from "../../../../types/assessment";

const TIPO_ICONS: Record<string, string> = {
  MULTIPLE_CHOICE: "⬤",
  MULTIPLE_SELECT: "☑",
  TRUE_FALSE: "T/F",
};

const TIPO_LABELS: Record<string, string> = {
  MULTIPLE_CHOICE: "Selección única",
  MULTIPLE_SELECT: "Selección múltiple",
  TRUE_FALSE: "V / F",
};

interface Props {
  onNext: () => void;
  onBack: () => void;
}

export function Step3Assessment({ onNext, onBack }: Props) {
  const { courseId, step3, setStep3, setStep } = useCourseWizardStore();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load assessment on mount (when courseId is available)
  useEffect(() => {
    if (!courseId) return;
    setLoading(true);
    assessmentsService
      .getAssessmentForCourse(courseId)
      .then((a) => {
        setAssessment(a);
        setStep3({
          puntaje_minimo: String(a.puntaje_minimo),
          max_intentos: String(a.max_intentos),
          tiempo_limite_minutos: a.tiempo_limite_minutos ? String(a.tiempo_limite_minutos) : "",
        });
        return assessmentsService.listQuestions(a.id);
      })
      .then(setQuestions)
      .catch(() => toast.error("No se pudo cargar la configuración de evaluación."))
      .finally(() => setLoading(false));
  }, [courseId]);

  // Auto-save config changes with 800ms debounce
  const saveConfig = useCallback(
    (field: string, value: string) => {
      if (!assessment) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        const payload: Record<string, number | null> = {};
        if (field === "puntaje_minimo") payload.puntaje_minimo = Number(value) || 70;
        if (field === "max_intentos") payload.max_intentos = Number(value) || 3;
        if (field === "tiempo_limite_minutos")
          payload.tiempo_limite_minutos = value ? Number(value) : null;
        try {
          await assessmentsService.updateAssessment(assessment.id, payload);
        } catch {
          // silent — user sees the value locally
        }
      }, 800);
    },
    [assessment]
  );

  function handleConfigChange(field: string, value: string) {
    setStep3({ [field]: value } as Parameters<typeof setStep3>[0]);
    saveConfig(field, value);
  }

  async function handleSaveQuestion(payload: CreateQuestionPayload) {
    if (!assessment) return;
    if (editingQuestion) {
      const updated = await assessmentsService.updateQuestion(assessment.id, editingQuestion.id, payload);
      setQuestions((qs) => qs.map((q) => (q.id === updated.id ? updated : q)));
      toast.success("Pregunta actualizada.");
    } else {
      const created = await assessmentsService.createQuestion(assessment.id, {
        ...payload,
        orden: questions.length + 1,
      });
      setQuestions((qs) => [...qs, created]);
      toast.success("Pregunta agregada.");
    }
    setShowForm(false);
    setEditingQuestion(null);
    // Refresh assessment to update question count
    const a = await assessmentsService.getAssessmentForCourse(courseId!);
    setAssessment(a);
  }

  async function handleDeleteQuestion(questionId: number) {
    if (!assessment) return;
    if (!confirm("¿Eliminar esta pregunta?")) return;
    await assessmentsService.deleteQuestion(assessment.id, questionId);
    setQuestions((qs) => qs.filter((q) => q.id !== questionId));
    toast.success("Pregunta eliminada.");
    const a = await assessmentsService.getAssessmentForCourse(courseId!);
    setAssessment(a);
  }

  return (
    <div className="space-y-6">
      {/* Config form */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">Política de evaluación</h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Puntaje mínimo (%)
            </label>
            <input
              type="number"
              value={step3.puntaje_minimo}
              onChange={(e) => handleConfigChange("puntaje_minimo", e.target.value)}
              min={1}
              max={100}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Intentos máximos
            </label>
            <input
              type="number"
              value={step3.max_intentos}
              onChange={(e) => handleConfigChange("max_intentos", e.target.value)}
              min={1}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Tiempo límite (min){" "}
              <span className="text-gray-400 font-normal">opcional</span>
            </label>
            <input
              type="number"
              value={step3.tiempo_limite_minutos}
              onChange={(e) => handleConfigChange("tiempo_limite_minutos", e.target.value)}
              min={1}
              placeholder="Sin límite"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Question bank */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="text-sm font-semibold text-gray-700">
            Banco de preguntas
            {assessment && (
              <span className="ml-2 text-xs font-normal text-gray-400">
                {assessment.question_count_approved} aprobada
                {assessment.question_count_approved !== 1 ? "s" : ""} / {assessment.question_count_total} total
              </span>
            )}
          </div>
          {!showForm && (
            <button
              type="button"
              onClick={() => { setEditingQuestion(null); setShowForm(true); }}
              className="text-xs font-medium text-indigo-600 hover:underline"
            >
              + Agregar pregunta
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          </div>
        ) : (
          <>
            {showForm && (
              <div className="p-4 border-b border-gray-100">
                <QuestionForm
                  initial={editingQuestion ?? undefined}
                  defaultOrden={questions.length + 1}
                  onSave={handleSaveQuestion}
                  onCancel={() => { setShowForm(false); setEditingQuestion(null); }}
                />
              </div>
            )}

            {questions.length === 0 && !showForm ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                No hay preguntas aún. Agrega tu primera pregunta.
              </div>
            ) : (
              questions.map((q, i) => (
                <div
                  key={q.id}
                  className="flex items-start gap-3 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50"
                >
                  <span className="w-6 h-6 shrink-0 flex items-center justify-center text-xs font-bold text-gray-400 bg-gray-100 rounded-full">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 leading-snug line-clamp-2">{q.texto}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400">
                        {TIPO_ICONS[q.tipo]} {TIPO_LABELS[q.tipo]}
                      </span>
                      {q.aprobada_por_humano ? (
                        <span className="text-xs text-green-600">✓ Aprobada</span>
                      ) : (
                        <span className="text-xs text-amber-500">Pendiente</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => { setEditingQuestion(q); setShowForm(true); }}
                      className="text-xs text-indigo-500 hover:underline"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteQuestion(q.id)}
                      className="text-xs text-red-400 hover:underline"
                    >
                      Borrar
                    </button>
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>

      {!courseId && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2">
          Guarda primero los datos del curso (Paso 1) para poder agregar preguntas.
        </p>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          type="button"
          onClick={() => { setStep(2); onBack(); }}
          className="px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50"
        >
          ← Anterior
        </button>
        <button
          type="button"
          onClick={() => { setStep(4); onNext(); }}
          className="px-6 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
        >
          Siguiente →
        </button>
      </div>
    </div>
  );
}
