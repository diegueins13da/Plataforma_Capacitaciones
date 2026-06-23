import { create } from "zustand";
import { persist } from "zustand/middleware";

export type TrainerMode = "INSTRUCTOR" | "ALUMNO";

interface TrainerModeStore {
  mode: TrainerMode;
  setMode: (mode: TrainerMode) => void;
  toggle: () => void;
}

export const useTrainerModeStore = create<TrainerModeStore>()(
  persist(
    (set, get) => ({
      mode: "INSTRUCTOR",
      setMode: (mode) => set({ mode }),
      toggle: () =>
        set({ mode: get().mode === "INSTRUCTOR" ? "ALUMNO" : "INSTRUCTOR" }),
    }),
    { name: "trainer-mode" }
  )
);
