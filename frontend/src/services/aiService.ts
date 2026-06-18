import api from "./api";

const BASE = "/v1/ai";

export interface ProposedModule {
  title: string;
  objetivo: string;
  descripcion: string;
  orden: number;
}

export interface ProposedQuestion {
  texto: string;
  tipo: "MULTIPLE_CHOICE" | "MULTIPLE_SELECT" | "TRUE_FALSE";
  opciones: string[];
  respuesta_correcta: number | number[] | boolean | null;
  dificultad: "FACIL" | "MEDIO" | "DIFICIL";
  tema: string;
}

export interface TaskStatus {
  task_id: string;
  status: "PENDING" | "STARTED" | "SUCCESS" | "FAILURE" | "RETRY";
  result?: { modules?: ProposedModule[]; questions?: ProposedQuestion[] };
  error?: string;
}

export const aiService = {
  async uploadDocument(file: File, cantidadModulos = 5): Promise<{ task_id: string }> {
    const form = new FormData();
    form.append("file", file);
    form.append("cantidad_modulos", String(cantidadModulos));
    const res = await api.post<{ task_id: string }>(`${BASE}/upload/`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },

  async getTaskStatus(taskId: string): Promise<TaskStatus> {
    const res = await api.get<TaskStatus>(`${BASE}/tasks/${taskId}/`);
    return res.data;
  },

  async generateQuestions(
    content: string,
    options: { cantidad?: number; tipos?: string[]; dificultad?: string }
  ): Promise<{ task_id: string }> {
    const res = await api.post<{ task_id: string }>(`${BASE}/generate-questions/`, {
      content,
      ...options,
    });
    return res.data;
  },
};
