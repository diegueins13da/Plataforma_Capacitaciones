from django.conf import settings
from django.http import JsonResponse


def lockout_response(request, credentials, *args, **kwargs):
    """
    Called by django-axes when a login attempt is blocked.
    Returns HTTP 423 Locked with a structured JSON body.
    Also logs the lockout event to AuditLog.
    """
    _log_lockout(request, credentials)

    cooloff = getattr(settings, "AXES_COOLOFF_TIME", None)
    if cooloff is None:
        minutes_remaining = 15
    else:
        from datetime import timedelta

        if isinstance(cooloff, timedelta):
            minutes_remaining = int(cooloff.total_seconds() / 60)
        else:
            minutes_remaining = int(cooloff * 60)  # axes accepts hours as float

    return JsonResponse(
        {
            "locked": True,
            "minutes_remaining": minutes_remaining,
            "message": (
                f"Cuenta bloqueada por demasiados intentos fallidos. "
                f"Intenta de nuevo en {minutes_remaining} minutos."
            ),
        },
        status=423,
    )


def _log_lockout(request, credentials: dict) -> None:
    """Silently records the lockout event. Errors must not break the lockout flow."""
    try:
        from apps.authentication.services import get_client_ip
        from apps.users.models import User

        email = credentials.get("username") or (request.POST or {}).get("email", "")
        user = None
        if email:
            try:
                user = User.objects.get(email=email)
            except User.DoesNotExist:
                pass

        from apps.reports.audit import log_event
        log_event(
            accion="ACCOUNT_LOCKED",
            actor=user,
            ip=get_client_ip(request),
            entidad_tipo="User",
            entidad_id=user.pk if user else "",
            entidad_nombre=email,
            detalle={"trigger": "axes_lockout"},
        )
    except Exception:  # noqa: BLE001
        pass  # Logging failure must never prevent the lockout response from being sent
