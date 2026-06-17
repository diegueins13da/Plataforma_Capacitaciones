export type CourseEstado = "BORRADOR" | "PUBLICADO" | "ARCHIVADO";
export type CourseTipo = "ONLINE" | "PRESENCIAL" | "HIBRIDO" | "AUTOAPRENDIZAJE";
export type ModuleTipo = "VIDEO" | "PDF" | "TEXTO" | "SCORM";

export interface CourseModule {
  id: number;
  titulo: string;
  descripcion: string;
  tipo_contenido: ModuleTipo;
  orden: number;
  es_secuencial: boolean;
  duracion_minutos: number | null;
  url_video: string;
  archivo_pdf: string;
  contenido_html: string;
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
  modules: CourseModule[];
  audiencia_grupos: CourseGroup[];
  cert_expira_meses: number | null;
  created_at: string;
  updated_at: string;
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
  created_at: string;
  updated_at: string;
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
  tipo_contenido: ModuleTipo;
  orden?: number;
  es_secuencial?: boolean;
  duracion_minutos?: number | null;
  url_video?: string;
  contenido_html?: string;
}

export interface CourseFilters {
  estado?: CourseEstado;
  area?: number;
  page?: number;
}
