"""
Data migration: pre-populate default LDAP / Active Directory settings.
All values are empty / disabled by default — admin configures from the UI.
"""
from django.db import migrations

LDAP_DEFAULTS = [
    ("LDAP_ENABLED",       "false",  "BOOLEAN", "LDAP", "Integración habilitada",           False),
    ("LDAP_SERVER_URI",    "",       "STRING",  "LDAP", "Servidor LDAP (URI)",              False),
    ("LDAP_BIND_DN",       "",       "STRING",  "LDAP", "DN de cuenta de servicio",         False),
    ("LDAP_BIND_PASSWORD", "",       "STRING",  "LDAP", "Contraseña de servicio",           True),
    ("LDAP_BASE_DN",       "",       "STRING",  "LDAP", "DN base de búsqueda",              False),
    ("LDAP_SYNC_FILTER",
     "(&(objectClass=person)(mail=*))",
     "STRING", "LDAP", "Filtro de sincronización de usuarios", False),
    ("LDAP_START_TLS",     "false",  "BOOLEAN", "LDAP", "Usar StartTLS (cifrado)",          False),
]


def add_ldap_defaults(apps, schema_editor):
    SystemSetting = apps.get_model("config", "SystemSetting")
    for clave, valor, tipo_dato, categoria, descripcion, es_sensible in LDAP_DEFAULTS:
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


def remove_ldap_defaults(apps, schema_editor):
    SystemSetting = apps.get_model("config", "SystemSetting")
    SystemSetting.objects.filter(clave__in=[row[0] for row in LDAP_DEFAULTS]).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("config", "0003_add_branding_and_cert_settings"),
    ]

    operations = [
        migrations.RunPython(add_ldap_defaults, remove_ldap_defaults),
    ]
