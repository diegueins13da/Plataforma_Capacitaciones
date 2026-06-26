"""
Migration: introduce Tema as the content-bearing child of Module.

Steps:
  1. Create course_temas table
  2. Data: for each existing Module, create one Tema inheriting its content
  3. Remove content columns from course_modules
"""
from django.db import migrations, models
import django.db.models.deletion


def copy_modules_to_temas(apps, schema_editor):
    Module = apps.get_model("courses", "Module")
    Tema = apps.get_model("courses", "Tema")

    for module in Module.objects.all():
        tipo = getattr(module, "tipo_contenido", None) or "TEXTO"
        if tipo == "SCORM":
            tipo = "TEXTO"
        Tema.objects.create(
            module=module,
            titulo=module.titulo,
            orden=1,
            tipo_contenido=tipo,
            duracion_minutos=getattr(module, "duracion_minutos", None),
            url_video=getattr(module, "url_video", "") or "",
            archivo_pdf=getattr(module, "archivo_pdf", "") or "",
            contenido_html=getattr(module, "contenido_html", "") or "",
        )


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("courses", "0001_initial"),
    ]

    operations = [
        # 1. Create Tema table
        migrations.CreateModel(
            name="Tema",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("module", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="temas",
                    to="courses.module",
                    verbose_name="módulo",
                )),
                ("titulo", models.CharField(max_length=255, verbose_name="título")),
                ("orden", models.PositiveSmallIntegerField(default=1, verbose_name="orden")),
                ("tipo_contenido", models.CharField(
                    choices=[
                        ("VIDEO", "Video"),
                        ("PDF", "PDF"),
                        ("TEXTO", "Texto HTML"),
                        ("IMAGEN", "Imagen"),
                        ("IFRAME", "Contenido externo (iFrame)"),
                    ],
                    max_length=10,
                    verbose_name="tipo de contenido",
                )),
                ("duracion_minutos", models.PositiveSmallIntegerField(blank=True, null=True, verbose_name="duración (minutos)")),
                ("url_video", models.URLField(blank=True, verbose_name="URL de video")),
                ("archivo_video", models.FileField(blank=True, null=True, upload_to="temas/videos/", verbose_name="archivo de video")),
                ("archivo_pdf", models.CharField(blank=True, max_length=500, verbose_name="archivo PDF")),
                ("contenido_html", models.TextField(blank=True, verbose_name="contenido HTML")),
                ("archivo_imagen", models.FileField(blank=True, null=True, upload_to="temas/imagenes/", verbose_name="imagen")),
                ("url_iframe", models.URLField(blank=True, verbose_name="URL del iframe")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="fecha de creación")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="última modificación")),
            ],
            options={
                "verbose_name": "tema",
                "verbose_name_plural": "temas",
                "db_table": "course_temas",
                "ordering": ["module", "orden"],
                "unique_together": {("module", "orden")},
            },
        ),
        # 2. Data migration: copy module content → temas
        migrations.RunPython(copy_modules_to_temas, noop),
        # 3. Remove content columns from Module
        migrations.RemoveField(model_name="module", name="tipo_contenido"),
        migrations.RemoveField(model_name="module", name="url_video"),
        migrations.RemoveField(model_name="module", name="archivo_pdf"),
        migrations.RemoveField(model_name="module", name="contenido_html"),
        migrations.RemoveField(model_name="module", name="duracion_minutos"),
    ]
