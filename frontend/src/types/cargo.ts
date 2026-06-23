export interface Cargo {
  id: number;
  nombre: string;
  area: number | null;
  area_nombre: string | null;
  activo: boolean;
  created_at: string;
}

export interface CreateCargoPayload {
  nombre: string;
  area?: number | null;
  activo?: boolean;
}

export type UpdateCargoPayload = Partial<CreateCargoPayload>;
