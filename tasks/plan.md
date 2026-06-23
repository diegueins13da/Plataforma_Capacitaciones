# Plan — Fase 1 + Fase 2: Catálogo, Cargos, Login, Certificados

**Fecha:** 2026-06-23
**Alcance aprobado:** Fase 1 (sin migraciones) + Fase 2 (modelo Cargo).
**Fase 3 (Grupos M2M)** queda fuera de este plan — trabajo futuro.

---

## Mapa del estado actual

| Componente | Archivo clave | Estado |
|---|---|---|
| Áreas CRUD | `SystemConfigPage.tsx → AreasTab` | ✅ existe, falta campo descripción |
| Grupos CRUD | `GroupManagementPage.tsx` | ✅ existe como página separada |
| `Cargo` model | `backend/apps/users/models.py` | ❌ no existe — solo `UserProfile.cargo` CharField |
| Tab "Catálogo de áreas" | `SystemConfigPage.tsx` | ✅ existe, necesita renombrarse + sub-tabs |
| Preview certificados | `SystemConfigPage.tsx → tab BRANDING` | ❌ sin preview en tiempo real |
| Login UI | `LoginPage.tsx` | ✅ funciona, sin glassmorphism |
| Edición de usuario | `UserManagementPage.tsx` | ❌ solo lista + crear, sin editar |

---

## Grafo de dependencias

```
T1 (Catálogo sub-tabs)
├── T2 (Área descripción)        → depende de T1 (mismo tab)
└── T6 (Cargo CRUD en Catálogo)  → depende de T1 + T5

T3 (Preview certificados)        → independiente
T4 (Login glassmorphism)         → independiente

T5 (Cargo model + API)           → independiente (backend puro)
├── T6 (Cargo CRUD frontend)     → depende de T5 + T1
└── T7 (User edit + selects)     → depende de T5 + T6
```

**Orden de ejecución seguro:** T4 → T3 → T1 → T2 → T5 → T6 → T7

---

## Fase 1 — Sin migraciones

### T1: Tab "Catálogo" unificado con sub-tabs

**Qué:** Renombrar "Catálogo de áreas" → "Catálogo" en `SystemConfigPage`. Convertir el contenido en sub-tabs: `Áreas | Grupos | Cargos` (Cargos queda como placeholder hasta T6).

**Archivos a tocar:**
- `frontend/src/pages/admin/config/SystemConfigPage.tsx` — cambiar label, agregar estado de sub-tab, extraer lógica de grupos como `GruposTab`
- `frontend/src/types/groups.ts` — `Group` y `GroupMember` ya exportados

**Criterio de aceptación:**
- Tab "Catálogo" visible con 3 sub-botones: Áreas / Grupos / Cargos
- Sub-tab Áreas muestra la misma funcionalidad actual
- Sub-tab Grupos replica `GroupManagementPage` con modal crear/editar/gestionar miembros
- Sub-tab Cargos muestra placeholder hasta T6
- La ruta `/admin/groups` sigue existiendo (no eliminar)

---

### T2: Área — agregar campo descripción en el formulario

**Qué:** El modelo `Area` ya tiene `descripcion: TextField`. El `AreasTab` actual solo muestra/edita `nombre`. Agregar descripción al crear y editar.

**Archivos a tocar:**
- `frontend/src/pages/admin/config/SystemConfigPage.tsx → AreasTab`
- `frontend/src/services/configService.ts` — verificar que `createArea`/`updateArea` pasan `descripcion`

**Criterio de aceptación:**
- Al crear área: campo descripción opcional (max 200 chars con contador)
- Al editar área: descripción editable en el formulario inline
- La descripción se muestra en la lista debajo del nombre (texto muted, truncado)

---

### T3: Preview en tiempo real para Certificados (tab BRANDING)

**Qué:** En el tab BRANDING de `SystemConfigPage`, `LOGO_URL` y `PRIMARY_COLOR` deben tener rendering especial.

**Archivos a tocar:**
- `frontend/src/pages/admin/config/SystemConfigPage.tsx`

**Comportamiento:**
- `PRIMARY_COLOR`: swatch de color (`div` pequeño con `background: valor`) que se actualiza mientras escribe. Validar HEX (#RRGGBB) antes de guardar — borde rojo si inválido.
- `LOGO_URL`: cuando el usuario escribe y hace pausa (debounce 800ms), mostrar `<img>` en miniatura 48x48. Si la imagen falla al cargar → ícono de error.

**Criterio de aceptación:**
- PRIMARY_COLOR: swatch en tiempo real, no guarda si formato inválido
- LOGO_URL: miniatura aparece automáticamente al ingresar URL

---

### T4: Login — rediseño glassmorphism

**Archivos a tocar:**
- `frontend/src/pages/auth/LoginPage.tsx`

**Cambios visuales:**
- Panel izquierdo: `backdrop-blur-xl`, fondo `rgba(255,255,255,0.04)`, borde `rgba(255,255,255,0.08)`
- Título hero: `text-5xl font-black`
- Feature icons: fondo `bg-emerald-500/10`, ícono `text-emerald-400`
- Formulario: card con `rounded-3xl`, inputs `rounded-xl`

**Criterio de aceptación:**
- Efecto glassmorphism visible en pantallas ≥ 1024px
- Funcionalidad de login intacta

---

## Fase 2 — Cargo model (1 migración Django)

### T5: Modelo `Cargo` + API backend

**Archivos a tocar (backend):**
- `backend/apps/users/models.py` — añadir clase `Cargo`
- `backend/apps/users/serializers.py` — añadir `CargoSerializer`
- `backend/apps/users/views.py` — añadir `CargoViewSet`
- `backend/apps/users/urls.py` — registrar `router.register(r"cargos", CargoViewSet)`
- Ejecutar: `python manage.py makemigrations users`

**Modelo:**
```python
class Cargo(models.Model):
    nombre   = models.CharField(max_length=100)
    area     = models.ForeignKey(Area, null=True, blank=True, on_delete=models.SET_NULL, related_name="cargos")
    activo   = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "cargos"
        unique_together = [("nombre", "area")]
        ordering = ["nombre"]
```

**Endpoints resultantes:**
- `GET /api/users/cargos/` — lista (any authenticated)
- `GET /api/users/cargos/?area_id=N` — filtrado por área
- `POST/PATCH/DELETE /api/users/cargos/{id}/` — ADMIN only

**Criterio de aceptación:**
- Migración aplica sin errores en el contenedor
- `GET /api/users/cargos/` responde 200

---

### T6: CRUD de Cargos en tab Catálogo (frontend)

**Archivos a tocar:**
- `frontend/src/pages/admin/config/SystemConfigPage.tsx` — reemplazar placeholder con `CargosTab`
- `frontend/src/types/cargo.ts` — crear tipo `Cargo`
- `frontend/src/services/configService.ts` — métodos `getCargos`, `createCargo`, `updateCargo`, `deleteCargo`

**Funcionalidad:**
- Lista de cargos con nombre, área (badge), estado
- Filtro por área
- Crear con nombre + área opcional + activo
- Editar inline + toggle activo + eliminar

**Criterio de aceptación:**
- CRUD completo en sub-tab Cargos
- Filtro por área funciona
- Error al eliminar si hay usuarios asignados (backend valida)

---

### T7: Edición de usuario con selects dependientes

**Archivos a tocar:**
- `frontend/src/pages/admin/users/UserManagementPage.tsx` — añadir `EditUserModal`

**Comportamiento:**
1. Botón "Editar" en cada fila abre modal
2. Campos: nombre, email, área (select), cargo (select filtrado por área), estado toggle
3. Cambiar área → resetear cargo + recargar opciones
4. Guardar → `PATCH /api/users/users/{id}/` con `{ area: id, cargo: "nombre" }`

**Criterio de aceptación:**
- Modal edición abre y cierra sin errores
- Select de cargo se filtra al cambiar área
- Cambios se persisten y la tabla se actualiza

---

## Checkpoints

### Checkpoint A — fin de Fase 1
- [ ] T1, T2, T3, T4 completados
- [ ] Sin errores en consola del navegador
- [ ] `git commit` "feat(config): catálogo unificado, áreas descripción, preview certificados, login glassmorphism"

### Checkpoint B — fin de Fase 2
- [ ] Migración aplicada: `docker compose exec backend python manage.py migrate`
- [ ] `GET /api/users/cargos/` responde 200
- [ ] T6, T7 completados
- [ ] Sin regresiones en flujos existentes
- [ ] `git commit` "feat(users): modelo Cargo + CRUD Catálogo + edición de usuario"

---

## Lo que NO se toca

- `UserProfile.grupo` — sigue siendo FK single (Fase 3 pendiente)
- `UserProfile.cargo` — sigue siendo CharField (Opción A: el select escribe el nombre como texto)
- Rutas `/admin/groups`, `/admin/users` — se mantienen como están
- AuditLog — sin cambios
- Lógica JWT / permisos — sin cambios
