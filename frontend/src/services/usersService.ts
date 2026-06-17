import api from "./api";
import type { PaginatedResponse } from "../types";
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
  UpdateUserPayload,
  UserFilters,
} from "../types/user";
import type { Area } from "../types/area";

const BASE = "/v1/groups";

export const usersService = {
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

  async deactivateUser(id: number): Promise<AdminUser> {
    const res = await api.post<AdminUser>(`/v1/users/${id}/deactivate/`);
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
