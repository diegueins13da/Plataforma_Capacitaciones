export type SettingCategory = "SMTP" | "BRANDING" | "SEGURIDAD" | "NOTIF" | "LDAP";

export interface SystemSetting {
  id: number;
  clave: string;
  valor: string;
  valor_display: string | number | boolean;
  tipo_dato: "STRING" | "BOOLEAN" | "INTEGER" | "JSON";
  categoria: SettingCategory;
  descripcion: string;
  es_sensible: boolean;
  updated_at: string;
}

export type GroupedSettings = Record<SettingCategory, SystemSetting[]>;
