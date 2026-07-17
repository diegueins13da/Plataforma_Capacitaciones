#!/bin/bash
# =============================================================================
# update.sh — Actualiza el LMS con la última versión de GitHub
# Ejecuta desde /opt/lms (o donde hayas clonado el repo)
# =============================================================================

set -e

GREEN='\033[0;32m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC}   $1"; }

echo ""
echo "=============================================="
echo "  LMS Corporativo — Actualización"
echo "=============================================="
echo ""

info "Descargando cambios desde GitHub ..."
git pull origin master

info "Reconstruyendo imágenes ..."
docker compose -f docker-compose.prod.yml build

info "Aplicando cambios (sin tiempo de caída) ..."
docker compose -f docker-compose.prod.yml up -d

info "Aplicando migraciones de base de datos ..."
docker compose -f docker-compose.prod.yml exec -T backend python manage.py migrate --noinput

success "Actualización completada."
docker compose -f docker-compose.prod.yml ps
