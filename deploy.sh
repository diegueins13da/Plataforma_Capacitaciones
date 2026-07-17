#!/bin/bash
# =============================================================================
# deploy.sh — Primer despliegue del LMS Corporativo en producción
#
# Requisitos en el servidor:
#   - Docker instalado (docker.io + docker compose v2)
#   - Puerto 80 y 443 abiertos en el firewall
#   - El DNS de tu dominio apuntando a este servidor
#
# Uso:
#   chmod +x deploy.sh
#   ./deploy.sh
# =============================================================================

set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC}   $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

echo ""
echo "=============================================="
echo "  LMS Corporativo — Despliegue en Producción"
echo "=============================================="
echo ""

# ---------------------------------------------------------------------------
# Verificaciones previas
# ---------------------------------------------------------------------------
command -v docker >/dev/null 2>&1 || error "Docker no está instalado. Instala con: sudo apt install docker.io docker-compose-v2"
docker compose version >/dev/null 2>&1 || error "Docker Compose v2 no está disponible."

if lsof -i:80 >/dev/null 2>&1; then
  error "El puerto 80 está en uso. Detén el servicio que lo ocupa antes de continuar."
fi

# ---------------------------------------------------------------------------
# Recopilar datos del usuario
# ---------------------------------------------------------------------------
echo "Necesito algunos datos para configurar el servidor."
echo ""

read -p "  Dominio principal (ej: lms.cooperativa.com): " DOMAIN
[ -z "$DOMAIN" ] && error "El dominio es obligatorio."

read -p "  Email para el certificado SSL (Let's Encrypt): " SSL_EMAIL
[ -z "$SSL_EMAIL" ] && error "El email es obligatorio para el SSL."

read -p "  Contraseña para la base de datos PostgreSQL: " -s DB_PASSWORD; echo
[ -z "$DB_PASSWORD" ] && error "La contraseña de la base de datos es obligatoria."

read -p "  Email SMTP del sistema (ej: sistema@cooperativa.com, Enter para omitir): " SMTP_USER
read -p "  Contraseña SMTP (Enter para omitir): " -s SMTP_PASSWORD; echo

read -p "  API Key de Anthropic para módulo IA (Enter para omitir): " ANTHROPIC_KEY

echo ""

# ---------------------------------------------------------------------------
# Generar SECRET_KEY segura
# ---------------------------------------------------------------------------
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(50))" 2>/dev/null || \
             openssl rand -base64 48 | tr -d '\n')
success "SECRET_KEY generada automáticamente."

# ---------------------------------------------------------------------------
# Crear archivo .env
# ---------------------------------------------------------------------------
info "Creando archivo .env ..."

cat > .env << EOF
# Generado automáticamente por deploy.sh — $(date)
COMPOSE_PROJECT_NAME=lms

# Django
SECRET_KEY=${SECRET_KEY}
DEBUG=False
ALLOWED_HOSTS=${DOMAIN},www.${DOMAIN}

# Base de datos
DB_NAME=lms_prod
DB_USER=lms_user
DB_PASSWORD=${DB_PASSWORD}
DATABASE_URL=postgres://lms_user:${DB_PASSWORD}@db:5432/lms_prod

# Redis
REDIS_URL=redis://redis:6379/0

# CORS y URLs
CORS_ALLOWED_ORIGINS=https://${DOMAIN},https://www.${DOMAIN}
FRONTEND_URL=https://${DOMAIN}
VITE_API_URL=https://${DOMAIN}

# Email
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.office365.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=${SMTP_USER}
EMAIL_HOST_PASSWORD=${SMTP_PASSWORD}
DEFAULT_FROM_EMAIL=LMS Cooperativa <${SMTP_USER}>

# IA
ANTHROPIC_API_KEY=${ANTHROPIC_KEY}

# Seguridad
SECURE_SSL_REDIRECT=False
STORAGE_BACKEND=local
LOG_LEVEL=WARNING
LOG_FORMAT=json
EOF

success ".env creado."

# ---------------------------------------------------------------------------
# Configurar dominio en nginx/prod.conf
# ---------------------------------------------------------------------------
info "Configurando dominio en nginx/prod.conf ..."
sed -i "s/TUDOMINIO.COM/${DOMAIN}/g" nginx/prod.conf
success "nginx/prod.conf listo para ${DOMAIN}."

# ---------------------------------------------------------------------------
# Obtener certificado SSL con certbot (standalone — puerto 80 debe estar libre)
# ---------------------------------------------------------------------------
info "Obteniendo certificado SSL para ${DOMAIN} ..."
info "Let's Encrypt verificará que el dominio apunta a este servidor."
echo ""

docker run --rm -p 80:80 \
  -v lms_letsencrypt_certs:/etc/letsencrypt \
  -v lms_certbot_www:/var/www/certbot \
  certbot/certbot certonly \
    --standalone \
    --non-interactive \
    --agree-tos \
    --email "$SSL_EMAIL" \
    -d "$DOMAIN" \
    -d "www.$DOMAIN" 2>&1 || {
  warn "No se pudo emitir el certificado para www.${DOMAIN}."
  warn "Intentando solo con ${DOMAIN} (sin www)..."
  # Actualizar nginx para que solo use el dominio sin www
  sed -i "s/server_name ${DOMAIN} www.${DOMAIN}/server_name ${DOMAIN}/" nginx/prod.conf
  sed -i "/ssl_certificate.*www/d" nginx/prod.conf
  docker run --rm -p 80:80 \
    -v lms_letsencrypt_certs:/etc/letsencrypt \
    -v lms_certbot_www:/var/www/certbot \
    certbot/certbot certonly \
      --standalone \
      --non-interactive \
      --agree-tos \
      --email "$SSL_EMAIL" \
      -d "$DOMAIN" || error "No se pudo obtener el certificado SSL. Verifica que ${DOMAIN} apunta a este servidor."
}

success "Certificado SSL obtenido."

# ---------------------------------------------------------------------------
# Construir imágenes y levantar el stack
# ---------------------------------------------------------------------------
info "Construyendo imágenes Docker (puede tardar 3-5 minutos la primera vez) ..."
docker compose -f docker-compose.prod.yml build

info "Levantando el stack completo ..."
docker compose -f docker-compose.prod.yml up -d

# ---------------------------------------------------------------------------
# Esperar a que el backend esté listo
# ---------------------------------------------------------------------------
info "Esperando a que el backend esté listo ..."
ATTEMPTS=0
until docker compose -f docker-compose.prod.yml exec -T backend python manage.py check --database default >/dev/null 2>&1; do
  ATTEMPTS=$((ATTEMPTS + 1))
  [ $ATTEMPTS -ge 30 ] && error "El backend no arrancó después de 60s. Revisa: docker compose -f docker-compose.prod.yml logs backend"
  sleep 2
done

success "Backend listo."

# ---------------------------------------------------------------------------
# Crear superusuario admin si no existe (lo hace entrypoint.sh automáticamente)
# ---------------------------------------------------------------------------
info "Verificando datos iniciales ..."
docker compose -f docker-compose.prod.yml exec -T backend python manage.py shell -c \
  "from apps.users.models import User; print('Usuarios:', User.objects.count())" 2>/dev/null || true

# ---------------------------------------------------------------------------
# Resultado final
# ---------------------------------------------------------------------------
echo ""
echo "=============================================="
success "¡LISTO! El LMS está corriendo en:"
echo ""
echo -e "  ${GREEN}https://${DOMAIN}${NC}"
echo ""
echo "  Usuario admin: admin@empresa.com"
echo "  Contraseña:    Demo1234!  ← CÁMBIALA de inmediato"
echo ""
echo "  Logs:    docker compose -f docker-compose.prod.yml logs -f"
echo "  Parar:   docker compose -f docker-compose.prod.yml down"
echo "  Estado:  docker compose -f docker-compose.prod.yml ps"
echo "=============================================="
