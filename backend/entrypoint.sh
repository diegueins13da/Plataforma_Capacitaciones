#!/bin/sh
set -e

echo "Waiting for database..."
until python -c "import psycopg2; psycopg2.connect('${DATABASE_URL}')" 2>/dev/null; do
  sleep 1
done
echo "Database ready."

echo "Running migrations..."
python manage.py migrate --noinput

echo "Creating default admin (skipped if already exists)..."
python manage.py create_default_admin

echo "Collecting static files..."
python manage.py collectstatic --noinput

exec "$@"
