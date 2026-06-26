export type CourseEstado = "BORRADOR" | "PUBLICADO" | "ARCHIVADO";
export type CourseTipo = "ONLINE" | "PRESENCIAL" | "HIBRIDO" | "AUTOAPRENDIZAJE";
export type TemaTipo = "VIDEO" | "PDF" | "TEXTO" | "IMAGEN" | "IFRAME";

export interface Tema {
  id: number;
  titulo: string;
  orden: number;
  tipo_contenido: TemaTipo;
  duracion_minutos: number | null;
  url_video: string;
  archivo_video: string;
  archivo_pdf: string;
  contenido_html: string;
  archivo_imagen: string;
  url_iframe: string;
  created_at: string;
  updated_at: string;
}

export interface CourseModule {
  id: number;
  titulo: string;
  descripcion: string;
  orden: number;
  es_secuencial: boolean;
  temas: Tema[];
  created_at: string;
  updated_at: string;
}

export interface CourseGroup {
  id: number;
  nombre: string;
}

export interface Course {
  id: number;
  titulo: string;
  descripcion: string;
  tipo: CourseTipo;
  estado: CourseEstado;
  fecha_limite: string | null;
  version: string;
  imagen_portada: string;
  duracion_horas: number | null;
  area_nombre: string;
  area: number | null;
  instructor_nombre: string;
  instructor: number | null;
  module_count: number;
  modules_with_status: CourseModuleWithStatus[];
  audiencia_grupos: CourseGroup[];
  cert_expira_meses: number | null;
  enrollment: CourseEnrollment | null;
  has_assessment: boolean;
  created_at: string;
  updated_at: string;
}

export interface CourseEnrollment {
  id: number;
  estado: "EN_PROGRESO" | "COMPLETADO" | "VENCIDO";
  progreso_porcentaje: number;
  fecha_inscripcion: string;
  fecha_completado: string | null;
}

export interface CourseListItem {
  id: number;
  titulo: string;
  descripcion: string;
  tipo: CourseTipo;
  estado: CourseEstado;
  fecha_limite: string | null;
  version: string;
  imagen_portada: string;
  duracion_horas: number | null;
  area_nombre: string;
  instructor_nombre: string;
  module_count: number;
  enrollment: CourseEnrollment | null;
  can_edit: boolean;
  created_at: string;
  updated_at: string;
}

export interface CourseModuleWithStatus extends CourseModule {
  is_completed: boolean;
  is_unlocked: boolean;
  last_position_json: Record<string, number>;
}

export interface CreateCoursePayload {
  titulo: string;
  descripcion?: string;
  tipo?: CourseTipo;
  fecha_limite?: string | null;
  version?: string;
  imagen_portada?: string;
  duracion_horas?: number | null;
  cert_expira_meses?: number | null;
  area?: number | null;
  instructor?: number | null;
  audiencia_grupos?: number[];
}

export interface CreateModulePayload {
  titulo: string;
  descripcion?: string;
  orden?: number;
  es_secuencial?: boolean;
}

export interface CreateTemaPayload {
  titulo: string;
  tipo_contenido: TemaTipo;
  orden?: number;
  duracion_minutos?: number | null;
  url_video?: string;
  contenido_html?: string;
  url_iframe?: string;
}

export interface CourseFilters {
  estado?: CourseEstado;
  area?: number;
  page?: number;
  as_student?: boolean;
}
