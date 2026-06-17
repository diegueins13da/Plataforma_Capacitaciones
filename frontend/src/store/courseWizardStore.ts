import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CourseModule, CourseTipo } from "../types/course";

export interface Step1Data {
  titulo: string;
  descripcion: string;
  tipo: CourseTipo;
  area: number | null;
  fecha_limite: string;
  version: string;
  imagen_portada: string;
  duracion_horas: string;
  cert_expira_meses: string;
}

export interface Step3Data {
  puntaje_minimo: string;
  max_intentos: string;
  tiempo_limite_minutos: string;
}

interface CourseWizardState {
  step: 1 | 2 | 3 | 4;
  mode: "create" | "edit";
  courseId: number | null;
  step1: Step1Data;
  modules: CourseModule[];
  step3: Step3Data;
  audienciaGrupos: number[];

  setStep: (s: 1 | 2 | 3 | 4) => void;
  setMode: (m: "create" | "edit") => void;
  setCourseId: (id: number) => void;
  setStep1: (data: Partial<Step1Data>) => void;
  setModules: (modules: CourseModule[]) => void;
  setStep3: (data: Partial<Step3Data>) => void;
  setAudienciaGrupos: (ids: number[]) => void;
  reset: () => void;
}

const defaultStep1: Step1Data = {
  titulo: "",
  descripcion: "",
  tipo: "ONLINE",
  area: null,
  fecha_limite: "",
  version: "1.0",
  imagen_portada: "",
  duracion_horas: "",
  cert_expira_meses: "",
};

const defaultStep3: Step3Data = {
  puntaje_minimo: "70",
  max_intentos: "3",
  tiempo_limite_minutos: "",
};

export const useCourseWizardStore = create<CourseWizardState>()(
  persist(
    (set) => ({
      step: 1,
      mode: "create",
      courseId: null,
      step1: defaultStep1,
      modules: [],
      step3: defaultStep3,
      audienciaGrupos: [],

      setStep: (s) => set({ step: s }),
      setMode: (m) => set({ mode: m }),
      setCourseId: (id) => set({ courseId: id }),
      setStep1: (data) => set((state) => ({ step1: { ...state.step1, ...data } })),
      setModules: (modules) => set({ modules }),
      setStep3: (data) => set((state) => ({ step3: { ...state.step3, ...data } })),
      setAudienciaGrupos: (ids) => set({ audienciaGrupos: ids }),
      reset: () =>
        set({
          step: 1,
          mode: "create",
          courseId: null,
          step1: defaultStep1,
          modules: [],
          step3: defaultStep3,
          audienciaGrupos: [],
        }),
    }),
    { name: "course-wizard" }
  )
);
