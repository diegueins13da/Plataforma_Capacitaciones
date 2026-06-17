import api from "./api";

const BASE = "/v1/enrollments";

export interface ModuleProgressData {
  module_id: number;
  is_completed: boolean;
  last_position_json: Record<string, number>;
  fecha_completado: string | null;
}

export interface EnrollmentCompletionData {
  id: number;
  estado: "EN_PROGRESO" | "COMPLETADO" | "VENCIDO";
  progreso_porcentaje: number;
  fecha_completado: string | null;
}

export const enrollmentsService = {
  async completeModule(
    enrollmentId: number,
    moduleId: number
  ): Promise<EnrollmentCompletionData> {
    const res = await api.post<EnrollmentCompletionData>(
      `${BASE}/${enrollmentId}/modules/${moduleId}/complete/`
    );
    return res.data;
  },

  async getModuleProgress(
    enrollmentId: number,
    moduleId: number
  ): Promise<ModuleProgressData> {
    const res = await api.get<ModuleProgressData>(
      `${BASE}/${enrollmentId}/modules/${moduleId}/progress/`
    );
    return res.data;
  },

  async updateModulePosition(
    enrollmentId: number,
    moduleId: number,
    lastPositionJson: Record<string, number>
  ): Promise<ModuleProgressData> {
    const res = await api.patch<ModuleProgressData>(
      `${BASE}/${enrollmentId}/modules/${moduleId}/progress/`,
      { last_position_json: lastPositionJson }
    );
    return res.data;
  },
};
