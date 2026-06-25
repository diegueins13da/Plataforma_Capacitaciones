"""
Data migration: ensure all SystemSetting records have human-friendly Spanish descriptions.
Uses UPDATE (not get_or_create) so it fixes records created before descriptions were added.
"""
from django.db import migrations

FRIENDLY_LABELS = {
    # SMTP
    "EMAIL_HOST":           "Servidor de correo SMTP",
    "EMAIL_PORT":           "Puerto del servidor SMTP",
    "EMAIL_HOST_USER":      "Usuario SMTP",
    "EMAIL_HOST_PASSWORD":  "Contraseña SMTP",
    "EMAIL_USE_TLS":        "Usar cifrado TLS",
    "DEFAULT_FROM_EMAIL":   "Correo remitente por defecto",
    # BRANDING
    "COMPANY_NAME":         "Nombre de la empresa",
    "LOGO_URL":             "URL del logotipo corporativo",
    "PRIMARY_COLOR":        "Color primario (hex)",
    "FAVICON_URL":          "URL del favicon",
    "SYSTEM_NAME":          "Nombre del sistema (aparece en login y menú)",
    "RUBRICA_GERENTE_URL":  "Ruta de la rúbrica del Gerente General (para certificados)",
    "CERT_CITY":            "Ciudad que aparece en los certificados",
    "CERT_MANAGER_TITLE":   "Título del gerente en certificados",
    "CERT_MANAGER_NAME":    "Nombre del gerente en certificados",
    # SEGURIDAD
    "PASSWORD_MIN_LENGTH":      "Longitud mínima de contraseña (caracteres)",
    "PASSWORD_REQUIRE_UPPER":   "Requiere al menos una mayúscula",
    "PASSWORD_REQUIRE_LOWER":   "Requiere al menos una minúscula",
    "PASSWORD_REQUIRE_DIGIT":   "Requiere al menos un número",
    "PASSWORD_REQUIRE_SPECIAL": "Requiere al menos un carácter especial",
    "PASSWORD_EXPIRY_DAYS":     "Días de vigencia de contraseña (0 = nunca vence)",
    "MAX_LOGIN_ATTEMPTS":       "Intentos fallidos antes de bloquear la cuenta",
    "LOCKOUT_DURATION_MIN":     "Duración del bloqueo de cuenta (minutos)",
    # NOTIFICACIONES
    "NOTIFY_NEW_COURSE":   "Enviar notificación al asignar un nuevo curso",
    "NOTIFY_DEADLINE_7D":  "Enviar alerta 7 días antes del vencimiento",
    "NOTIFY_DEADLINE_1D":  "Enviar alerta 1 día antes del vencimiento",
    "NOTIFY_EXAM_RESULT":  "Notificar resultado del examen al alumno",
    # LDAP
    "LDAP_ENABLED":       "Integración con Active Directory habilitada",
    "LDAP_SERVER_URI":    "Dirección del servidor LDAP (ej: ldap://servidor:389)",
    "LDAP_BIND_DN":       "DN de la cuenta de servicio LDAP",
    "LDAP_BIND_PASSWORD": "Contraseña de la cuenta de servicio LDAP",
    "LDAP_BASE_DN":       "DN base para búsqueda de usuarios",
    "LDAP_SYNC_FILTER":   "Filtro LDAP para sincronizar usuarios",
    "LDAP_START_TLS":     "Usar StartTLS para cifrar la conexión LDAP",
}


def update_descriptions(apps, schema_editor):
    SystemSetting = apps.get_model("config", "SystemSetting")
    for clave, descripcion in FRIENDLY_LABELS.items():
        SystemSetting.objects.filter(clave=clave).update(descripcion=descripcion)


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("config", "0004_ldap_settings"),
    ]

    operations = [
        migrations.RunPython(update_descriptions, noop),
    ]
