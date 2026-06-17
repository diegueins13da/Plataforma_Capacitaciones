from django.conf import settings
from django.db import models


class Notification(models.Model):
    class Tipo(models.TextChoices):
        NUEVO_CURSO = "NUEVO_CURSO", "Nuevo curso asignado"
        VENCIMIENTO_7D = "VENCIMIENTO_7D", "Curso vence en 7 días"
        VENCIMIENTO_1D = "VENCIMIENTO_1D", "Curso vence mañana"
        VENCIDO = "VENCIDO", "Curso vencido"
        EXAMEN_APROBADO = "EXAMEN_APROBADO", "Examen aprobado"
        EXAMEN_REPROBADO = "EXAMEN_REPROBADO", "Examen reprobado"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
        verbose_name="usuario",
    )
    tipo = models.CharField(
        max_length=20,
        choices=Tipo.choices,
        verbose_name="tipo",
    )
    titulo = models.CharField(max_length=255, verbose_name="título")
    mensaje = models.TextField(blank=True, verbose_name="mensaje")
    leida = models.BooleanField(default=False, verbose_name="leída")
    referencia_id = models.IntegerField(
        null=True,
        blank=True,
        verbose_name="ID de referencia",
        help_text="ID del recurso relacionado (Course, Enrollment, etc.).",
    )
    referencia_tipo = models.CharField(
        max_length=50,
        blank=True,
        verbose_name="tipo de referencia",
        help_text="Modelo relacionado: 'course', 'enrollment', etc.",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="fecha de creación")

    class Meta:
        db_table = "notifications"
        verbose_name = "notificación"
        verbose_name_plural = "notificaciones"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"[{self.tipo}] {self.user} — {self.titulo}"
