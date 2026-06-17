"""
System configuration model — key-value store for all runtime settings.

Categories:
  SMTP       — email delivery settings
  BRANDING   — company visual identity
  SEGURIDAD  — password policy and account lockout
  NOTIF      — email notification toggles
"""
from django.conf import settings
from django.db import models


class SystemSetting(models.Model):
    class DataType(models.TextChoices):
        STRING = "STRING", "Texto"
        BOOLEAN = "BOOLEAN", "Booleano"
        INTEGER = "INTEGER", "Entero"
        JSON = "JSON", "JSON"

    class Category(models.TextChoices):
        SMTP = "SMTP", "Correo electrónico (SMTP)"
        BRANDING = "BRANDING", "Identidad visual"
        SEGURIDAD = "SEGURIDAD", "Seguridad y contraseñas"
        NOTIF = "NOTIF", "Notificaciones"

    clave = models.CharField(max_length=100, unique=True, verbose_name="clave")
    valor = models.TextField(blank=True, verbose_name="valor")
    tipo_dato = models.CharField(
        max_length=20,
        choices=DataType.choices,
        default=DataType.STRING,
        verbose_name="tipo de dato",
    )
    categoria = models.CharField(
        max_length=20,
        choices=Category.choices,
        verbose_name="categoría",
    )
    descripcion = models.CharField(max_length=255, blank=True, verbose_name="descripción")
    es_sensible = models.BooleanField(
        default=False,
        help_text="Si es True, el valor no se retorna en el API (ej. contraseñas SMTP).",
    )
    updated_at = models.DateTimeField(auto_now=True, verbose_name="última actualización")
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="config_changes",
        verbose_name="actualizado por",
    )

    class Meta:
        db_table = "system_settings"
        verbose_name = "configuración del sistema"
        verbose_name_plural = "configuraciones del sistema"
        ordering = ["categoria", "clave"]

    def __str__(self) -> str:
        return f"{self.categoria}/{self.clave}"

    def get_value(self) -> object:
        """Return the value cast to the appropriate Python type."""
        if self.tipo_dato == self.DataType.BOOLEAN:
            return self.valor.lower() in ("true", "1", "yes")
        if self.tipo_dato == self.DataType.INTEGER:
            try:
                return int(self.valor)
            except (ValueError, TypeError):
                return 0
        if self.tipo_dato == self.DataType.JSON:
            import json
            try:
                return json.loads(self.valor)
            except (ValueError, TypeError):
                return {}
        return self.valor
