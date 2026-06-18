"""
Scheduled Celery tasks for deadline monitoring and enrollment expiration.
Both tasks run daily at 07:00 UTC (configured in django-celery-beat).
"""
from __future__ import annotations

from datetime import date, timedelta

from celery import shared_task
from django.db import transaction


@shared_task(name="notifications.check_upcoming_deadlines")
def check_upcoming_deadlines() -> dict:
    """
    Notify users whose course deadline is 7 or 1 day away.
    Uses a 25-hour dedup window to avoid duplicate notifications.
    """
    from apps.courses.models import Enrollment  # noqa: PLC0415

    from .services import notify_vencimiento  # noqa: PLC0415

    today = date.today()
    targets = {7: today + timedelta(days=7), 1: today + timedelta(days=1)}
    sent = 0

    for dias, target_date in targets.items():
        enrollments = Enrollment.objects.select_related("user", "course").filter(
            estado=Enrollment.Estado.EN_PROGRESO,
            course__fecha_limite=target_date,
        )
        for enrollment in enrollments:
            notif = notify_vencimiento(enrollment.user, enrollment, dias)
            if notif:
                sent += 1

    return {"checked": True, "notifications_sent": sent}


@shared_task(name="notifications.close_expired_enrollments")
def close_expired_enrollments() -> dict:
    """
    Mark EN_PROGRESO enrollments as VENCIDO when course.fecha_limite < today.
    Generates a `VENCIDO` notification for each affected user.
    """
    from apps.courses.models import Enrollment  # noqa: PLC0415

    from .services import notify_curso_vencido  # noqa: PLC0415

    today = date.today()
    expired_enrollments = Enrollment.objects.select_related("user", "course").filter(
        estado=Enrollment.Estado.EN_PROGRESO,
        course__fecha_limite__lt=today,
        course__fecha_limite__isnull=False,
    )

    closed = 0
    with transaction.atomic():
        for enrollment in expired_enrollments:
            enrollment.estado = Enrollment.Estado.VENCIDO
            enrollment.save(update_fields=["estado"])
            notify_curso_vencido(enrollment.user, enrollment)
            closed += 1

    return {"closed": closed}
