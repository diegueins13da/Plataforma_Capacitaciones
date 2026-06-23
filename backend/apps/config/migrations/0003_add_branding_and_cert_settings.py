"""
Add SYSTEM_NAME and RUBRICA_GERENTE_URL to BRANDING settings.
SYSTEM_NAME is what appears on the login page and sidebar header.
RUBRICA_GERENTE_URL stores the path to the manager's signature image.
"""
from django.db import migrations

NEW_SETTINGS = [
    ("SYSTEM_NAME",         "LMS Corporativo", "STRING",  "BRANDING", "Nombre del sistema (aparece en login y menú)", False),
    ("RUBRICA_GERENTE_URL", "",                "STRING",  "BRANDING", "Ruta de la rúbrica del Gerente General (para certificados)", False),
    ("CERT_CITY",           "la ciudad",       "STRING",  "BRANDING", "Ciudad que aparece en los certificados", False),
    ("CERT_MANAGER_TITLE",  "GERENTE GENERAL", "STRING",  "BRANDING", "Título del gerente en certificados", False),
    ("CERT_MANAGER_NAME",   "",                "STRING",  "BRANDING", "Nombre del gerente en certificados", False),
]


def add_settings(apps, schema_editor):
    SystemSetting = apps.get_model("config", "SystemSetting")
    for clave, valor, tipo_dato, categoria, descripcion, es_sensible in NEW_SETTINGS:
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


def remove_settings(apps, schema_editor):
    SystemSetting = apps.get_model("config", "SystemSetting")
    SystemSetting.objects.filter(clave__in=[s[0] for s in NEW_SETTINGS]).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("config", "0002_default_settings"),
    ]

    operations = [
        migrations.RunPython(add_settings, remove_settings),
    ]
