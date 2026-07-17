#!/bin/bash
# =============================================================================
# deploy-lan.sh — Despliegue LMS en red interna (LAN), sin SSL
# Uso: chmod +x deploy-lan.sh && ./deploy-lan.sh
# =============================================================================

set -e

GREEN='\033[0;32m'; BLUE='\033[0;34m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC}   $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

echo ""
echo "================================================"
echo "  LMS Corporativo — Despliegue en LAN"
echo "================================================"
echo ""

command -v docker >/dev/null 2>&1 || error "Docker no está instalado."
docker compose version >/dev/null 2>&1 || error "Docker Compose v2 no está disponible."

# Detectar la IP del servidor automáticamente
SERVER_IP=$(hostname -I | awk '{print $1}')
echo "  IP detectada del servidor: ${SERVER_IP}"
read -p "  ¿Es correcta? Si no, escribe la IP real (Enter para confirmar): " INPUT_IP
[ -n "$INPUT_IP" ] && SERVER_IP=$INPUT_IP

read -p "  Contraseña para la base de datos: " -s DB_PASSWORD; echo
[ -z "$DB_PASSWORD" ] && error "La contraseña es obligatoria."

read -p "  Email SMTP (Enter para omitir): " SMTP_USER
read -p "  Contraseña SMTP (Enter para omitir): " -s SMTP_PASSWORD; echo
read -p "  API Key Anthropic para IA (Enter para omitir): " ANTHROPIC_KEY

echo ""

# Generar SECRET_KEY
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(50))" 2>/dev/null || \
             openssl rand -base64 48 | tr -d '\n')

# Crear .env
info "Creando .env ..."
cat > .env << EOF
COMPOSE_PROJECT_NAME=lms

SECRET_KEY=${SECRET_KEY}
DEBUG=False
ALLOWED_HOSTS=${SERVER_IP},localhost,127.0.0.1

DB_NAME=lms_prod
DB_USER=lms_user
DB_PASSWORD=${DB_PASSWORD}
DATABASE_URL=postgres://lms_user:${DB_PASSWORD}@db:5432/lms_prod

REDIS_URL=redis://redis:6379/0

CORS_ALLOWED_ORIGINS=http://${SERVER_IP}
FRONTEND_URL=http://${SERVER_IP}
VITE_API_URL=http://${SERVER_IP}

EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.office365.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=${SMTP_USER}
EMAIL_HOST_PASSWORD=${SMTP_PASSWORD}
DEFAULT_FROM_EMAIL=LMS Cooperativa <${SMTP_USER}>

ANTHROPIC_API_KEY=${ANTHROPIC_KEY}
STORAGE_BACKEND=local
SECURE_SSL_REDIRECT=False
LOG_LEVEL=WARNING
LOG_FORMAT=json
EOF

success ".env creado."

# Construir y levantar
info "Construyendo imágenes (puede tardar 3-5 minutos la primera vez) ..."
docker compose -f docker-compose.lan.yml build

info "Levantando servicios ..."
docker compose -f docker-compose.lan.yml up -d

# Esperar que el backend esté listo
info "Esperando que el backend esté listo ..."
ATTEMPTS=0
until docker compose -f docker-compose.lan.yml exec -T backend python manage.py check --database default >/dev/null 2>&1; do
  ATTEMPTS=$((ATTEMPTS + 1))
  [ $ATTEMPTS -ge 30 ] && error "El backend no arrancó. Revisa: docker compose -f docker-compose.lan.yml logs backend"
  sleep 3
done

echo ""
echo "================================================"
success "¡LISTO!"
echo ""
echo -e "  Accede desde cualquier PC de la red en:"
echo -e "  ${GREEN}http://${SERVER_IP}${NC}"
echo ""
echo "  Usuario: admin@empresa.com"
echo "  Clave:   Demo1234!  ← cámbiala de inmediato"
echo ""
echo "  Ver logs:  docker compose -f docker-compose.lan.yml logs -f"
echo "  Estado:    docker compose -f docker-compose.lan.yml ps"
echo "================================================"
