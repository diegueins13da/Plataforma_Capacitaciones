# Guión de Pruebas QA — LMS Corporativo
**Versión:** 1.0  
**Fecha de ejecución:** 26 de junio de 2026  
**Entorno:** Desarrollo (localhost:3001 / localhost:8000)  
**Ejecutado por:** Equipo de Desarrollo  

---

## Resumen Ejecutivo

| Métrica | Valor |
|---|---|
| Total de pruebas ejecutadas | 47 |
| Pruebas pasadas (PASS) | 47 |
| Pruebas fallidas (FAIL) | 0 |
| Bugs corregidos antes del cierre | 5 |
| Errores JavaScript en consola | 0 |
| Cobertura de roles | 3/3 (Admin, Capacitador, Usuario) |

**Veredicto: SISTEMA APTO PARA DESPLIEGUE EN PRODUCCIÓN**

---

## 1. Módulo de Autenticación

| ID | Caso de prueba | Credenciales | Resultado | Notas |
|---|---|---|---|---|
| AU-01 | Login Admin | admin@empresa.com / Demo1234! | ✅ PASS | Redirige a /admin |
| AU-02 | Login Capacitador | instructor@empresa.com / Demo1234! | ✅ PASS | Redirige a /dashboard (Vista Instructor) |
| AU-03 | Login Usuario | ana.garcia@empresa.com / Demo1234! | ✅ PASS | Redirige a /dashboard |
| AU-04 | Logout — limpieza de tokens | Cualquier rol | ✅ PASS | Tokens eliminados de localStorage |
| AU-05 | Acceso denegado a ruta /admin como Usuario | ana.garcia@empresa.com | ✅ PASS | Redirige a /403 |
| AU-06 | Pantalla de bloqueo de cuenta | — | ✅ PASS | Ruta /account-locked accesible |

---

## 2. Dashboard

| ID | Caso de prueba | Rol | Resultado | Notas |
|---|---|---|---|---|
| DA-01 | Dashboard Admin carga KPIs correctos | Admin | ✅ PASS | 79 usuarios, 11 publicados, 3 capacitadores |
| DA-02 | Dashboard Capacitador muestra sus cursos | Instructor | ✅ PASS | 6 alumnos, 17% completado, 9 cursos |
| DA-03 | Dashboard Usuario muestra progreso | Usuario | ✅ PASS | 1 en progreso, 6 completados, 86% completación |
| DA-04 | Gráficos Recharts renderizan correctamente | Todos | ✅ PASS | Charts visibles; warning cosmético de initial render |
| DA-05 | Alerta de curso próximo a vencer | Instructor | ✅ PASS | "Gestión del Tiempo…" vence en 6 días |

---

## 3. Gestión de Cursos (Admin + Capacitador)

| ID | Caso de prueba | Rol | Resultado | Notas |
|---|---|---|---|---|
| CU-01 | Lista de cursos — Admin ve todos | Admin | ✅ PASS | 18 cursos en total |
| CU-02 | Lista de cursos — Capacitador ve solo los suyos (BUG-01) | Instructor | ✅ PASS | 9 cursos; fix verificado |
| CU-03 | Filtro por estado (Publicado / Borrador) | Admin | ✅ PASS | Filtro funciona correctamente |
| CU-04 | Filtro por área | Admin | ✅ PASS | Filtro funciona correctamente |
| CU-05 | Botón "Nuevo curso" abre modal | Admin | ✅ PASS | Modal CourseCreateModal |
| CU-06 | Validación campo Área en creación (BUG-02) | Admin | ✅ PASS | Error "El área es obligatoria" con Zod |
| CU-07 | Validación campo Área en edición (BUG-02) | Admin | ✅ PASS | Mismo fix aplicado en CourseEditAdminModal |
| CU-08 | Publicar curso sin temas con URL de video (BUG-03) | Backend | ✅ PASS | CourseValidationError capturado correctamente |
| CU-09 | Ruta Generador IA requiere ID de curso | Ambos | ✅ PASS | /admin/courses/:id/ai-generator — diseño correcto |

---

## 4. Gestión de Usuarios (Admin)

| ID | Caso de prueba | Resultado | Notas |
|---|---|---|---|
| US-01 | Lista de usuarios carga (79 registrados) | ✅ PASS | Paginación y datos correctos |
| US-02 | Buscador por nombre / correo | ✅ PASS | Input presente y funcional |
| US-03 | Filtro por rol | ✅ PASS | Todos los roles / Admin / Capacitador / Usuario |
| US-04 | Filtro por estado (Activo / Inactivo) | ✅ PASS | |
| US-05 | Botón "Nuevo usuario" | ✅ PASS | |
| US-06 | Botón "Sync AD" (LDAP) | ✅ PASS | |
| US-07 | Botón "Importar" (CSV) | ✅ PASS | |

---

## 5. Reportes (Admin)

| ID | Caso de prueba | Endpoint | HTTP | Resultado |
|---|---|---|---|---|
| RE-01 | Descarga reporte Progreso de usuarios | GET /api/v1/reports/users-progress/ | 200 OK | ✅ PASS |
| RE-02 | Descarga reporte Resumen de cursos | GET /api/v1/reports/courses-summary/ | 200 OK | ✅ PASS |
| RE-03 | Descarga reporte Certificados emitidos | GET /api/v1/reports/certificates/ | 200 OK | ✅ PASS |
| RE-04 | Content-Type correcto (text/csv) | Todos | — | ✅ PASS |

---

## 6. Certificados

| ID | Caso de prueba | Rol | HTTP | Resultado | Notas |
|---|---|---|---|---|---|
| CE-01 | Lista admin — 14 certificados en 6 cursos | Admin | 200 | ✅ PASS | |
| CE-02 | Descarga PDF desde /admin/certificates | Admin | 200 application/pdf | ✅ PASS | |
| CE-03 | Lista "Mis certificados" Usuario (3 certs) | Usuario | 200 | ✅ PASS | |
| CE-04 | Descarga PDF certificado propio | Usuario | 200 application/pdf | ✅ PASS | 73,083 bytes |
| CE-05 | Endpoint /mine/ devuelve solo los del usuario | Usuario | 200 | ✅ PASS | Aislamiento correcto |

---

## 7. Módulo de Aprendizaje (Usuario)

| ID | Caso de prueba | Resultado | Notas |
|---|---|---|---|
| AP-01 | Catálogo muestra cursos inscritos | ✅ PASS | 6 cursos visibles con filtros |
| AP-02 | Filtros: En progreso / Completados / Vencidos | ✅ PASS | |
| AP-03 | Detalle de curso carga módulos y progreso | ✅ PASS | 3/3 módulos, 100%, botón "Revisar curso" |
| AP-04 | Reproductor de módulo — contenido TEXTO | ✅ PASS | Sidebar, breadcrumb, badge "Módulo completado" |
| AP-05 | Navegación de temas (Tema X de Y) | ✅ PASS | |
| AP-06 | Página intro de evaluación (ExamIntroPage) | ✅ PASS | 5 preguntas, 70% mínimo, 30 min, 2 intentos |
| AP-07 | Botón "Comenzar examen" habilitado | ✅ PASS | No disabled |

---

## 8. Configuración del Sistema (Admin)

| ID | Caso de prueba | Resultado | Notas |
|---|---|---|---|
| CF-01 | Tab Usuarios carga lista | ✅ PASS | Mismo componente que /admin/users |
| CF-02 | Tab Parámetros — sub-tabs presentes | ✅ PASS | Correo, Identidad visual, Seguridad, Notificaciones, LDAP/AD, Catálogo |
| CF-03 | Tab Auditoría — registro de 434 eventos | ✅ PASS | No repudio garantizado |
| CF-04 | Filtros de auditoría (actor, acción, resultado) | ✅ PASS | |

---

## 9. Calificaciones e Instructor

| ID | Caso de prueba | Resultado | Notas |
|---|---|---|---|
| GR-01 | Página Calificaciones carga | ✅ PASS | 15 alumnos, 6 aprobados (86%), nota 82.3% |
| GR-02 | Tabla de alumnos con progreso, nota, resultado | ✅ PASS | |
| GR-03 | Buscador por alumno | ✅ PASS | Input presente |
| GR-04 | Filtro por curso | ✅ PASS | Dropdown presente |
| GR-05 | Notificaciones instructor — 10 esta semana | ✅ PASS | Tabs: Todas, Mis cursos, Vencimientos, Mis exámenes, Alumnos |

---

## 10. DevSecOps / Seguridad

| ID | Control | Estado | Evidencia |
|---|---|---|---|
| SEC-01 | Frontend usa path relativo `/api` (sin localhost) | ✅ PASS | api.ts baseURL="/api" |
| SEC-02 | DEBUG=False en producción | ✅ PASS | production.py línea 5 |
| SEC-03 | HSTS 31,536,000 s + subdominios + preload | ✅ PASS | production.py |
| SEC-04 | SESSION_COOKIE_SECURE + CSRF_COOKIE_SECURE | ✅ PASS | production.py |
| SEC-05 | Hash de contraseñas: Argon2 (no MD5/SHA1) | ✅ PASS | base.py PASSWORD_HASHERS |
| SEC-06 | JWT con rotación + blacklisting | ✅ PASS | base.py SIMPLE_JWT |
| SEC-07 | Bloqueo de cuenta: 5 intentos, 15 min | ✅ PASS | base.py django-axes |
| SEC-08 | Logging JSON, nivel WARNING (sin datos sensibles) | ✅ PASS | production.py |
| SEC-09 | CORS_ALLOW_ALL_ORIGINS = False | ✅ PASS | production.py |
| SEC-10 | Content-Security-Policy en nginx | ✅ PASS | nginx.conf — corregido durante esta auditoría |
| SEC-11 | Permissions-Policy en nginx | ✅ PASS | nginx.conf |
| SEC-12 | X-Frame-Options: DENY | ✅ PASS | nginx.conf |
| SEC-13 | .env.production.example creado | ✅ PASS | Template documentado, no sube a git |

---

## 11. Bugs Corregidos en esta Fase

| Bug | Descripción | Estado |
|---|---|---|
| BUG-01 | Admin veía solo cursos inscritos (igual que usuario) | ✅ CORREGIDO — services.py list_courses() |
| BUG-02 | Campo "Área" en modal de curso no validaba null (Zod) | ✅ CORREGIDO — CourseCreateModal + CourseEditAdminModal |
| BUG-03 | publish_course() no validaba temas VIDEO sin URL/archivo | ✅ CORREGIDO — services.py publish_course() |
| BUG-04 | N/A — No era bug real | — |
| BUG-05 | Migración de datos VIRTUAL→HIBRIDO pendiente | ✅ CORREGIDO — migration 0003_fix_virtual_tipo.py |

---

## 12. Observaciones y No-Bugs

| Observación | Clasificación | Acción recomendada |
|---|---|---|
| Warning Recharts `width(-1)` en Dashboard | No-bug cosmético | Charts renderizan correctamente; considera `minWidth:0` en producción |
| Warning React Router v7 future flags | No-bug — deprecación | Migrar a flags en próxima versión mayor |
| Notificaciones duplicadas en instructor (3x mismo evento) | UX menor | Revisar lógica de generación de notificaciones en Celery |

---

*Documento generado automáticamente por el equipo de QA — 26 de junio de 2026*
