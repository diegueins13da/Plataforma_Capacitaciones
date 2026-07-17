export interface Group {
  id: number;
  nombre: string;
  descripcion: string;
  activo: boolean;
  from_ad: boolean;
  created_at: string;
  member_count: number;
  cursos_activos: number;
}

export interface GroupMember {
  id: number;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  area: string;
  cargo: string;
}

export interface CreateGroupRequest {
  nombre: string;
  descripcion?: string;
  activo?: boolean;
}

export type UpdateGroupRequest = Partial<CreateGroupRequest>;

export interface AddMembersRequest {
  user_ids: number[];
}
