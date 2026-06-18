import api from "./api";
import type {
  Assessment,
  CreateQuestionPayload,
  ExamStartResponse,
  ExamSubmitResponse,
  Question,
  UpdateAssessmentPayload,
} from "../types/assessment";

const COURSES_BASE = "/v1/courses";
const BASE = "/v1/assessments";

export const assessmentsService = {
  // ------------------------------------------------------------------
  // Assessment
  // ------------------------------------------------------------------

  async getAssessmentForCourse(courseId: number): Promise<Assessment> {
    const res = await api.get<Assessment>(`${COURSES_BASE}/${courseId}/assessment/`);
    return res.data;
  },

  async updateAssessment(
    assessmentId: number,
    payload: UpdateAssessmentPayload
  ): Promise<Assessment> {
    const res = await api.patch<Assessment>(`${BASE}/${assessmentId}/`, payload);
    return res.data;
  },

  // ------------------------------------------------------------------
  // Questions
  // ------------------------------------------------------------------

  async listQuestions(assessmentId: number): Promise<Question[]> {
    const res = await api.get<Question[]>(`${BASE}/${assessmentId}/questions/`);
    return res.data;
  },

  async createQuestion(
    assessmentId: number,
    payload: CreateQuestionPayload
  ): Promise<Question> {
    const res = await api.post<Question>(`${BASE}/${assessmentId}/questions/`, payload);
    return res.data;
  },

  async updateQuestion(
    assessmentId: number,
    questionId: number,
    payload: Partial<CreateQuestionPayload>
  ): Promise<Question> {
    const res = await api.patch<Question>(
      `${BASE}/${assessmentId}/questions/${questionId}/`,
      payload
    );
    return res.data;
  },

  async deleteQuestion(assessmentId: number, questionId: number): Promise<void> {
    await api.delete(`${BASE}/${assessmentId}/questions/${questionId}/`);
  },

  // ------------------------------------------------------------------
  // Exam lifecycle
  // ------------------------------------------------------------------

  async startExam(assessmentId: number): Promise<ExamStartResponse> {
    const res = await api.post<ExamStartResponse>(`${BASE}/${assessmentId}/start/`);
    return res.data;
  },

  async saveProgress(
    assessmentId: number,
    answers: Record<string, number | number[] | boolean | null>
  ): Promise<{ saved: boolean; attempt_id: number }> {
    const res = await api.post(`${BASE}/${assessmentId}/save-progress/`, { answers });
    return res.data;
  },

  async submitExam(
    assessmentId: number,
    answers: Record<string, number | number[] | boolean | null>
  ): Promise<ExamSubmitResponse> {
    const res = await api.post<ExamSubmitResponse>(`${BASE}/${assessmentId}/submit/`, { answers });
    return res.data;
  },

  async resetAttempts(assessmentId: number, userId: number): Promise<{ deleted: number }> {
    const res = await api.post(`${BASE}/${assessmentId}/users/${userId}/reset-attempts/`);
    return res.data;
  },
};
