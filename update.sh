#!/bin/bash
# =============================================================================
# update.sh — Actualiza el LMS con la última versión de GitHub
# Ejecuta desde el directorio donde clonaste el repo.
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
docker compose build

info "Aplicando cambios (sin tiempo de caída) ..."
docker compose up -d

info "Esperando que el backend esté listo ..."
ATTEMPTS=0
until docker compose exec -T backend python manage.py check --database default >/dev/null 2>&1; do
  ATTEMPTS=$((ATTEMPTS + 1))
  [ $ATTEMPTS -ge 20 ] && { echo "Timeout. Revisa: docker compose logs backend"; exit 1; }
  sleep 3
done

success "Actualización completada."
docker compose ps
