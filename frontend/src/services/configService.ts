import api from "./api";
import type { Area, CreateAreaPayload, UpdateAreaPayload } from "../types/area";
import type { Cargo, CreateCargoPayload, UpdateCargoPayload } from "../types/cargo";
import type { Group } from "../types/groups";
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

  async testEmail(recipient: string): Promise<{ ok: boolean; message: string; config: Record<string, unknown> }> {
    const res = await api.post<{ ok: boolean; message: string; config: Record<string, unknown> }>(
      "/v1/config/test-email/",
      { recipient },
    );
    return res.data;
  },

  async testLdap(): Promise<{ ok: boolean; message: string; latency_ms: number | null }> {
    const res = await api.post<{ ok: boolean; message: string; latency_ms: number | null }>(
      "/v1/config/test-ldap/",
    );
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

  // ---------------------------------------------------------------------------
  // Groups (departamentos desde AD)
  // ---------------------------------------------------------------------------

  async getGroups(): Promise<Group[]> {
    const res = await api.get<PaginatedResponse<Group> | Group[]>("/v1/groups/");
    const data = res.data;
    return Array.isArray(data) ? data : data.results;
  },

  // ---------------------------------------------------------------------------
  // Cargo catalog
  // ---------------------------------------------------------------------------

  async getCargos(areaId?: number): Promise<Cargo[]> {
    const params = areaId ? { area_id: areaId } : {};
    const res = await api.get<PaginatedResponse<Cargo> | Cargo[]>("/v1/cargos/", { params });
    const data = res.data;
    return Array.isArray(data) ? data : data.results;
  },

  async createCargo(payload: CreateCargoPayload): Promise<Cargo> {
    const res = await api.post<Cargo>("/v1/cargos/", payload);
    return res.data;
  },

  async updateCargo(id: number, payload: UpdateCargoPayload): Promise<Cargo> {
    const res = await api.patch<Cargo>(`/v1/cargos/${id}/`, payload);
    return res.data;
  },

  async deleteCargo(id: number): Promise<void> {
    await api.delete(`/v1/cargos/${id}/`);
  },
};
