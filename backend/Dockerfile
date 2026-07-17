FROM python:3.12-slim AS base

WORKDIR /app

# System libraries:
# - libpq-dev + gcc: psycopg2 compilation
# - libcairo2 + libpango*: WeasyPrint PDF generation (Fase 2)
# - libgdk-pixbuf2.0-0 + shared-mime-info: WeasyPrint image support
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    gcc \
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf-xlib-2.0-0 \
    libffi-dev \
    shared-mime-info \
    libldap2-dev \
    libsasl2-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements/ requirements/


# ---- Development stage ----
FROM base AS development

RUN pip install --no-cache-dir -r requirements/development.txt

COPY . .

ENV DJANGO_SETTINGS_MODULE=config.settings.development \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

EXPOSE 8000

CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]


# ---- Production stage (T37) ----
FROM base AS production

RUN pip install --no-cache-dir -r requirements/production.txt

COPY . .

ENV DJANGO_SETTINGS_MODULE=config.settings.production \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# collectstatic se ejecuta en entrypoint.sh al iniciar el contenedor,
# donde SECRET_KEY y DATABASE_URL ya están disponibles como variables de entorno.

EXPOSE 8000

ENTRYPOINT ["./entrypoint.sh"]
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "4"]
