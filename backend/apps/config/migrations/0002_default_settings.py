"""
Data migration: pre-populate default SystemSetting records.
All values are safe defaults — admins customize them via the Config panel.
"""
from django.db import migrations

DEFAULT_SETTINGS = [
    # ── SMTP ─────────────────────────────────────────────────────────────────
    ("EMAIL_HOST",        "",          "STRING",  "SMTP", "Servidor SMTP",              False),
    ("EMAIL_PORT",        "587",       "INTEGER", "SMTP", "Puerto SMTP",                False),
    ("EMAIL_HOST_USER",   "",          "STRING",  "SMTP", "Usuario SMTP",               False),
    ("EMAIL_HOST_PASSWORD", "",        "STRING",  "SMTP", "Contraseña SMTP",            True),
    ("EMAIL_USE_TLS",     "true",      "BOOLEAN", "SMTP", "Usar TLS",                   False),
    ("DEFAULT_FROM_EMAIL", "",         "STRING",  "SMTP", "Correo remitente por defecto", False),
    # ── BRANDING ─────────────────────────────────────────────────────────────
    ("COMPANY_NAME",      "Mi Empresa","STRING",  "BRANDING", "Nombre de la empresa",   False),
    ("LOGO_URL",          "",          "STRING",  "BRANDING", "URL del logotipo",        False),
    ("PRIMARY_COLOR",     "#4f46e5",   "STRING",  "BRANDING", "Color primario (hex)",    False),
    ("FAVICON_URL",       "",          "STRING",  "BRANDING", "URL del favicon",         False),
    # ── SEGURIDAD ────────────────────────────────────────────────────────────
    ("PASSWORD_MIN_LENGTH",     "8",   "INTEGER", "SEGURIDAD", "Longitud mínima de contraseña", False),
    ("PASSWORD_REQUIRE_UPPER",  "true","BOOLEAN", "SEGURIDAD", "Requiere mayúscula",     False),
    ("PASSWORD_REQUIRE_LOWER",  "true","BOOLEAN", "SEGURIDAD", "Requiere minúscula",     False),
    ("PASSWORD_REQUIRE_DIGIT",  "true","BOOLEAN", "SEGURIDAD", "Requiere número",        False),
    ("PASSWORD_REQUIRE_SPECIAL","true","BOOLEAN", "SEGURIDAD", "Requiere carácter especial", False),
    ("PASSWORD_EXPIRY_DAYS",    "0",   "INTEGER", "SEGURIDAD", "Expiración de contraseña (0 = nunca)", False),
    ("MAX_LOGIN_ATTEMPTS",      "5",   "INTEGER", "SEGURIDAD", "Intentos de login antes de bloquear", False),
    ("LOCKOUT_DURATION_MIN",    "15",  "INTEGER", "SEGURIDAD", "Duración del bloqueo (minutos)", False),
    # ── NOTIFICACIONES ───────────────────────────────────────────────────────
    ("NOTIFY_NEW_COURSE",   "true", "BOOLEAN", "NOTIF", "Notificar nuevo curso asignado", False),
    ("NOTIFY_DEADLINE_7D",  "true", "BOOLEAN", "NOTIF", "Alerta 7 días antes del vencimiento", False),
    ("NOTIFY_DEADLINE_1D",  "true", "BOOLEAN", "NOTIF", "Alerta 1 día antes del vencimiento", False),
    ("NOTIFY_EXAM_RESULT",  "true", "BOOLEAN", "NOTIF", "Notificar resultado de examen", False),
]


def populate_defaults(apps, schema_editor):
    SystemSetting = apps.get_model("config", "SystemSetting")
    for clave, valor, tipo_dato, categoria, descripcion, es_sensible in DEFAULT_SETTINGS:
        SystemSetting.objects.get_or_create(
            clave=clave,
            defaults={
                "valor": valor,
                "tipo_dato": tipo_dato,
                "categoria": categoria,
                "descripcion": descripcion,
                "es_sensible": es_sensible,
            },
        )


def reverse_defaults(apps, schema_editor):
    SystemSetting = apps.get_model("config", "SystemSetting")
    claves = [row[0] for row in DEFAULT_SETTINGS]
    SystemSetting.objects.filter(clave__in=claves).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("config", "0001_initial_system_settings"),
    ]

    operations = [
        migrations.RunPython(populate_defaults, reverse_defaults),
    ]
