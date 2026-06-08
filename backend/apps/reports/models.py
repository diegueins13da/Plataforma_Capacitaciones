from django.conf import settings
from django.db import models


class AuditLog(models.Model):
    """
    Immutable audit trail. Records are created-only — no endpoint exposes UPDATE or DELETE.
    The auto_now_add timestamp and the no-update policy are enforced at the service layer.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
        verbose_name="usuario",
    )
    accion = models.CharField(max_length=100, verbose_name="acción")
    ip = models.GenericIPAddressField(null=True, blank=True, verbose_name="dirección IP")
    timestamp = models.DateTimeField(auto_now_add=True, verbose_name="fecha y hora")
    detalles_json = models.JSONField(default=dict, blank=True, verbose_name="detalles")

    class Meta:
        db_table = "audit_logs"
        ordering = ["-timestamp"]
        verbose_name = "registro de auditoría"
        verbose_name_plural = "registros de auditoría"

    def __str__(self) -> str:
        who = self.user.email if self.user else "sistema"
        return f"[{self.timestamp}] {who} — {self.accion}"
