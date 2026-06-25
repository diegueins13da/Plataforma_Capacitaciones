# Reporte de Auditoría UX/QA — LMS Corporativo
**Fecha:** 25 de junio de 2026  
**Auditor:** QA/UX Expert (Claude Sonnet 4.6)  
**Metodología:** Pruebas manuales en navegador real, simulando tres roles distintos  
**Cuentas usadas:**  
- ADMIN: `admin@empresa.com`  
- INSTRUCTOR: `instructor@empresa.com` (Carlos Mendoza)  
- ALUMNO: `laura.sanchez@empresa.com` (Laura Sánchez)

---

## 1. Resumen Ejecutivo

La plataforma LMS Corporativo presenta una **base sólida y funcional** con flujos bien diseñados en creación de cursos y consumo de contenido por alumnos. Se identificaron **18 hallazgos** en total: 2 bugs de alta prioridad, 6 fricciones de UX media-alta, y 10 áreas de mejora menor. Las funcionalidades más maduras son el dashboard del instructor y el lector de módulos del alumno. Las áreas de mayor riesgo son la creación de usuarios (bug silencioso) y la descubribilidad del modo instructor.

| Prioridad | Cantidad | Impacto |
|-----------|----------|---------|
| Alta (bugs / bloqueos) | 2 | Impide flujo completo |
| Media-Alta (UX crítica) | 4 | Genera confusión o abandono |
| Media (mejoras recomendadas) | 6 | Reduce eficiencia |
| Baja (pulido) | 6 | Afecta percepción de calidad |

---

## 2. Hallazgos por Rol

---

### 2.1 ROL: ADMINISTRADOR

#### Fortalezas

- **Gestión de usuarios completa:** tabla con filtros por rol, área, estado; badge "AD" para usuarios LDAP; acciones de edición y desactivación claras.
- **Auditoría/Log de eventos:** registro histórico de acciones con actor, IP, entidad y resultado. Muy valioso para compliance.
- **Configuración centralizada por sección:** SMTP, Branding, Seguridad, Notificaciones y LDAP agrupados lógicamente.
- **Sincronización LDAP:** flujo de sync manual con resumen de resultados (creados, actualizados, omitidos, errores).
- **Protección de cursos publicados:** no se pueden eliminar directamente; deben archivarse primero — previene borrado accidental.

#### Fricciones

**F-A1 — BUG CRÍTICO: Creación de usuario falla silenciosamente en error de validación**  
- **Archivo:** `frontend/src/components/shared/CreateUserModal.tsx`, línea 63  
- **Reproducción:** Intentar crear un usuario con email duplicado. El modal no muestra ningún error — ni en campos ni como toast. El botón vuelve a estar disponible pero no hay feedback.  
- **Causa raíz:** El backend devuelve `{"errors": {"email": [...]}, "status": 400}`. El frontend lee `resp?.data` (el objeto completo) y llama a `setError("errors", ...)` y `setError("status", ...)`, que no son campos del formulario. La rama `else` con `toast.error()` nunca se ejecuta porque `apiErrors` es truthy.  
- **Corrección:** Cambiar línea 63 de `const apiErrors = resp?.data;` a `const apiErrors = resp?.data?.errors;`  
- **Impacto:** El administrador no sabe si el usuario fue creado o no → puede creer que falló y reintentar, o asumir que tuvo éxito cuando en realidad no.

**F-A2 — Sidebar icon-only: nula descubribilidad para usuarios nuevos**  
- El menú lateral muestra únicamente iconos sin etiquetas de texto. Un administrador nuevo no puede saber qué sección corresponde a cada icono sin hacer hover o explorar por prueba y error.  
- **Recomendación:** Agregar etiquetas de texto visibles junto a los iconos, o al menos mostrarlas permanentemente en modo expandido. Los tooltips al hacer hover son insuficientes en desktop.

**F-A3 — Reportes exportables solo en CSV: sin visualización integrada**  
- La sección de Reportes ofrece tablas exportables a CSV (completaciones, inscripciones, calificaciones), pero no muestra ningún gráfico ni KPI resumen dentro de la plataforma.  
- El administrador necesita descargar el CSV y procesarlo en Excel para obtener insights.  
- **Recomendación:** Agregar un dashboard de KPIs globales (cursos más populares, tasa de completación general, alumnos activos por área) con gráficas simples de barras y donuts.

**F-A4 — Inconsistencia de nomenclatura: "Auditoría" vs "Reportes"**  
- El ícono del sidebar lleva el tooltip "Auditoría" pero al navegar, el breadcrumb y el título de la página dicen "Reportes". Son dos secciones distintas pero la navegación no lo deja claro visualmente.  
- **Recomendación:** Usar nombres consistentes: "Auditoría" para el log de eventos y "Reportes" para las exportaciones, con iconos y rutas distintas bien etiquetadas.

**F-A5 — Gestión de usuarios duplicada**  
- Los usuarios aparecen tanto en la sección "Usuarios" del menú principal como dentro de "Configuración". Genera ambigüedad sobre dónde hacer cambios.  
- **Recomendación:** Centralizar en un único punto. La configuración debería acceder a usuarios como enlace, no duplicar la tabla.

**F-A6 — Logo de la empresa requiere URL externa: no permite subida de archivo**  
- En Configuración → Branding, el campo "URL del logo" solo acepta una URL HTTP/S. Un administrador no técnico no sabrá cómo hostear la imagen para obtener una URL pública.  
- **Recomendación:** Agregar un input de tipo `file` para subir imágenes directamente a la plataforma (almacenadas en el servidor o un bucket S3).

**F-A7 — Claves de configuración en inglés técnico**  
- Los campos de configuración se muestran con sus claves internas (`BRANDING_LOGO_URL`, `LDAP_SERVER_URI`, `SMTP_HOST`). Un administrador no técnico no entenderá qué configura cada campo.  
- **Recomendación:** Reemplazar las claves técnicas por etiquetas amigables: "URL del logo corporativo", "Servidor LDAP", "Servidor de correo SMTP".

#### Recomendaciones prioritarias

1. **Inmediato:** Corregir bug F-A1 (`resp?.data?.errors`) — una línea, alto impacto.
2. **Corto plazo:** Agregar etiquetas de texto al sidebar (F-A2) y carga de archivos para logo (F-A6).
3. **Medio plazo:** Dashboard de KPIs en Reportes (F-A3) y labels amigables en Configuración (F-A7).

---

### 2.2 ROL: INSTRUCTOR (CAPACITADOR)

#### Fortalezas

- **Dashboard instructor rico en información:** alertas de cursos próximos a vencer, gráfica de alumnos inscritos por curso, progreso individual color-coded (Completado, ≥50%, Bajo avance, Sin iniciar), nota promedio por curso. Excelente para gestión proactiva.
- **Flujo de creación de cursos en 3 pasos progresivos:** Información → Módulos → Evaluación. Los tabs se desbloquean secuencialmente, auto-guardado en cada paso. UX muy bien pensada.
- **Tipos de contenido completos:** HTML enriquecido, PDF, Video, SCORM — cubre todos los formatos corporativos estándar.
- **Tipos de pregunta:** Selección única, Selección múltiple, Verdadero/Falso con defaults inteligentes (70% aprobación, 3 intentos).
- **Protección de cursos publicados:** cursos publicados solo pueden archivarse (no eliminarse), con tooltip explicativo. Previene pérdida de datos de progreso de alumnos.
- **Contador de módulos en tiempo real:** el tab "Módulos (N)" se actualiza al instante al agregar o eliminar módulos.

#### Fricciones

**F-I1 — BUG UX CRÍTICO: El toggle de modo Instructor/Alumno no es descubrible**  
- Al iniciar sesión, el instructor ve el badge "Alumno" en la barra lateral izquierda. Visualmente parece una etiqueta de estado, no un botón interactivo. No tiene affordance de clic (sin flecha, sin borde, sin cursor pointer visual, sin texto "cambiar").  
- Consecuencia: Un instructor nuevo abre sesión, ve el dashboard de alumno (Mis cursos, Mis certificados) y **no sabe que tiene acceso a la gestión de cursos**. Pierde toda la funcionalidad de instructor.  
- El atributo ARIA tiene el label correcto (`"Cambiar a modo Alumno"`) pero no es visible en pantalla.  
- **Recomendación:** Reemplazar el badge de texto por un **toggle switch** claro con las dos opciones visibles: `[Alumno] / [Instructor]`. Agregar un tooltip o una notificación de onboarding en el primer login que explique el cambio de modo.

**F-I2 — Sin sección dedicada de Calificaciones**  
- No existe una vista centralizada de calificaciones del instructor. Para revisar notas debe ingresar a cada curso individualmente.  
- En el sidebar modo instructor: Dashboard, Mis cursos creados, Notificaciones — sin sección de Calificaciones.  
- **Recomendación:** Agregar una página `/instructor/grades` que muestre una tabla de todas las evaluaciones de todos sus cursos, filtrable por curso, alumno y fecha.

**F-I3 — Formulario "Nueva pregunta": UX de respuesta correcta ambigua**  
- En el banco de preguntas, para indicar cuál opción es la respuesta correcta se usa el mismo radio button que sirve para "seleccionar opción". El instructivo dice "Opciones (selecciona la correcta)" pero visualmente los radio buttons se parecen a los que usan los alumnos al responder.  
- **Recomendación:** Distinguir la interfaz de creación de la de consumo. Por ejemplo, usar un ícono de estrella o trofeo junto a la opción correcta, o un checkbox con etiqueta explícita "Marcar como correcta".

**F-I4 — Sin buscador ni ordenamiento en la lista de cursos**  
- Con 5+ cursos visibles y sin filtro de búsqueda, el instructor debe hacer scroll para encontrar un curso específico. La tabla tiene filtros de estado y área pero no permite ordenar por nombre o fecha.  
- **Recomendación:** Agregar campo de búsqueda por nombre y ordenamiento por columna (clic en encabezado).

#### Recomendaciones prioritarias

1. **Inmediato:** Rediseñar el toggle modo Instructor/Alumno (F-I1) — impacto crítico en descubribilidad de la plataforma.
2. **Corto plazo:** Agregar página de Calificaciones centralizada (F-I2).
3. **Medio plazo:** Mejorar UX del formulario de preguntas (F-I3) y agregar búsqueda en lista de cursos (F-I4).

---

### 2.3 ROL: ALUMNO (USUARIO)

#### Fortalezas

- **Dashboard con "Próximos vencimientos":** lista de cursos ordenados por urgencia (7 días, 53 días, 83 días), cada uno con link directo. Feature de alto valor para cumplimiento de capacitaciones obligatorias.
- **Catálogo de cursos en tarjetas:** cards con barra de progreso, badge de urgencia, área, instructor, número de módulos y duración. Información suficiente para tomar decisiones.
- **Filtros de cursos funcionales:** Todos / En progreso / Completados / Vencidos — permite priorizar sin overhead cognitivo.
- **Lector de módulos con panel de navegación lateral:** muestra progreso del curso, lista de módulos con estado (completado/bloqueado/activo) y permite volver al curso. UX clara y bien estructurada.
- **Desbloqueo secuencial de módulos:** módulos y evaluación final se desbloquean al completar los anteriores. Garantiza progresión pedagógica.
- **Timer de lectura automático:** el módulo se marca como completado tras el tiempo estimado de lectura del contenido. Reduce fricción: el alumno no necesita presionar un botón "Completar".
- **Perfil con cambio de contraseña:** el alumno puede actualizar su nombre, cargo y contraseña desde su perfil sin asistencia del administrador.

#### Fricciones

**F-AL1 — BUG: Porcentaje de progreso incorrecto antes de completar el primer módulo**  
- Al entrar al curso "Gestión del Tiempo y Productividad Personal", la página mostraba "0/2 módulos completados · 50%". Si 0 módulos están completados, el porcentaje debería ser 0%, no 50%.  
- Probablemente el porcentaje se calcula sobre contenido visitado (parcial), mientras que el contador "X/N módulos" solo cuenta módulos 100% completados. Esta divergencia confunde al alumno sobre su progreso real.  
- **Recomendación:** Unificar el criterio de cálculo o mostrar dos indicadores explícitos: "Módulos completados: 0/2" y "Contenido revisado: 50%".

**F-AL2 — Inconsistencia en el formato del tiempo restante en tarjetas de cursos**  
- Las tarjetas del catálogo usan formatos distintos para la misma información:  
  - "Vence en 7 días" (cuenta regresiva urgente)  
  - "83 días restantes" (cuenta regresiva lejana)  
- Mismo dato, distinta redacción y posición visual en la tarjeta. Genera inconsistencia de diseño.  
- **Recomendación:** Unificar a un único formato: `"Vence en N días"` con color-coding semántico (rojo ≤7d, naranja ≤30d, verde >30d).

**F-AL3 — Breadcrumb incompleto en el lector de módulos**  
- Al estar dentro de un módulo, el breadcrumb superior muestra `"Cursos / modules"` en lugar de la ruta completa: `"Cursos / Gestión del Tiempo... / Módulo 1"`.  
- El usuario pierde el contexto de dónde está dentro de la jerarquía del curso.  
- **Recomendación:** Construir el breadcrumb dinámicamente: `Cursos > [Nombre del curso] > [Nombre del módulo]`.

**F-AL4 — Tarjetas sin portada muestran ícono genérico**  
- Los cursos sin imagen de portada configurada muestran un ícono de libro azul genérico. Con múltiples cursos en pantalla, esto crea un catálogo visualmente desordenado.  
- **Recomendación:** Implementar portadas generadas automáticamente (por ejemplo, fondo degradado con las iniciales del curso y el color del área) cuando no se suba una imagen.

**F-AL5 — Sin buscador en el catálogo de cursos**  
- Un alumno con 8+ cursos asignados no puede buscar por nombre. Solo puede filtrar por estado (en progreso/completado/vencido) o hacer scroll.  
- **Recomendación:** Agregar campo de búsqueda por nombre del curso en la parte superior del catálogo.

**F-AL6 — Perfil: sin foto de avatar, sin visibilidad de contraseña, sin medidor de fortaleza**  
- El perfil no permite subir foto — el avatar es un círculo con las iniciales del usuario.  
- Los campos de cambio de contraseña no tienen toggle "mostrar/ocultar".  
- No hay indicador de fortaleza de contraseña al escribir la nueva.  
- **Recomendación:** Agregar toggle de visibilidad (ojo) en campos de contraseña y un medidor de fortaleza visual (barra roja/naranja/verde).

#### Recomendaciones prioritarias

1. **Corto plazo:** Corregir inconsistencia de progreso F-AL1 y breadcrumb F-AL3 (ambos bugs de datos/navegación).
2. **Corto plazo:** Unificar formato de fechas F-AL2 y agregar buscador en catálogo F-AL5.
3. **Medio plazo:** Portadas automáticas F-AL4 y mejoras de seguridad en perfil F-AL6.

---

## 3. Evaluación de Dashboards y Reportes

### Dashboard Administrador

| Aspecto | Evaluación | Nota |
|---------|-----------|------|
| KPIs globales | ❌ Ausente | No existe un panel de métricas de la plataforma |
| Gestión de usuarios | ✅ Completa | Tabla con filtros, badge LDAP, acciones inline |
| Gestión de cursos | ✅ Completa | Tabla con filtros de estado y área |
| Auditoría | ✅ Funcional | Log detallado de eventos |
| Reportes exportables | ⚠️ Parcial | CSV disponible, sin visualización integrada |
| Configuración | ⚠️ Mejorable | Claves técnicas, sin upload de archivos |

**Gap principal:** El admin no tiene un dashboard de inicio con métricas globales (alumnos activos, tasa de completación, cursos publicados, logins recientes). Debe navegar sección por sección para construir ese panorama mentalmente.

### Dashboard Instructor

| Aspecto | Evaluación | Nota |
|---------|-----------|------|
| KPIs de sus cursos | ✅ Excelente | Alumnos activos, tasa completación, progreso promedio, Nº cursos |
| Alertas de vencimiento | ✅ Excelente | Identifica cursos por vencer con alumnos aún en progreso |
| Progreso individual | ✅ Excelente | Color-coded por alumno (Completado / ≥50% / Bajo avance / Sin iniciar) |
| Nota promedio por curso | ✅ Bueno | Gráfica de barras comparativa |
| Alumnos inscritos por curso | ✅ Bueno | Visualización directa |
| Calificaciones globales | ❌ Ausente | Sin página dedicada de notas cross-curso |

**Valoración:** El dashboard instructor es el componente más maduro de la plataforma. La información presentada es accionable y priorizable. Pendiente solo la vista de calificaciones centralizada.

### Dashboard Alumno

| Aspecto | Evaluación | Nota |
|---------|-----------|------|
| KPIs personales | ✅ Excelente | En progreso, Completados, % Completación, Vencidos |
| Progreso por curso | ✅ Bueno | Gráfica de barras horizontal por curso |
| Estado general | ✅ Bueno | Donut chart total |
| Próximos vencimientos | ✅ Excelente | Lista con countdown clickable |
| Historial de notas | ❌ Ausente | No hay vista de calificaciones del alumno |
| Certificados obtenidos | ✅ Presente | Sección dedicada en sidebar (/my-certificates) |

**Gap principal:** El alumno no puede ver sus notas históricas de evaluaciones desde el dashboard ni desde su perfil. Solo ve el estado de progreso por curso.

### Reportes (Admin)

La funcionalidad de exportación es correcta y cubre los casos principales (inscripciones, completaciones, calificaciones). El gap es la ausencia de visualización integrada. Un administrador que quiera responder "¿cuál es la tasa de completación del último trimestre?" necesita descargar, abrir Excel, y calcular manualmente.

**Recomendación de roadmap para Reportes:**
1. **V1 (actual):** Exportación CSV ✅
2. **V2 (propuesta):** Dashboard con 4-6 KPIs visuales: tasa global, cursos más completados, áreas más activas, alumnos en riesgo (bajo avance + próximo vencimiento)
3. **V3 (futuro):** Filtros por rango de fechas, por área, por grupo de usuarios

---

## 4. Tabla Consolidada de Hallazgos

| ID | Rol | Tipo | Prioridad | Descripción breve |
|----|-----|------|-----------|-------------------|
| F-A1 | Admin | Bug | Alta | Modal creación usuario: error 400 silencioso |
| F-A2 | Admin | UX | Media-Alta | Sidebar sin etiquetas de texto |
| F-A3 | Admin | Feature | Media | Reportes sin visualización integrada |
| F-A4 | Admin | UX | Baja | "Auditoría" vs "Reportes" — nombrado inconsistente |
| F-A5 | Admin | UX | Baja | Usuarios duplicados en menú principal y Config |
| F-A6 | Admin | UX | Media | Logo: URL externa requerida, sin upload de archivo |
| F-A7 | Admin | UX | Media | Claves de config en inglés técnico |
| F-I1 | Instructor | UX | Alta | Toggle modo Instructor/Alumno: no descubrible |
| F-I2 | Instructor | Feature | Media-Alta | Sin página dedicada de calificaciones |
| F-I3 | Instructor | UX | Baja | UI de "respuesta correcta" en preguntas: ambigua |
| F-I4 | Instructor | UX | Baja | Sin búsqueda en lista de cursos del instructor |
| F-AL1 | Alumno | Bug | Media-Alta | Porcentaje progreso inconsistente (0/2 módulos · 50%) |
| F-AL2 | Alumno | UX | Media | Formato de fechas inconsistente en tarjetas |
| F-AL3 | Alumno | UX | Media | Breadcrumb incompleto en lector de módulos |
| F-AL4 | Alumno | UX | Baja | Cursos sin portada: ícono genérico |
| F-AL5 | Alumno | Feature | Media | Sin buscador en catálogo de cursos |
| F-AL6 | Alumno | UX | Baja | Perfil: sin toggle contraseña, sin medidor fortaleza |
| — | Admin | Gap | Media | Sin dashboard de KPIs globales para admin |

---

## 5. Roadmap de Mejoras Sugerido

### Sprint inmediato (1-2 días)
- [ ] **F-A1** — Fix `resp?.data?.errors` en `CreateUserModal.tsx:63`
- [ ] **F-I1** — Rediseño visual del toggle modo Instructor (switch con dos estados visibles)

### Corto plazo (1-2 semanas)
- [ ] **F-AL1** — Unificar criterio de cálculo de % progreso
- [ ] **F-AL3** — Breadcrumb dinámico en lector de módulos
- [ ] **F-AL2** — Unificar formato de fechas con color-coding semántico
- [ ] **F-A2** — Etiquetas de texto en sidebar (o modo expandible)
- [ ] **F-A6** — Input de subida de archivos para logo

### Medio plazo (1 mes)
- [ ] **F-I2** — Página `/instructor/grades` con tabla cross-curso
- [ ] **F-A3** — Dashboard de KPIs con 4-6 métricas clave
- [ ] **F-AL5** — Buscador en catálogo de cursos del alumno
- [ ] **F-A7** — Labels amigables en Configuración
- [ ] **F-AL6** — Toggle visibilidad contraseña + medidor de fortaleza

### Backlog (iteración futura)
- [ ] **F-AL4** — Portadas automáticas para cursos sin imagen
- [ ] **F-I3** — Rediseño UX del formulario de preguntas
- [ ] **F-I4** — Ordenamiento por columna en tabla de cursos
- [ ] **F-A5** — Consolidar gestión de usuarios en un único punto
- [ ] Historial de calificaciones para el alumno en su perfil/dashboard

---

*Reporte generado automáticamente mediante auditoría QA/UX con navegación real en las tres cuentas de prueba. Todos los hallazgos fueron reproducidos y verificados en el entorno de desarrollo (`http://localhost:3001`).*
