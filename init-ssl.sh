#!/bin/bash
# =============================================================================
# init-ssl.sh — Obtiene el primer certificado SSL con Let's Encrypt
#
# Ejecuta UNA SOLA VEZ después de que el DNS de tu dominio apunte al servidor.
# Después, certbot renueva automáticamente cada 12 h (servicio certbot en compose).
#
# Uso:
#   chmod +x init-ssl.sh
#   ./init-ssl.sh tudominio.com tu@email.com
# =============================================================================

set -e

DOMAIN=${1:?"Uso: ./init-ssl.sh <dominio> <email>  Ej: ./init-ssl.sh lms.cooperativa.com admin@cooperativa.com"}
EMAIL=${2:?"Uso: ./init-ssl.sh <dominio> <email>  Ej: ./init-ssl.sh lms.cooperativa.com admin@cooperativa.com"}

echo "======================================================="
echo " Dominio : $DOMAIN"
echo " Email   : $EMAIL"
echo "======================================================="

# 1. Actualizar el dominio en nginx/prod.conf
echo "[1/4] Actualizando nginx/prod.conf con el dominio $DOMAIN ..."
sed -i "s/TUDOMINIO.COM/$DOMAIN/g" nginx/prod.conf

# 2. Actualizar el dominio en .env si el usuario puso el placeholder
if grep -q "tudominio.com" .env 2>/dev/null; then
  echo "[1/4] AVISO: Recuerda actualizar tudominio.com en tu archivo .env"
fi

# 3. Levantar solo nginx en modo HTTP para que certbot pueda responder el reto ACME
echo "[2/4] Levantando nginx temporal (HTTP solamente) ..."
docker compose -f docker-compose.prod.yml up -d nginx certbot

echo "      Esperando 5s para que nginx arranque ..."
sleep 5

# 4. Emitir el certificado
echo "[3/4] Solicitando certificado para $DOMAIN ..."
docker compose -f docker-compose.prod.yml run --rm certbot \
  certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$DOMAIN" \
    -d "www.$DOMAIN"

# 5. Levantar el stack completo
echo "[4/4] Levantando el stack completo ..."
docker compose -f docker-compose.prod.yml up -d

echo ""
echo "======================================================="
echo " LISTO — https://$DOMAIN"
echo " El certificado se renueva automáticamente cada 12 h"
echo "======================================================="
