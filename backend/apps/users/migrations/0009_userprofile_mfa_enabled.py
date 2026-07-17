from django.db import migrations, models


def set_ldap_mfa_enabled(apps, schema_editor):
    """Enable MFA by default for all existing LDAP users."""
    UserProfile = apps.get_model("users", "UserProfile")
    UserProfile.objects.filter(auth_source="LDAP").update(mfa_enabled=True)


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0008_add_mfachallenge"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="mfa_enabled",
            field=models.BooleanField(
                default=False,
                help_text="Si True, el usuario debe verificar su identidad por correo al iniciar sesión. "
                          "Los usuarios AD tienen este campo en True por defecto.",
                verbose_name="MFA habilitado",
            ),
        ),
        migrations.RunPython(set_ldap_mfa_enabled, migrations.RunPython.noop),
    ]
