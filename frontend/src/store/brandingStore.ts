import { create } from "zustand";
import { configService } from "../services/configService";

const DEFAULT_APP_NAME = "LMS Corporativo";

interface BrandingStore {
  appName: string;
  fetched: boolean;
  fetchBranding: () => Promise<void>;
  setAppName: (name: string) => void;
}

export const useBrandingStore = create<BrandingStore>((set, get) => ({
  appName: DEFAULT_APP_NAME,
  fetched: false,

  fetchBranding: async () => {
    if (get().fetched) return;
    try {
      const branding = await configService.getPublicBranding();
      const name = branding["SYSTEM_NAME"]?.trim() || DEFAULT_APP_NAME;
      document.title = name;
      set({ appName: name, fetched: true });
    } catch {
      set({ fetched: true });
    }
  },

  setAppName: (name) => {
    const resolved = name?.trim() || DEFAULT_APP_NAME;
    document.title = resolved;
    set({ appName: resolved });
  },
}));
