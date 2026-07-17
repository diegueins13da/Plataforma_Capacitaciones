export interface Area {
  id: number;
  nombre: string;
  descripcion: string;
  activo: boolean;
  from_ad: boolean;
  created_at: string;
  user_count: number;
}

export interface CreateAreaPayload {
  nombre: string;
  descripcion?: string;
  activo?: boolean;
}

export interface UpdateAreaPayload {
  nombre?: string;
  descripcion?: string;
  activo?: boolean;
}
