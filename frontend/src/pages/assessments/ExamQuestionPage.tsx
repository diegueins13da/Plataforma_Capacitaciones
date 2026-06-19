/**
 * P18 — Exam In Progress
 * One-question-at-a-time interface with countdown timer, auto-save every 30s,
 * and auto-submit on timeout.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { assessmentsService } from "../../services/assessmentsService";
import { useExamTimer } from "../../hooks/useExamTimer";
import type { ExamQuestion, QuestionTipo } from "../../types/assessment";

interface ExamState {
  assessmentId: number;
  attempt_id: number;
  questions: ExamQuestion[];
  tiempoLimiteMinutos: number | null;
  maxIntentos: number;
  puntajeMinimo: number;
  startedAt: number;
}

type AnswerValue = number | number[] | boolean | null;

function examStateKey(courseId: string): string {
  return `exam_inprogress_${courseId}`;
}

function QuestionOptions({
  question,
  answer,
  onSetAnswer,
  onToggleMulti,
}: {
  question: ExamQuestion;
  answer: AnswerValue;
  onSetAnswer: (id: number, v: number | boolean) => void;
  onToggleMulti: (id: number, idx: number) => void;
}) {
  if (question.tipo === "TRUE_FALSE") {
    return (
      <div className="flex gap-3 mt-4">
        {([true, false] as const).map((val) => (
          <button
            key={String(val)}
            type="button"
            onClick={() => onSetAnswer(question.id, val)}
            className={`flex-1 py-3 text-sm font-medium rounded-xl border transition-colors ${
              answer === val
                ? "bg-indigo-600 text-white border-indigo-600"
                : "border-border text-foreground hover:bg-background"
            }`}
          >
            {val ? "Verdadero" : "Falso"}
          </button>
        ))}
      </div>
    );
  }

  const selectedIndices: number[] =
    question.tipo === "MULTIPLE_SELECT"
      ? Array.isArray(answer)
        ? (answer as number[])
        : []
      : [];

  return (
    <div className="space-y-2 mt-4">
      {question.opciones.map((opcion, i) => {
        const isSelected =
          question.tipo === "MULTIPLE_CHOICE"
            ? answer === i
            : selectedIndices.includes(i);

        return (
          <label
            key={i}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors ${
              isSelected
                ? "bg-indigo-500/10 border-indigo-500/40"
                : "border-border hover:bg-background"
            }`}
          >
            <input
              type={question.tipo === "MULTIPLE_CHOICE" ? "radio" : "checkbox"}
              name={`q_${question.id}`}
              checked={isSelected}
              onChange={() => {
                if (question.tipo === "MULTIPLE_CHOICE") {
                  onSetAnswer(question.id, i);
                } else {
                  onToggleMulti(question.id, i);
                }
              }}
              className="accent-indigo-600 shrink-0"
            />
            <span className="text-sm text-foreground">{opcion}</span>
          </label>
        );
      })}
    </div>
  );
}

function typeLabel(tipo: QuestionTipo): string {
  return tipo === "MULTIPLE_SELECT"
    ? "Selección múltiple"
    : tipo === "TRUE_FALSE"
    ? "Verdadero / Falso"
    : "Selección única";
}

export default function ExamQuestionPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();

  const [examState] = useState<ExamState | null>(() => {
    if (!courseId) return null;
    const stored = sessionStorage.getItem(examStateKey(courseId));
    return stored ? (JSON.parse(stored) as ExamState) : null;
  });

  const [initialSecondsLeft] = useState<number | null>(() => {
    if (!examState?.tiempoLimiteMinutos) return null;
    const elapsed = (Date.now() - examState.startedAt) / 1000;
    return Math.max(0, Math.round(examState.tiempoLimiteMinutos * 60 - elapsed));
  });

  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [submitting, setSubmitting] = useState(false);
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const submittingRef = useRef(false);

  // Redirect if no active exam state
  useEffect(() => {
    if (!examState) {
      navigate(`/courses/${courseId}/exam`, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const assessmentId = examState?.assessmentId;

  // Auto-save every 30s (silent, non-blocking)
  useEffect(() => {
    if (!assessmentId) return;
    const timer = setInterval(() => {
      assessmentsService.saveProgress(assessmentId, answersRef.current).catch(() => {});
    }, 30_000);
    return () => clearInterval(timer);
  }, [assessmentId]);

  const handleSubmit = useCallback(async () => {
    if (!examState || !courseId || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const result = await assessmentsService.submitExam(
        examState.assessmentId,
        answersRef.current
      );
      sessionStorage.removeItem(examStateKey(courseId));
      navigate(`/courses/${courseId}/exam/result`, {
        state: {
          assessmentId: examState.assessmentId,
          ...result,
          maxIntentos: examState.maxIntentos,
          puntajeMinimo: examState.puntajeMinimo,
        },
      });
    } catch (err: unknown) {
      const resp = (err as { response?: { data?: { error?: string } } })?.response;
      const msg = resp?.data?.error ?? "";
      sessionStorage.removeItem(examStateKey(courseId));
      navigate(`/courses/${courseId}/exam/result`, {
        state: {
          assessmentId: examState.assessmentId,
          aprobado: false,
          calificacion: 0,
          intento_numero: examState.maxIntentos,
          maxIntentos: examState.maxIntentos,
          puntajeMinimo: examState.puntajeMinimo,
          timeExpired: msg.includes("expirado"),
        },
      });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [examState, courseId, navigate]);

  const { secondsLeft, isAlmostExpired, formattedTime } = useExamTimer(
    initialSecondsLeft,
    handleSubmit
  );

  if (!examState) return null;

  const questions = examState.questions;
  const question = questions[currentIdx];
  const isFirst = currentIdx === 0;
  const isLast = currentIdx === questions.length - 1;
  const answeredCount = questions.filter(
    (q) => answers[String(q.id)] !== undefined && answers[String(q.id)] !== null
  ).length;

  function setAnswer(id: number, value: number | boolean) {
    setAnswers((prev) => ({ ...prev, [String(id)]: value }));
  }

  function toggleMultiSelect(id: number, idx: number) {
    setAnswers((prev) => {
      const current = (prev[String(id)] as number[] | undefined) ?? [];
      const next = current.includes(idx)
        ? current.filter((i) => i !== idx)
        : [...current, idx];
      return { ...prev, [String(id)]: next };
    });
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3 shadow-sm">
        <div className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">
            Pregunta {currentIdx + 1}
          </span>{" "}
          de {questions.length}
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs text-muted-foreground">
            {answeredCount}/{questions.length} respondidas
          </span>

          {formattedTime !== null && (
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-mono font-semibold ${
                isAlmostExpired
                  ? "bg-red-500/15 text-red-400 animate-pulse"
                  : "bg-muted/40 text-foreground"
              }`}
            >
              <span>{isAlmostExpired ? "⚠" : "⏱"}</span>
              <span>{formattedTime}</span>
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-muted/40 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-500 rounded-full transition-all duration-300"
          style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
        />
      </div>

      {/* Question card */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-medium text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full">
            {typeLabel(question.tipo)}
          </span>
          {answers[String(question.id)] !== undefined &&
            answers[String(question.id)] !== null && (
              <span className="text-xs text-emerald-500 font-medium">✓ Respondida</span>
            )}
        </div>

        <p className="text-base font-medium text-foreground leading-snug">
          {question.texto}
        </p>

        <QuestionOptions
          question={question}
          answer={answers[String(question.id)] ?? null}
          onSetAnswer={setAnswer}
          onToggleMulti={toggleMultiSelect}
        />
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setCurrentIdx((i) => i - 1)}
          disabled={isFirst}
          className="flex items-center gap-1.5 px-4 py-2.5 text-sm text-muted-foreground border border-border rounded-xl hover:bg-background disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          ← Anterior
        </button>

        {/* Question dots (up to 10 visible) */}
        <div className="flex items-center gap-1 overflow-hidden">
          {questions.slice(0, 10).map((q, i) => (
            <button
              key={q.id}
              type="button"
              onClick={() => setCurrentIdx(i)}
              className={`w-2 h-2 rounded-full transition-all ${
                i === currentIdx
                  ? "bg-indigo-600 w-4"
                  : answers[String(q.id)] !== undefined &&
                    answers[String(q.id)] !== null
                  ? "bg-emerald-400"
                  : "bg-muted"
              }`}
            />
          ))}
          {questions.length > 10 && (
            <span className="text-xs text-muted-foreground ml-1">
              +{questions.length - 10}
            </span>
          )}
        </div>

        {isLast ? (
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting}
            className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all duration-300"
          >
            {submitting ? "Enviando…" : "Enviar examen ✓"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setCurrentIdx((i) => i + 1)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm text-indigo-400 border border-indigo-500/30 rounded-xl hover:bg-indigo-500/10 transition-colors"
          >
            Siguiente →
          </button>
        )}
      </div>

      {secondsLeft !== null && secondsLeft === 0 && (
        <p className="text-center text-sm text-red-400 font-medium">
          Tiempo agotado. Enviando examen…
        </p>
      )}
    </div>
  );
}
