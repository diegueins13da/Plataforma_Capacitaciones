import uuid
from django.conf import settings
from django.db import models
from django.utils import timezone


class Course(models.Model):
    class Estado(models.TextChoices):
        BORRADOR = "BORRADOR", "Borrador"
        PUBLICADO = "PUBLICADO", "Publicado"
        ARCHIVADO = "ARCHIVADO", "Archivado"

    class Tipo(models.TextChoices):
        ONLINE = "ONLINE", "Online"
        PRESENCIAL = "PRESENCIAL", "Presencial"
        HIBRIDO = "HIBRIDO", "Híbrido"
        AUTOAPRENDIZAJE = "AUTOAPRENDIZAJE", "Autoaprendizaje"

    titulo = models.CharField(max_length=255, verbose_name="título")
    descripcion = models.TextField(blank=True, verbose_name="descripción")
    instructor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="courses_as_instructor",
        verbose_name="instructor",
    )
    area = models.ForeignKey(
        "users.Area",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="courses",
        verbose_name="área",
    )
    audiencia_grupos = models.ManyToManyField(
        "users.Group",
        blank=True,
        related_name="courses",
        verbose_name="grupos objetivo",
    )
    tipo = models.CharField(
        max_length=20,
        choices=Tipo.choices,
        default=Tipo.ONLINE,
        verbose_name="tipo",
    )
    estado = models.CharField(
        max_length=20,
        choices=Estado.choices,
        default=Estado.BORRADOR,
        verbose_name="estado",
    )
    fecha_limite = models.DateField(
        null=True,
        blank=True,
        verbose_name="fecha límite",
        help_text="Opcional. Si se define, los enrollments sin completar se cierran automáticamente al vencer.",
    )
    version = models.CharField(max_length=20, default="1.0", verbose_name="versión")
    imagen_portada = models.CharField(max_length=500, blank=True, verbose_name="imagen de portada")
    duracion_horas = models.PositiveSmallIntegerField(
        null=True, blank=True, verbose_name="duración (horas)"
    )
    cert_expira_meses = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        verbose_name="expiración del certificado (meses)",
        help_text="Cuántos meses es válido el certificado. Null = nunca expira.",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="courses_created",
        verbose_name="creado por",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="fecha de creación")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="última modificación")

    class Meta:
        db_table = "courses"
        verbose_name = "curso"
        verbose_name_plural = "cursos"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.titulo

    # ------------------------------------------------------------------
    # State machine helpers
    # ------------------------------------------------------------------

    def can_publish(self) -> bool:
        return self.estado == self.Estado.BORRADOR

    def can_archive(self) -> bool:
        return self.estado == self.Estado.PUBLICADO

    def publish(self) -> None:
        if not self.can_publish():
            raise ValueError(
                f"No se puede publicar un curso en estado '{self.estado}'."
            )
        self.estado = self.Estado.PUBLICADO
        self.save(update_fields=["estado", "updated_at"])

    def archive(self) -> None:
        if not self.can_archive():
            raise ValueError(
                f"No se puede archivar un curso en estado '{self.estado}'."
            )
        self.estado = self.Estado.ARCHIVADO
        self.save(update_fields=["estado", "updated_at"])


class Module(models.Model):
    class TipoContenido(models.TextChoices):
        VIDEO = "VIDEO", "Video"
        PDF = "PDF", "PDF"
        TEXTO = "TEXTO", "Texto"
        SCORM = "SCORM", "SCORM"

    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name="modules",
        verbose_name="curso",
    )
    titulo = models.CharField(max_length=255, verbose_name="título")
    descripcion = models.TextField(blank=True, verbose_name="descripción")
    tipo_contenido = models.CharField(
        max_length=10,
        choices=TipoContenido.choices,
        verbose_name="tipo de contenido",
    )
    orden = models.PositiveSmallIntegerField(default=1, verbose_name="orden")
    es_secuencial = models.BooleanField(
        default=True,
        verbose_name="es secuencial",
        help_text="Si es True, el usuario debe completar el módulo N antes de abrir el N+1.",
    )
    duracion_minutos = models.PositiveSmallIntegerField(
        null=True, blank=True, verbose_name="duración (minutos)"
    )
    # VIDEO content
    url_video = models.URLField(blank=True, verbose_name="URL de video")
    # PDF content
    archivo_pdf = models.CharField(max_length=500, blank=True, verbose_name="archivo PDF")
    # TEXTO content
    contenido_html = models.TextField(blank=True, verbose_name="contenido HTML")

    created_at = models.DateTimeField(auto_now_add=True, verbose_name="fecha de creación")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="última modificación")

    class Meta:
        db_table = "course_modules"
        verbose_name = "módulo"
        verbose_name_plural = "módulos"
        ordering = ["course", "orden"]
        unique_together = [("course", "orden")]

    def __str__(self) -> str:
        return f"{self.course} — módulo {self.orden}: {self.titulo}"


class Enrollment(models.Model):
    class Estado(models.TextChoices):
        EN_PROGRESO = "EN_PROGRESO", "En progreso"
        COMPLETADO = "COMPLETADO", "Completado"
        VENCIDO = "VENCIDO", "Vencido"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="enrollments",
        verbose_name="usuario",
    )
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name="enrollments",
        verbose_name="curso",
    )
    estado = models.CharField(
        max_length=15,
        choices=Estado.choices,
        default=Estado.EN_PROGRESO,
        verbose_name="estado",
    )
    progreso_porcentaje = models.PositiveSmallIntegerField(
        default=0, verbose_name="progreso (%)"
    )
    fecha_inscripcion = models.DateTimeField(
        auto_now_add=True, verbose_name="fecha de inscripción"
    )
    fecha_completado = models.DateTimeField(
        null=True, blank=True, verbose_name="fecha de completado"
    )

    class Meta:
        db_table = "enrollments"
        verbose_name = "inscripción"
        verbose_name_plural = "inscripciones"
        unique_together = [("user", "course")]
        ordering = ["-fecha_inscripcion"]

    def __str__(self) -> str:
        return f"{self.user} → {self.course}"

    def update_progress(self) -> None:
        """Recalculate and persist progreso_porcentaje from completed modules."""
        total = self.course.modules.count()
        if total == 0:
            self.progreso_porcentaje = 0
        else:
            completed = self.module_progress.filter(is_completed=True).count()
            self.progreso_porcentaje = int((completed / total) * 100)
        if self.progreso_porcentaje == 100 and self.estado == self.Estado.EN_PROGRESO:
            self.estado = self.Estado.COMPLETADO
            self.fecha_completado = timezone.now()
        self.save(update_fields=["progreso_porcentaje", "estado", "fecha_completado"])


class ModuleProgress(models.Model):
    enrollment = models.ForeignKey(
        Enrollment,
        on_delete=models.CASCADE,
        related_name="module_progress",
        verbose_name="inscripción",
    )
    module = models.ForeignKey(
        Module,
        on_delete=models.CASCADE,
        related_name="progress_records",
        verbose_name="módulo",
    )
    is_completed = models.BooleanField(default=False, verbose_name="completado")
    last_position_json = models.JSONField(
        default=dict,
        verbose_name="última posición",
        help_text=(
            "Posición guardada: {second: N} para video, "
            "{page: N} para PDF, {scroll: N} para texto."
        ),
    )
    fecha_completado = models.DateTimeField(
        null=True, blank=True, verbose_name="fecha de completado"
    )
    updated_at = models.DateTimeField(auto_now=True, verbose_name="última actualización")

    class Meta:
        db_table = "module_progress"
        verbose_name = "progreso de módulo"
        verbose_name_plural = "progreso de módulos"
        unique_together = [("enrollment", "module")]

    def __str__(self) -> str:
        status = "✓" if self.is_completed else "○"
        return f"{status} {self.enrollment.user} / {self.module}"


class Certificate(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="certificates",
        verbose_name="usuario",
    )
    course = models.ForeignKey(
        Course,
        on_delete=models.PROTECT,
        related_name="certificates",
        verbose_name="curso",
    )
    enrollment = models.OneToOneField(
        Enrollment,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="certificate",
        verbose_name="inscripción",
    )
    fecha_emision = models.DateTimeField(
        auto_now_add=True, verbose_name="fecha de emisión"
    )
    nota_obtenida = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="nota obtenida",
    )
    url_pdf = models.CharField(
        max_length=500, blank=True, default="", verbose_name="URL del PDF"
    )
    url_qr = models.CharField(
        max_length=500, blank=True, default="", verbose_name="URL del QR"
    )

    class Meta:
        db_table = "certificates"
        verbose_name = "certificado"
        verbose_name_plural = "certificados"
        ordering = ["-fecha_emision"]

    def __str__(self) -> str:
        return f"Cert {self.id} — {self.user} / {self.course}"


# ---------------------------------------------------------------------------
# Signals
# ---------------------------------------------------------------------------
from django.db.models.signals import post_save  # noqa: E402
from django.dispatch import receiver  # noqa: E402


@receiver(post_save, sender=Certificate)
def trigger_certificate_pdf(sender, instance: Certificate, created: bool, **kwargs) -> None:
    """Auto-generate the PDF when a new Certificate is created without a PDF."""
    if created and not instance.url_pdf:
        try:
            from apps.certificates.tasks import generate_certificate_pdf_task
            generate_certificate_pdf_task.delay(str(instance.id))
        except Exception:
            pass  # Non-blocking — PDF can be regenerated manually by admin
