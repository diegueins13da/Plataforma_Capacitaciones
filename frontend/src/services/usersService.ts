import api from "./api";
import type { PaginatedResponse } from "../types";
import type {
  AddMembersRequest,
  CreateGroupRequest,
  Group,
  GroupMember,
  UpdateGroupRequest,
} from "../types/groups";

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
};
