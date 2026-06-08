# Plan de Implementación — LMS Corporativo MVP

**Fecha:** 2026-06-08 | **Basado en:** [SPEC.md](../SPEC.md)

---

## Resumen

Construimos una plataforma LMS corporativa desde cero en Django + React + PostgreSQL, desplegada con Docker. El proyecto tiene ~38 tareas distribuidas en 11 fases. Cada tarea entrega un flujo completo y verificable (vertical slice), no una capa horizontal de arquitectura.

## Grafo de Dependencias

```
T01 Docker + Scaffold
    │
    ├── T02 Modelos User + AuditLog
    │       │
    │       ├── T03 JWT auth backend
    │       │       ├── T04 Bloqueo + rate limiting
    │       │       └── T05 Recuperación de contraseña
    │       │               │
    │       │               └── [CHECKPOINT A]
    │       │                       │
    │       │               T06 Frontend scaffold
    │       │                       ├── T07 Login UI (P01)
    │       │                       └── T08 Auth edge cases (P02-P05)
    │       │                               │
    │       │                               └── [CHECKPOINT B]
    │       │
    │       ├── T09 Modelos UserProfile
    │       │       │
    │       │       ├── T10 User management backend
    │       │       │       ├── T11 User admin UI (P25-P27)
    │       │       │       └── T12 Bulk import Excel (P28-P29)
    │       │       │               └── [CHECKPOINT C]
    │       │
    │       └── T13 Modelos Course + Module + Enrollment + StorageBackend
    │               │
    │               ├── T14 Course CRUD backend
    │               │       └── T15 Publicación + enrollment
    │               │               └── [CHECKPOINT D]
    │               │                       │
    │               │               T16 Wizard cursos frontend (P30-P33)
    │               │               T17 Course list admin (P35)
    │               │               T18 Catálogo + detalle + inscripción (P10-P12)
    │               │               T19 Reproductores + completion (P13-P16)
    │               │                       └── [CHECKPOINT E]
    │               │
    │               └── T20 Modelos Assessment + Question + UserAnswer
    │                       │
    │                       ├── T21 Assessment CRUD backend
    │                       │       └── T22 Servicio de examen (grading)
    │                       │               ├── T23 Assessment admin UI (P32)
    │                       │               └── T24 Examen frontend (P17-P21)
    │                       │                       └── [CHECKPOINT F]
    │
    ├── T25 Celery + Redis setup
    │       │
    │       └── T26 Parser documentos (pdfplumber + python-pptx)
    │               │
    │               └── T27 AI service (Claude API)
    │                       ├── T28 AI UI módulos (P34)
    │                       └── T29 AI UI preguntas (P34)
    │                               └── [CHECKPOINT G]
    │
    ├── T30 Notification model + service
    │       ├── T31 Notification UI (P09, P40)
    │       ├── T32 Dashboard usuario con progreso (P06)
    │       └── T33 Perfil + cambio contraseña (P07-P08)
    │               └── [CHECKPOINT H]
    │
    ├── T34 Audit log admin (P39)
    ├── T35 App layout + navegación (sidebar, header)
    └── T36 Error pages (P41-P44)
            │
            └── T37 Docker producción + Nginx
                    └── T38 Security hardening
                            └── [CHECKPOINT FINAL]
```

---

## Decisiones Arquitectónicas Clave

1. **AuditLog se construye en T02 (Phase 2)** — Es transversal a todo el sistema. Se construye junto con el User model para que desde T03 en adelante todas las acciones puedan emitir eventos.
2. **StorageBackend se implementa en T13** — La abstracción se crea junto con los modelos de Course para que ningún código de cursos referencie el almacenamiento directamente.
3. **Celery/Redis en T25, antes del AI Generator** — La IA necesita background tasks para evitar timeouts HTTP. Se construye la infraestructura antes del servicio.
4. **Frontend scaffold (T06) empieza después del Checkpoint A** — Necesitamos un endpoint de login funcional para poder probar el frontend de autenticación.
5. **App layout (T35) al final** — Los componentes de layout (sidebar, header, breadcrumbs) se construyen cuando ya conocemos todos los roles y rutas.

---

## Oportunidades de Paralelización

Estas tareas pueden ejecutarse en paralelo si hay dos agentes disponibles:

- **T10 + T14**: User management backend y Course management backend son independientes entre sí.
- **T11 + T16**: User admin UI y Course wizard UI no comparten estado.
- **T18 + T19**: Catálogo de cursos y Reproductores no se bloquean mutuamente.
- **T28 + T29**: AI UI para módulos y preguntas son secciones distintas de P34.
- **T34 + T36**: Audit log UI y Error pages son completamente independientes.

---

## POLÍTICAS DE NEGOCIO DOCUMENTADAS

Decisiones confirmadas el 2026-06-08 que afectan el modelo de datos:

| Política | Decisión | Impacto técnico |
|---|---|---|
| Edición de cursos publicados | Editar en el mismo curso (en place). Los usuarios con progreso existente lo conservan. | No hay versionado de contenido en MVP. El campo `version` en Course es informativo (administrador lo actualiza manualmente). |
| Fecha límite de cursos | Opcional. El trainer decide si la pone o no. Si existe y el usuario no completó → Enrollment se cierra automáticamente (estado=`vencido`, sin acceso). Sin fecha límite → el enrollment permanece abierto indefinidamente. | `Course.fecha_limite` es nullable. Tarea Celery `close_expired_enrollments` corre diariamente. |
| Baja de grupo | Los enrollments activos del usuario permanecen aunque lo quiten del grupo. Solo los cursos futuros (publicados después de la baja) no le llegarán. | Al quitar un usuario de un grupo, solo se desactiva la FK; no se tocan los Enrollment existentes. |

---

## FASE 0 — Infraestructura

---

### Task 01: Docker dev environment + scaffold del proyecto

**Descripción:** Crear la estructura completa del repositorio, los Dockerfiles y el `docker-compose.dev.yml`. Al final de esta tarea el entorno de desarrollo levanta correctamente con `docker-compose -f docker-compose.dev.yml up --build` y el Django dev server responde en `http://localhost:8000/api/health/`.

**Aceptación:**
- [ ] `docker-compose -f docker-compose.dev.yml up --build` levanta sin errores
- [ ] `GET http://localhost:8000/api/health/` retorna `{"status": "ok"}`
- [ ] El frontend de React corre en `http://localhost:5173/`
- [ ] `.env.example` contiene todas las variables requeridas del SPEC
- [ ] La estructura de carpetas coincide exactamente con el SPEC §4

**Verificación:**
- [ ] `docker-compose exec backend python manage.py check` sin errores
- [ ] El frontend compila sin errores TypeScript: `docker-compose exec frontend npm run build`

**Dependencias:** Ninguna

**Archivos:**
- `docker-compose.dev.yml`
- `backend/Dockerfile` (dev stage)
- `frontend/Dockerfile` (dev stage)
- `backend/config/settings/base.py`, `development.py`
- `backend/config/urls.py` (endpoint `/api/health/`)
- `backend/requirements/base.txt`, `development.txt`
- `frontend/package.json`, `vite.config.ts`, `tsconfig.json`
- `.env.example`

**Tamaño:** M (8 archivos) — justificado como scaffolding inicial

---

### Task 01b: Development toolchain — calidad de código desde el día 1

**Descripción:** Configurar todas las herramientas de calidad de código antes de escribir la primera línea de lógica. Sin este setup, el código se vuelve inconsistente entre sesiones y los tests son difíciles de escribir. Esta tarea no produce funcionalidad visible pero previene deuda técnica desde el inicio.

**Aceptación:**
- [ ] `ruff check .` y `ruff format .` pasan sin errores (reemplaza black + isort + flake8 con una sola herramienta)
- [ ] `mypy apps/` sin errores de tipo en el código nuevo (configuración permisiva para legacy, estricta para código nuevo)
- [ ] `.pre-commit-config.yaml` ejecuta ruff + mypy antes de cada commit; `pre-commit install` documentado en README
- [ ] `pyproject.toml` centraliza configuración de ruff, mypy, pytest y coverage
- [ ] `factory_boy` y `faker` instalados en `requirements/development.txt`; `UserFactory` y `UserProfileFactory` creadas como ejemplo en `apps/users/tests/factories.py`
- [ ] `django-debug-toolbar` instalado y configurado solo en `settings/development.py` (nunca en producción)
- [ ] `.gitignore` cubre: `*.pyc`, `__pycache__/`, `.env`, `media/`, `staticfiles/`, `node_modules/`, `.coverage`, `dist/`
- [ ] `django-environ` instalado; `config/settings/base.py` lee todas las variables desde `.env` vía `env()`
- [ ] `django-cors-headers` instalado; en desarrollo permite `localhost:5173`; en producción solo el dominio del frontend (variable `FRONTEND_URL`)
- [ ] `django-filter` instalado; configurado como `DEFAULT_FILTER_BACKENDS` en DRF settings — todos los endpoints de listado usan filtros consistentes
- [ ] **Paginación global de DRF**: `DEFAULT_PAGINATION_CLASS = PageNumberPagination`, `PAGE_SIZE = 20` en settings; todas las listas retornan `{count, next, previous, results: [...]}`
- [ ] **Formato de error estándar**: DRF exception handler personalizado en `apps/core/exceptions.py` que retorna siempre `{error: "mensaje legible", code: "ERROR_CODE", details: {campo: ["error"]}}` — los errores de validación de formularios se mapean directamente al campo correspondiente en React Hook Form
- [ ] `conftest.py` en la raíz de `backend/` con fixtures base: `api_client`, `admin_user`, `trainer_user`, `regular_user` usando factory_boy

**Verificación:**
- [ ] `pre-commit run --all-files` pasa en verde
- [ ] `pytest --co -q` lista los tests sin errores de importación

**Dependencias:** T01

**Archivos:**
- `pyproject.toml` (ruff, mypy, pytest, coverage config)
- `.pre-commit-config.yaml`
- `.gitignore`
- `backend/requirements/development.txt` (actualización)
- `backend/apps/users/tests/factories.py`
- `backend/config/settings/base.py` (migrar a django-environ)

**Tamaño:** S

---

## FASE 1 — Autenticación Backend

---

### Task 02: Modelos User, UserProfile y AuditLog + migraciones

**Descripción:** Definir los tres modelos base del sistema. `User` extiende `AbstractUser` con el campo `role` (ADMIN/TRAINER/USUARIO). `UserProfile` almacena área, cargo y grupo. `AuditLog` es el registro inmutable de acciones críticas. Esta tarea no incluye endpoints; solo los modelos y su migración.

**Aceptación:**
- [ ] `python manage.py migrate` se ejecuta sin errores
- [ ] `User` tiene campo `role` con choices ADMIN / TRAINER / USUARIO
- [ ] `UserProfile` tiene OneToOne con `User`, campos: area, cargo, grupo
- [ ] `AuditLog` tiene: user (FK nullable), accion, ip, timestamp (auto_now_add), detalles_json
- [ ] `AuditLog` NO tiene endpoint de DELETE ni UPDATE en ninguna parte del código
- [ ] El campo `AuditLog.timestamp` usa `auto_now_add=True` (inmutable)
- [ ] Tests unitarios de los modelos pasan: `pytest apps/users/tests/ apps/reports/tests/`

**Verificación:**
- [ ] `python manage.py shell -c "from apps.users.models import User; print(User.ROLES)"` imprime los 3 roles
- [ ] `python manage.py shell -c "from apps.reports.models import AuditLog; print(AuditLog._meta.get_field('timestamp').auto_now_add)"` retorna `True`

**Dependencias:** T01

**Archivos:**
- `backend/apps/users/models.py`
- `backend/apps/reports/models.py` (AuditLog)
- `backend/apps/users/migrations/0001_initial.py`
- `backend/apps/reports/migrations/0001_initial.py`
- `backend/apps/users/tests/test_models.py`

**Tamaño:** S

---

### Task 03: Autenticación JWT — login, logout, token refresh

**Descripción:** Implementar los endpoints de autenticación: `POST /api/v1/auth/login/`, `POST /api/v1/auth/logout/`, `POST /api/v1/auth/token/refresh/`. El login retorna access token (30 min) y refresh token (24h). El logout invalida el refresh token. Toda autenticación exitosa y fallida se registra en `AuditLog`.

**Aceptación:**
- [ ] `POST /api/v1/auth/login/` con credenciales válidas retorna `{access, refresh, user: {id, email, role, force_password_change}}`
- [ ] `POST /api/v1/auth/login/` con credenciales inválidas retorna 401 con mensaje en español genérico (sin revelar si el usuario existe)
- [ ] `POST /api/v1/auth/logout/` invalida el refresh token (blacklist de simplejwt)
- [ ] `POST /api/v1/auth/token/refresh/` retorna nuevo access token
- [ ] `GET /api/v1/auth/me/` retorna `{id, email, role, full_name, area, grupo}` del usuario autenticado — **el frontend lo usa al refrescar la página para restaurar el estado de sesión sin reloginear**
- [ ] Cada login (exitoso o fallido) crea un registro en `AuditLog` con IP del request
- [ ] La expiración del access token es de 30 minutos (configurable vía env var)
- [ ] Tests del servicio de autenticación alcanzan ≥ 90% de cobertura

**Verificación:**
- [ ] `pytest apps/authentication/tests/ -v --cov=apps/authentication/services`
- [ ] `curl -X POST http://localhost:8000/api/v1/auth/login/ -d '{"username":"admin","password":"wrong"}' -H "Content-Type: application/json"` retorna 401

**Dependencias:** T02

**Archivos:**
- `backend/apps/authentication/services.py`
- `backend/apps/authentication/views.py`
- `backend/apps/authentication/serializers.py`
- `backend/apps/authentication/urls.py`
- `backend/apps/authentication/tests/test_services.py`
- `backend/apps/authentication/tests/test_views.py`

**Tamaño:** M

---

### Task 04: Bloqueo de cuenta + rate limiting

**Descripción:** Configurar `django-axes` para bloquear cuentas automáticamente tras 5 intentos fallidos por 15 minutos. El endpoint de login retorna `{locked: true, unlock_at: <timestamp>, attempts_left: N}` cuando la cuenta está siendo bloqueada. Configurar `django-ratelimit` en el endpoint de login (máx 10 req/min por IP).

**Aceptación:**
- [ ] Tras 5 intentos fallidos, el login retorna 423 con `{locked: true, minutes_remaining: 15}`
- [ ] El campo `attempts_left` en el response muestra correctamente cuántos intentos quedan
- [ ] Después de 15 minutos el bloqueo se libera automáticamente
- [ ] Más de 10 requests/min desde la misma IP retornan 429
- [ ] El bloqueo queda registrado en `AuditLog` con accion=`ACCOUNT_LOCKED`
- [ ] Tests de bloqueo con 5 intentos consecutivos pasan

**Verificación:**
- [ ] `pytest apps/authentication/tests/test_lockout.py -v`

**Dependencias:** T03

**Archivos:**
- `backend/config/settings/base.py` (configuración axes)
- `backend/apps/authentication/views.py` (actualización)
- `backend/apps/authentication/tests/test_lockout.py`

**Tamaño:** S

---

### Task 05: Recuperación de contraseña + cambio obligatorio en primer login

**Descripción:** Implementar el flujo completo de recuperación: `POST /api/v1/auth/password-reset/` genera y envía un código de 6 dígitos por email (Office 365 SMTP, expira en 30 min), `POST /api/v1/auth/password-reset/confirm/` valida el código y actualiza la contraseña. Además, el flag `force_password_change` en `User` activa el cambio obligatorio tras el login.

**Aceptación:**
- [ ] `POST /api/v1/auth/password-reset/` retorna **siempre 200** con el mismo mensaje, independientemente de si el email existe (previene enumeración de usuarios)
- [ ] El código expira en 30 minutos y solo puede usarse una vez
- [ ] `POST /api/v1/auth/password-reset/confirm/` con código válido actualiza la contraseña
- [ ] Código incorrecto o expirado retorna 400 con mensaje en español
- [ ] El login de un usuario con `force_password_change=True` retorna `{force_password_change: true}`
- [ ] `POST /api/v1/auth/change-password/` actualiza la contraseña, registra en AuditLog **y añade a la blacklist todos los refresh tokens activos del usuario** — si alguien robó la contraseña y el usuario la cambia, las sesiones activas del atacante quedan invalidadas
- [ ] La contraseña debe cumplir política mínima: 8 caracteres, al menos 1 mayúscula, 1 número, 1 carácter especial (validado en `PasswordPolicyValidator` personalizado de Django)
- [ ] Tests cubren: código válido, código expirado, código ya usado, contraseña débil, invalidación de tokens previos

**Verificación:**
- [ ] `pytest apps/authentication/tests/test_password_reset.py -v`

**Dependencias:** T03

**Archivos:**
- `backend/apps/authentication/services.py` (actualización)
- `backend/apps/authentication/views.py` (actualización)
- `backend/apps/authentication/serializers.py` (actualización)
- `backend/apps/authentication/tests/test_password_reset.py`

**Tamaño:** M

---

## ✅ CHECKPOINT A — Auth Backend Completo

**Verificaciones:**
- [ ] `pytest apps/authentication/ --cov=apps/authentication/services --cov-report=term` ≥ 90%
- [ ] El login genera token válido y el token expirado es rechazado
- [ ] 5 intentos fallidos bloquean la cuenta, visible en AuditLog
- [ ] Flujo de recuperación funciona con el SMTP de Office 365 (o email backend de consola en dev)
- [ ] Revisar con el cliente antes de continuar

---

## FASE 2 — Autenticación Frontend

---

### Task 06: Scaffold frontend — Zustand, Axios, routing, layout base

**Descripción:** Configurar la capa base del frontend: instancia Axios con interceptores para adjuntar el JWT y manejar el refresh automático cuando el token expira, store de autenticación en Zustand, React Router con rutas protegidas por rol, y el componente `AppLayout` vacío (sidebar + header). Esta tarea no incluye pantallas reales; solo la infraestructura.

**Aceptación:**
- [ ] Axios intercepta todos los requests y añade `Authorization: Bearer <token>`
- [ ] Cuando el access token expira, el interceptor llama automáticamente a `/api/v1/auth/token/refresh/`
- [ ] Si el refresh falla, redirige a `/login`
- [ ] Al cargar la app, si hay token en localStorage, el interceptor llama a `GET /api/v1/auth/me/` para restaurar el estado del usuario en Zustand (evita perder la sesión al refrescar la página)
- [ ] `useAuthStore` contiene: `user`, `token`, `isAuthenticated`, `login()`, `logout()`, `restoreSession()`
- [ ] Las rutas protegidas redirigen a `/login` si no hay sesión activa
- [ ] Las rutas de rol ADMIN, TRAINER y USUARIO están definidas en el router
- [ ] `React Hook Form` instalado — todos los formularios del sistema usan este hook (no `useState` por campo)
- [ ] `Zod` instalado — cada formulario tiene su schema de validación en `src/schemas/`; los errores del backend en formato `{details: {campo: [...]}}` se mapean automáticamente al campo del formulario via `setError()`
- [ ] **Sistema de Toast** (shadcn/ui `Toaster`): configurado globalmente en `AppLayout`; todos los servicios usan `toast.success()` / `toast.error()` para confirmar acciones al usuario
- [ ] **React Error Boundary** en `src/components/ErrorBoundary.tsx`: envuelve toda la aplicación; captura errores no controlados de componentes y muestra P43 (Error 500) en lugar de pantalla blanca; envía el error a los logs
- [ ] **Loading states**: hook `useAsync` en `src/hooks/useAsync.ts` que retorna `{data, loading, error}`; componente `<Skeleton>` de shadcn/ui para mostrar placeholder mientras carga cualquier lista o dato
- [ ] **ConfirmDialog**: componente `src/components/shared/ConfirmDialog.tsx` para acciones destructivas (borrar usuario, archivar curso, descartar pregunta IA); todas las acciones destructivas pasan por este componente

**Verificación:**
- [ ] `npm run build` en el contenedor frontend sin errores TypeScript
- [ ] `npm test` pasa los tests unitarios de `useAuthStore`

**Dependencias:** T03, T01

**Archivos:**
- `frontend/src/services/api.ts`
- `frontend/src/store/authStore.ts`
- `frontend/src/router/index.tsx`
- `frontend/src/router/ProtectedRoute.tsx`
- `frontend/src/components/layout/AppLayout.tsx`
- `frontend/src/store/authStore.test.ts`

**Tamaño:** M

---

### Task 07: Login UI — P01

**Descripción:** Implementar la pantalla P01 (Login). Formulario con email/usuario y contraseña, botón de submit, manejo de errores del API (credenciales inválidas, cuenta bloqueada), indicador de "recordarme" y link a recuperar contraseña. Al autenticarse, redirige al dashboard del rol correspondiente.

**Aceptación:**
- [ ] El formulario envía a `POST /api/v1/auth/login/` y almacena token en Zustand + localStorage
- [ ] Credenciales inválidas muestran mensaje de error en español sin revelar si el usuario existe
- [ ] Cuenta bloqueada muestra contador de minutos restantes
- [ ] Login exitoso redirige a `/dashboard` (USUARIO/TRAINER) o `/admin` (ADMIN)
- [ ] El campo contraseña tiene toggle para mostrar/ocultar
- [ ] Tests del componente cubren: submit exitoso, error 401, error 423

**Verificación:**
- [ ] `npm test -- --grep "LoginPage"` pasa
- [ ] Manual: login con credenciales válidas → redirige al dashboard correcto

**Dependencias:** T06

**Archivos:**
- `frontend/src/pages/auth/LoginPage.tsx`
- `frontend/src/services/authService.ts`
- `frontend/src/types/auth.ts`
- `frontend/src/pages/auth/LoginPage.test.tsx`

**Tamaño:** M

---

### Task 08: Auth edge cases UI — P02, P03, P04, P05

**Descripción:** Implementar las cuatro pantallas restantes del módulo de autenticación: P02 (Recuperar contraseña: solicitar código + confirmar código + nueva contraseña en 3 pasos), P03 (Cuenta bloqueada: información del tiempo de desbloqueo), P04 (Cambio obligatorio de contraseña: interceptado post-login), P05 (Sesión expirada: modal con botón de volver a login).

**Aceptación:**
- [ ] P02: El flujo de 3 pasos funciona completo (email → código → nueva contraseña)
- [ ] P03: Muestra el tiempo restante de bloqueo, se actualiza cada minuto
- [ ] P04: Un usuario con `force_password_change=true` no puede acceder a ninguna otra ruta hasta cambiar la contraseña
- [ ] P05: Aparece automáticamente cuando el refresh token expira; al hacer clic en "Iniciar sesión" lleva al login sin perder la URL destino
- [ ] Todos los mensajes de error y etiquetas están en español

**Verificación:**
- [ ] `npm test -- --grep "Auth"` pasa
- [ ] Manual: token vencido → aparece P05; login → regresa a la ruta donde estaba

**Dependencias:** T07, T05

**Archivos:**
- `frontend/src/pages/auth/PasswordRecoveryPage.tsx`
- `frontend/src/pages/auth/AccountLockedPage.tsx`
- `frontend/src/pages/auth/ForcePasswordChangePage.tsx`
- `frontend/src/components/shared/SessionExpiredModal.tsx`
- `frontend/src/router/index.tsx` (actualización de rutas)

**Tamaño:** M

---

## ✅ CHECKPOINT B — Autenticación Completa (Backend + Frontend)

**Verificaciones:**
- [ ] Un usuario puede hacer login, navegar, y ser desconectado por inactividad (P05)
- [ ] Un usuario nuevo con contraseña temporal ve P04 antes de cualquier otra pantalla
- [ ] La cuenta se bloquea en 5 intentos (P03) y se desbloquea sola en 15 min
- [ ] La recuperación de contraseña llega al email configurado en Office 365

---

## FASE 3 — Gestión de Usuarios

---

### Task 09: Modelos UserProfile + sistema de permisos por rol

**Descripción:** Crear `UserProfile` con los campos area, cargo, grupo. Implementar el sistema de permisos basado en rol: una clase de permisos custom de DRF (`IsAdmin`, `IsTrainer`, `IsAdminOrTrainer`) que se usará como `permission_classes` en todos los views subsiguientes.

**Aceptación:**
- [ ] `UserProfile` se crea automáticamente vía signal cuando se crea un `User`
- [ ] `IsAdmin` retorna 403 si el usuario no tiene role=ADMIN
- [ ] `IsAdminOrTrainer` retorna 403 si el usuario es USUARIO
- [ ] Tests de permisos cubren los 3 roles para cada clase de permiso

**Verificación:**
- [ ] `pytest apps/users/tests/test_permissions.py -v`

**Dependencias:** T02

**Archivos:**
- `backend/apps/users/models.py` (UserProfile + signal)
- `backend/apps/users/permissions.py`
- `backend/apps/users/migrations/0002_userprofile.py`
- `backend/apps/users/tests/test_permissions.py`

**Tamaño:** S

---

### Task 09b: Group model + management backend + Groups UI (P45)

**Descripción:** Crear el modelo `Group` (nombre, descripción, activo) y sus endpoints CRUD. Actualizar `UserProfile.grupo` de `CharField` a `ForeignKey(Group)`. Implementar la pantalla P45 en el panel de administración: listado de grupos con conteo de miembros, crear/editar grupo (modal), asignar/quitar usuarios a un grupo. Esta pantalla es nueva y no estaba en las 44 pantallas originales del diseño.

**Aceptación:**
- [ ] `Group` tiene: id, nombre, descripcion, activo, created_at
- [ ] `UserProfile.grupo` es FK a `Group` (nullable para usuarios sin grupo asignado)
- [ ] `GET /api/v1/groups/` retorna lista con conteo de miembros y cursos asignados a ese grupo
- [ ] `GET /api/v1/groups/{id}/members/` retorna los usuarios del grupo (paginado)
- [ ] `POST /api/v1/groups/{id}/members/` agrega usuarios al grupo (array de user_ids)
- [ ] `DELETE /api/v1/groups/{id}/members/{user_id}/` quita un usuario del grupo
- [ ] Solo ADMIN puede gestionar grupos (403 para otros roles)
- [ ] P45: tabla de grupos con columnas nombre, miembros, cursos activos, acciones
- [ ] P45: modal crear/editar grupo + asignación de usuarios mediante búsqueda inline
- [ ] Eliminar un grupo con usuarios activos retorna 400 con mensaje (no se puede borrar con miembros)

**Verificación:**
- [ ] `pytest apps/users/tests/test_groups.py -v`
- [ ] Manual: crear grupo "TI" → asignar 3 usuarios → publicar curso para ese grupo → los 3 usuarios tienen Enrollment

**Dependencias:** T09

**Archivos:**
- `backend/apps/users/models.py` (Group + actualización UserProfile)
- `backend/apps/users/migrations/0003_group.py`
- `backend/apps/users/services.py` (group_service)
- `backend/apps/users/views.py` (GroupViewSet)
- `backend/apps/users/serializers.py` (GroupSerializer)
- `backend/apps/users/tests/test_groups.py`
- `frontend/src/pages/admin/users/GroupManagementPage.tsx`
- `frontend/src/services/usersService.ts` (actualización)

**Tamaño:** M

---

### Task 10: User management backend — CRUD + cambio de rol

**Descripción:** Implementar los endpoints para gestión de usuarios: `GET/POST /api/v1/users/` (listar y crear), `GET/PUT/PATCH /api/v1/users/{id}/` (detalle y editar), `POST /api/v1/users/{id}/change-role/`. Todos restringidos a ADMIN. El cambio de rol genera entrada en AuditLog.

**Aceptación:**
- [ ] `GET /api/v1/users/` retorna lista paginada con filtros: área, rol, estado, búsqueda por nombre
- [ ] `POST /api/v1/users/` crea usuario y su perfil; envía email con contraseña temporal
- [ ] `PATCH /api/v1/users/{id}/` permite actualizar campos del perfil
- [ ] `POST /api/v1/users/{id}/change-role/` cambia el rol y registra en AuditLog
- [ ] `POST /api/v1/users/{id}/deactivate/` — desactiva la cuenta (`is_active=False`) **Y añade a la blacklist TODOS los refresh tokens activos del usuario inmediatamente**. Un admin que desactiva una cuenta comprometida cierra la sesión del atacante en ese instante, sin esperar a que el token expire. Registra en AuditLog.
- [ ] Un no-ADMIN recibe 403 en todos estos endpoints
- [ ] Tests de servicio alcanzan ≥ 80% de cobertura

**Verificación:**
- [ ] `pytest apps/users/tests/ --cov=apps/users/services -v`

**Dependencias:** T09, T03

**Archivos:**
- `backend/apps/users/services.py`
- `backend/apps/users/views.py`
- `backend/apps/users/serializers.py`
- `backend/apps/users/urls.py`
- `backend/apps/users/tests/test_services.py`
- `backend/apps/users/tests/test_views.py`

**Tamaño:** M

---

### Task 11: Admin users UI — P25, P26, P27

**Descripción:** Implementar las tres pantallas de administración de usuarios: P25 (Panel general: estadísticas rápidas de usuarios activos, cursos en progreso, certificados emitidos), P26 (Gestión de usuarios: tabla con filtros, paginación y acciones), P27 (Modal crear usuario: formulario validado con todos los campos del perfil).

**Aceptación:**
- [ ] P25: Los números del panel se cargan desde el API y se actualizan al navegar
- [ ] P26: La tabla soporta filtro por rol, área y búsqueda; paginación del servidor (no del cliente)
- [ ] P26: Acciones en fila: ver historial, cambiar rol, activar/desactivar
- [ ] P27: El modal valida todos los campos antes de enviar; muestra errores del API en campo correspondiente
- [ ] Cambiar el rol de un usuario actualiza la fila en P26 sin recargar la página

**Verificación:**
- [ ] Manual: crear usuario desde P27 → aparece en P26 → cambiar rol → ver en AuditLog (P39, cuando esté listo)

**Dependencias:** T10, T06

**Archivos:**
- `frontend/src/pages/admin/users/AdminDashboardPage.tsx`
- `frontend/src/pages/admin/users/UserManagementPage.tsx`
- `frontend/src/components/shared/CreateUserModal.tsx`
- `frontend/src/services/usersService.ts`
- `frontend/src/types/user.ts`

**Tamaño:** M

---

### Task 12: Carga masiva Excel — P28, P29

**Descripción:** Implementar la carga masiva de usuarios por archivo Excel/CSV. Backend: `POST /api/v1/users/bulk-import/` con validación por fila (retorna errores específicos por fila antes de importar). Frontend P28: drag-and-drop de archivo, previsualización de filas válidas e inválidas, confirmación de importación. P29: historial de actividad de un usuario específico.

**Aceptación:**
- [ ] Solo se aceptan `.xlsx` y `.csv`, máx. 5 MB, máx. 500 filas; se valida el magic bytes del archivo (no solo la extensión)
- [ ] El endpoint de previsualización retorna: `{valid: [{...}], invalid: [{row: N, errors: [...]}]}` sin guardar nada
- [ ] El endpoint de confirmación importa solo las filas válidas y registra la operación en AuditLog
- [ ] P28: el usuario puede ver exactamente qué filas fallarán antes de confirmar
- [ ] P29: muestra enrollments, intentos de examen y notificaciones del usuario; incluye botón "Resetear intentos" por assessment (solo visible para ADMIN), que llama al endpoint de T22
- [ ] Test de servicio cubre: archivo vacío, filas con email duplicado, campos obligatorios faltantes

**Verificación:**
- [ ] `pytest apps/users/tests/test_bulk_import.py -v`
- [ ] Manual: subir Excel con 10 usuarios (2 con errores) → confirmar → 8 usuarios creados

**Dependencias:** T10, T11

**Archivos:**
- `backend/apps/users/services.py` (bulk_import_service)
- `backend/apps/users/views.py` (BulkImportView)
- `backend/apps/users/serializers.py` (BulkImportSerializer)
- `backend/apps/users/tests/test_bulk_import.py`
- `frontend/src/pages/admin/users/BulkImportPage.tsx`
- `frontend/src/pages/admin/users/UserHistoryPage.tsx`

**Tamaño:** M

---

## ✅ CHECKPOINT C — Gestión de Usuarios Completa

**Verificaciones:**
- [ ] ADMIN puede crear, listar, editar y cambiar rol de usuarios
- [ ] La carga masiva de Excel funciona con previsualización de errores
- [ ] El historial de usuario muestra actividad correcta
- [ ] Todas las acciones del admin aparecen en AuditLog

---

## FASE 4 — Gestión de Cursos (Backend)

---

### Task 13: Modelos Course, Module, Enrollment + StorageBackend

**Descripción:** Definir los tres modelos del dominio de cursos y la capa de abstracción de almacenamiento. `Course` incluye estado (borrador/publicado/archivado), tipo, fecha límite, versión y audiencia. `Module` soporta tipos VIDEO/PDF/TEXTO. La clase abstracta `StorageBackend` define la interfaz con implementación `LocalStorage` para el MVP.

**Aceptación:**
- [ ] `python manage.py migrate` sin errores
- [ ] `Course.estado` tiene el state machine: borrador → publicado → archivado (sin retroceso)
- [ ] `Course.audiencia_grupos` es ManyToMany con `Group` (FK al modelo Group de T09b)
- [ ] `Course.fecha_limite` es **nullable** (el trainer decide si pone fecha límite o no; sin fecha = curso abierto indefinidamente)
- [ ] `Enrollment.estado` tiene los valores: `en_progreso`, `completado`, `vencido` (acceso cerrado)
- [ ] `Module.tipo_contenido` acepta VIDEO, PDF, TEXTO (SCORM diferido: campo existe pero view lo rechaza con 400)
- [ ] `Module.es_secuencial` es True por defecto en todos los módulos (los módulos son secuenciales; un usuario no puede abrir el módulo N+1 sin completar el N)
- [ ] `StorageBackend` tiene métodos abstractos: `save(file, path)`, `url(path)`, `delete(path)`
- [ ] `LocalStorage` implementa la interfaz guardando en el volumen Docker de media
- [ ] `Enrollment.progreso_porcentaje` se calcula basado en módulos completados
- [ ] **Modelo `ModuleProgress`**: registra por cada par `(enrollment, module)` el estado de completado (`is_completed`) y la posición guardada (`last_position_json` — página del PDF, segundo del video, porcentaje de scroll del texto). Permite retomar el contenido exactamente donde se dejó.
- [ ] **Modelo `Certificate` (stub MVP)**: id (UUID autogenerado), user (FK), course (FK), enrollment (FK), fecha_emision, nota_obtenida, `url_pdf=null`, `url_qr=null`. El UUID se genera cuando se aprueba el examen (T22); el PDF se genera en Fase 2. Así no se necesita migración retroactiva en Fase 2.
- [ ] Tests de modelos pasan (state machine, cálculo de progreso, secuencialidad)

**Verificación:**
- [ ] `pytest apps/courses/tests/test_models.py -v`

**Dependencias:** T02

**Archivos:**
- `backend/apps/courses/models.py`
- `backend/apps/courses/migrations/0001_initial.py`
- `backend/storage/backends/base.py`
- `backend/storage/backends/local.py`
- `backend/storage/backends/sharepoint.py` (stub vacío)
- `backend/apps/courses/tests/test_models.py`

**Tamaño:** M

---

### Task 14: Course CRUD backend — crear, editar, listar cursos y módulos

**Descripción:** Endpoints para administración de cursos: `GET/POST /api/v1/courses/` (ADMIN/TRAINER), `GET/PUT/PATCH /api/v1/courses/{id}/`, `POST /api/v1/courses/{id}/modules/` (crear módulo con upload de archivo para PDF), `PUT/PATCH /api/v1/courses/{id}/modules/{mod_id}/`. Incluye subida de archivos PDF validando tipo MIME y tamaño (máx. 50 MB por archivo).

**Aceptación:**
- [ ] `POST /api/v1/courses/` crea un curso en estado "borrador"
- [ ] `POST /api/v1/courses/{id}/modules/` acepta: VIDEO (url), PDF (archivo ≤50MB), TEXTO (html)
- [ ] La subida de PDF usa `LocalStorage.save()` (no ruta directa)
- [ ] El tipo de archivo se valida por MIME type **y por magic bytes** (los primeros bytes del archivo), no solo por extensión
- [ ] El contenido HTML de módulos de tipo TEXTO se sanitiza con `bleach` antes de guardarse en BD: se permiten únicamente etiquetas seguras (h1-h4, p, ul, ol, li, strong, em, a, img). **Sin esta sanitización, un admin podría guardar JavaScript malicioso que se ejecuta en el navegador de cada usuario que abre el módulo (XSS).**
- [ ] SCORM retorna 400 con mensaje "SCORM disponible en Fase 2"
- [ ] Un TRAINER solo puede editar cursos propios; ADMIN puede editar cualquiera
- [ ] Tests de servicio ≥ 80% cobertura

**Verificación:**
- [ ] `pytest apps/courses/tests/ --cov=apps/courses/services -v`

**Dependencias:** T13, T09

**Archivos:**
- `backend/apps/courses/services.py`
- `backend/apps/courses/views.py`
- `backend/apps/courses/serializers.py`
- `backend/apps/courses/urls.py`
- `backend/apps/courses/tests/test_services.py`
- `backend/apps/courses/tests/test_views.py`

**Tamaño:** M

---

### Task 15: Publicación de cursos + lógica de enrollment

**Descripción:** Agregar al `CourseService` los métodos de publicación (`publish_course`) y asignación de audiencia por grupos. Al publicar: validar que el curso tenga al menos un módulo, cambiar estado a "publicado", crear automáticamente `Enrollment` para todos los usuarios del grupo objetivo y generar notificaciones de sistema "nuevo_curso_asignado".

**Aceptación:**
- [ ] `POST /api/v1/courses/{id}/publish/` cambia estado a publicado (solo ADMIN/TRAINER dueño)
- [ ] Un curso sin módulos no puede publicarse (retorna 400)
- [ ] Al publicar, se crean Enrollments para todos los usuarios en los grupos asignados
- [ ] Cada Enrollment creado genera una Notification de tipo `nuevo_curso_asignado`
- [ ] La publicación queda registrada en AuditLog
- [ ] `GET /api/v1/courses/` para un USUARIO retorna solo los cursos en los que está inscrito

**Verificación:**
- [ ] `pytest apps/courses/tests/test_publish.py -v`
- [ ] Manual: publicar curso con grupo "Area TI" → usuarios del grupo tienen Enrollment en BD

**Dependencias:** T14

**Archivos:**
- `backend/apps/courses/services.py` (publish_course, assign_audience)
- `backend/apps/courses/views.py` (PublishCourseView)
- `backend/apps/courses/tests/test_publish.py`
- `backend/apps/notifications/models.py` (Notification — primero en este archivo)
- `backend/apps/notifications/services.py` (create_notification)

**Tamaño:** M

---

## ✅ CHECKPOINT D — Backend de Cursos Completo

**Verificaciones:**
- [ ] ADMIN puede crear un curso con módulos y publicarlo
- [ ] Los usuarios del grupo asignado reciben Enrollment automáticamente
- [ ] Un USUARIO no puede acceder a cursos fuera de su grupo
- [ ] Los archivos PDF se guardan en el volumen de media

---

## FASE 5 — Gestión de Cursos (Frontend)

---

### Task 16: Wizard de creación de cursos — Pasos 1 y 2 (P30, P31)

**Descripción:** Implementar los primeros dos pasos del wizard de creación Y edición de cursos. El wizard funciona en dos modos: `mode=create` (desde P35 botón "Nuevo curso") y `mode=edit` (desde P35 botón "Editar" en un curso existente). En modo edición, los campos se pre-populan con los datos actuales y el botón dice "Guardar cambios". Paso 1 (P30): nombre, objetivo, tipo, área, fecha límite, versión. Paso 2 (P31): gestión de módulos con upload.

**Aceptación:**
- [ ] El wizard guarda el progreso en Zustand; recargar la página no pierde el paso actual
- [ ] P30: todos los campos obligatorios tienen validación inline (sin submit)
- [ ] P31: al subir un PDF muestra barra de progreso real (basado en eventos de upload de Axios)
- [ ] P31: el editor de texto HTML tiene formato básico (negrita, listas, encabezados)
- [ ] P31: el drag-and-drop de módulos actualiza el campo `orden` en el estado local
- [ ] Cada paso tiene botón "Guardar borrador" que persiste en el servidor

**Verificación:**
- [ ] Manual: crear curso con un módulo PDF (subir archivo real) y un módulo de video

**Dependencias:** T14, T06

**Archivos:**
- `frontend/src/pages/admin/courses/CourseWizardPage.tsx`
- `frontend/src/pages/admin/courses/steps/Step1Info.tsx`
- `frontend/src/pages/admin/courses/steps/Step2Modules.tsx`
- `frontend/src/components/shared/RichTextEditor.tsx`
- `frontend/src/services/coursesService.ts`
- `frontend/src/types/course.ts`

**Tamaño:** M

---

### Task 17: Wizard pasos 3 y 4 + listado de cursos (P32, P33, P35)

**Descripción:** Paso 3 (P32): configurar la evaluación del curso (puntaje mínimo, intentos, tiempo límite — el banco de preguntas se completa en T22). Paso 4 (P33): seleccionar grupos de audiencia y publicar. P35: listado de cursos del admin con filtros (estado, área, tipo) y acciones (editar, publicar, archivar).

**Aceptación:**
- [ ] P32: los campos de configuración de evaluación se guardan y persisten al regresar al paso
- [ ] P33: selector de grupos de audiencia (checkboxes por área/grupo de usuarios)
- [ ] P33: el botón "Publicar" está deshabilitado si no hay al menos un módulo
- [ ] P35: la tabla tiene columnas: nombre, área, estado (badge de color), fecha límite, acciones
- [ ] Publicar desde P33 llama a `POST /api/v1/courses/{id}/publish/` y redirige a P35

**Verificación:**
- [ ] Manual: completar wizard completo → P35 muestra el nuevo curso con estado "publicado"

**Dependencias:** T16, T15

**Archivos:**
- `frontend/src/pages/admin/courses/steps/Step3Assessment.tsx`
- `frontend/src/pages/admin/courses/steps/Step4Publish.tsx`
- `frontend/src/pages/admin/courses/CourseListPage.tsx`
- `frontend/src/services/coursesService.ts` (actualización)

**Tamaño:** M

---

### Task 18: Catálogo, detalle e inscripción del usuario (P10, P11, P12)

**Descripción:** Pantallas de consumo de cursos para el USUARIO. P10 (Catálogo): listado de cursos del usuario con filtro por estado de avance (pendiente/en progreso/completado) y semáforo de urgencia. P11 (Detalle): descripción del curso, módulos listados, estado del enrollment, botón "Comenzar/Continuar". P12 (Mis cursos): cursos en progreso con porcentaje y próximos a vencer.

**Aceptación:**
- [ ] P10: los cursos del USUARIO incluyen su Enrollment con `progreso_porcentaje`
- [ ] P10: el semáforo de urgencia es verde (>7 días), amarillo (1-7 días), rojo (<1 día o vencido)
- [ ] P11: muestra módulos como lista con ícono de tipo, duración estimada y estado (completado/pendiente)
- [ ] P11: solo los módulos disponibles (previo completado) son clickeables si el curso es secuencial
- [ ] P12: ordena por fecha de vencimiento más próxima

**Verificación:**
- [ ] Manual: usuario con cursos asignados → P10 muestra los cursos con el semáforo correcto

**Dependencias:** T15, T06

**Archivos:**
- `frontend/src/pages/courses/CourseCatalogPage.tsx`
- `frontend/src/pages/courses/CourseDetailPage.tsx`
- `frontend/src/pages/courses/MyCourseListPage.tsx`
- `frontend/src/components/shared/UrgencyBadge.tsx`

**Tamaño:** M

---

### Task 19: Reproductores de contenido + completion tracking (P13, P14, P15, P16)

**Descripción:** Implementar los tres reproductores de módulos: P13 (Video: iframe/player con tracking al 90% de visualización), P14 (PDF: visor con detección de última página), P15 (Texto: scroll-to-bottom + 30 segundos de permanencia). P16 (Curso completado): pantalla de celebración con botón al examen. La completación de cada módulo llama a `POST /api/v1/enrollments/{id}/modules/{mod_id}/complete/`.

**Aceptación:**
- [ ] El backend valida la secuencialidad antes de marcar un módulo como completado: si el módulo anterior no está completado, retorna 403 con mensaje en español
- [ ] P11 (detalle del curso): los módulos no completados y sin desbloquear se muestran con ícono de candado y son no clickeables
- [ ] **Resume position**: al abrir un módulo, el frontend llama a `GET /api/v1/enrollments/{id}/modules/{mod_id}/progress/` y obtiene `last_position_json`; el reproductor retoma desde esa posición (página del PDF, segundo del video, scroll del texto). Al cerrar o pausar, el frontend hace `PATCH` con la posición actual cada 10 segundos y al desmontar el componente.
- [ ] P13: el módulo se marca como completado solo después del 90% del video (controlado por el frontend; backend valida que el evento llegue)
- [ ] P14: el módulo se marca como completado al scrollear a la última página del PDF
- [ ] P15: el módulo se marca como completado solo si el usuario está en la página ≥ 30 segundos Y ha hecho scroll al final
- [ ] El `progreso_porcentaje` del Enrollment se recalcula en el backend al completar un módulo
- [ ] P16 aparece cuando todos los módulos del curso están completados
- [ ] El usuario no puede "completar" un módulo que ya está completado (idempotente)

**Verificación:**
- [ ] Manual: tomar un curso con los 3 tipos de módulo → todos se completan → aparece P16

**Dependencias:** T18, T14

**Archivos:**
- `frontend/src/pages/courses/VideoPlayerPage.tsx`
- `frontend/src/pages/courses/PdfPlayerPage.tsx`
- `frontend/src/pages/courses/TextPlayerPage.tsx`
- `frontend/src/pages/courses/CourseCompletedPage.tsx`
- `backend/apps/courses/views.py` (CompleteModuleView)
- `backend/apps/courses/services.py` (complete_module, recalculate_progress)

**Tamaño:** L (6 archivos — justificado por los 4 reproductores que son interdependientes)

---

## ✅ CHECKPOINT E — Flujo de Cursos Completo End-to-End

**Verificaciones:**
- [ ] ADMIN crea un curso con módulos de video, PDF y texto → lo publica
- [ ] USUARIO ve el curso en P10, lo abre en P11, consume todos los módulos, llega a P16
- [ ] El progreso en P12 se actualiza correctamente
- [ ] Un usuario no puede ver cursos de otro grupo

---

## FASE 6 — Evaluaciones

---

### Task 20: Modelos Assessment, Question, UserAnswer + migraciones

**Descripción:** Definir los modelos de evaluación. `Assessment` es 1-a-1 con `Course`. `Question` tiene tipos (MULTIPLE_CHOICE, MULTIPLE_SELECT, TRUE_FALSE) con opciones y respuesta correcta en JSON. `UserAnswer` registra cada intento completo con timestamp y calificación.

**Aceptación:**
- [ ] `python manage.py migrate` sin errores
- [ ] `Question.opciones` usa `JSONField`; `Question.respuesta_correcta` es string o lista (según tipo)
- [ ] `Question.aprobada_por_humano` es False por defecto (las preguntas de IA empiezan en False)
- [ ] `UserAnswer.intento_numero` se incrementa automáticamente por enrollment
- [ ] Tests de modelos pasan

**Verificación:**
- [ ] `pytest apps/assessments/tests/test_models.py -v`

**Dependencias:** T13

**Archivos:**
- `backend/apps/assessments/models.py`
- `backend/apps/assessments/migrations/0001_initial.py`
- `backend/apps/assessments/tests/test_models.py`

**Tamaño:** S

---

### Task 21: Assessment CRUD backend — banco de preguntas

**Descripción:** Endpoints para gestión de preguntas: `GET/POST /api/v1/assessments/{id}/questions/` (ADMIN/TRAINER), `PUT/DELETE /api/v1/assessments/{id}/questions/{q_id}/`. Las preguntas creadas manualmente tienen `aprobada_por_humano=True` automáticamente.

**Aceptación:**
- [ ] Solo preguntas con `aprobada_por_humano=True` se incluyen en los exámenes
- [ ] `GET /api/v1/assessments/{id}/` incluye configuración (puntaje mínimo, intentos, tiempo) y conteo de preguntas aprobadas
- [ ] `DELETE` de una pregunta no borra `UserAnswer` existentes (FK protegida)
- [ ] Tests ≥ 80% cobertura en services

**Verificación:**
- [ ] `pytest apps/assessments/tests/ --cov=apps/assessments/services -v`

**Dependencias:** T20, T09

**Archivos:**
- `backend/apps/assessments/services.py`
- `backend/apps/assessments/views.py`
- `backend/apps/assessments/serializers.py`
- `backend/apps/assessments/urls.py`
- `backend/apps/assessments/tests/test_services.py`

**Tamaño:** M

---

### Task 22: Servicio de examen — grading, intentos, guardado automático

**Descripción:** Implementar la lógica core del examen: `POST /api/v1/assessments/{id}/start/` (valida intentos disponibles, retorna preguntas en orden aleatorio), `POST /api/v1/assessments/{id}/save-progress/` (guardado automático de respuestas parciales), `POST /api/v1/assessments/{id}/submit/` (califica y retorna resultado). Incluir endpoint de reset de intentos para ADMIN. El orden de las preguntas se fija al inicio del intento para evitar manipulación.

**Aceptación:**
- [ ] **Protección de intento simultáneo**: `start/` usa `select_for_update()` en una transacción atómica para verificar y registrar el inicio del intento. Si hay un intento `en_curso` para ese usuario+assessment, retorna 409 ("Ya tienes un examen activo en otra pestaña"). Esto evita que dos pestañas creen dos intentos simultáneos y ensucien el historial.
- [ ] `start/` retorna 403 si el usuario agotó sus intentos
- [ ] `start/` retorna 403 si el curso no está completado (todos los módulos secuenciales)
- [ ] `submit/` calcula el puntaje, lo compara con `puntaje_minimo`, genera `UserAnswer`
- [ ] `submit/` con puntaje ≥ mínimo: (1) marca el Enrollment como "completado", (2) **crea registro `Certificate` con UUID único y `fecha_emision` — sin `url_pdf` todavía (Fase 2 agrega el PDF)**. El UUID del certificado queda disponible desde el MVP.
- [ ] El tiempo límite se valida en el backend: submit después del tiempo retorna 400
- [ ] `POST /api/v1/assessments/{id}/users/{user_id}/reset-attempts/` — solo ADMIN — borra los `UserAnswer` del usuario para ese assessment y resetea el contador de intentos; registra en AuditLog con accion=`EXAM_ATTEMPTS_RESET`
- [ ] `GET /api/v1/assessments/{id}/users/{user_id}/attempts/` — solo ADMIN — retorna historial de intentos del usuario (TRAINER no puede consultar intentos ajenos en MVP)
- [ ] Tests de grading ≥ 90% cobertura (caso borde: empate exacto con puntaje mínimo, intento concurrente, reset de intentos)

**Verificación:**
- [ ] `pytest apps/assessments/tests/test_grading.py --cov=apps/assessments/services -v`

**Dependencias:** T21

**Archivos:**
- `backend/apps/assessments/services.py` (grading_service, attempt_service)
- `backend/apps/assessments/views.py` (Start, SaveProgress, Submit)
- `backend/apps/assessments/tests/test_grading.py`

**Tamaño:** M

---

### Task 23: Assessment admin UI en el wizard — P32

**Descripción:** Completar el Paso 3 del wizard de creación de cursos con el banco de preguntas. Formulario de creación/edición de preguntas inline: selector de tipo, campo de texto, generación dinámica de opciones (para MULTIPLE_CHOICE/SELECT), marcado de respuesta correcta. Lista de preguntas del banco con acciones editar/eliminar.

**Aceptación:**
- [ ] El formulario cambia dinámicamente según el tipo de pregunta
- [ ] Las preguntas guardadas aparecen en la lista con ícono de tipo y estado
- [ ] Se puede crear, editar y borrar preguntas sin salir del wizard
- [ ] El conteo de preguntas aprobadas se muestra en el encabezado del paso

**Verificación:**
- [ ] Manual: en P32 del wizard, crear 3 preguntas de distintos tipos y guardarlas

**Dependencias:** T17, T21

**Archivos:**
- `frontend/src/pages/admin/courses/steps/Step3Assessment.tsx` (actualización completa)
- `frontend/src/components/shared/QuestionForm.tsx`
- `frontend/src/services/assessmentsService.ts`
- `frontend/src/types/assessment.ts`

**Tamaño:** M

---

### Task 24: Examen frontend — P17, P18, P19, P20, P21

**Descripción:** Implementar el flujo completo de examen para el USUARIO. P17 (Intro: instrucciones, tiempo límite, intentos restantes, botón Comenzar), P18 (Pregunta: una pregunta a la vez con navegación, contador de tiempo, auto-guardado cada 30s), P19/P20/P21 (Resultados: aprobado, reprobado con intentos, sin intentos).

**Aceptación:**
- [ ] P17: no puede iniciar si no hay preguntas aprobadas en el assessment
- [ ] P18: el contador de tiempo se muestra en rojo cuando quedan < 5 minutos
- [ ] P18: el auto-guardado llama a `save-progress/` cada 30s (sin bloquear al usuario)
- [ ] P18: si el tiempo expira, se hace submit automático con las respuestas guardadas
- [ ] P19: muestra nota obtenida, nota mínima y opción de ver el certificado (cuando esté en Fase 2)
- [ ] P20: muestra intentos restantes y módulos sugeridos para reforzar
- [ ] P21: botón para pedir revisión manual (genera notificación al admin)

**Verificación:**
- [ ] Manual: tomar un examen completo → verificar que el resultado es correcto y el Enrollment queda en estado correcto

**Dependencias:** T23, T22

**Archivos:**
- `frontend/src/pages/assessments/ExamIntroPage.tsx`
- `frontend/src/pages/assessments/ExamQuestionPage.tsx`
- `frontend/src/pages/assessments/ExamResultApprovedPage.tsx`
- `frontend/src/pages/assessments/ExamResultFailedPage.tsx`
- `frontend/src/pages/assessments/ExamNoAttemptsPage.tsx`
- `frontend/src/hooks/useExamTimer.ts`

**Tamaño:** L (6 archivos — flujo secuencial de 5 pantallas interdependientes)

---

## ✅ CHECKPOINT F — Flujo de Evaluaciones Completo

**Verificaciones:**
- [ ] El flujo completo funciona: curso → módulos → examen → resultado → enrollment completado
- [ ] El auto-guardado de respuestas funciona (verificar en BD durante el examen)
- [ ] El tiempo límite se aplica en el backend (no solo en el frontend)
- [ ] Agotar intentos bloquea correctamente el acceso al examen

---

## FASE 7 — Generador IA (Funcionalidad Central)

---

### Task 25: Celery + Redis — infraestructura de background tasks

**Descripción:** Configurar Celery con Redis como broker y `django-celery-beat` como scheduler de tareas programadas. Crear un `celery_app` en `config/celery.py`, actualizar `docker-compose.dev.yml` con los servicios `celery-worker` y `celery-beat`. Sin `celery-beat`, las tareas de vencimiento de cursos y alertas de deadline nunca corren solas en producción.

**Aceptación:**
- [ ] `docker-compose exec celery-worker celery -A config inspect active` retorna output sin errores
- [ ] La tarea `health_check.delay()` se ejecuta y el resultado es recuperable con `.get(timeout=5)`
- [ ] **Result backend configurado**: `CELERY_RESULT_BACKEND = REDIS_URL` en settings. Sin esto, el frontend que hace polling del estado del task de IA siempre recibirá `{"status": "PENDING"}` aunque el task haya terminado.
- [ ] `CELERY_RESULT_EXPIRES = 3600` — los resultados de tasks se borran de Redis después de 1 hora (evita acumulación)
- [ ] `django-celery-beat` instalado; `celery-beat` como servicio en docker-compose corre `celery -A config beat`
- [ ] `CELERY_TASK_ALWAYS_EAGER=True` en `settings/test.py` para que los tests ejecuten tasks síncronamente
- [ ] La tabla de schedules de celery-beat existe en la BD (`python manage.py migrate django_celery_beat`)

**Verificación:**
- [ ] `pytest apps/ai_generator/tests/test_tasks.py -v`

**Dependencias:** T01

**Archivos:**
- `backend/config/celery.py`
- `backend/config/settings/base.py` (actualización CELERY_*)
- `docker-compose.dev.yml` (celery-worker service)
- `backend/apps/ai_generator/__init__.py`
- `backend/apps/ai_generator/tasks.py` (health_check)
- `backend/apps/ai_generator/tests/test_tasks.py`

**Tamaño:** S

---

### Task 26: Parser de documentos — PDF y PPT

**Descripción:** Implementar `parsers.py` en `ai_generator` con dos funciones: `extract_text_from_pdf(file_path) -> str` usando `pdfplumber`, y `extract_text_from_pptx(file_path) -> str` usando `python-pptx`. Ambas incluyen limpieza de texto (eliminar headers/footers repetitivos, normalizar espacios) y truncado inteligente si el texto supera los 100,000 caracteres (límite de contexto).

**Aceptación:**
- [ ] `extract_text_from_pdf` extrae texto de PDFs con múltiples páginas correctamente
- [ ] `extract_text_from_pptx` extrae texto de cada diapositiva manteniendo el orden
- [ ] Si el archivo está corrompido o vacío, lanza `DocumentParseError` con mensaje descriptivo
- [ ] El texto resultante no supera 100,000 caracteres (truncado con marcador `[CONTENIDO TRUNCADO...]`)
- [ ] Tests con fixtures de archivos reales (PDF de 3 páginas, PPT de 5 diapositivas)

**Verificación:**
- [ ] `pytest apps/ai_generator/tests/test_parsers.py -v`

**Dependencias:** T25

**Archivos:**
- `backend/apps/ai_generator/parsers.py`
- `backend/apps/ai_generator/exceptions.py`
- `backend/apps/ai_generator/tests/test_parsers.py`
- `backend/apps/ai_generator/tests/fixtures/sample.pdf` (archivo de prueba)
- `backend/apps/ai_generator/tests/fixtures/sample.pptx` (archivo de prueba)

**Tamaño:** S

---

### Task 27: AI Service — integración con Claude API (módulos + preguntas)

**Descripción:** Implementar `ai_generator/services.py` con dos funciones principales: `generate_course_modules(text: str, config: dict) -> list[dict]` y `generate_questions(content: str, config: dict) -> list[dict]`. Ambas construyen el prompt, llaman a `claude-sonnet-4-6` vía Anthropic SDK, validan el JSON retornado y manejan errores/reintentos. Las tareas Celery `analyze_document` y `generate_questions_task` envuelven estos servicios.

**Aceptación:**
- [ ] `generate_course_modules` retorna lista de `{title, objetivo, descripcion, orden}` validada
- [ ] `generate_questions` retorna lista de `{text, type, options, correct_answer, difficulty, topic}` validada
- [ ] Si Claude retorna JSON malformado, se reintenta hasta 2 veces con el prompt ajustado
- [ ] Si tras 3 intentos no hay JSON válido, lanza `AIGenerationError`
- [ ] La tarea Celery `analyze_document` acepta `(file_path, file_type, config)` y retorna el task_id al frontend
- [ ] El frontend puede consultar el estado del task con `GET /api/v1/ai/tasks/{task_id}/`
- [ ] Tests con mock de la API de Anthropic (sin llamadas reales) ≥ 70% cobertura

**Verificación:**
- [ ] `pytest apps/ai_generator/tests/test_services.py --cov=apps/ai_generator/services -v`

**Dependencias:** T26

**Archivos:**
- `backend/apps/ai_generator/services.py`
- `backend/apps/ai_generator/tasks.py` (analyze_document, generate_questions_task)
- `backend/apps/ai_generator/views.py` (UploadView, TaskStatusView, GenerateQuestionsView)
- `backend/apps/ai_generator/serializers.py`
- `backend/apps/ai_generator/urls.py`
- `backend/apps/ai_generator/tests/test_services.py`

**Tamaño:** M

---

### Task 28: AI Generator UI — revisión de módulos propuestos (P34 — sección A)

**Descripción:** Implementar la primera sección de la pantalla P34: subida de archivo (PDF/PPT con drag-and-drop y validación de tipo/tamaño), botón "Analizar con IA", polling del estado de la tarea (spinner mientras procesa), y la interfaz de revisión de módulos propuestos (tarjetas con título, objetivo y descripción editable). Acciones por tarjeta: Aprobar, Editar, Descartar.

**Aceptación:**
- [ ] Solo se aceptan `.pdf`, `.pptx`, `.ppt` (validado en frontend Y backend)
- [ ] Durante el análisis (Celery) se muestra spinner con mensaje "Analizando contenido..."
- [ ] El polling consulta el estado cada 3s y para cuando el task está completo o falla
- [ ] Cada módulo propuesto tiene campos editables inline (título, objetivo, descripción)
- [ ] "Aprobar todos" aprueba todos los módulos con un click
- [ ] "Agregar al curso" llama a `POST /api/v1/courses/{id}/modules/` para cada módulo aprobado
- [ ] Si la API de IA falla, muestra mensaje de error con botón "Reintentar"

**Verificación:**
- [ ] Manual: subir PDF real → ver módulos propuestos → aprobar 2, editar 1, descartar 1 → confirmar que los 3 módulos aparecen en el Paso 2 del wizard

**Dependencias:** T27, T16

**Archivos:**
- `frontend/src/pages/admin/courses/AIGeneratorPage.tsx`
- `frontend/src/components/shared/DocumentUploader.tsx`
- `frontend/src/components/shared/AIModuleCard.tsx`
- `frontend/src/services/aiService.ts`
- `frontend/src/hooks/useTaskPolling.ts`

**Tamaño:** M

---

### Task 29: AI Generator UI — revisión de preguntas (P34 — sección B)

**Descripción:** Segunda sección de P34: configuración de generación (módulo fuente, cantidad 1-20, dificultad, tipos de pregunta), botón "Generar preguntas", y lista de preguntas propuestas con acciones individuales: Aprobar, Editar (inline), Descartar, Regenerar (solo esa pregunta). Solo las preguntas aprobadas se guardan en la BD.

**Aceptación:**
- [ ] La configuración tiene validación: cantidad entre 1 y 20, al menos un tipo seleccionado
- [ ] Cada pregunta propuesta muestra: texto, tipo, opciones (para MC/MS) y respuesta correcta resaltada
- [ ] "Editar" convierte la tarjeta en formulario editable in-place
- [ ] "Regenerar" llama a un endpoint que genera una nueva versión solo de esa pregunta
- [ ] "Aprobar" llama a `POST /api/v1/assessments/{id}/questions/` con `aprobada_por_humano=True`
- [ ] El AuditLog registra cuántas preguntas IA fueron aprobadas, editadas y descartadas

**Verificación:**
- [ ] Manual: generar 5 preguntas → aprobar 3, editar 1 y aprobarla, descartar 1 → verificar que hay exactamente 4 preguntas en el banco de preguntas

**Dependencias:** T28, T23

**Archivos:**
- `frontend/src/pages/admin/courses/AIGeneratorPage.tsx` (sección B, mismo componente)
- `frontend/src/components/shared/AIQuestionCard.tsx`
- `backend/apps/ai_generator/views.py` (RegenerateQuestionView)
- `backend/apps/ai_generator/services.py` (regenerate_single_question)

**Tamaño:** M

---

## ✅ CHECKPOINT G — Generador IA Completo

**Verificaciones:**
- [ ] El flujo completo funciona: subir PDF → módulos propuestos → aprobar → aparecen en el curso
- [ ] El flujo de preguntas: configurar → generar → aprobar/editar/descartar → banco de preguntas actualizado
- [ ] NINGUNA pregunta llega a la BD sin `aprobada_por_humano=True`
- [ ] El AuditLog registra todas las aprobaciones de contenido IA
- [ ] La API de IA falla gracefully (sin crash, mensaje de error amigable)

---

## FASE 8 — Notificaciones, Dashboard y Perfil

---

### Task 30: Notification model + service + event hooks

**Descripción:** Formalizar el modelo `Notification` (ya creado en T15) con todos sus tipos. Implementar `NotificationService` con métodos para crear notificaciones de cada tipo del SPEC. Conectar los eventos que deben generar notificaciones: `nuevo_curso_asignado` (T15 ya lo tiene), `examen_aprobado`, `examen_reprobado`, y configurar la tarea Celery `check_upcoming_deadlines` que corre diariamente para generar alertas de `vencimiento_7_dias` y `vencimiento_1_dia`.

**Aceptación:**
- [ ] `examen_aprobado` se genera cuando `submit/` retorna aprobado
- [ ] `examen_reprobado` se genera cuando `submit/` retorna reprobado (incluye intentos restantes)
- [ ] `vencimiento_7_dias` se genera para Enrollments en cursos con `fecha_limite = hoy + 7 días` (solo si `fecha_limite` no es null)
- [ ] `vencimiento_1_dia` se genera para Enrollments en cursos con `fecha_limite = hoy + 1 día`
- [ ] La tarea `check_upcoming_deadlines` **no genera notificaciones duplicadas** — verifica si la notificación de ese tipo ya fue enviada para ese enrollment en las últimas 25 horas
- [ ] La tarea `close_expired_enrollments` corre diariamente: marca como `vencido` los Enrollments donde `Course.fecha_limite < hoy` y `estado = en_progreso`; genera notificación `curso_vencido`; los enrollments `vencido` retornan 403 en el endpoint de acceso al curso
- [ ] Ambas tareas están registradas en `django-celery-beat` con schedule diario a las 07:00 UTC
- [ ] Tests de cada tipo de notificación usando factory_boy para datos de prueba

**Verificación:**
- [ ] `pytest apps/notifications/tests/ -v`

**Dependencias:** T22, T15

**Archivos:**
- `backend/apps/notifications/models.py` (actualización)
- `backend/apps/notifications/services.py`
- `backend/apps/notifications/tasks.py` (check_upcoming_deadlines)
- `backend/apps/notifications/urls.py`
- `backend/apps/notifications/views.py`
- `backend/apps/notifications/tests/test_services.py`

**Tamaño:** M

---

### Task 31: Notifications UI — P09, P40

**Descripción:** P40 (Dropdown en el header): badge con conteo de no leídas, lista de las últimas 5 notificaciones con ícono por tipo y timestamp relativo, "marcar todas como leídas". P09 (Vista completa): paginación, filtro por tipo, marcar individual/todas como leídas.

**Aceptación:**
- [ ] El badge del header se actualiza en tiempo real (polling cada 60s o WebSocket si está disponible)
- [ ] Hacer clic en una notificación la marca como leída y navega a la pantalla relevante
- [ ] P09: tiene filtro por tipo (curso asignado, vencimiento, examen, certificado)
- [ ] `notificationsStore` en Zustand mantiene el conteo de no leídas sincronizado

**Verificación:**
- [ ] Manual: completar un examen → aparece notificación en P40 → clic → navega al resultado

**Dependencias:** T30, T06

**Archivos:**
- `frontend/src/pages/dashboard/NotificationsPage.tsx`
- `frontend/src/components/layout/NotificationDropdown.tsx`
- `frontend/src/store/notificationsStore.ts`

**Tamaño:** M

---

### Task 32: Dashboard de usuario — P06

**Descripción:** Implementar P06 con los 4 bloques principales: (1) Resumen rápido (cursos en progreso, completados, pendientes), (2) Lista de cursos activos con barra de progreso y semáforo, (3) Actividad reciente (últimas 5 acciones), (4) Próximas fechas límite (ordenado por urgencia).

**Aceptación:**
- [ ] Los datos del dashboard se cargan con una única llamada a `GET /api/v1/users/me/dashboard/`
- [ ] El endpoint retorna todos los datos necesarios para el dashboard en una respuesta
- [ ] Los colores del semáforo son consistentes con P10 (misma lógica en `UrgencyBadge`)
- [ ] La sección "Actividad reciente" usa AuditLog filtrado por el usuario actual

**Verificación:**
- [ ] Manual: usuario con varios cursos en distintos estados → el dashboard muestra todo correcto

**Dependencias:** T31, T18

**Archivos:**
- `frontend/src/pages/dashboard/UserDashboardPage.tsx`
- `backend/apps/users/views.py` (UserDashboardView)
- `backend/apps/users/services.py` (get_user_dashboard)

**Tamaño:** M

---

### Task 33: Perfil y cambio de contraseña — P07, P08

**Descripción:** P07 (Mi perfil): formulario con campos editables (nombre, área, cargo, avatar). P08 (Cambiar contraseña): formulario con contraseña actual, nueva y confirmación. El cambio de contraseña registra en AuditLog.

**Aceptación:**
- [ ] P07: el avatar tiene upload con preview inmediato (recorte cuadrado)
- [ ] P08: la contraseña nueva debe cumplir requisitos mínimos (8 chars, mayúscula, número)
- [ ] P08: contraseña incorrecta retorna 400 sin revelar información extra
- [ ] El cambio de contraseña registra en AuditLog con accion=`PASSWORD_CHANGED`

**Verificación:**
- [ ] Manual: cambiar contraseña → logout → login con nueva contraseña

**Dependencias:** T10, T06

**Archivos:**
- `frontend/src/pages/dashboard/ProfilePage.tsx`
- `frontend/src/pages/dashboard/ChangePasswordPage.tsx`

**Tamaño:** S

---

## ✅ CHECKPOINT H — Dashboard y Notificaciones Completos

**Verificaciones:**
- [ ] El dashboard de usuario muestra progreso real
- [ ] Las notificaciones de examen aprobado/reprobado llegan en tiempo real (o próximo polling)
- [ ] La tarea Celery de vencimientos funciona al ejecutarla manualmente
- [ ] El flujo de perfil y cambio de contraseña funciona

---

## FASE 9 — Transversales y UX

---

### Task 34: Audit Log admin view — P39

**Descripción:** Implementar la vista de log de auditoría para el ADMIN. `GET /api/v1/reports/audit-log/` retorna el log paginado (50 registros por página) con filtros por usuario, acción, fecha y IP. P39: tabla con columnas fecha, usuario, acción, IP, detalles (expandible); filtros en panel lateral; exportar a Excel.

**Aceptación:**
- [ ] Solo ADMIN puede acceder (403 para otros roles)
- [ ] Los filtros funcionan combinados (usuario + acción + rango de fechas)
- [ ] El detalle JSON se muestra en un modal expandible, bien formateado
- [ ] La exportación Excel incluye todos los registros del filtro actual (no solo la página visible)
- [ ] No hay ningún botón ni opción de borrar registros en la UI

**Verificación:**
- [ ] Manual: filtrar log por "LOGIN_FAILED" → exportar → verificar Excel tiene todos los registros

**Dependencias:** T02, T10

**Archivos:**
- `backend/apps/reports/views.py` (AuditLogView)
- `backend/apps/reports/services.py` (export_audit_log)
- `backend/apps/reports/urls.py`
- `frontend/src/pages/admin/reports/AuditLogPage.tsx`

**Tamaño:** M

---

### Task 35: App layout + navegación global

**Descripción:** Implementar el layout principal de la aplicación: sidebar con navegación adaptada por rol (ADMIN ve sección Admin, TRAINER ve sección Cursos, USUARIO solo ve sus pantallas), header con nombre de usuario + avatar + dropdown de notificaciones + logout, breadcrumbs dinámicos, y el componente base para todas las páginas.

**Aceptación:**
- [ ] El sidebar muestra exactamente las secciones permitidas para cada rol (sin hardcodear: usar `useAuthStore.role`)
- [ ] El sidebar se colapsa en móvil (<768px)
- [ ] Los breadcrumbs se generan automáticamente desde la ruta actual (React Router)
- [ ] El header incluye el badge de notificaciones no leídas (de `notificationsStore`)
- [ ] Al hacer logout desde el header se limpia el store y redirige a `/login`

**Verificación:**
- [ ] Manual: login como ADMIN → sidebar muestra Admin; login como USUARIO → no muestra Admin

**Dependencias:** T31, T07

**Archivos:**
- `frontend/src/components/layout/AppLayout.tsx` (refactor completo)
- `frontend/src/components/layout/Sidebar.tsx`
- `frontend/src/components/layout/Header.tsx`
- `frontend/src/components/layout/Breadcrumbs.tsx`

**Tamaño:** M

---

### Task 36: Error pages — P41, P42, P43, P44

**Descripción:** Implementar las 4 pantallas de error globales con diseño consistente. P41 (404: no encontrada), P42 (403: acceso denegado), P43 (500: error del servidor), P44 (mantenimiento: página estática sin dependencias de la API). La P44 es servida directamente por Nginx como archivo HTML estático para que funcione incluso si Django está caído.

**Aceptación:**
- [ ] P42 se muestra automáticamente cuando el API retorna 403 (manejado en el interceptor Axios)
- [ ] P43 se muestra automáticamente cuando el API retorna 500
- [ ] P44 es un archivo `maintenance.html` en la carpeta de Nginx que no necesita React
- [ ] Todas las páginas tienen un botón "Volver al inicio" que lleva al dashboard del rol

**Verificación:**
- [ ] Manual: acceder a una ruta que no existe → aparece P41
- [ ] Manual: forzar un 500 en el API → aparece P43 con mensaje amigable

**Dependencias:** T06

**Archivos:**
- `frontend/src/pages/errors/NotFoundPage.tsx`
- `frontend/src/pages/errors/ForbiddenPage.tsx`
- `frontend/src/pages/errors/ServerErrorPage.tsx`
- `frontend/src/services/api.ts` (interceptor de errores globales)
- `nginx/maintenance.html`

**Tamaño:** S

---

## FASE 10 — Producción

---

### Task 37: Docker producción + Nginx + variables de entorno

**Descripción:** Crear la configuración de producción completa: `docker-compose.yml` (producción, sin volúmenes de código montados), `backend/Dockerfile` con stage de producción (Gunicorn, `collectstatic`), `frontend/Dockerfile` con build estático de React, configuración de Nginx para servir frontend y hacer proxy al backend, sin exponer puertos del backend directamente.

**Aceptación:**
- [ ] `docker-compose up --build -d` levanta todos los servicios sin errores
- [ ] `GET https://localhost/api/health/` retorna 200 (via Nginx)
- [ ] El frontend de React se sirve en `https://localhost/`
- [ ] Los archivos estáticos y media se sirven correctamente por Nginx (no por Django)
- [ ] Los logs de producción van a stdout/stderr (capturables por Docker logging)
- [ ] El Dockerfile de producción no instala dependencias de desarrollo
- [ ] **Docker healthchecks** en todos los servicios del `docker-compose.yml`: `db` con `pg_isready`, `redis` con `redis-cli ping`, `backend` con `curl -f http://localhost:8000/api/health/`; el servicio `backend` usa `depends_on: db: condition: service_healthy` y `redis: condition: service_healthy`
- [ ] **`backend/entrypoint.sh`**: script de inicio que ejecuta (1) `python manage.py migrate --no-input`, (2) `python manage.py collectstatic --no-input`, (3) arranca Gunicorn. El script usa `set -e` para abortar si cualquier paso falla. Esto garantiza que las migraciones corren **una sola vez y de forma controlada** antes de que el servidor acepte tráfico — no hay race condition entre containers.
- [ ] Nginx configurado con `gzip on` para comprimir respuestas JSON y assets del frontend
- [ ] Nginx tiene `client_max_body_size 25M` para permitir subida de PDFs/PPTs hasta 20 MB (con margen)

**Verificación:**
- [ ] `docker-compose config` sin warnings
- [ ] `docker-compose exec backend python manage.py check --deploy` sin errores críticos

**Dependencias:** T01

**Archivos:**
- `docker-compose.yml`
- `backend/Dockerfile` (multi-stage: dev + prod)
- `frontend/Dockerfile` (multi-stage: build + nginx)
- `nginx/nginx.conf`
- `nginx/maintenance.html`

**Tamaño:** M

---

### Task 38b: Logging estructurado + health check profundo

**Descripción:** Configurar logging estructurado en JSON para Django y Celery. Sin esto, debuggear problemas en producción sin acceso directo al servidor es casi imposible. Extender el endpoint `/api/health/` para verificar activamente la conectividad con PostgreSQL y Redis. Agregar Request IDs a cada request HTTP para poder correlacionar logs de un mismo flujo.

**Aceptación:**
- [ ] `django-structlog` instalado; todos los logs de Django y Celery usan formato JSON en producción
- [ ] Cada log JSON incluye: `timestamp`, `level`, `event`, `request_id` (UUID por request), `user_id` (si autenticado)
- [ ] `GET /api/v1/health/` retorna `{"status": "ok", "db": "ok", "redis": "ok", "celery": "ok"}` o `{"status": "degraded", "db": "error: connection refused"}` si algo falla
- [ ] En desarrollo (`settings/development.py`), los logs son en texto plano legible (no JSON)
- [ ] Los logs de acciones del AuditLog incluyen el `request_id` para trazabilidad completa
- [ ] El health check retorna 200 si todo OK, 503 si algún componente falla (permite que Docker y load balancers detecten el problema)

**Verificación:**
- [ ] `curl http://localhost:8000/api/v1/health/` retorna JSON completo
- [ ] `docker-compose logs backend | python -m json.tool` parsea sin errores (JSON válido)

**Dependencias:** T37, T25

**Archivos:**
- `backend/requirements/base.txt` (django-structlog)
- `backend/config/settings/base.py` (logging config)
- `backend/config/settings/development.py` (override a texto plano)
- `backend/config/urls.py` (health check endpoint actualizado)
- `backend/apps/core/views.py` (HealthCheckView con checks de DB + Redis)

**Tamaño:** S

---

### Task 38: Security hardening — producción

**Descripción:** Configurar todos los requisitos de seguridad de producción en Django: headers de seguridad (HSTS, CSP, X-Frame-Options, X-Content-Type-Options), CORS restringido al dominio del frontend, `DEBUG=False` verificado, `SECURE_SSL_REDIRECT=True`, revisión final de que ninguna ruta expone datos sensibles sin autenticación.

**Aceptación:**
- [ ] `python manage.py check --deploy` retorna 0 errores y 0 warnings críticos
- [ ] `GET /api/v1/users/` sin token retorna 401 (no 200, no lista vacía)
- [ ] La respuesta de `/api/v1/auth/login/` con credenciales incorrectas NO revela si el usuario existe
- [ ] Los headers de seguridad están presentes en todas las respuestas: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`
- [ ] CORS solo acepta el origen del frontend (variable de entorno `FRONTEND_URL`)
- [ ] El endpoint de verificación pública de certificados (P24, Fase 2) es el único accesible sin auth

**Verificación:**
- [ ] Ejecutar checklist de seguridad: `curl -I https://localhost/api/v1/users/` → 401
- [ ] `pytest apps/ -k "security" -v`

**Dependencias:** T37

**Archivos:**
- `backend/config/settings/production.py`
- `backend/config/settings/base.py` (security middleware)
- `nginx/nginx.conf` (headers de seguridad)
- `backend/apps/authentication/tests/test_security.py`

**Tamaño:** S

---

## ✅ CHECKPOINT FINAL — MVP Listo para Producción

**Verificaciones completas:**
- [ ] `docker-compose up --build -d` levanta limpio en el servidor Linux
- [ ] Login → dashboard → tomar curso → examen → resultado funciona end-to-end
- [ ] Admin puede crear curso con IA, revisar propuesta, publicar
- [ ] Carga masiva de usuarios con Excel funciona (probar con 50+ usuarios)
- [ ] AuditLog registra todas las acciones críticas del flujo
- [ ] `python manage.py check --deploy` sin errores
- [ ] `pytest apps/ --cov=apps --cov-report=term` ≥ 80% en módulos críticos

---

## Riesgos y Mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| La API de Anthropic es lenta (>30s) para PDFs grandes | Alto | Celery + Redis separa el procesamiento; el frontend hace polling sin bloquear |
| El servidor PostgreSQL existente tiene configuración de red restrictiva | Medio | Verificar conectividad en T01 antes de continuar; obtener las credenciales y permisos correctos |
| Los diseños de las 44 pantallas tienen inconsistencias con los flujos documentados | Medio | Revisar los mockups durante la implementación de cada pantalla; escalar al cliente si hay conflicto |
| Tamaño de los PDFs/PPTs supera el contexto de Claude (200k tokens) | Medio | T26 implementa truncado a 100k chars; si no es suficiente, procesar por secciones |
| La cuenta de Office 365 tiene restricciones de SMTP externo | Bajo | Configurar email de consola en desarrollo; probar SMTP con credenciales reales antes del Checkpoint A |

---

## Preguntas Abiertas — RESUELTAS (2026-06-08)

- [x] **Grupos de audiencia:** Los grupos son entidades gestionables (no predefinidos). Hay una nueva pantalla de administración de grupos (P45, fuera de las 44 originales). El modelo `Group` es propio del sistema (no los grupos de Django). Se agrega como **T09b** en Fase 3.
- [x] **Orden de módulos:** Los módulos son **secuenciales**. El usuario no puede abrir el módulo N+1 hasta completar el módulo N. El backend valida esto en el endpoint de completado; el frontend deshabilita visualmente los módulos bloqueados.
- [x] **TRAINER y intentos ajenos:** El TRAINER **no puede ver** intentos de examen de otros usuarios en el MVP. Solo en Fase 2 con el módulo de reportes.
- [x] **Reset de intentos:** El ADMIN **puede resetear** manualmente los intentos de examen de un usuario específico. Se agrega endpoint `POST /api/v1/assessments/{id}/users/{user_id}/reset-attempts/` en T22 y acción en P29 (historial usuario) en T12.
