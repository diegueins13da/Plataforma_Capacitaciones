import api from "./api";
import type { PaginatedResponse } from "../types";

// ---------------------------------------------------------------------------
// Dashboard types
// ---------------------------------------------------------------------------

export interface DashboardCourse {
  enrollment_id: number;
  course_id: number;
  titulo: string;
  progreso: number;
  fecha_limite: string | null;
  days_left: number | null;
  urgency: "verde" | "amarillo" | "rojo";
  estado: string;
}

export interface DashboardActivity {
  accion: string;
  timestamp: string;
  ip: string | null;
  entidad_nombre?: string | null;
  entidad_tipo?: string | null;
}

export interface DashboardCertificate {
  id: string;
  titulo: string;
  fecha_emision: string;
  fecha_vencimiento: string | null;
}

export interface DashboardCompletedCourse {
  enrollment_id: number;
  course_id: number;
  titulo: string;
  fecha_completado: string | null;
}

export interface DashboardData {
  resumen: {
    en_progreso: number;
    completados: number;
    vencidos: number;
    certificados?: number;
    certs_por_vencer?: number;
  };
  cursos_activos: DashboardCourse[];
  cursos_completados?: DashboardCompletedCourse[];
  proximos_vencimientos: DashboardCourse[];
  certificados?: DashboardCertificate[];
  actividad_reciente: DashboardActivity[];
}

import type {
  AddMembersRequest,
  CreateGroupRequest,
  Group,
  GroupMember,
  UpdateGroupRequest,
} from "../types/groups";
import type {
  AdminUser,
  BulkImportCommitResult,
  BulkImportPreviewResult,
  BulkImportValidRow,
  ChangeRolePayload,
  CreateUserPayload,
  CatalogSyncResult,
  LdapSyncResult,
  UpdateUserPayload,
  UserFilters,
} from "../types/user";
import type { Area } from "../types/area";

const BASE = "/v1/groups";

export const usersService = {
  // ---------------------------------------------------------------------------
  // Dashboard
  // ---------------------------------------------------------------------------

  async getDashboard(): Promise<DashboardData> {
    const res = await api.get<DashboardData>("/v1/users/me/dashboard/");
    return res.data;
  },

  // ---------------------------------------------------------------------------
  // Groups
  // ---------------------------------------------------------------------------

  async getGroups(): Promise<Group[]> {
    const res = await api.get<PaginatedResponse<Group> | Group[]>(BASE + "/");
    const data = res.data;
    return Array.isArray(data) ? data : data.results;
  },

  async getGroup(id: number): Promise<Group> {
    const res = await api.get<Group>(`${BASE}/${id}/`);
    return res.data;
  },

  async createGroup(payload: CreateGroupRequest): Promise<Group> {
    const res = await api.post<Group>(BASE + "/", payload);
    return res.data;
  },

  async updateGroup(id: number, payload: UpdateGroupRequest): Promise<Group> {
    const res = await api.patch<Group>(`${BASE}/${id}/`, payload);
    return res.data;
  },

  async deleteGroup(id: number): Promise<void> {
    await api.delete(`${BASE}/${id}/`);
  },

  // ---------------------------------------------------------------------------
  // Members sub-resource
  // ---------------------------------------------------------------------------

  async getGroupMembers(groupId: number): Promise<GroupMember[]> {
    const res = await api.get<PaginatedResponse<GroupMember> | GroupMember[]>(
      `${BASE}/${groupId}/members/`
    );
    const data = res.data;
    return Array.isArray(data) ? data : data.results;
  },

  async addGroupMembers(groupId: number, payload: AddMembersRequest): Promise<GroupMember[]> {
    const res = await api.post<GroupMember[]>(`${BASE}/${groupId}/members/`, payload);
    return res.data;
  },

  async removeGroupMember(groupId: number, userId: number): Promise<void> {
    await api.delete(`${BASE}/${groupId}/members/${userId}/`);
  },

  // ---------------------------------------------------------------------------
  // Users
  // ---------------------------------------------------------------------------

  async getUsers(filters?: UserFilters): Promise<PaginatedResponse<AdminUser>> {
    const params: Record<string, string | number | boolean | undefined> = {};
    if (filters?.role) params.role = filters.role;
    if (filters?.is_active !== undefined) params.is_active = filters.is_active;
    if (filters?.area) params.area = filters.area;
    if (filters?.search) params.search = filters.search;
    if (filters?.page) params.page = filters.page;
    const res = await api.get<PaginatedResponse<AdminUser>>("/v1/users/", { params });
    return res.data;
  },

  async getUser(id: number): Promise<AdminUser> {
    const res = await api.get<AdminUser>(`/v1/users/${id}/`);
    return res.data;
  },

  async createUser(payload: CreateUserPayload): Promise<AdminUser> {
    const res = await api.post<AdminUser>("/v1/users/", payload);
    return res.data;
  },

  async updateUser(id: number, payload: UpdateUserPayload): Promise<AdminUser> {
    const res = await api.patch<AdminUser>(`/v1/users/${id}/`, payload);
    return res.data;
  },

  async changeUserRole(id: number, payload: ChangeRolePayload): Promise<AdminUser> {
    const res = await api.post<AdminUser>(`/v1/users/${id}/change-role/`, payload);
    return res.data;
  },

  async activateUser(id: number): Promise<AdminUser> {
    const res = await api.post<AdminUser>(`/v1/users/${id}/activate/`);
    return res.data;
  },

  async deactivateUser(id: number): Promise<AdminUser> {
    const res = await api.post<AdminUser>(`/v1/users/${id}/deactivate/`);
    return res.data;
  },

  async deleteUser(id: number): Promise<void> {
    await api.delete(`/v1/users/${id}/`);
  },

  async resetLockout(id: number): Promise<void> {
    await api.post(`/v1/users/${id}/reset-lockout/`);
  },

  async toggleUserMfa(id: number): Promise<AdminUser> {
    const res = await api.post<AdminUser>(`/v1/users/${id}/toggle-mfa/`);
    return res.data;
  },

  async ldapSync(): Promise<LdapSyncResult> {
    const res = await api.post<LdapSyncResult>("/v1/users/ldap-sync/");
    return res.data;
  },

  async catalogSync(): Promise<CatalogSyncResult> {
    const res = await api.post<CatalogSyncResult>("/v1/users/catalog-sync/");
    return res.data;
  },

  // ---------------------------------------------------------------------------
  // Bulk import
  // ---------------------------------------------------------------------------

  async bulkImportPreview(file: File): Promise<BulkImportPreviewResult> {
    const form = new FormData();
    form.append("file", file);
    const res = await api.post<BulkImportPreviewResult>(
      "/v1/users/bulk-import/preview/",
      form,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
    return res.data;
  },

  async bulkImportConfirm(rows: BulkImportValidRow[]): Promise<BulkImportCommitResult> {
    const res = await api.post<BulkImportCommitResult>("/v1/users/bulk-import/confirm/", {
      rows,
    });
    return res.data;
  },

  // ---------------------------------------------------------------------------
  // Area catalog (read — write via configService)
  // ---------------------------------------------------------------------------

  async getAreas(): Promise<Area[]> {
    const res = await api.get<{ results?: Area[] } | Area[]>("/v1/areas/");
    const data = res.data;
    return Array.isArray(data) ? data : (data.results ?? []);
  },
};
