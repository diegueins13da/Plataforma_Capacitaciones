"""
Migration 0002 — Enrich AuditLog for non-repudiation.

Adds actor snapshot fields (email, name, role), network context (user_agent),
a structured result flag, entity fields (tipo/id/nombre), and an error detail
text field.  All new columns are nullable / blank-safe so existing rows keep
working without data backfill.

Indexes are added on the most common filter axes:
  - actor_email   (who did it)
  - accion        (what kind of event)
  - resultado     (OK vs ERROR)
  - entidad_tipo + entidad_id  (which object was affected)
"""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("reports", "0001_initial"),
    ]

    operations = [
        # ── Actor snapshot ────────────────────────────────────────────────
        migrations.AddField(
            model_name="auditlog",
            name="actor_email",
            field=models.CharField(
                max_length=254,
                blank=True,
                default="",
                verbose_name="email del actor (snapshot)",
            ),
        ),
        migrations.AddField(
            model_name="auditlog",
            name="actor_nombre",
            field=models.CharField(
                max_length=200,
                blank=True,
                default="",
                verbose_name="nombre del actor (snapshot)",
            ),
        ),
        migrations.AddField(
            model_name="auditlog",
            name="actor_rol",
            field=models.CharField(
                max_length=20,
                blank=True,
                default="",
                verbose_name="rol del actor (snapshot)",
            ),
        ),
        # ── Network context ───────────────────────────────────────────────
        migrations.AddField(
            model_name="auditlog",
            name="user_agent",
            field=models.CharField(
                max_length=500,
                blank=True,
                default="",
                verbose_name="user agent",
            ),
        ),
        # ── Result ────────────────────────────────────────────────────────
        migrations.AddField(
            model_name="auditlog",
            name="resultado",
            field=models.CharField(
                max_length=5,
                choices=[("OK", "OK"), ("ERROR", "ERROR")],
                default="OK",
                verbose_name="resultado",
            ),
        ),
        # ── Affected entity ───────────────────────────────────────────────
        migrations.AddField(
            model_name="auditlog",
            name="entidad_tipo",
            field=models.CharField(
                max_length=50,
                blank=True,
                default="",
                verbose_name="tipo de entidad",
            ),
        ),
        migrations.AddField(
            model_name="auditlog",
            name="entidad_id",
            field=models.CharField(
                max_length=100,
                blank=True,
                default="",
                verbose_name="ID de entidad",
            ),
        ),
        migrations.AddField(
            model_name="auditlog",
            name="entidad_nombre",
            field=models.CharField(
                max_length=300,
                blank=True,
                default="",
                verbose_name="nombre de entidad (snapshot)",
            ),
        ),
        # ── Error detail ──────────────────────────────────────────────────
        migrations.AddField(
            model_name="auditlog",
            name="error_detalle",
            field=models.TextField(
                blank=True,
                default="",
                verbose_name="detalle de error",
            ),
        ),
        # ── Indexes for common query patterns ─────────────────────────────
        migrations.AddIndex(
            model_name="auditlog",
            index=models.Index(fields=["actor_email"], name="audit_actor_email_idx"),
        ),
        migrations.AddIndex(
            model_name="auditlog",
            index=models.Index(fields=["accion"], name="audit_accion_idx"),
        ),
        migrations.AddIndex(
            model_name="auditlog",
            index=models.Index(fields=["resultado"], name="audit_resultado_idx"),
        ),
        migrations.AddIndex(
            model_name="auditlog",
            index=models.Index(
                fields=["entidad_tipo", "entidad_id"], name="audit_entidad_idx"
            ),
        ),
    ]
