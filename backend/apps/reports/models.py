from django.conf import settings
from django.db import models


class AuditLog(models.Model):
    """
    Immutable audit trail — INSERT only.

    Supports non-repudiation: actor identity is snapshotted at creation time
    so the record remains valid even if the user is later deleted or modified.

    Schema
    ------
    Core (original)
        user            FK to User (nullable — SET_NULL on delete)
        accion          Event code, e.g. LOGIN_SUCCESS, COURSE_PUBLISHED
        ip              IPv4/IPv6 of the request
        timestamp       Auto-set at creation; never mutable
        detalles_json   Arbitrary extra payload (free-form JSON)

    Actor snapshot  (non-repudiation — copied from user at creation time)
        actor_email     E-mail address at the moment of the event
        actor_nombre    Display name at the moment of the event
        actor_rol       Role (ADMIN / TRAINER / USUARIO / SISTEMA)

    Network context
        user_agent      HTTP User-Agent header (first 500 chars)

    Result
        resultado       "OK" or "ERROR"
        error_detalle   Error message / stack excerpt when resultado=ERROR

    Affected entity
        entidad_tipo    Object type: Course, User, Certificate, Assessment, Config…
        entidad_id      PK or UUID of the affected object (as string)
        entidad_nombre  Human-readable name of the object AT THE TIME of the event
    """

    # ── Core ─────────────────────────────────────────────────────────────────
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
        verbose_name="usuario",
    )
    accion = models.CharField(max_length=100, verbose_name="acción", db_index=True)
    ip = models.GenericIPAddressField(null=True, blank=True, verbose_name="IP")
    timestamp = models.DateTimeField(auto_now_add=True, verbose_name="fecha/hora", db_index=True)
    detalles_json = models.JSONField(default=dict, blank=True, verbose_name="detalles (JSON)")

    # ── Actor snapshot ────────────────────────────────────────────────────────
    actor_email = models.CharField(
        max_length=254, blank=True, default="", verbose_name="email del actor"
    )
    actor_nombre = models.CharField(
        max_length=200, blank=True, default="", verbose_name="nombre del actor"
    )
    actor_rol = models.CharField(
        max_length=20, blank=True, default="", verbose_name="rol del actor"
    )

    # ── Network context ───────────────────────────────────────────────────────
    user_agent = models.CharField(
        max_length=500, blank=True, default="", verbose_name="user agent"
    )

    # ── Result ────────────────────────────────────────────────────────────────
    RESULTADO_OK = "OK"
    RESULTADO_ERROR = "ERROR"
    RESULTADO_CHOICES = [(RESULTADO_OK, "OK"), (RESULTADO_ERROR, "ERROR")]

    resultado = models.CharField(
        max_length=5,
        choices=RESULTADO_CHOICES,
        default=RESULTADO_OK,
        verbose_name="resultado",
    )
    error_detalle = models.TextField(blank=True, default="", verbose_name="detalle de error")

    # ── Affected entity ───────────────────────────────────────────────────────
    entidad_tipo = models.CharField(
        max_length=50, blank=True, default="", verbose_name="tipo de entidad"
    )
    entidad_id = models.CharField(
        max_length=100, blank=True, default="", verbose_name="ID de entidad"
    )
    entidad_nombre = models.CharField(
        max_length=300, blank=True, default="", verbose_name="nombre de entidad"
    )

    class Meta:
        db_table = "audit_logs"
        ordering = ["-timestamp"]
        verbose_name = "registro de auditoría"
        verbose_name_plural = "registros de auditoría"
        indexes = [
            models.Index(fields=["actor_email"], name="audit_actor_email_idx"),
            models.Index(fields=["accion"], name="audit_accion_idx"),
            models.Index(fields=["resultado"], name="audit_resultado_idx"),
            models.Index(fields=["entidad_tipo", "entidad_id"], name="audit_entidad_idx"),
        ]

    def save(self, *args, **kwargs):
        if self.pk is not None:
            raise ValueError(
                "AuditLog records are immutable. Updates are not allowed."
            )
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        actor = self.actor_email or (self.user.email if self.user else "sistema")
        return f"[{self.timestamp:%Y-%m-%d %H:%M:%S}] {actor} — {self.accion} ({self.resultado})"
