/**
 * P17 — Exam Intro
 * Shows assessment instructions, stats, and the "Comenzar examen" button.
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { toast } from "sonner";

import { assessmentsService } from "../../services/assessmentsService";
import type { Assessment } from "../../types/assessment";

function examStateKey(courseId: string): string {
  return `exam_inprogress_${courseId}`;
}

export default function ExamIntroPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!courseId) return;
    assessmentsService
      .getAssessmentForCourse(Number(courseId))
      .then(setAssessment)
      .catch(() => setError("No se pudo cargar la evaluación de este curso."))
      .finally(() => setLoading(false));
  }, [courseId]);

  async function handleStart() {
    if (!assessment || !courseId) return;
    setStarting(true);
    setError("");
    try {
      const data = await assessmentsService.startExam(assessment.id);
      const examState = {
        assessmentId: assessment.id,
        attempt_id: data.attempt_id,
        questions: data.questions,
        tiempoLimiteMinutos: assessment.tiempo_limite_minutos,
        maxIntentos: assessment.max_intentos,
        puntajeMinimo: assessment.puntaje_minimo,
        startedAt: Date.now(),
      };
      sessionStorage.setItem(examStateKey(courseId), JSON.stringify(examState));
      navigate(`/courses/${courseId}/exam/in-progress`);
    } catch (err: unknown) {
      const resp = (err as { response?: { status?: number; data?: { error?: string } } })?.response;
      if (resp?.status === 403) {
        // All attempts exhausted → jump to result P21
        navigate(`/courses/${courseId}/exam/result`, {
          state: {
            assessmentId: assessment.id,
            aprobado: false,
            calificacion: 0,
            intento_numero: assessment.max_intentos,
            maxIntentos: assessment.max_intentos,
            puntajeMinimo: assessment.puntaje_minimo,
          },
        });
      } else if (resp?.status === 409) {
        setError(
          "Tienes un examen en progreso en otra pestaña. Ciérrala y recarga esta página."
        );
      } else {
        setError("No se pudo iniciar el examen. Intenta de nuevo.");
        toast.error("Error al iniciar el examen.");
      }
    } finally {
      setStarting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!assessment && error) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <p className="text-red-600">{error}</p>
        <Link
          to={`/courses/${courseId}`}
          className="text-sm text-indigo-600 underline"
        >
          Volver al curso
        </Link>
      </div>
    );
  }

  const remainingAttempts = assessment
    ? Math.max(0, assessment.max_intentos - assessment.user_attempts_count)
    : 0;
  const canStart =
    !!assessment && assessment.question_count_approved > 0 && remainingAttempts > 0;

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <div className="bg-white border border-gray-200 rounded-2xl p-8 space-y-6 shadow-sm">
        {/* Header */}
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-indigo-100 flex items-center justify-center text-3xl">
            📝
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Evaluación final</h1>
          <p className="text-sm text-gray-500 mt-1">
            Lee las instrucciones antes de comenzar
          </p>
        </div>

        {assessment && (
          <>
            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-2xl font-bold text-indigo-600">
                  {assessment.question_count_approved}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  pregunta{assessment.question_count_approved !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-2xl font-bold text-indigo-600">
                  {assessment.puntaje_minimo}%
                </p>
                <p className="text-xs text-gray-500 mt-0.5">nota mínima</p>
              </div>
              <div
                className={`rounded-xl p-3 ${
                  remainingAttempts <= 1 && remainingAttempts > 0
                    ? "bg-amber-50"
                    : remainingAttempts === 0
                    ? "bg-red-50"
                    : "bg-gray-50"
                }`}
              >
                <p
                  className={`text-2xl font-bold ${
                    remainingAttempts <= 1 && remainingAttempts > 0
                      ? "text-amber-600"
                      : remainingAttempts === 0
                      ? "text-red-600"
                      : "text-indigo-600"
                  }`}
                >
                  {remainingAttempts}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  intento{remainingAttempts !== 1 ? "s" : ""} restante
                  {remainingAttempts !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            {/* Time limit badge */}
            {assessment.tiempo_limite_minutos && (
              <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-4 py-2.5">
                <span>⏱</span>
                <span>
                  Tiempo límite:{" "}
                  <strong>{assessment.tiempo_limite_minutos} minutos</strong>
                </span>
              </div>
            )}

            {/* Instructions */}
            <ul className="text-sm text-gray-600 space-y-2.5">
              <li className="flex items-start gap-2">
                <span className="text-green-500 shrink-0 mt-0.5">✓</span>
                <span>
                  Responde cada pregunta con cuidado. Puedes navegar entre ellas
                  antes de enviar.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 shrink-0 mt-0.5">✓</span>
                <span>
                  Tus respuestas se guardan automáticamente cada 30 segundos.
                </span>
              </li>
              {assessment.tiempo_limite_minutos && (
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 shrink-0 mt-0.5">⚠</span>
                  <span>
                    El examen se envía automáticamente cuando el tiempo se agote.
                  </span>
                </li>
              )}
              {remainingAttempts === 1 && (
                <li className="flex items-start gap-2">
                  <span className="text-red-500 shrink-0 mt-0.5">⚠</span>
                  <span>
                    Este es tu <strong>último intento</strong>. No podrás volver a
                    tomar el examen.
                  </span>
                </li>
              )}
            </ul>

            {/* No approved questions warning */}
            {assessment.question_count_approved === 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
                Este examen aún no tiene preguntas aprobadas. Contacta a tu
                instructor.
              </div>
            )}
          </>
        )}

        {error && (
          <p className="text-sm text-red-600 text-center bg-red-50 border border-red-100 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3 pt-1">
          <button
            type="button"
            onClick={() => void handleStart()}
            disabled={!canStart || starting}
            className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {starting ? "Iniciando…" : "Comenzar examen"}
          </button>
          <Link
            to={`/courses/${courseId}`}
            className="w-full py-2.5 text-sm text-center text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Volver al curso
          </Link>
        </div>
      </div>
    </div>
  );
}
