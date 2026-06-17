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
    const res = await api.get<PaginatedResponse<CourseListItem>>(`${BASE}/`, { params });
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
};
