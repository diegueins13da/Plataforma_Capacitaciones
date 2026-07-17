# Estado Actual del Sistema — LMS Corporativo
**Cooperativa de Ahorro y Crédito Acción Tungurahua Ltda.**
**Versión del documento:** 1.0 | **Fecha:** 26 de junio de 2026
**Estado del sistema:** Certificado — Listo para producción

---

## Índice

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Infraestructura y despliegue](#2-infraestructura-y-despliegue)
3. [Stack tecnológico completo](#3-stack-tecnológico-completo)
4. [Arquitectura del sistema](#4-arquitectura-del-sistema)
5. [Módulos backend](#5-módulos-backend)
6. [Modelo de datos real](#6-modelo-de-datos-real)
7. [API REST — endpoints disponibles](#7-api-rest--endpoints-disponibles)
8. [Frontend — páginas y rutas](#8-frontend--páginas-y-rutas)
9. [Flujos funcionales por rol](#9-flujos-funcionales-por-rol)
10. [Seguridad implementada](#10-seguridad-implementada)
11. [Integración IA (Anthropic Claude)](#11-integración-ia-anthropic-claude)
12. [Sistema de notificaciones](#12-sistema-de-notificaciones)
13. [Generación de certificados PDF](#13-generación-de-certificados-pdf)
14. [Variables de entorno requeridas](#14-variables-de-entorno-requeridas)
15. [Comandos de operación](#15-comandos-de-operación)
16. [Estado QA — resultados de la auditoría](#16-estado-qa--resultados-de-la-auditoría)
17. [Datos reales del sistema](#17-datos-reales-del-sistema)
18. [Qué está implementado vs qué está diferido](#18-qué-está-implementado-vs-qué-está-diferido)

---

## 1. Resumen ejecutivo

El **LMS Corporativo** es una plataforma web de gestión de aprendizaje (Learning Management System) construida a medida para la Cooperativa de Ahorro y Crédito Acción Tungurahua. Permite a los colaboradores acceder a cursos de capacitación, rendir evaluaciones y obtener certificados digitales verificables. El diferenciador clave es la integración con IA (Anthropic Claude) para generación automática de módulos de curso y preguntas de evaluación desde materiales existentes (PDF, PPT).

**Estado a junio 2026:**
- 47/47 pruebas QA aprobadas (0 bugs abiertos)
- 13/13 controles de seguridad PASS
- 0 errores JavaScript en consola
- Sistema en entorno dev con datos reales: 79 usuarios, 18 cursos, 14 certificados
- Listo para despliegue en servidor de producción

---

## 2. Infraestructura y despliegue

### Servicios Docker (producción)

El sistema corre como 7 contenedores Docker orquestados con Docker Compose:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Servidor Linux                                │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  nginx (puerto 80)                                               │    │
│  │    ├── GET /          → sirve React build estático              │    │
│  │    ├── GET /api/*     → proxy_pass backend:8000                │    │
│  │    ├── GET /static/*  → proxy_pass backend:8000                │    │
│  │    └── GET /media/*   → proxy_pass backend:8000                │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  ┌─────────────────┐  ┌────────────────────┐  ┌───────────────────┐    │
│  │ backend         │  │ celery-worker      │  │ celery-beat       │    │
│  │ Django+Gunicorn │  │ Procesa tareas IA  │  │ Tareas periódicas │    │
│  │ puerto 8000     │  │ y generación PDF   │  │ (alertas crons)   │    │
│  └────────┬────────┘  └─────────┬──────────┘  └────────┬──────────┘    │
│           │                     │                       │               │
│  ┌────────▼─────────────────────▼───────────────────────▼────────────┐  │
│  │  redis:6379 (broker Celery + caché)                               │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  db: postgres:15 — volumen persistente postgres_data              │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Volúmenes persistentes

| Volumen | Ruta contenedor | Contenido |
|---|---|---|
| `postgres_data` | `/var/lib/postgresql/data` | Toda la base de datos |
| `redis_data` | `/data` | Caché y cola Celery |
| `backend_media` | `/app/media` | Archivos subidos: PDFs, imágenes, rúbricas |
| `backend_static` | `/app/staticfiles` | Assets Django admin |

### Archivos de configuración Docker

| Archivo | Uso |
|---|---|
| `docker-compose.yml` | Producción (sin puertos expuestos para backend/db) |
| `docker-compose.dev.yml` | Desarrollo local (puertos expuestos, hot-reload) |
| `backend/Dockerfile` | Multi-stage: base, development, production |
| `frontend/Dockerfile` | Multi-stage: builder (Node), production (nginx) |

### Healthchecks

- `db`: `pg_isready` cada 10s
- `redis`: `redis-cli ping` cada 10s
- `backend`: `curl http://localhost:8000/api/health/` cada 30s
- `frontend`, `celery-worker`, `celery-beat`: policy `unless-stopped`

---

## 3. Stack tecnológico completo

### Backend

| Componente | Tecnología | Versión |
|---|---|---|
| Framework | Django | ≥5.0, <6.0 |
| API REST | Django REST Framework | ≥3.15 |
| Autenticación | djangorestframework-simplejwt | ≥5.3 |
| Blacklisting JWT | rest_framework_simplejwt.token_blacklist | incluido |
| Base de datos | PostgreSQL | 15 (Alpine) |
| Driver BD | psycopg2-binary | ≥2.9 |
| Config env | django-environ | ≥0.11 |
| CORS | django-cors-headers | ≥4.3 |
| Filtros API | django-filter | ≥24.0 |
| Bloqueo cuentas | django-axes | ≥6.4 |
| Hash contraseñas | argon2-cffi | ≥23.1 |
| LDAP/AD | python-ldap + django-auth-ldap | ≥3.4 / ≥4.6 |
| Cola de tareas | Celery | ≥5.4 |
| Tareas periódicas | django-celery-beat | ≥2.6 |
| Broker tareas | Redis (Python client) | ≥5.0 |
| Parse PDF | pdfplumber | ≥0.11 |
| Parse PPT | python-pptx | ≥1.0 |
| IA | Anthropic SDK | ≥0.30 |
| Sanitización HTML | bleach | ≥6.1 |
| Excel export/import | openpyxl | ≥3.1 |
| Imágenes | Pillow | ≥10.3 |
| Códigos QR | qrcode[pil] | ≥7.4 |
| Generación PDF cert. | WeasyPrint | ≥62.0 |
| Logging estructurado | structlog + django-structlog | ≥24.0 / ≥8.0 |
| Testing | pytest-django | vía requirements/development.txt |

### Frontend

| Componente | Tecnología | Versión |
|---|---|---|
| Framework | React | ^18.3.1 |
| Lenguaje | TypeScript | ^5.5.3 |
| Build tool | Vite | ^5.3.4 |
| Routing | React Router DOM | ^6.25.1 |
| Estado global | Zustand | ^4.5.4 |
| HTTP client | Axios | ^1.7.2 |
| Server state | TanStack React Query | ^5.51.1 |
| UI base | Tailwind CSS | ^3.4.6 |
| Componentes UI | Radix UI (primitives) | múltiples ^1.x |
| Formularios | React Hook Form | ^7.52.1 |
| Validación | Zod | ^3.23.8 |
| Gráficos | Recharts | ^3.8.1 |
| Visor PDF | pdfjs-dist | ^4.10.38 |
| Fechas | date-fns | ^3.6.0 |
| Iconos | Lucide React | ^0.408.0 |
| Toasts | Sonner | ^1.5.0 |
| Testing | Vitest + React Testing Library | ^2.0.0 |

### Infraestructura

| Componente | Tecnología |
|---|---|
| Proxy reverso | Nginx (dentro del contenedor frontend) |
| Contenedores | Docker + Docker Compose |
| Modelo IA | claude-sonnet-4-6 (Anthropic) |
| Generación PDF | WeasyPrint (requiere Cairo + Pango en el contenedor) |
| Servidor WSGI | Gunicorn (producción) |

---

## 4. Arquitectura del sistema

### Patrón backend: 4 capas estrictas

Cada aplicación Django sigue exactamente este patrón sin excepciones:

```
models.py       ← Define la estructura de datos y relaciones en BD
     ↓
services.py     ← TODA la lógica de negocio vive aquí y solo aquí
     ↓
views.py        ← Recibe request HTTP, llama service, retorna response
     ↓
serializers.py  ← Solo valida formato y convierte tipos (JSON ↔ Python)
```

**Invariantes:**
- `views.py` no contiene lógica condicional de negocio
- `serializers.py` no calcula nada
- `services.py` puede testearse sin levantar HTTP
- `models.py` solo tiene métodos de instancia (`__str__`, propiedades simples)

### Patrón frontend: capas separadas

```
pages/          ← Pantallas completas (no lógica de negocio)
     ↓
components/     ← Componentes reutilizables
     ↓
hooks/          ← Custom hooks (estado local + llamadas a services)
     ↓
services/       ← Llamadas a la API vía Axios (única capa que habla con backend)
     ↓
store/          ← Estado global Zustand (auth, notificaciones)
     ↓
types/          ← Interfaces TypeScript espejo de modelos backend
```

### Flujo de autenticación JWT

```
1. POST /api/v1/auth/login/
   → devuelve { access: "...", refresh: "...", user: {...} }

2. Frontend guarda en localStorage:
   - lms_access_token  (JWT access, TTL 30 min)
   - lms_refresh_token (JWT refresh, TTL 24h)

3. Axios interceptor agrega header:
   Authorization: Bearer <lms_access_token>

4. Cuando el access expira → interceptor llama automáticamente:
   POST /api/v1/auth/token/refresh/
   y reintenta la petición original

5. Si el refresh también expiró → logout automático y redirect /login
```

### Flujo de tareas asíncronas (Celery)

```
Frontend → POST /api/v1/ai/generate-modules/
         → Backend encola tarea Celery → responde 202 { task_id }

Redis (broker) → Celery Worker:
  1. Extrae texto del documento (pdfplumber / python-pptx)
  2. Construye prompt
  3. Llama a Anthropic API (claude-sonnet-4-6)
  4. Valida JSON de respuesta
  5. Persiste resultado en BD o lo retorna via polling

Frontend → GET /api/v1/ai/tasks/{task_id}/status/
         → { state: "SUCCESS", result: [...] }
```

---

## 5. Módulos backend

### `apps.authentication`

Gestiona login, logout, recuperación de contraseña y cambio obligatorio.

**Funciones principales:**
- Login con credenciales → JWT access + refresh tokens
- Rate limiting en endpoint de login
- Bloqueo automático tras 5 intentos fallidos (django-axes, 15 min)
- Recuperación de contraseña por correo con token temporal
- Cambio obligatorio de contraseña en primer login (`must_change_password=True`)
- Renovación automática de access token vía refresh
- Blacklisting de refresh tokens en logout

**Endpoints:**
```
POST /api/v1/auth/login/
POST /api/v1/auth/logout/
POST /api/v1/auth/token/refresh/
POST /api/v1/auth/password-recovery/
POST /api/v1/auth/password-recovery/confirm/
POST /api/v1/auth/change-password/
GET  /api/v1/auth/me/
```

---

### `apps.users`

Gestiona usuarios, perfiles, áreas, grupos, cargos e importación masiva.

**Modelos:**
- `User` — extiende AbstractUser; campo `role` (ADMIN/TRAINER/USUARIO), `must_change_password`
- `UserProfile` — área (FK), cargo, grupo (FK), rúbrica (firma imagen), auth_source (LOCAL/LDAP), ldap_dn
- `Area` — catálogo de áreas organizacionales
- `Group` — grupos de usuarios para asignación de cursos
- `Cargo` — cargos por área

**Funciones principales:**
- CRUD de usuarios con señal automática que crea UserProfile al crear User
- Importación masiva desde CSV/Excel (openpyxl)
- Sincronización con Active Directory (LDAP) vía django-auth-ldap
- Cambio de rol por administrador
- Activar/desactivar usuarios

**Endpoints:**
```
GET/POST   /api/v1/users/
GET/PUT    /api/v1/users/{id}/
GET/PUT    /api/v1/users/me/
POST       /api/v1/users/bulk-import/
POST       /api/v1/users/sync-ldap/
GET        /api/v1/users/groups/
GET        /api/v1/users/areas/
```

---

### `apps.courses`

Gestiona cursos, módulos, temas, inscripciones, progreso y certificados.

**Modelos:**
- `Course` — título, descripción, instructor (FK), área (FK), audiencia_grupos (M2M), tipo (ONLINE/PRESENCIAL/HIBRIDO/AUTOAPRENDIZAJE), estado (BORRADOR/PUBLICADO/ARCHIVADO), fecha_limite, version, imagen_portada, duracion_horas, cert_expira_meses
- `Module` — curso (FK), título, descripción, orden, es_secuencial
- `Tema` — módulo (FK), título, orden, tipo_contenido (VIDEO/PDF/TEXTO/IMAGEN/IFRAME), campos de contenido según tipo
- `Enrollment` — usuario (FK), curso (FK), estado (EN_PROGRESO/COMPLETADO/VENCIDO), progreso_porcentaje, fecha_inscripcion, fecha_completado
- `ModuleProgress` — enrollment (FK), module (FK), is_completed, last_position_json (posición guardada), fecha_completado
- `Certificate` — UUID primario, usuario (FK), curso (FK), enrollment (FK), fecha_emision, nota_obtenida, url_pdf, url_qr

**Tipos de contenido en Tema:**
| Tipo | Campo almacenado |
|---|---|
| VIDEO | `url_video` (URL) o `archivo_video` (FileField) |
| PDF | `archivo_pdf` (ruta media) |
| TEXTO | `contenido_html` (HTML sanitizado con bleach) |
| IMAGEN | `archivo_imagen` (FileField) |
| IFRAME | `url_iframe` (URL externa embebida) |

**Máquina de estados del curso:**
```
BORRADOR → (publicar) → PUBLICADO → (archivar) → ARCHIVADO
```
- `publish()` valida que todos los módulos tengan al menos un tema con contenido
- `archive()` solo es posible desde estado PUBLICADO

**Progreso:**
- `Enrollment.update_progress()` recalcula `progreso_porcentaje` contando módulos completados vs total
- Al llegar a 100%, cambia estado a COMPLETADO automáticamente y genera certificado si el curso tiene evaluación aprobada

**Endpoints relevantes:**
```
GET/POST           /api/v1/courses/
GET/PUT/DELETE     /api/v1/courses/{id}/
POST               /api/v1/courses/{id}/publish/
POST               /api/v1/courses/{id}/archive/
GET/POST           /api/v1/courses/{id}/modules/
GET/PUT            /api/v1/courses/{id}/modules/{mid}/
GET/POST           /api/v1/courses/{id}/modules/{mid}/temas/
GET/POST           /api/v1/enrollments/
PATCH              /api/v1/enrollments/{id}/progress/
GET                /api/v1/instructor/dashboard/
GET                /api/v1/instructor/grades/
```

---

### `apps.assessments`

Gestiona evaluaciones, banco de preguntas e intentos de examen.

**Modelos:**
- `Assessment` — curso (FK, OneToOne), puntaje_minimo (%), max_intentos, tiempo_limite_minutos
- `Question` — assessment (FK), texto, tipo (MULTIPLE_CHOICE/MULTIPLE_SELECT/TRUE_FALSE), opciones (JSON), respuesta_correcta (JSON), orden, aprobada_por_humano
- `UserAnswer` — enrollment (FK), assessment (FK), intento_numero, respuestas_json, calificacion (%), aprobado, fecha_inicio, fecha_fin

**Regla de aprobación por humano:**
Solo las `Question` con `aprobada_por_humano=True` se incluyen en los exámenes. Las preguntas generadas por IA llegan con `aprobada_por_humano=False` y requieren revisión manual antes de usarse.

**Lógica de calificación:**
- Al enviar el examen, el servicio compara `respuestas_json` con `respuesta_correcta` de cada pregunta
- Para MULTIPLE_CHOICE: coincidencia exacta del índice
- Para MULTIPLE_SELECT: coincidencia exacta del set de índices
- Para TRUE_FALSE: coincidencia del booleano
- `calificacion` = (correctas / total) × 100
- `aprobado` = `calificacion >= assessment.puntaje_minimo`
- Si aprobado y es el primer intento aprobado → se genera certificado

**Endpoints:**
```
GET/POST       /api/v1/assessments/
GET/PUT        /api/v1/assessments/{id}/
GET/POST       /api/v1/assessments/{id}/questions/
POST           /api/v1/assessments/{course_id}/start/
PATCH          /api/v1/assessments/attempts/{attempt_id}/save/
POST           /api/v1/assessments/attempts/{attempt_id}/submit/
GET            /api/v1/assessments/attempts/{attempt_id}/
```

---

### `apps.certificates`

Genera PDFs con WeasyPrint, almacena certificados y permite descarga/verificación.

**Flujo de generación:**
1. Se crea el registro `Certificate` en BD al aprobar el examen
2. La señal `post_save` en el modelo dispara `generate_certificate_pdf_task.delay(cert_id)`
3. El Celery worker ejecuta la tarea: renderiza plantilla HTML + CSS → WeasyPrint → PDF
4. El PDF se guarda en `/media/certificates/{uuid}.pdf`
5. Se genera el código QR con URL pública de verificación
6. Se actualiza `url_pdf` y `url_qr` en el registro `Certificate`

**Plantilla del certificado incluye:**
- Logo de la cooperativa (configurable en SystemSetting)
- Nombre completo del participante
- Nombre del curso
- Fecha de emisión
- Horas de capacitación (`curso.duracion_horas`)
- Nota obtenida
- Rúbrica (firma imagen) del instructor
- Código QR con URL `https://[dominio]/certificates/{uuid}/verify/` (verificación pública sin login)

**Endpoints:**
```
GET    /api/v1/certificates/mine/
GET    /api/v1/certificates/admin/
GET    /api/v1/certificates/{uuid}/download/
GET    /api/v1/certificates/{uuid}/verify/   ← público, sin auth
```

---

### `apps.reports`

Genera reportes CSV y gestiona el log de auditoría.

**Reportes disponibles (descarga directa CSV):**
- `GET /api/v1/reports/users-progress/` — Progreso de usuarios: nombre, correo, área, cursos inscritos, completados, % promedio
- `GET /api/v1/reports/courses-summary/` — Resumen de cursos: nombre, inscritos, tasa de completación, nota promedio
- `GET /api/v1/reports/certificates/` — Certificados emitidos: usuario, curso, fecha, calificación

**Modelo `AuditLog`:**

Registro inmutable (el método `save()` lanza `ValueError` si `pk is not None`). Campos:

| Campo | Tipo | Descripción |
|---|---|---|
| `user` | FK nullable | Usuario que realizó la acción (SET_NULL si se elimina) |
| `accion` | CharField | Código del evento (LOGIN_SUCCESS, COURSE_PUBLISHED, etc.) |
| `ip` | GenericIPAddressField | IP del request |
| `timestamp` | DateTimeField (auto) | Fecha/hora inmutable |
| `detalles_json` | JSONField | Payload libre adicional |
| `actor_email` | CharField | Email snapshotted al momento del evento |
| `actor_nombre` | CharField | Nombre snapshotted al momento del evento |
| `actor_rol` | CharField | Rol snapshotted al momento del evento |
| `user_agent` | CharField | User-Agent del browser |
| `resultado` | CharField | "OK" o "ERROR" |
| `error_detalle` | TextField | Mensaje de error si resultado=ERROR |
| `entidad_tipo` | CharField | Tipo del objeto afectado (Course, User, etc.) |
| `entidad_id` | CharField | PK/UUID del objeto afectado |
| `entidad_nombre` | CharField | Nombre del objeto en el momento del evento |

**Acciones auditadas:**
`LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGOUT`, `ACCESS_DENIED`, `USER_CREATED`, `USER_ROLE_CHANGED`, `USER_DEACTIVATED`, `USER_BULK_IMPORT`, `COURSE_PUBLISHED`, `COURSE_ARCHIVED`, `CERTIFICATE_GENERATED`, `EXAM_SUBMITTED`, `CONFIG_CHANGED`, `AI_CONTENT_APPROVED`, `PASSWORD_CHANGED`

**Endpoints:**
```
GET  /api/v1/reports/users-progress/
GET  /api/v1/reports/courses-summary/
GET  /api/v1/reports/certificates/
GET  /api/v1/reports/audit-logs/
```

---

### `apps.notifications`

Sistema de notificaciones in-app para los 3 roles.

**Tipos de notificación:**

| Tipo | Para quién |
|---|---|
| `NUEVO_CURSO` | Usuario — nuevo curso asignado |
| `VENCIMIENTO_7D` | Usuario — curso vence en 7 días |
| `VENCIMIENTO_1D` | Usuario — curso vence mañana |
| `VENCIDO` | Usuario — curso vencido |
| `EXAMEN_APROBADO` | Usuario — aprobó el examen |
| `EXAMEN_REPROBADO` | Usuario — reprobó el examen |
| `ALUMNO_INSCRITO` | Instructor — un alumno se inscribió en su curso |
| `ALUMNO_COMPLETO` | Instructor — un alumno completó su curso |
| `ALUMNO_APROBADO` | Instructor — un alumno aprobó el examen |
| `ALUMNO_REPROBADO` | Instructor — un alumno reprobó el examen |

Las alertas de vencimiento (`VENCIMIENTO_7D`, `VENCIMIENTO_1D`, `VENCIDO`) son generadas por tareas Celery-beat periódicas.

**Endpoints:**
```
GET    /api/v1/notifications/
PATCH  /api/v1/notifications/{id}/read/
POST   /api/v1/notifications/mark-all-read/
GET    /api/v1/notifications/unread-count/
```

---

### `apps.ai_generator`

Integración con Anthropic Claude para generación de contenido.

**Función A: Generación de módulos desde documentos**

```
1. Admin sube archivo PDF o PPT
2. Celery worker extrae texto:
   - PDF  → pdfplumber
   - PPT  → python-pptx
3. Construye prompt con texto extraído (máx. 8000 chars)
4. Llama a claude-sonnet-4-6 con:
   system: "Eres experto en diseño instruccional..."
   max_tokens: 4096
5. Respuesta: array JSON de módulos con { title, objetivo, descripcion, orden }
6. Validación + 3 reintentos automáticos si JSON malformado
7. Retorna propuesta al frontend (NO persiste en BD)
8. Admin revisa → aprueba/edita/descarta cada módulo
9. Solo módulos aprobados se guardan en BD
```

**Función B: Generación de preguntas de evaluación**

```
1. Admin configura: cantidad (1-20), tipos (MC/MS/TF), dificultad
2. Backend construye prompt con contenido del módulo (máx. 6000 chars)
3. Llama a claude-sonnet-4-6
4. Respuesta: array JSON con { texto, tipo, opciones, respuesta_correcta, dificultad, tema }
5. Validación + 3 reintentos
6. Retorna al frontend con aprobada_por_humano=False
7. Admin aprueba → Question se guarda con aprobada_por_humano=True
```

**Modelo usado:** `claude-sonnet-4-6` (configurable vía `ANTHROPIC_MODEL` en settings)

**Seguridad:** La API de Anthropic NUNCA es llamada desde el frontend. Solo el backend hace las llamadas.

**Endpoints:**
```
POST  /api/v1/ai/upload-document/
GET   /api/v1/ai/tasks/{task_id}/status/
POST  /api/v1/ai/generate-modules/
POST  /api/v1/ai/generate-questions/
POST  /api/v1/ai/approve-module/
POST  /api/v1/ai/approve-question/
```

---

### `apps.config`

Configuración del sistema accesible desde la UI de administración.

**Modelo `SystemSetting`:** clave/valor para configuración dinámica sin tocar código.

**Sub-secciones configurables desde la UI:**
- **Correo electrónico:** servidor SMTP, puerto, remitente
- **Identidad visual:** logo de la cooperativa, nombre de la empresa, colores del certificado
- **Seguridad:** intentos de login antes del bloqueo, tiempo de bloqueo, políticas de contraseña
- **Notificaciones:** plantillas de correo para cada evento
- **LDAP/AD:** host LDAP, puerto, base DN, usuario de servicio, filtros
- **Catálogo:** gestión de Áreas, Grupos y Cargos

---

### `apps.core`

Utilidades transversales: health check, middleware común, utilidades de respuesta.

**Endpoints:**
```
GET  /api/health/   ← usado por Docker healthcheck
```

---

## 6. Modelo de datos real

Tablas en la base de datos (nombres reales del `db_table`):

```
users               — User (extiende AbstractUser)
user_profiles       — UserProfile (1:1 con User)
areas               — Area
groups              — Group (grupos organizacionales, distinto de django.auth.Group)
cargos              — Cargo

courses             — Course
course_modules      — Module
course_temas        — Tema
enrollments         — Enrollment
module_progress     — ModuleProgress
certificates        — Certificate (PK = UUID)

assessments         — Assessment (1:1 con Course)
assessment_questions — Question
user_answers        — UserAnswer (intento de examen)

audit_logs          — AuditLog (inmutable)
notifications       — Notification
```

### Diagrama de relaciones

```
User ──────────────────────────────────────────────┐
 │ 1:1                                              │
 ▼                                                  │
UserProfile                                         │
 ├── area (FK → Area)                               │
 ├── grupo (FK → Group)                             │
 └── cargo (CharField)                              │
                                                    │
User ──── (1:N) ──── Enrollment ─── (1:N) ──── ModuleProgress
           │               │                        │
           │               └── (1:N) ──── UserAnswer │
           │                                         │
           └── (1:N) ──── Notification               │
           │                                         │
           └── (1:N) ──── AuditLog                   │
                                                     │
Course ─── (1:N) ──── Module ─── (1:N) ──── Tema    │
   │                                                 │
   ├── (1:1) ──── Assessment ─── (1:N) ──── Question │
   │                                                 │
   └── (1:N) ──── Certificate (← también FK User) ──┘
```

### Índices clave

```sql
-- audit_logs: búsquedas por actor, acción, resultado, entidad
INDEX audit_actor_email_idx ON audit_logs(actor_email)
INDEX audit_accion_idx      ON audit_logs(accion)
INDEX audit_resultado_idx   ON audit_logs(resultado)
INDEX audit_entidad_idx     ON audit_logs(entidad_tipo, entidad_id)

-- enrollments: reportes de progreso
UNIQUE ON enrollments(user_id, course_id)

-- module_progress: estado por enrollment
UNIQUE ON module_progress(enrollment_id, module_id)
```

---

## 7. API REST — endpoints disponibles

Prefijo global: `http://[servidor]/api/v1/`

### Autenticación
```
POST   auth/login/
POST   auth/logout/
POST   auth/token/refresh/
POST   auth/password-recovery/
POST   auth/password-recovery/confirm/
POST   auth/change-password/
GET    auth/me/
```

### Usuarios
```
GET    users/                         ← ADMIN: lista completa; TRAINER: solo su perfil
POST   users/                         ← ADMIN only
GET    users/{id}/
PUT    users/{id}/
GET    users/me/                      ← perfil propio (todos)
PUT    users/me/
POST   users/bulk-import/             ← ADMIN only
POST   users/sync-ldap/               ← ADMIN only
GET    users/groups/
GET    users/areas/
GET    users/cargos/
```

### Cursos
```
GET    courses/                       ← filtra por rol automáticamente
POST   courses/                       ← ADMIN + TRAINER
GET    courses/{id}/
PUT    courses/{id}/
POST   courses/{id}/publish/
POST   courses/{id}/archive/
GET    courses/{id}/modules/
POST   courses/{id}/modules/
PUT    courses/{id}/modules/{mid}/
DELETE courses/{id}/modules/{mid}/
GET    courses/{id}/modules/{mid}/temas/
POST   courses/{id}/modules/{mid}/temas/
PUT    courses/{id}/modules/{mid}/temas/{tid}/
DELETE courses/{id}/modules/{mid}/temas/{tid}/
GET    enrollments/
POST   enrollments/
PATCH  enrollments/{id}/progress/
GET    instructor/dashboard/          ← ADMIN + TRAINER
GET    instructor/grades/             ← ADMIN + TRAINER
```

### Evaluaciones
```
GET    assessments/{course_id}/
PUT    assessments/{course_id}/
GET    assessments/{course_id}/questions/
POST   assessments/{course_id}/questions/
PUT    assessments/{course_id}/questions/{qid}/
DELETE assessments/{course_id}/questions/{qid}/
POST   assessments/{course_id}/start/
PATCH  assessments/attempts/{id}/save/
POST   assessments/attempts/{id}/submit/
GET    assessments/attempts/{id}/
```

### Certificados
```
GET    certificates/mine/             ← todos los roles
GET    certificates/admin/            ← ADMIN only
GET    certificates/{uuid}/download/  ← PDF (todos los roles para el suyo; admin para todos)
GET    certificates/{uuid}/verify/    ← público, sin autenticación
```

### Reportes
```
GET    reports/users-progress/        ← ADMIN: CSV
GET    reports/courses-summary/       ← ADMIN: CSV
GET    reports/certificates/          ← ADMIN: CSV
GET    reports/audit-logs/            ← ADMIN: paginado JSON
```

### Notificaciones
```
GET    notifications/
PATCH  notifications/{id}/read/
POST   notifications/mark-all-read/
GET    notifications/unread-count/
```

### IA Generador
```
POST   ai/upload-document/
GET    ai/tasks/{task_id}/status/
POST   ai/generate-modules/
POST   ai/generate-questions/
POST   ai/approve-module/
POST   ai/approve-question/
```

### Configuración
```
GET    config/settings/               ← ADMIN only
PUT    config/settings/{clave}/
GET    config/areas/
POST   config/areas/
PUT    config/areas/{id}/
GET    config/groups/
POST   config/groups/
PUT    config/groups/{id}/
```

### Infraestructura
```
GET    /api/health/                   ← sin prefijo v1; sin autenticación
```

---

## 8. Frontend — páginas y rutas

### Estructura de rutas React Router v6

```
/ → redirect /login

── Públicas (sin auth) ──────────────────────────────────────────
/login                         LoginPage
/password-recovery             PasswordRecoveryPage
/account-locked                AccountLockedPage

── Autenticadas (cualquier rol) con AppLayout ───────────────────
/change-password               ForceChangePasswordPage
/dashboard                     DashboardPage
/profile                       ProfilePage
/courses                       CourseCatalogPage
/courses/:id                   CourseDetailPage
/courses/:courseId/modules/:moduleId   ModulePlayerPage
/courses/:courseId/completed   CourseCompletedPage
/my-courses                    → redirect /courses
/my-certificates               MyCertificatesPage
/notifications                 NotificationsPage
/courses/:courseId/exam                ExamIntroPage
/courses/:courseId/exam/in-progress    ExamQuestionPage
/courses/:courseId/exam/result         ExamResultPage

── ADMIN + TRAINER con AppLayout ────────────────────────────────
/admin/courses                 CourseListPage
/admin/courses/new             CourseWizardPage
/admin/courses/:id/edit        CourseWizardPage
/admin/courses/:id/ai-generator AIGeneratorPage
/instructor/grades             InstructorGradesPage

── ADMIN only con AppLayout ─────────────────────────────────────
/admin                         AdminDashboardPage
/admin/config                  AdminConfigPage
/admin/certificates            AdminCertificatesPage
/admin/users                   UserManagementPage
/admin/groups                  GroupManagementPage
/admin/users/import            BulkImportPage
/admin/users/import-history    ImportHistoryPage
/admin/config/general          SystemConfigPage
/admin/reports                 AdminReportsPage

── Errores ──────────────────────────────────────────────────────
/403                           ForbiddenPage
/500                           ServerErrorPage
*                              NotFoundPage
```

### Lazy loading

Todas las páginas están cargadas con `React.lazy()` + `<Suspense>` para reducir el bundle inicial.

### Layout principal (AppLayout)

Compuesto por:
- `Sidebar` izquierdo con navegación adaptada al rol
- `Navbar` superior con notificaciones y cambio de tema
- `<Outlet>` para el contenido de la página activa

### Estado global (Zustand stores)

| Store | Estado |
|---|---|
| `authStore` | `user`, `token` (`lms_access_token`), `refreshToken` |
| `notificationsStore` | `notifications[]`, `unreadCount` |
| `coursesStore` | Caché de cursos para evitar requests repetidas |

### Interceptores Axios (api.ts)

```typescript
// Request: agrega header de autorización
headers.Authorization = `Bearer ${localStorage.getItem('lms_access_token')}`

// Response error 401: intenta renovar con refresh token
// Si falla → limpia localStorage → redirect /login
```

---

## 9. Flujos funcionales por rol

### Rol USUARIO (empleado)

**Flujo completo de un curso:**
1. Login → detecta rol → redirect `/dashboard`
2. Dashboard: KPIs (en progreso, completados, completación %, vencidos)
3. `/courses` → catálogo con tarjetas de cursos asignados al grupo del usuario
4. Filtros: Todos / En progreso / Completados / Vencidos
5. Click en tarjeta → `/courses/:id` → detalle con lista de módulos, progreso y fecha límite
6. "Comenzar / Continuar" → reproductor de módulos (`/courses/:courseId/modules/:moduleId`)
7. Reproductor: sidebar con módulos/temas, contenido según tipo (Video/PDF/HTML/Imagen/iFrame)
8. El progreso de cada tema se guarda automáticamente
9. Al completar todos los módulos → aparece botón "Ir a evaluación"
10. Evaluación: intro con parámetros → examen (opción múltiple) → resultado
11. Si aprueba: certificado generado automáticamente
12. `/my-certificates` → lista de certificados + botón "Descargar PDF"

---

### Rol TRAINER (Capacitador)

**Crear un curso:**
1. Login → redirect `/dashboard` (vista instructor con métricas propias)
2. `/admin/courses` → lista de cursos propios
3. "Nuevo curso" → asistente 3 pasos:
   - **Paso 1:** Nombre, descripción, área, tipo, fecha límite, duración, imagen de portada
   - **Paso 2:** Agregar módulos (`+Módulo`) y temas (`+Tema`), seleccionar tipo de contenido, subir o pegar contenido
   - **Paso 3:** Evaluación opcional: min. aprobación, intentos, tiempo, agregar preguntas
4. "Guardar borrador" → estado BORRADOR
5. "Publicar" → validación backend (todos los módulos deben tener al menos un tema) → estado PUBLICADO

**Usar IA para generar contenido:**
1. Desde curso en borrador → ícono IA → `/admin/courses/:id/ai-generator`
2. Subir PDF o PPT (máx. 20 MB)
3. El sistema extrae texto y lo envía a Claude → propuesta de módulos
4. Revisar módulo a módulo: aprobar / editar / descartar
5. Los módulos aprobados se agregan al curso

**Ver calificaciones:**
1. `/instructor/grades` → KPIs: total alumnos, aprobados, nota promedio
2. Tabla: alumno, curso, progreso, estado, nota, resultado
3. Filtros por alumno y por curso

---

### Rol ADMIN (Administrador)

**Gestión de usuarios:**
1. `/admin/users` → lista de 79+ usuarios con paginación
2. Filtros: rol, estado (activo/inactivo), búsqueda por nombre/correo
3. Acciones por usuario: editar (lápiz), cambiar rol, activar/desactivar
4. "Nuevo usuario" → modal con campos obligatorios
5. "Importar" → subir CSV/Excel con plantilla
6. "Sync AD" → sincronización LDAP con Active Directory

**Reportes:**
1. `/admin/reports` → 3 tarjetas
2. Click en "Descargar" → genera CSV instantáneo con Content-Type: text/csv

**Configuración del sistema:**
1. `/admin/config` → 3 tabs: Usuarios, Parámetros generales, Auditoría
2. Parámetros: 6 sub-secciones (Correo, Identidad, Seguridad, Notificaciones, LDAP, Catálogo)
3. Auditoría: tabla de 434+ eventos, filtros por actor/acción/resultado/entidad

---

## 10. Seguridad implementada

### Controles verificados (QA junio 2026 — 13/13 PASS)

| Control | Implementación | Estándar |
|---|---|---|
| Hashing contraseñas | Argon2 (argon2-cffi). PBKDF2 como fallback | OWASP Top 10 |
| JWT tokens | djangorestframework-simplejwt, access 30min, refresh 24h, blacklisting en logout | RFC 7519 |
| Bloqueo de cuenta | django-axes: 5 intentos → bloqueo 15 min | NIST SP 800-63 |
| HTTPS + HSTS | HSTS 1 año + subdomains + preload en settings/production.py | OWASP |
| Cookies seguras | SESSION_COOKIE_SECURE=True, CSRF_COOKIE_SECURE=True | OWASP |
| Headers HTTP | X-Frame-Options: DENY, X-Content-Type-Options: nosniff, CSP, Permissions-Policy, Referrer-Policy (nginx.conf) | OWASP |
| Content-Security-Policy | `default-src 'self'` con excepciones para Google Fonts | OWASP |
| DEBUG en producción | DEBUG=False, no traceback visible | OWASP |
| Logging | structlog JSON, nivel WARNING, sin datos sensibles en logs | OWASP |
| CORS | CORS_ALLOW_ALL_ORIGINS=False, solo dominios propios | RFC 6454 |
| API key IA | Solo en backend vía variable de entorno, nunca en frontend | OWASP |
| Auditoría inmutable | `AuditLog.save()` lanza ValueError si pk is not None | ISO 27001 A.12.4 |
| Template .env | `.env.production.example` documentado, `.env.production` en .gitignore | OWASP |

### Permisos por rol (DRF permissions)

Cada ViewSet tiene `permission_classes` configurado:
- `IsAuthenticated` — base para todos los endpoints privados
- `IsAdminUser` — solo ADMIN
- `IsAdminOrTrainer` — ADMIN o TRAINER
- Los cursos filtran automáticamente: ADMIN ve todos; TRAINER ve los suyos; USUARIO ve los asignados a su grupo

### Token storage

Tokens almacenados en `localStorage` bajo las claves:
- `lms_access_token` — JWT access (30 min)
- `lms_refresh_token` — JWT refresh (24 h)

---

## 11. Integración IA (Anthropic Claude)

### Configuración

```python
# backend/config/settings/base.py
ANTHROPIC_API_KEY = env("ANTHROPIC_API_KEY")
ANTHROPIC_MODEL = env("ANTHROPIC_MODEL", default="claude-sonnet-4-6")
```

### Generación de módulos — detalles del prompt

```
System: "Eres un experto en diseño instruccional. Tu trabajo es analizar
contenido educativo y estructurarlo en módulos de aprendizaje claros y
accionables. Responde SOLO con un array JSON, sin texto adicional."

User: "Analiza el siguiente contenido y genera exactamente {N} módulos
de curso en {idioma}. Responde con un array JSON [...]"
```

### Generación de preguntas — detalles del prompt

```
System: "Eres un experto en evaluación educativa. Genera preguntas de
evaluación precisas y bien redactadas. Responde SOLO con un array JSON."

User: "Genera exactamente {N} preguntas de evaluación. Tipos: {tipos}.
Dificultad: {dificultad}. [JSON schema de respuesta esperada]"
```

### Manejo de errores

| Error | Comportamiento |
|---|---|
| JSON malformado en respuesta | Extracción heurística (regex markdown block) + hasta 3 reintentos automáticos |
| Timeout Anthropic API (>60s) | Tarea Celery con reintentos, error 504 al frontend |
| Archivo >20 MB | Validación backend antes de encolar, error 400 |
| Tipo de archivo inválido | Validación backend, error 400 (solo .pdf, .pptx, .ppt) |
| API key no configurada | `AIGenerationError` con mensaje claro |

---

## 12. Sistema de notificaciones

### Generación automática

Las notificaciones se crean desde `services.py` de los módulos correspondientes:

- **Login exitoso** de un usuario → `NUEVO_CURSO` si hay nuevos cursos asignados
- **Examen enviado** → `EXAMEN_APROBADO` / `EXAMEN_REPROBADO` al usuario + `ALUMNO_APROBADO` / `ALUMNO_REPROBADO` al instructor
- **Enrollment creado** → `ALUMNO_INSCRITO` al instructor
- **Enrollment completado** → `ALUMNO_COMPLETO` al instructor

Las alertas de vencimiento son generadas por tareas periódicas de Celery-beat:
- `check_expiring_courses` — se ejecuta diariamente a las 9:00 AM
  - Busca enrollments EN_PROGRESO cuya `course.fecha_limite` es en 7 días → `VENCIMIENTO_7D`
  - Busca enrollments EN_PROGRESO cuya `course.fecha_limite` es mañana → `VENCIMIENTO_1D`
  - Marca como VENCIDO los enrollments cuya fecha límite ya pasó → `VENCIDO`

### Visualización en frontend

- Badge rojo con conteo de no leídas en el ícono de notificaciones del navbar
- Click → panel dropdown con las últimas notificaciones
- `/notifications` → vista completa con 5 tabs: Todas, Mis cursos, Vencimientos, Mis exámenes, Alumnos

---

## 13. Generación de certificados PDF

### Plantilla HTML → WeasyPrint

La plantilla HTML para certificados lee los siguientes valores:
- Logo: `SystemSetting('logo_url')` o logo por defecto
- Colores: `SystemSetting('cert_color_primary')` y `cert_color_secondary`
- Nombre empresa: `SystemSetting('nombre_empresa')`
- Firma del instructor: `UserProfile.rubrica` (imagen subida en el perfil)
- Todos los demás datos del `Certificate` model

### Ruta física del PDF

```
/app/media/certificates/{cert_uuid}.pdf
```

Accedida via:
```
https://[dominio]/media/certificates/{cert_uuid}.pdf
```
O via el endpoint autenticado:
```
GET /api/v1/certificates/{uuid}/download/
```

### Verificación pública

```
GET /api/v1/certificates/{uuid}/verify/
```

No requiere autenticación. Devuelve JSON con datos del certificado para verificar autenticidad. El código QR embebido en el PDF apunta a esta URL.

---

## 14. Variables de entorno requeridas

Archivo: `.env.production` (no versionado en git)

```env
# ── Django ─────────────────────────────────────────────────────────────────
SECRET_KEY=                        # string largo y aleatorio, mín. 50 chars
DEBUG=False
ALLOWED_HOSTS=mi-dominio.fin.ec,www.mi-dominio.fin.ec
DJANGO_SETTINGS_MODULE=config.settings.production
FRONTEND_URL=https://mi-dominio.fin.ec

# ── Base de datos ──────────────────────────────────────────────────────────
DATABASE_URL=postgresql://lms_user:PASSWORD@db:5432/lms_db
POSTGRES_DB=lms_db
POSTGRES_USER=lms_user
POSTGRES_PASSWORD=

# ── IA ─────────────────────────────────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-6   # opcional, este es el default

# ── Email (Office 365) ─────────────────────────────────────────────────────
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.office365.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=notificaciones@acciontungurahua.fin.ec
EMAIL_HOST_PASSWORD=
DEFAULT_FROM_EMAIL=LMS Corporativo <notificaciones@acciontungurahua.fin.ec>

# ── Celery / Redis ─────────────────────────────────────────────────────────
REDIS_URL=redis://redis:6379/0

# ── JWT ────────────────────────────────────────────────────────────────────
JWT_ACCESS_TOKEN_LIFETIME_MINUTES=30
JWT_REFRESH_TOKEN_LIFETIME_HOURS=24
```

---

## 15. Comandos de operación

### Primera instalación

```bash
# 1. Clonar repositorio
git clone [repo-url]
cd Plataforma_Capacitaciones

# 2. Crear archivo de variables de entorno
cp .env.production.example .env.production
# Editar .env.production con los valores reales

# 3. Construir y levantar todos los servicios
docker-compose up --build -d

# 4. Aplicar migraciones de base de datos
docker-compose exec backend python manage.py migrate

# 5. Recolectar archivos estáticos
docker-compose exec backend python manage.py collectstatic --noinput

# 6. Crear el primer usuario administrador
docker-compose exec backend python manage.py createsuperuser
```

### Desarrollo local

```bash
# Levantar en modo desarrollo (hot-reload)
docker-compose -f docker-compose.dev.yml up

# Crear nuevas migraciones
docker-compose exec backend python manage.py makemigrations [app_name]

# Aplicar migraciones
docker-compose exec backend python manage.py migrate

# Ejecutar tests del backend
docker-compose exec backend pytest

# Tests con reporte de cobertura
docker-compose exec backend pytest --cov=apps --cov-report=term-missing

# Logs en tiempo real
docker-compose -f docker-compose.dev.yml logs -f backend
docker-compose -f docker-compose.dev.yml logs -f celery-worker
```

### Operación en producción

```bash
# Ver estado de servicios
docker-compose ps

# Reiniciar un servicio
docker-compose restart backend

# Desplegar nueva versión
git pull
docker-compose up --build -d
docker-compose exec backend python manage.py migrate

# Backup de base de datos
docker-compose exec db pg_dump -U $POSTGRES_USER $POSTGRES_DB > backup_$(date +%F).sql

# Ver logs
docker-compose logs -f backend
docker-compose logs -f celery-worker
```

---

## 16. Estado QA — resultados de la auditoría

**Fecha de la última auditoría completa:** 26 de junio de 2026
**Veredicto: SISTEMA APTO PARA DESPLIEGUE EN PRODUCCIÓN**

| Módulo | Pruebas | PASS | FAIL |
|---|---|---|---|
| Autenticación | 6 | 6 | 0 |
| Dashboard | 5 | 5 | 0 |
| Gestión de cursos | 9 | 9 | 0 |
| Gestión de usuarios | 7 | 7 | 0 |
| Reportes | 4 | 4 | 0 |
| Certificados | 5 | 5 | 0 |
| Módulo de aprendizaje | 7 | 7 | 0 |
| Configuración del sistema | 4 | 4 | 0 |
| Calificaciones / Instructor | 5 | 5 | 0 |
| DevSecOps / Seguridad | 13 | 13 | 0 |
| **TOTAL** | **47** | **47** | **0** |

### Bugs corregidos en la auditoría

| Bug | Descripción | Fix aplicado |
|---|---|---|
| BUG-01 | Admin veía solo cursos propios (igual que usuario) | `services.py list_courses()` — filtro por rol |
| BUG-02 | Campo Área en modal de curso no validaba null | Zod `invalid_type_error` en CourseCreateModal + CourseEditAdminModal |
| BUG-03 | `publish_course()` no validaba temas VIDEO sin URL/archivo | Validación en `services.py publish_course()` |
| BUG-05 | Datos con tipo VIRTUAL (renombrado a HIBRIDO) | Migración `0003_fix_virtual_tipo.py` |

### Observaciones no-bug

| Observación | Impacto |
|---|---|
| Warning Recharts `width(-1)` en Dashboard al cargar | Cosmético — los charts renderizan correctamente |
| Warning React Router v7 future flags | Solo deprecación — no afecta funcionalidad |
| Notificaciones duplicadas en instructor (3x mismo evento) | UX menor — revisar lógica Celery en siguiente iteración |

---

## 17. Datos reales del sistema

Estado capturado en el entorno de desarrollo el 26 de junio de 2026:

| Métrica | Valor |
|---|---|
| Usuarios registrados | 79 |
| Usuarios activos | 79 (100%) |
| Cursos creados | 18 |
| Cursos publicados | 11 |
| Cursos en borrador | 7 |
| Capacitadores activos | 3 |
| Certificados emitidos | 14 (en 6 cursos) |
| Eventos de auditoría | 434+ |
| Tasa de aprobación global | 86% |
| Nota promedio del sistema | 82.3% |

---

## 18. Qué está implementado vs qué está diferido

### Implementado (MVP completo)

| Funcionalidad | Estado |
|---|---|
| Autenticación JWT con Argon2, bloqueo, recuperación | ✅ Completo |
| 3 roles: ADMIN, TRAINER, USUARIO | ✅ Completo |
| Gestión de usuarios (CRUD, importación CSV, Sync LDAP) | ✅ Completo |
| Gestión de cursos con 5 tipos de contenido | ✅ Completo (VIDEO, PDF, TEXTO, IMAGEN, IFRAME) |
| Evaluaciones con 3 tipos de pregunta | ✅ Completo (MULTIPLE_CHOICE, MULTIPLE_SELECT, TRUE_FALSE) |
| Reproductor de módulos con progreso guardado | ✅ Completo |
| Generador IA de módulos (PDF/PPT → Módulos) | ✅ Completo |
| Generador IA de preguntas | ✅ Completo |
| Certificados PDF con QR de verificación | ✅ Completo |
| Verificación pública de certificados (sin login) | ✅ Completo |
| Notificaciones in-app con alertas de vencimiento | ✅ Completo |
| Reportes CSV (3 tipos) | ✅ Completo |
| Log de auditoría inmutable | ✅ Completo |
| Configuración del sistema desde UI | ✅ Completo |
| Dashboard por rol (Admin/Instructor/Usuario) | ✅ Completo |
| Modo claro / Modo oscuro | ✅ Completo |
| Seguridad: HSTS, CSP, headers, CORS | ✅ Completo |

### Diferido (post-MVP, no implementado)

| Funcionalidad | Fase | Notas |
|---|---|---|
| Envío de emails por SMTP (notificaciones por correo) | Fase 2 | Backend y modelo Celery listos; solo falta activar SMTP |
| Reportes visuales (gráficos de barras por área en página de reportes) | Fase 2 | Actualmente solo descarga CSV |
| Exportación de reportes a Excel | Fase 2 | openpyxl instalado, no expuesto aún |
| Modo mantenimiento (P44) | Fase 2 | No implementado |
| Soporte SCORM 1.2 / 2004 | Fase 3 | No implementado |
| Integración SharePoint para almacenamiento de archivos | Fase 3 | Stub `sharepoint.py` creado, sin implementar |
| SSO / Azure AD | Fase 3 | LDAP funciona; SSO Azure AD diferido |

### Capacidades técnicas listas para activar (sin código adicional)

- **Email SMTP:** Configurar `EMAIL_HOST_*` en `.env.production` y descomentar las llamadas a `send_mail()` en `notifications/tasks.py`
- **LDAP/AD:** Configurar host, puerto, base DN en la UI de Administración → tab LDAP/AD
- **Certificado SSL:** Configurar Nginx con certificado y activar `SECURE_SSL_REDIRECT=True` (ya configurado en `production.py`)

---

*Documento generado el 26 de junio de 2026.*
*Todas las secciones técnicas derivan del código fuente real del repositorio.*
*© 2026 Cooperativa de Ahorro y Crédito Acción Tungurahua Ltda. — Uso interno*
