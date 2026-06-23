// ---------------------------------------------------------------------------
// Domain types — expanded as features are added in subsequent tasks
// ---------------------------------------------------------------------------

export type Role = "ADMIN" | "TRAINER" | "USUARIO";

export interface User {
  id: number;
  email: string;
  full_name: string;
  first_name: string;
  last_name: string;
  role: Role;
  is_active: boolean;
  must_change_password: boolean;
  cargo?: string;
  rubrica_url?: string | null;
  area?: string;
  grupo?: { id: number; name: string } | null;
}

export interface ApiError {
  errors: Record<string, string[]>;
  status: number;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
