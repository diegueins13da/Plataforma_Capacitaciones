from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0006_add_cargo_model"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="auth_source",
            field=models.CharField(
                choices=[("LOCAL", "Local"), ("LDAP", "LDAP / AD")],
                default="LOCAL",
                help_text="LOCAL: contraseña local. LDAP: autentica contra Active Directory.",
                max_length=10,
                verbose_name="origen de autenticación",
            ),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="ldap_dn",
            field=models.TextField(
                blank=True,
                default="",
                help_text="Distinguished Name del usuario en Active Directory (solo lectura).",
                verbose_name="DN en el directorio LDAP",
            ),
            preserve_default=False,
        ),
    ]
