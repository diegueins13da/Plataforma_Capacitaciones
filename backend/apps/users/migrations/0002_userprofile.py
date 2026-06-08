import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = False

    dependencies = [
        ("users", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="UserProfile",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("area", models.CharField(blank=True, max_length=150, verbose_name="área")),
                ("cargo", models.CharField(blank=True, max_length=150, verbose_name="cargo")),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="profile",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="usuario",
                    ),
                ),
            ],
            options={
                "db_table": "user_profiles",
                "verbose_name": "perfil de usuario",
                "verbose_name_plural": "perfiles de usuario",
            },
        ),
    ]
