"""Notification service — creates in-app notifications for all platform events."""
from __future__ import annotations

from datetime import timedelta
from typing import TYPE_CHECKING

from django.utils import timezone

from .models import Notification

if TYPE_CHECKING:
    from apps.courses.models import Enrollment
    from apps.users.models import User


def create_notification(
    user: "User",
    tipo: str,
    titulo: str,
    mensaje: str = "",
    referencia_id: int | None = None,
    referencia_tipo: str = "",
) -> Notification:
    return Notification.objects.create(
        user=user,
        tipo=tipo,
        titulo=titulo,
        mensaje=mensaje,
        referencia_id=referencia_id,
        referencia_tipo=referencia_tipo,
    )


def _already_sent(user: "User", tipo: str, referencia_id: int | None) -> bool:
    """Return True if a notification of this type was already sent in the last 25 hours."""
    cutoff = timezone.now() - timedelta(hours=25)
    return Notification.objects.filter(
        user=user,
        tipo=tipo,
        referencia_id=referencia_id,
        created_at__gte=cutoff,
    ).exists()


# ---------------------------------------------------------------------------
# Event-specific helpers
# ---------------------------------------------------------------------------


def notify_nuevo_curso(user: "User", enrollment: "Enrollment") -> Notification | None:
    if _already_sent(user, Notification.Tipo.NUEVO_CURSO, enrollment.pk):
        return None
    course = enrollment.course
    return create_notification(
        user=user,
        tipo=Notification.Tipo.NUEVO_CURSO,
        titulo="Nuevo curso asignado",
        mensaje=f'Se te ha asignado el curso "{course.titulo}". ¡Empieza cuando quieras!',
        referencia_id=course.pk,
        referencia_tipo="course",
    )


def notify_examen_aprobado(user: "User", enrollment: "Enrollment", calificacion: float) -> Notification:
    course = enrollment.course
    return create_notification(
        user=user,
        tipo=Notification.Tipo.EXAMEN_APROBADO,
        titulo="¡Aprobaste la evaluación!",
        mensaje=f'Obtuviste {calificacion:.0f}% en la evaluación de "{course.titulo}". ¡Felicidades!',
        referencia_id=course.pk,
        referencia_tipo="course",
    )


def notify_examen_reprobado(
    user: "User", enrollment: "Enrollment", calificacion: float, intentos_restantes: int
) -> Notification:
    course = enrollment.course
    if intentos_restantes > 0:
        msg = (
            f'Obtuviste {calificacion:.0f}% en la evaluación de "{course.titulo}". '
            f"Te quedan {intentos_restantes} intento{'s' if intentos_restantes != 1 else ''}."
        )
    else:
        msg = (
            f'Obtuviste {calificacion:.0f}% en la evaluación de "{course.titulo}". '
            "Has agotado todos los intentos disponibles."
        )
    return create_notification(
        user=user,
        tipo=Notification.Tipo.EXAMEN_REPROBADO,
        titulo="No aprobaste la evaluación",
        mensaje=msg,
        referencia_id=course.pk,
        referencia_tipo="course",
    )


def notify_vencimiento(user: "User", enrollment: "Enrollment", dias: int) -> Notification | None:
    tipo = Notification.Tipo.VENCIMIENTO_7D if dias == 7 else Notification.Tipo.VENCIMIENTO_1D
    if _already_sent(user, tipo, enrollment.pk):
        return None
    course = enrollment.course
    if dias == 1:
        msg = f'El curso "{course.titulo}" vence mañana. ¡Complétalo hoy!'
    else:
        msg = f'El curso "{course.titulo}" vence en {dias} días.'
    return create_notification(
        user=user,
        tipo=tipo,
        titulo=f"Tu curso vence en {dias} día{'s' if dias != 1 else ''}",
        mensaje=msg,
        referencia_id=enrollment.pk,
        referencia_tipo="enrollment",
    )


def notify_curso_vencido(user: "User", enrollment: "Enrollment") -> Notification | None:
    if _already_sent(user, Notification.Tipo.VENCIDO, enrollment.pk):
        return None
    course = enrollment.course
    return create_notification(
        user=user,
        tipo=Notification.Tipo.VENCIDO,
        titulo="Curso vencido",
        mensaje=f'El período de acceso al curso "{course.titulo}" ha finalizado.',
        referencia_id=enrollment.pk,
        referencia_tipo="enrollment",
    )


# ---------------------------------------------------------------------------
# User-facing queries
# ---------------------------------------------------------------------------


def get_unread_count(user: "User") -> int:
    return Notification.objects.filter(user=user, leida=False).count()


def mark_read(user: "User", notification_id: int | None = None) -> int:
    """Mark one or all notifications as read. Returns count of updated rows."""
    qs = Notification.objects.filter(user=user, leida=False)
    if notification_id is not None:
        qs = qs.filter(pk=notification_id)
    return qs.update(leida=True)
