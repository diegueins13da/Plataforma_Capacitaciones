# Presentación Comercial — LMS Corporativo
## Plataforma de Gestión de Capacitación para Cooperativas de Ahorro y Crédito

**Cooperativa de Ahorro y Crédito Acción Tungurahua Ltda.**  
**Documento:** Presentación para Certificación y Adopción Institucional  
**Versión:** 1.0 | **Fecha:** Junio 2026  
**Clasificación:** Uso interno / Dirección Ejecutiva

---

## DIAPOSITIVA 1 — Portada

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   [LOGO ACCIÓN TUNGURAHUA]                              │
│                                                         │
│   LMS CORPORATIVO                                       │
│   Plataforma Digital de Capacitación                    │
│                                                         │
│   Certificación del Sistema · Junio 2026                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## DIAPOSITIVA 2 — El Desafío

### Antes: Gestión Manual de Capacitación

**Problemática identificada en cooperativas ecuatorianas:**

- Registros de asistencia en papel → difíciles de auditar
- Sin evidencia digital de aprendizaje por competencias
- Sin trazabilidad para cumplimiento regulatorio (SEPS)
- Capacitadores sin métricas de efectividad de sus cursos
- Certificados emitidos manualmente, fácilmente falsificables
- Imposible demostrar cumplimiento ante una auditoría externa en menos de 24 horas

**Impacto real:**
> "Una auditoría de la SEPS solicita evidencia de las 40 horas de capacitación obligatorias por empleado del ejercicio 2025. El equipo administrativo tarda 3 días en recopilar registros en Excel y carpetas físicas."

---

## DIAPOSITIVA 3 — La Solución

### LMS Corporativo: Plataforma 100% Digital

```
ANTES                          DESPUÉS
─────────────────────────────────────────────────────
Hojas de asistencia  →  Registro automático digital
Excel de seguimiento →  Dashboard en tiempo real
PDF de certificados  →  PDF con QR de verificación
Sin trazabilidad     →  Auditoría inmutable (434+ eventos)
Sin métricas         →  KPIs por empleado, área y curso
Días para reportes   →  Descarga CSV en segundos
```

**Stack tecnológico seguro y moderno:**
- Backend: Django REST Framework + PostgreSQL
- Frontend: React 18 + TypeScript
- Seguridad: JWT, Argon2, HSTS, CSP, bloqueo de cuentas
- Integración: LDAP / Active Directory corporativo
- IA: Generador de contenido con Anthropic Claude

---

## DIAPOSITIVA 4 — Cumplimiento Regulatorio SEPS

### Alineación con el Marco Normativo Ecuatoriano

La plataforma fue diseñada para dar cumplimiento directo a las resoluciones de la Superintendencia de Economía Popular y Solidaria (SEPS):

---

### Norma de Capacitación y Desarrollo del Talento Humano (Resolución SEPS)

| Requisito Normativo | Cumplimiento en la Plataforma |
|---|---|
| Registro de horas de capacitación por empleado | ✅ Automático — cada curso registra duración y completación |
| Evidencia de participación y aprobación | ✅ Certificado PDF con fecha, nota y QR verificable |
| Plan de capacitación anual documentado | ✅ Cursos con fecha límite y control de vencimientos |
| Capacitación por área y cargo | ✅ Asignación segmentada por área, grupo y cargo |
| Registro de evaluaciones y resultados | ✅ Historial de intentos, notas y fechas |
| Acceso inmediato a evidencia para auditorías | ✅ Reporte CSV descargable en < 5 segundos |

---

### Norma de Gestión de Riesgo Operativo (Resolución SEPS)

| Requisito Normativo | Cumplimiento en la Plataforma |
|---|---|
| Control de accesos por roles y perfiles | ✅ 3 roles: Admin / Capacitador / Usuario — sin acceso cruzado |
| Registro de auditoría inmutable (no repudio) | ✅ 434+ eventos con actor, acción, timestamp — no editables |
| Continuidad operativa del servicio | ✅ Docker + PostgreSQL con respaldo configurable |
| Seguridad de datos personales de empleados | ✅ Cifrado Argon2, HTTPS forzado, cookies seguras |
| Trazabilidad de cambios en datos críticos | ✅ AuditLog registra toda modificación de usuario o curso |
| Control de acceso con bloqueo por intentos fallidos | ✅ 5 intentos → bloqueo automático 15 minutos |

> **Nota:** Se recomienda complementar esta sección con los artículos específicos de las resoluciones aplicables vigentes al momento de presentación, que pueden ser consultados en el portal oficial de SEPS: www.seps.gob.ec

---

## DIAPOSITIVA 5 — Funcionalidades Clave

### Para la Institución (Administrador)

| Función | Beneficio |
|---|---|
| Gestión de 79+ usuarios con sincronización LDAP | Sin ingreso manual de empleados |
| 18 cursos activos con control de versiones | Contenido siempre actualizado |
| Reportes CSV en tiempo real | Auditorías en segundos, no días |
| Configuración sin programar (parámetros en UI) | IT no depende de cambios en producción |
| Log de auditoría con 434 eventos históricos | Evidencia irrefutable ante SEPS |

### Para el Capacitador

| Función | Beneficio |
|---|---|
| Creador de cursos en 3 pasos | Sin conocimiento técnico requerido |
| Generador de contenido con IA | Reduce 80% el tiempo de preparación de materiales |
| Dashboard con métricas de alumnos | Mide el impacto de cada capacitación |
| Alertas de vencimientos | Proactividad ante plazos regulatorios |

### Para el Empleado (Usuario)

| Función | Beneficio |
|---|---|
| Acceso 24/7 desde cualquier dispositivo | Flexibilidad horaria |
| Contenido en múltiples formatos (video, PDF, texto) | Adaptado a distintos estilos de aprendizaje |
| Certificados PDF con QR verificable | Credencial digital confiable |
| Progreso guardado automáticamente | Sin perder avance ante interrupciones |

---

## DIAPOSITIVA 6 — Métricas de Adopción Actual

*Datos reales del sistema al 26 de junio de 2026:*

```
┌──────────────────┬────────────────────┬──────────────────┐
│  79 usuarios     │  18 cursos         │  11 publicados   │
│  registrados     │  creados           │  disponibles     │
├──────────────────┼────────────────────┼──────────────────┤
│  14 certificados │  434 eventos de    │  3 capacitadores │
│  emitidos        │  auditoría         │  activos         │
└──────────────────┴────────────────────┴──────────────────┘
```

**Tasa de aprobación global:** 86%  
**Nota promedio del sistema:** 82.3%  
**Usuarios activos / registrados:** 100% (79/79)

---

## DIAPOSITIVA 7 — Seguridad de la Información

### Controles de Seguridad Implementados

```
CAPA           CONTROL                          ESTÁNDAR
────────────────────────────────────────────────────────
Contraseñas    Argon2 hashing                   OWASP Top 10
Sesiones       JWT con rotación + blacklisting  RFC 7519
Transporte     HTTPS + HSTS 1 año               OWASP
Cabeceras      CSP, X-Frame-Options, nosniff    OWASP
Accesos        Bloqueo por 5 intentos fallidos  NIST SP 800-63
Backend        DEBUG=False, logging JSON        OWASP
API            CORS restringido a dominios       RFC 6454
               propios
Auditoría      Inmutable — no repudio           ISO 27001 A.12.4
```

**Resultado de auditoría de seguridad (junio 2026):** ✅ 13/13 controles PASS

---

## DIAPOSITIVA 8 — Antes vs Después

### Impacto Operativo Medible

| Escenario | Antes (manual) | Después (LMS) | Mejora |
|---|---|---|---|
| Evidencia ante auditoría SEPS | 3 días, búsqueda manual | 5 segundos, CSV | **99.9% más rápido** |
| Emisión de certificado | Manual, 1–2 días | Automático al aprobar examen | **Inmediato** |
| Preparación de curso (40h contenido) | 2 semanas de diseño | Generador IA: 2 horas | **-90% tiempo** |
| Control de vencimientos de capacitación | Sin control automático | Alertas en dashboard | **Proactivo** |
| Verificación de autenticidad de certificado | Imposible en tiempo real | QR público de verificación | **Instantáneo** |
| Sincronización de empleados nuevos | Ingreso manual en Excel | Sync automático con AD | **Automático** |

---

## DIAPOSITIVA 9 — Implementación y Soporte

### Fases de Despliegue

```
FASE 1 — CONFIGURACIÓN (Semana 1–2)
├── Instalación en servidor de la cooperativa
├── Configuración del servidor de correo (Office 365)
├── Sincronización inicial con Active Directory
└── Personalización de identidad visual

FASE 2 — CARGA DE CONTENIDO (Semana 2–4)
├── Migración de cursos existentes
├── Capacitación a los Capacitadores
└── Carga del catálogo de cursos del plan anual

FASE 3 — LANZAMIENTO (Semana 4–5)
├── Capacitación a Administradores
├── Comunicación a usuarios finales
└── Go-live y monitoreo

FASE 4 — OPERACIÓN CONTINUA
├── Actualizaciones del sistema
├── Soporte técnico
└── Evolución de funcionalidades
```

### Requisitos de Infraestructura

| Componente | Mínimo recomendado |
|---|---|
| Servidor | 4 vCPU, 8 GB RAM, 100 GB SSD |
| Sistema operativo | Ubuntu 22.04 LTS |
| Red | HTTPS con certificado SSL válido |
| Backup | Backup diario de base de datos |

---

## DIAPOSITIVA 10 — Conclusión

### ¿Por qué LMS Corporativo?

```
✅ Cumplimiento regulatorio SEPS demostrable en segundos
✅ Certificados digitales con QR verificable — fin a las falsificaciones
✅ Auditoría inmutable — evidencia ante cualquier inspección
✅ IA para creación de contenido — capacitadores más productivos
✅ Integración con Active Directory — sin doble ingreso de datos
✅ 0 errores JavaScript — sistema estable listo para producción
✅ Seguridad auditada: 13/13 controles de seguridad PASS
```

### Próximos Pasos

1. Aprobación de la Gerencia General para despliegue en producción
2. Coordinación con TI para configuración del servidor
3. Definición del plan de migración de cursos existentes
4. Comunicación a colaboradores sobre el nuevo sistema

---

**Contacto del proyecto:**  
Equipo de Tecnología · Cooperativa Acción Tungurahua  
[correo-ti]@acciontungurahua.fin.ec

---

*Documento preparado para el proceso de certificación del sistema — Uso interno*  
*© 2026 Cooperativa de Ahorro y Crédito Acción Tungurahua Ltda.*
