from django.conf import settings
from django.db import models


class Assessment(models.Model):
    """Evaluation configuration attached to a course (1-to-1)."""

    course = models.OneToOneField(
        "courses.Course",
        on_delete=models.CASCADE,
        related_name="assessment",
        verbose_name="curso",
    )
    puntaje_minimo = models.PositiveSmallIntegerField(
        default=70,
        verbose_name="puntaje mínimo para aprobar (%)",
        help_text="Porcentaje mínimo de respuestas correctas para considerar aprobado.",
    )
    max_intentos = models.PositiveSmallIntegerField(
        default=3,
        verbose_name="máximo de intentos",
    )
    tiempo_limite_minutos = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        verbose_name="tiempo límite (minutos)",
        help_text="Null = sin límite de tiempo.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "assessments"
        verbose_name = "evaluación"
        verbose_name_plural = "evaluaciones"

    def __str__(self) -> str:
        return f"Evaluación de {self.course}"


class Question(models.Model):
    class Tipo(models.TextChoices):
        MULTIPLE_CHOICE = "MULTIPLE_CHOICE", "Selección única"
        MULTIPLE_SELECT = "MULTIPLE_SELECT", "Selección múltiple"
        TRUE_FALSE = "TRUE_FALSE", "Verdadero / Falso"

    assessment = models.ForeignKey(
        Assessment,
        on_delete=models.CASCADE,
        related_name="questions",
        verbose_name="evaluación",
    )
    texto = models.TextField(verbose_name="enunciado")
    tipo = models.CharField(
        max_length=20,
        choices=Tipo.choices,
        default=Tipo.MULTIPLE_CHOICE,
        verbose_name="tipo de pregunta",
    )
    opciones = models.JSONField(
        default=list,
        verbose_name="opciones",
        help_text='Lista de textos: ["Opción A", "Opción B", ...]',
    )
    respuesta_correcta = models.JSONField(
        verbose_name="respuesta correcta",
        help_text=(
            "MULTIPLE_CHOICE: índice entero (0-based). "
            "MULTIPLE_SELECT: lista de índices. "
            "TRUE_FALSE: boolean."
        ),
    )
    orden = models.PositiveSmallIntegerField(default=1, verbose_name="orden")
    aprobada_por_humano = models.BooleanField(
        default=False,
        verbose_name="aprobada por humano",
        help_text="Solo las preguntas aprobadas por humano se incluyen en los exámenes.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "assessment_questions"
        verbose_name = "pregunta"
        verbose_name_plural = "preguntas"
        ordering = ["assessment", "orden"]

    def __str__(self) -> str:
        return f"[{self.get_tipo_display()}] {self.texto[:60]}"


class UserAnswer(models.Model):
    """
    A single exam attempt by a user.

    respuestas_json stores the user's answers as:
        {"<question_id>": <answer>}
    where <answer> follows the same format as Question.respuesta_correcta.

    intento_numero is assigned by the service layer (1-based per enrollment).
    """

    enrollment = models.ForeignKey(
        "courses.Enrollment",
        on_delete=models.CASCADE,
        related_name="exam_attempts",
        verbose_name="inscripción",
    )
    assessment = models.ForeignKey(
        Assessment,
        on_delete=models.PROTECT,
        related_name="attempts",
        verbose_name="evaluación",
    )
    intento_numero = models.PositiveSmallIntegerField(verbose_name="número de intento")
    respuestas_json = models.JSONField(
        default=dict,
        verbose_name="respuestas",
        help_text="Guardado parcial mientras el examen está en curso.",
    )
    calificacion = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="calificación (%)",
    )
    aprobado = models.BooleanField(null=True, blank=True, verbose_name="aprobado")
    fecha_inicio = models.DateTimeField(auto_now_add=True, verbose_name="fecha de inicio")
    fecha_fin = models.DateTimeField(null=True, blank=True, verbose_name="fecha de finalización")

    class Meta:
        db_table = "user_answers"
        verbose_name = "intento de examen"
        verbose_name_plural = "intentos de examen"
        unique_together = [("enrollment", "intento_numero")]
        ordering = ["enrollment", "intento_numero"]

    def __str__(self) -> str:
        return f"Intento #{self.intento_numero} — {self.enrollment.user} / {self.assessment.course}"
