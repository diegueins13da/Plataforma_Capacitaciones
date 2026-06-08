import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0002_userprofile"),
    ]

    operations = [
        migrations.CreateModel(
            name="Group",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("nombre", models.CharField(max_length=150, unique=True, verbose_name="nombre")),
                ("descripcion", models.TextField(blank=True, verbose_name="descripción")),
                ("activo", models.BooleanField(default=True, verbose_name="activo")),
                (
                    "created_at",
                    models.DateTimeField(auto_now_add=True, verbose_name="fecha de creación"),
                ),
            ],
            options={
                "verbose_name": "grupo",
                "verbose_name_plural": "grupos",
                "db_table": "groups",
                "ordering": ["nombre"],
            },
        ),
        migrations.AddField(
            model_name="userprofile",
            name="grupo",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="members",
                to="users.group",
                verbose_name="grupo",
            ),
        ),
    ]
