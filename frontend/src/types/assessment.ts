export type QuestionTipo = "MULTIPLE_CHOICE" | "MULTIPLE_SELECT" | "TRUE_FALSE";

export interface Assessment {
  id: number;
  course: number;
  puntaje_minimo: number;
  max_intentos: number;
  tiempo_limite_minutos: number | null;
  question_count_approved: number;
  question_count_total: number;
  created_at: string;
  updated_at: string;
}

export interface Question {
  id: number;
  assessment: number;
  texto: string;
  tipo: QuestionTipo;
  opciones: string[];
  respuesta_correcta: number | number[] | boolean;
  orden: number;
  aprobada_por_humano: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateQuestionPayload {
  texto: string;
  tipo: QuestionTipo;
  opciones: string[];
  respuesta_correcta: number | number[] | boolean;
  orden?: number;
}

export interface UpdateAssessmentPayload {
  puntaje_minimo?: number;
  max_intentos?: number;
  tiempo_limite_minutos?: number | null;
}

/** Question data returned during an active exam (no correct answer) */
export interface ExamQuestion {
  id: number;
  texto: string;
  tipo: QuestionTipo;
  opciones: string[];
  orden: number;
}

export interface ExamStartResponse {
  attempt_id: number;
  questions: ExamQuestion[];
}

export interface ExamSubmitResponse {
  attempt_id: number;
  intento_numero: number;
  calificacion: number;
  aprobado: boolean;
  correct_answers: Record<string, number | number[] | boolean>;
}
