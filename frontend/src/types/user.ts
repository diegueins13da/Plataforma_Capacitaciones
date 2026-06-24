/**
 * Admin user management types — returned by /api/v1/users/
 */
export type UserRole = "ADMIN" | "TRAINER" | "USUARIO";

export interface AdminUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  is_superuser: boolean;
  is_locked: boolean;
  must_change_password: boolean;
  area: string;
  cargo: string;
  grupo_nombre: string | null;
  auth_source: "LOCAL" | "LDAP";
}

export interface LdapSyncResult {
  created: number;
  updated: number;
  deactivated: number;
  skipped: number;
  errors: number;
  error_details: string[];
}

export interface CreateUserPayload {
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  area?: string;
  cargo?: string;
  grupo_id?: number | null;
}

export interface UpdateUserPayload {
  email?: string;
  first_name?: string;
  last_name?: string;
  area?: string;
  cargo?: string;
  grupo_id?: number | null;
}

export interface ChangeRolePayload {
  new_role: UserRole;
}

export interface UserFilters {
  role?: UserRole;
  is_active?: boolean;
  area?: string;
  search?: string;
  page?: number;
}

// ---------------------------------------------------------------------------
// Bulk import
// ---------------------------------------------------------------------------

export interface BulkImportValidRow {
  row: number;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  area?: string;
  cargo?: string;
  grupo_id?: number | null;
}

export interface BulkImportErrorRow {
  row: number;
  email: string;
  errors: string[];
}

export interface BulkImportPreviewResult {
  valid_count: number;
  error_count: number;
  valid_rows: BulkImportValidRow[];
  error_rows: BulkImportErrorRow[];
}

export interface BulkImportCommitResult {
  created: number;
  failed: number;
  errors: BulkImportErrorRow[];
}
