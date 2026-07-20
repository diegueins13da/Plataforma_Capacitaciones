# LMS Corporativo

Sistema de gestión de aprendizaje (LMS) con generación de contenido por IA, seguimiento de progreso, certificados automáticos y reportes.

---

## Requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows o Mac) — o Docker Engine + Docker Compose v2 en Linux
- Git

---

## Despliegue en 4 pasos

### 1. Clonar el repositorio

```bash
git clone <url-del-repositorio>
cd Plataforma_Capacitaciones
```

### 2. Crear el archivo de configuración

```bash
cp .env.example .env
```

Abre `.env` y edita al menos estos valores:

| Variable | Qué poner |
|---|---|
| `SECRET_KEY` | Clave aleatoria larga (ver instrucción dentro del archivo) |
| `DB_PASSWORD` | Contraseña para la base de datos (cualquier valor seguro) |
| `DATABASE_URL` | Igual que arriba, reemplaza la contraseña en la URL |
| `ALLOWED_HOSTS` | IP o dominio del servidor, sin `http://` (ej. `192.168.1.100`) |
| `CORS_ALLOWED_ORIGINS` | URL completa con esquema (ej. `http://192.168.1.100`) |
| `CSRF_TRUSTED_ORIGINS` | Igual que `CORS_ALLOWED_ORIGINS` |
| `FRONTEND_URL` | Igual que `CORS_ALLOWED_ORIGINS` |
| `VITE_API_URL` | Igual que `CORS_ALLOWED_ORIGINS` |

> Si el servidor está en LAN sin SSL (HTTP), deja `SESSION_COOKIE_SECURE=False` y `CSRF_COOKIE_SECURE=False`.

### 3. Construir y levantar

```bash
docker compose up -d --build
```

La primera vez descarga imágenes base y compila el frontend. Tarda entre 5 y 15 minutos según la conexión.

### 4. Acceder

Abre en el navegador: `http://<IP-del-servidor>`

**Credenciales por defecto:**

| Campo | Valor |
|---|---|
| Email | `admin@empresa.com` |
| Contraseña | `Demo1234!` |

El sistema pedirá cambiar la contraseña en el primer inicio de sesión.

---

## Actualizar la plataforma

Cada vez que haya una nueva versión:

```bash
git pull origin master
docker compose up -d --build
```

Las migraciones de base de datos se aplican automáticamente al reiniciar.

---

## Verificar que funciona

```bash
# Estado de los contenedores (todos deben aparecer como "Up")
docker compose ps

# Logs del backend en tiempo real
docker compose logs -f backend
```

---

## Desarrollo local

Para trabajar en el código (con hot-reload):

```bash
cp .env.example .env
# Edita .env: pon la IP de tu máquina o usa localhost
docker compose -f docker-compose.dev.yml up -d
```

Frontend disponible en `http://localhost:3001`, backend en `http://localhost:8000`.

---

## Solución de problemas

**El login falla con "error inesperado"**
```bash
# Verifica que las migraciones corrieron
docker compose exec backend python manage.py migrate --noinput
```

**Cambios en .env no se aplican**
```bash
# restart no recarga .env — usa up -d
docker compose up -d
```

**Ver logs de errores**
```bash
docker compose logs backend --tail=50
docker compose logs nginx --tail=20
```
