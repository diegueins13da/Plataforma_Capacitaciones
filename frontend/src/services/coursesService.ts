import api from "./api";
import type { PaginatedResponse } from "../types";
import type {
  Course,
  CourseFilters,
  CourseListItem,
  CourseModule,
  CreateCoursePayload,
  CreateModulePayload,
} from "../types/course";

export interface InstructorCourseStats {
  id: number;
  titulo: string;
  estado: string;
  tipo: string;
  duracion_horas: number | null;
  total_inscritos: number;
  completados: number;
  en_progreso: number;
  vencidos: number;
  progreso_promedio: number;
  fecha_limite: string | null;
  dias_para_vencer: number | null;
  nota_promedio: number | null;
  tasa_aprobacion: number | null;
}

export interface InstructorAlumno {
  user_id: number;
  nombre: string;
  email: string;
  curso_id: number;
  curso_titulo: string;
  progreso: number;
  estado: string;
  fecha_limite: string | null;
  dias_para_vencer: number | null;
}

export interface InstructorAlerta {
  tipo: string;
  curso_id: number;
  curso_titulo: string;
  dias: number;
  alumnos_afectados: number;
}

export interface InstructorDashboardData {
  kpis: {
    total_alumnos: number;
    tasa_completado: number;
    progreso_promedio: number;
    cursos_publicados: number;
    cursos_borrador: number;
    cursos_archivados: number;
  };
  cursos: InstructorCourseStats[];
  alumnos: InstructorAlumno[];
  alertas: InstructorAlerta[];
}

export interface CourseEnrollmentUser {
  id: number;
  nombre: string;
  email: string;
  role: string;
  estado_inscripcion: string | null;
}

const BASE = "/v1/courses";

export const coursesService = {
  // ------------------------------------------------------------------
  // Courses
  // ------------------------------------------------------------------

  async getCourses(filters?: CourseFilters): Promise<PaginatedResponse<CourseListItem>> {
    const params: Record<string, string | number | undefined> = {};
    if (filters?.estado) params.estado = filters.estado;
    if (filters?.area) params.area = filters.area;
    if (filters?.page) params.page = filters.page;
    if (filters?.as_student) params.as_student = "true";
    const res = await api.get<PaginatedResponse<CourseListItem>>(`${BASE}/`, { params });
    return res.data;
  },

  async getMyEnrolledCourses(): Promise<PaginatedResponse<CourseListItem>> {
    const res = await api.get<PaginatedResponse<CourseListItem>>(`${BASE}/`, {
      params: { as_student: "true", estado: "PUBLICADO" },
    });
    return res.data;
  },

  async getInstructorDashboard(): Promise<InstructorDashboardData> {
    const res = await api.get<InstructorDashboardData>("/v1/instructor/dashboard/");
    return res.data;
  },

  async getCourse(id: number): Promise<Course> {
    const res = await api.get<Course>(`${BASE}/${id}/`);
    return res.data;
  },

  async createCourse(payload: CreateCoursePayload): Promise<Course> {
    const res = await api.post<Course>(`${BASE}/`, payload);
    return res.data;
  },

  async updateCourse(id: number, payload: Partial<CreateCoursePayload>): Promise<Course> {
    const res = await api.patch<Course>(`${BASE}/${id}/`, payload);
    return res.data;
  },

  async deleteCourse(id: number): Promise<void> {
    await api.delete(`${BASE}/${id}/`);
  },

  async publishCourse(id: number): Promise<Course> {
    const res = await api.post<Course>(`${BASE}/${id}/publish/`);
    return res.data;
  },

  async archiveCourse(id: number): Promise<Course> {
    const res = await api.post<Course>(`${BASE}/${id}/archive/`);
    return res.data;
  },

  // ------------------------------------------------------------------
  // Modules
  // ------------------------------------------------------------------

  async getModules(courseId: number): Promise<CourseModule[]> {
    const res = await api.get<CourseModule[]>(`${BASE}/${courseId}/modules/`);
    return res.data;
  },

  async createModule(
    courseId: number,
    payload: CreateModulePayload,
    pdfFile?: File,
    onProgress?: (percent: number) => void
  ): Promise<CourseModule> {
    if (pdfFile) {
      const form = new FormData();
      Object.entries(payload).forEach(([k, v]) => {
        if (v !== undefined && v !== null) form.append(k, String(v));
      });
      form.append("archivo_pdf", pdfFile);
      const res = await api.post<CourseModule>(`${BASE}/${courseId}/modules/`, form, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (e) => {
          if (onProgress && e.total) {
            onProgress(Math.round((e.loaded / e.total) * 100));
          }
        },
      });
      return res.data;
    }
    const res = await api.post<CourseModule>(`${BASE}/${courseId}/modules/`, payload);
    return res.data;
  },

  async updateModule(
    courseId: number,
    moduleId: number,
    payload: Partial<CreateModulePayload>,
    pdfFile?: File,
    onProgress?: (percent: number) => void
  ): Promise<CourseModule> {
    if (pdfFile) {
      const form = new FormData();
      Object.entries(payload).forEach(([k, v]) => {
        if (v !== undefined && v !== null) form.append(k, String(v));
      });
      form.append("archivo_pdf", pdfFile);
      const res = await api.patch<CourseModule>(
        `${BASE}/${courseId}/modules/${moduleId}/`,
        form,
        {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (e) => {
            if (onProgress && e.total) {
              onProgress(Math.round((e.loaded / e.total) * 100));
            }
          },
        }
      );
      return res.data;
    }
    const res = await api.patch<CourseModule>(
      `${BASE}/${courseId}/modules/${moduleId}/`,
      payload
    );
    return res.data;
  },

  async deleteModule(courseId: number, moduleId: number): Promise<void> {
    await api.delete(`${BASE}/${courseId}/modules/${moduleId}/`);
  },

  // ------------------------------------------------------------------
  // User assignment
  // ------------------------------------------------------------------

  async getCourseEnrollmentUsers(courseId: number): Promise<CourseEnrollmentUser[]> {
    const res = await api.get<CourseEnrollmentUser[]>(`${BASE}/${courseId}/enrollment-users/`);
    return res.data;
  },

  async bulkAssignUsers(courseId: number, userIds: number[]): Promise<{ created: number; skipped: number }> {
    const res = await api.post<{ created: number; skipped: number }>(`${BASE}/${courseId}/bulk-assign/`, { user_ids: userIds });
    return res.data;
  },
};
