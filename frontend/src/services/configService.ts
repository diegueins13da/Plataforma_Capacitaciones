import api from "./api";
import type { Area, CreateAreaPayload, UpdateAreaPayload } from "../types/area";
import type { GroupedSettings, SystemSetting } from "../types/config";
import type { PaginatedResponse } from "../types";

export const configService = {
  // ---------------------------------------------------------------------------
  // SystemSetting
  // ---------------------------------------------------------------------------

  async getSettings(): Promise<GroupedSettings> {
    const res = await api.get<GroupedSettings>("/v1/config/");
    return res.data;
  },

  async updateSetting(clave: string, valor: string): Promise<SystemSetting> {
    const res = await api.patch<SystemSetting>(`/v1/config/${clave}/`, { valor });
    return res.data;
  },

  // ---------------------------------------------------------------------------
  // Area catalog
  // ---------------------------------------------------------------------------

  async getAreas(): Promise<Area[]> {
    const res = await api.get<PaginatedResponse<Area> | Area[]>("/v1/areas/");
    const data = res.data;
    return Array.isArray(data) ? data : data.results;
  },

  async createArea(payload: CreateAreaPayload): Promise<Area> {
    const res = await api.post<Area>("/v1/areas/", payload);
    return res.data;
  },

  async updateArea(id: number, payload: UpdateAreaPayload): Promise<Area> {
    const res = await api.patch<Area>(`/v1/areas/${id}/`, payload);
    return res.data;
  },

  async deleteArea(id: number): Promise<void> {
    await api.delete(`/v1/areas/${id}/`);
  },
};
