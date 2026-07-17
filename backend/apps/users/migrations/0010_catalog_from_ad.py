from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0009_userprofile_mfa_enabled"),
    ]

    operations = [
        migrations.AddField(
            model_name="area",
            name="from_ad",
            field=models.BooleanField(
                default=False,
                help_text="Sincronizado desde Active Directory. Solo lectura.",
                verbose_name="origen AD",
            ),
        ),
        migrations.AddField(
            model_name="group",
            name="from_ad",
            field=models.BooleanField(
                default=False,
                help_text="Sincronizado desde Active Directory. Solo lectura.",
                verbose_name="origen AD",
            ),
        ),
        migrations.AddField(
            model_name="cargo",
            name="from_ad",
            field=models.BooleanField(
                default=False,
                help_text="Sincronizado desde Active Directory. Solo lectura.",
                verbose_name="origen AD",
            ),
        ),
    ]
