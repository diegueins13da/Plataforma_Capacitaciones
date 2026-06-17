# Todo — LMS Corporativo MVP

> Lista concisa de tareas. Ver `plan.md` para criterios de aceptación completos.
> Estado: `[ ]` pendiente · `[x]` completado · `[~]` en progreso

---

## Fase 0 — Infraestructura

- [x] **T01** Docker dev environment + scaffold del proyecto (docker-compose.dev.yml, Dockerfiles, settings, health endpoint, React + Vite)
- [x] **T01b** Development toolchain: ruff + mypy + pre-commit + factory_boy + faker + django-debug-toolbar + django-environ + .gitignore + pyproject.toml

---

## Fase 1 — Autenticación Backend

- [x] **T02** Modelos User, UserProfile, AuditLog + migraciones
- [x] **T03** JWT auth backend — login, logout, token refresh
- [x] **T04** Bloqueo de cuenta (django-axes, 5 intentos, 15 min) + rate limiting (django-ratelimit)
- [x] **T05** Recuperación de contraseña (código 6 dígitos, 30 min) + cambio obligatorio en primer login

### ✅ CHECKPOINT A — Auth backend: tests ≥90%, login funciona con JWT, bloqueo en 5 intentos

---

## Fase 2 — Autenticación Frontend

- [x] **T06** Scaffold frontend: Zustand, Axios (interceptores JWT + refresh), React Router, AppLayout vacío
- [x] **T07** Login UI — P01
- [x] **T08** Auth edge cases UI — P02 (recuperar), P03 (bloqueada), P04 (cambio obligatorio), P05 (sesión expirada)

### ✅ CHECKPOINT B — Autenticación completa end-to-end (backend + frontend)

---

## Fase 3 — Gestión de Usuarios

- [x] **T09** Modelos UserProfile + clases de permiso por rol (IsAdmin, IsAdminOrTrainer)
- [x] **T09b** Modelo Group + CRUD backend + P45 (gestión de grupos: crear, editar, asignar miembros) ← nueva pantalla
- [x] **T10** User management backend: CRUD + cambio de rol + AuditLog
- [x] **T11** Admin users UI — P25 (panel), P26 (listado), P27 (modal crear usuario)
- [x] **T12** Carga masiva Excel — backend (validación por fila + previsualización) + P28 + P29 (historial + botón resetear intentos de examen)
- [x] **T12b** Configuración del sistema — `apps/config` (SystemSetting key-value), catálogo de Áreas, migrar `UserProfile.area` a FK, panel de config admin (SMTP, branding, política de contraseñas)

### ✅ CHECKPOINT C — ADMIN puede gestionar usuarios y grupos completamente

---

## Fase 4 — Gestión de Cursos (Backend)

- [x] **T13** Modelos Course, Module, Enrollment + StorageBackend abstracto + LocalStorage
- [ ] **T14** Course CRUD backend: crear/editar curso + subida módulos (video URL, PDF, texto HTML)
- [ ] **T15** Publicación de cursos + lógica de enrollment + notificación nuevo_curso_asignado

### ✅ CHECKPOINT D — ADMIN publica curso, usuarios del grupo reciben Enrollment automático

---

## Fase 5 — Gestión de Cursos (Frontend)

- [ ] **T16** Wizard pasos 1-2: info general (P30) + módulos con upload PDF (P31)
- [ ] **T17** Wizard pasos 3-4: evaluación config (P32) + publicación/audiencia (P33) + listado cursos (P35)
- [ ] **T18** Catálogo (P10), detalle de curso (P11), mis cursos (P12) — con semáforo de urgencia
- [ ] **T19** Reproductores: video (P13), PDF (P14), texto (P15) con completion tracking + curso completado (P16)

### ✅ CHECKPOINT E — Flujo completo: admin crea curso → usuario lo consume → llega a P16

---

## Fase 6 — Evaluaciones

- [ ] **T20** Modelos Assessment, Question, UserAnswer + migraciones
- [ ] **T21** Assessment CRUD backend: banco de preguntas
- [ ] **T22** Servicio de examen: grading, intentos, guardado automático cada 30s, tiempo límite
- [ ] **T23** Assessment admin UI en wizard — P32 (banco de preguntas, crear/editar/borrar preguntas)
- [ ] **T24** Examen frontend: intro (P17), pregunta en curso (P18), aprobado (P19), reprobado (P20), sin intentos (P21)

### ✅ CHECKPOINT F — Flujo completo: completar módulos → examen → resultado correcto en BD

---

## Fase 7 — Generador IA (Funcionalidad Central)

- [ ] **T25** Celery + Redis: setup infraestructura + tarea health_check + docker-compose.dev.yml actualizado
- [ ] **T26** Parser documentos: pdfplumber (PDF) + python-pptx (PPT) con tests de fixtures reales
- [ ] **T27** AI Service: Claude API (claude-sonnet-4-6), generate_course_modules + generate_questions, tareas Celery, endpoint de status del task
- [ ] **T28** AI Generator UI sección A — P34: upload archivo, polling status, revisión módulos (Aprobar/Editar/Descartar)
- [ ] **T29** AI Generator UI sección B — P34: configuración, generación de preguntas, revisión (Aprobar/Editar/Descartar/Regenerar)

### ✅ CHECKPOINT G — Flujo IA completo: subir PDF → módulos propuestos → aprobar → aparecen en curso

---

## Fase 8 — Notificaciones, Dashboard y Perfil

- [ ] **T30** Notification model + service + tareas Celery (check_upcoming_deadlines: vencimiento 7d, 1d, vencido) + hooks en assessment submit
- [ ] **T31** Notifications UI — P40 (dropdown header) + P09 (vista completa)
- [ ] **T32** Dashboard de usuario — P06: resumen, cursos activos con semáforo, actividad reciente, próximos vencimientos
- [ ] **T33** Perfil + cambio de contraseña — P07, P08

### ✅ CHECKPOINT H — Dashboard y notificaciones completos y funcionando

---

## Fase 9 — Transversales y UX

- [ ] **T34** Audit Log admin view — P39 (tabla paginada + filtros + exportar Excel)
- [ ] **T35** App layout + navegación: sidebar por rol, header con badge notificaciones, breadcrumbs
- [ ] **T36** Error pages — P41 (404), P42 (403), P43 (500), P44 (mantenimiento HTML estático en Nginx)

---

## Fase 10 — Producción

- [ ] **T37** Docker producción + Nginx (multi-stage Dockerfiles, Gunicorn, serve frontend estático, Docker healthchecks, gzip, client_max_body_size 25M)
- [ ] **T38b** Logging estructurado JSON (django-structlog) + health check profundo (DB + Redis + Celery) + Request IDs
- [ ] **T38** Security hardening: headers seguridad, CORS, `manage.py check --deploy` limpio, tests de seguridad

### ✅ CHECKPOINT FINAL — MVP en producción: `docker-compose up` limpio, flujo end-to-end verificado

---

## Decisiones Resueltas (2026-06-08)

- [x] **Grupos:** Gestionables con pantalla propia → T09b agrega P45
- [x] **Módulos:** Secuenciales — el usuario debe completar el módulo N antes de abrir el N+1
- [x] **TRAINER y intentos:** Solo ve los suyos propios en MVP
- [x] **Reset de intentos:** ADMIN puede resetear intentos desde P29 → endpoint en T22
- [x] **Edición de cursos:** En place; progreso previo se conserva
- [x] **Vencimiento:** `fecha_limite` es opcional; si existe y el usuario no terminó → enrollment se cierra automáticamente
- [x] **Baja de grupo:** Enrollments activos se mantienen

## Mejoras agregadas por buenas prácticas (2026-06-08)

- [x] **T01b** Dev toolchain (ruff, mypy, pre-commit, factory_boy, django-environ, django-cors-headers, django-filter, paginación global, formato de error estándar, conftest.py)
- [x] **T03** `GET /api/v1/auth/me/` para restaurar sesión en page refresh
- [x] **T05** Cambio de contraseña invalida todos los tokens activos + política de contraseñas + anti-enumeración en reset
- [x] **T06** React Hook Form + Zod + Toast + Error Boundary + loading states + ConfirmDialog
- [x] **T10** Desactivar usuario invalida tokens activos inmediatamente
- [x] **T12** Validación de magic bytes en carga de archivos
- [x] **T13** `fecha_limite` nullable + `Enrollment.estado = vencido` + modelo `ModuleProgress` (resume position) + modelo `Certificate` stub (UUID en MVP)
- [x] **T14** Sanitización HTML con `bleach` para módulos de texto (XSS prevention)
- [x] **T16** Wizard en modo crear Y editar
- [x] **T19** Resume position: el reproductor retoma desde donde el usuario dejó
- [x] **T22** Protección de examen simultáneo (select_for_update) + creación de Certificate stub al aprobar
- [x] **T25** Celery result backend en Redis + django-celery-beat
- [x] **T30** Tarea `close_expired_enrollments` + schedule 07:00 UTC diario
- [x] **T37** Docker healthchecks + `entrypoint.sh` (migraciones controladas) + Nginx gzip + client_max_body_size
- [x] **T38b** Logging estructurado JSON + health check profundo

---

## Resumen

| Fase | Tareas | Estado |
|---|---|---|
| 0 — Infraestructura | 2 (T01, T01b) | ✅ Completo |
| 1 — Auth Backend | 4 | ✅ Completo |
| 2 — Auth Frontend | 3 | ✅ Completo |
| 3 — Usuarios | 6 (T09, T09b, T10, T11, T12, T12b) | ✅ Completo |
| 4 — Cursos Backend | 3 (T13 ✅) | En progreso |
| 5 — Cursos Frontend | 4 | Pendiente |
| 6 — Evaluaciones | 5 | Pendiente |
| 7 — Generador IA | 5 | Pendiente |
| 8 — Notificaciones/Dashboard | 4 | Pendiente |
| 9 — Transversales | 3 | Pendiente |
| 10 — Producción | 3 (T37, T38b, T38) | Pendiente |
| **TOTAL** | **42** | **16 / 42** |
