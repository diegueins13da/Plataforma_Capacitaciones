# Manual de Usuario — LMS Corporativo
**Cooperativa de Ahorro y Crédito Acción Tungurahua Ltda.**  
**Versión:** 1.0 | **Fecha:** Junio 2026  

---

## Introducción

El **LMS Corporativo** es la plataforma de capacitación en línea de Acción Tungurahua. Permite a los empleados acceder a cursos, completar evaluaciones y obtener certificados de manera digital, desde cualquier dispositivo con acceso a internet.

La plataforma tiene tres roles:

| Rol | Descripción | Acceso |
|---|---|---|
| **Administrador** | Gestiona usuarios, cursos, reportes y configuración del sistema | Panel completo |
| **Capacitador** | Crea y gestiona sus propios cursos, revisa calificaciones | Panel de instructor |
| **Usuario** | Toma cursos, rinde evaluaciones, descarga certificados | Portal de aprendizaje |

---

## Parte 1: Acceso al Sistema

### 1.1 Iniciar Sesión

1. Abrir el navegador e ingresar la URL del sistema: `https://[dominio-de-la-cooperativa]`
2. Ingresar el **correo electrónico** institucional
3. Ingresar la **contraseña**
4. Hacer clic en **Ingresar**

> [CAPTURA: Pantalla de login con campos de correo y contraseña]

El sistema detecta automáticamente el rol asignado y redirige al panel correspondiente.

**Credenciales olvidadas:**  
Hacer clic en **¿Olvidaste tu contraseña?** e ingresar el correo institucional para recibir un enlace de recuperación.

### 1.2 Cerrar Sesión

En el menú lateral izquierdo, hacer clic en **Salir** (ícono de salida, parte inferior).

---

## Parte 2: Guía para el Usuario (Empleado)

### 2.1 Dashboard — Vista General

Al ingresar, el usuario ve su panel de inicio con:
- **En progreso:** Cursos iniciados pero no completados
- **Completados:** Cursos finalizados exitosamente
- **Completación:** Porcentaje de avance general
- **Vencidos:** Cursos con fecha límite pasada

> [CAPTURA: Dashboard del usuario con KPIs y gráfico de progreso]

### 2.2 Catálogo de Cursos

1. Hacer clic en **Mis cursos** (ícono de libro en el menú lateral)
2. Ver todos los cursos asignados con su estado actual

> [CAPTURA: Catálogo mostrando tarjetas de cursos con estados]

**Filtros disponibles:**
- **Todos:** Todos los cursos asignados
- **En progreso:** Cursos iniciados
- **Completados:** Cursos terminados con éxito
- **Vencidos:** Cursos con fecha límite expirada

**Búsqueda:** Escribir el nombre del curso en la barra superior.

### 2.3 Acceder a un Curso

1. Hacer clic sobre la tarjeta del curso
2. Ver el detalle con:
   - Descripción y objetivos
   - Módulos y temas
   - Fecha límite (si aplica)
   - Progreso actual

> [CAPTURA: Detalle del curso con lista de módulos y barra de progreso]

3. Hacer clic en **Continuar curso** (o **Comenzar** si es la primera vez)

### 2.4 Reproducir un Módulo

Dentro del reproductor de módulos:

> [CAPTURA: Reproductor de módulos con sidebar y contenido]

- **Panel izquierdo:** Lista de módulos y temas — el tema activo aparece resaltado
- **Panel derecho:** Contenido del tema (texto, video, PDF, imagen o recurso externo)
- Navegar entre temas con los botones **Anterior** y **Siguiente**
- El progreso se guarda automáticamente al completar cada tema

**Tipos de contenido:**
| Tipo | Descripción |
|---|---|
| Texto | Contenido explicativo con formato enriquecido |
| Video | Reproductor integrado (enlace o archivo subido) |
| PDF | Visor de diapositivas con navegación |
| Imagen | Visualizador de imágenes |
| Recurso externo | Contenido embebido en iframe |

### 2.5 Rendir una Evaluación

Al completar todos los módulos, el curso habilita la evaluación final.

1. En el detalle del curso, hacer clic en **Ir a evaluación**
2. Leer las instrucciones: número de preguntas, nota mínima, tiempo límite e intentos disponibles

> [CAPTURA: Pantalla de introducción al examen]

3. Hacer clic en **Comenzar examen**
4. Responder cada pregunta (se puede navegar entre ellas)
5. Las respuestas se guardan automáticamente cada 30 segundos
6. Al terminar, hacer clic en **Enviar examen**

> [CAPTURA: Pregunta de examen con opciones múltiples]

**Resultado:**
- Si la nota supera el mínimo: **Aprobado** → el certificado se genera automáticamente
- Si la nota no supera el mínimo: **Reprobado** → intentar de nuevo si quedan intentos

> [CAPTURA: Pantalla de resultado del examen]

### 2.6 Descargar Certificado

1. Hacer clic en **Mis certific...** en el menú lateral (ícono de diploma)
2. Ver todos los certificados obtenidos

> [CAPTURA: Página "Mis certificados" con lista y botones de descarga]

3. Hacer clic en **Descargar PDF** junto al certificado deseado
4. El PDF se descarga automáticamente al dispositivo

Cada certificado incluye:
- Nombre del participante
- Nombre del curso
- Fecha de emisión
- Horas de capacitación
- Nota obtenida
- Código QR de verificación
- Firma del instructor y del sistema

### 2.7 Perfil de Usuario

1. Hacer clic en el avatar en la esquina inferior izquierda
2. Seleccionar **Mi perfil**
3. Ver y editar **Nombre completo** y **Cargo**

> [CAPTURA: Página de perfil con información personal]

---

## Parte 3: Guía para el Capacitador

### 3.1 Dashboard del Instructor

Al ingresar, el capacitador ve:
- **Alumnos activos:** Total de alumnos en sus cursos
- **Tasa de completado:** Porcentaje de alumnos que finalizaron al menos un curso
- **Progreso promedio:** Avance general de todos los alumnos
- **Mis cursos:** Total de cursos creados (publicados y en borrador)

> [CAPTURA: Dashboard del instructor con KPIs y lista de cursos]

Las alertas de vencimiento aparecen en la parte superior cuando algún alumno aún está en progreso y el curso vence pronto.

### 3.2 Gestionar Cursos

1. Hacer clic en **Mis cur...** en el menú lateral
2. Ver la lista de cursos propios con estado, área, módulos y fecha límite

> [CAPTURA: Lista de cursos del instructor con columnas de estado]

**Acciones disponibles por curso:**
| Ícono | Acción |
|---|---|
| Verde (lápiz) | Editar información del curso |
| Azul (módulos) | Gestionar módulos y temas |
| Amarillo (evaluación) | Configurar evaluación |

### 3.3 Crear un Nuevo Curso

1. Hacer clic en **Nuevo curso** (botón azul, parte superior derecha)
2. Completar el asistente de 3 pasos:

**Paso 1 — Información básica:**
- Nombre del curso (obligatorio)
- Descripción
- Área (obligatorio)
- Tipo: Presencial / Online / Híbrido
- Fecha límite (opcional)
- Duración en horas
- Imagen de portada

> [CAPTURA: Paso 1 del asistente de creación de curso]

**Paso 2 — Módulos y temas:**
- Agregar módulos con el botón **+ Módulo**
- Dentro de cada módulo, agregar temas con **+ Tema**
- Para cada tema, seleccionar el tipo de contenido y cargar el material

> [CAPTURA: Paso 2 con módulos y temas agregados]

**Paso 3 — Evaluación (opcional):**
- Activar evaluación y configurar parámetros
- Agregar preguntas de opción múltiple con el asistente

3. Hacer clic en **Guardar borrador** o **Publicar**

> **Nota:** Para publicar un curso, todos los módulos deben tener al menos un tema. Los temas de tipo Video deben tener URL o archivo cargado.

### 3.4 Generador de Contenido con IA

Para cursos en borrador, está disponible el asistente de IA:

1. Desde la lista de cursos, abrir el curso deseado
2. Hacer clic en el ícono de IA (varita mágica)
3. Describir el objetivo del curso y el público objetivo
4. La IA genera una estructura de módulos y contenido de temas
5. Revisar y ajustar según las necesidades
6. Aceptar para agregar el contenido generado al curso

> [CAPTURA: Interfaz del generador IA con resultado de contenido propuesto]

### 3.5 Revisar Calificaciones

1. Hacer clic en **Calific...** en el menú lateral
2. Ver el resumen global:
   - Total de alumnos
   - Aprobados y porcentaje
   - Nota promedio

> [CAPTURA: Página de calificaciones con tabla de alumnos]

3. Filtrar por alumno (barra de búsqueda) o por curso (dropdown)
4. Cada fila muestra: alumno, curso, progreso, estado, nota, resultado

---

## Parte 4: Guía para el Administrador

### 4.1 Dashboard Administrativo

El panel del administrador muestra KPIs globales del sistema:
- Total usuarios / Usuarios activos
- Cursos publicados
- Número de capacitadores
- Gráfico de completación por área

> [CAPTURA: Dashboard admin con KPIs y gráfico de barras]

### 4.2 Gestión de Usuarios

Ruta: **Menú lateral → Usuarios** (ícono de personas)

> [CAPTURA: Lista de usuarios con columnas: nombre, área/cargo, rol, estado]

**Crear usuario manual:**
1. Clic en **Nuevo usuario**
2. Completar nombre, correo, rol, área y cargo
3. El sistema envía correo de bienvenida con contraseña temporal

**Modificar usuario:**
- Clic en ícono de lápiz para editar información
- Clic en ícono de rol para cambiar el rol asignado
- Clic en ícono de estado para activar/desactivar

**Importar desde Active Directory:**
- Clic en **Sync AD** para sincronizar con el directorio LDAP corporativo
- Los usuarios se crean automáticamente con sus datos del directorio

**Importación masiva CSV:**
- Clic en **Importar**
- Descargar la plantilla de ejemplo
- Llenar con los datos de los usuarios
- Subir el archivo CSV

### 4.3 Gestión de Cursos (Vista Admin)

El administrador ve **todos los cursos** del sistema (18 en total en el ejemplo), no solo los propios.  
Las mismas funciones de creación y edición del Capacitador están disponibles.

### 4.4 Reportes

Ruta: **Menú lateral → Reportes**

> [CAPTURA: Página de reportes con 3 tarjetas de descarga]

Tres reportes descargables en formato CSV:

| Reporte | Contenido |
|---|---|
| **Progreso de usuarios** | Todos los usuarios activos: cursos inscritos, completados y % de avance |
| **Resumen de cursos** | Por curso: inscritos, tasa de finalización, nota promedio |
| **Certificados emitidos** | Registro completo: usuario, curso, fecha, calificación |

Para descargar: Clic en **Descargar** bajo el reporte deseado.

### 4.5 Certificados (Vista Admin)

Ruta: **Menú lateral → Certificados**

Ver todos los certificados emitidos agrupados por curso.  
Expandir un curso para ver los participantes certificados.  
Descargar cualquier certificado en PDF.

> [CAPTURA: Lista de certificados agrupados por curso]

### 4.6 Configuración del Sistema

Ruta: **Menú lateral → Config...**

**Tab Usuarios:** Mismo módulo de gestión de usuarios  

**Tab Parámetros generales:**

| Sub-sección | Configuración |
|---|---|
| Correo electrónico | Servidor SMTP, remitente por defecto |
| Identidad visual | Logo, nombre de la empresa, colores de certificados |
| Seguridad | Intentos de login, tiempo de bloqueo, políticas de contraseña |
| Notificaciones | Plantillas de correo por evento |
| LDAP / AD | Conexión con Active Directory corporativo |
| Catálogo | Áreas y grupos de usuarios |

> [CAPTURA: Parámetros generales — sub-tab de Identidad visual]

**Tab Auditoría:**

Registro inmutable de todos los eventos del sistema:
- Fecha y hora exacta
- Actor (usuario que realizó la acción)
- Acción realizada
- Entidad afectada
- Resultado (OK / Error)

> [CAPTURA: Registro de auditoría con filtros y tabla de eventos]

Filtros disponibles: Actor (correo), Tipo de acción, Resultado, Entidad.

---

## Parte 5: Cambio de Tema Visual

En la parte inferior del menú lateral:
- **Oscuro** — Activa el modo oscuro (fondo oscuro, ideal para uso nocturno)
- El ícono de luna/sol en la barra superior también permite alternar

> [CAPTURA: Comparación modo claro vs modo oscuro]

---

## Glosario

| Término | Definición |
|---|---|
| **Borrador** | Curso en preparación, no visible para los usuarios |
| **Publicado** | Curso disponible para los usuarios inscritos |
| **Inscripción** | Asignación de un usuario a un curso |
| **Tema** | Unidad mínima de contenido dentro de un módulo |
| **Módulo** | Agrupación de temas relacionados dentro de un curso |
| **Certificado** | Documento PDF generado al aprobar el examen del curso |
| **No repudio** | Garantía de que ningún evento de auditoría puede ser eliminado o modificado |
| **AD / LDAP** | Active Directory / protocolo para sincronizar usuarios desde el directorio corporativo |

---

*© 2026 Cooperativa de Ahorro y Crédito Acción Tungurahua Ltda. — Uso interno*
