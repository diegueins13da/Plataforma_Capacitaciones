"""
Dynamic email utility — reads SMTP settings from the system_settings table
at send-time so any admin change takes effect immediately without a restart.

Usage (drop-in replacement for django.core.mail.send_mail):
    from apps.config.email import send_mail
    send_mail(subject="Hi", message="body", recipient_list=["user@example.com"])
"""
from __future__ import annotations


def _get_smtp_settings() -> dict:
    """Read SMTP settings from DB. Returns a dict or raises if unconfigured."""
    from .models import SystemSetting

    keys = [
        "EMAIL_HOST",
        "EMAIL_PORT",
        "EMAIL_HOST_USER",
        "EMAIL_HOST_PASSWORD",
        "EMAIL_USE_TLS",
        "DEFAULT_FROM_EMAIL",
    ]
    qs = SystemSetting.objects.filter(clave__in=keys)
    db = {s.clave: s.get_value() for s in qs}

    host = db.get("EMAIL_HOST", "")
    if not host:
        raise SMTPNotConfiguredError(
            "El servidor SMTP no está configurado. "
            "Ve a Administración → Configuración → Correo electrónico."
        )

    return {
        "host": host,
        "port": int(db.get("EMAIL_PORT") or 587),
        "username": db.get("EMAIL_HOST_USER", ""),
        "password": db.get("EMAIL_HOST_PASSWORD", ""),
        "use_tls": bool(db.get("EMAIL_USE_TLS", True)),
        "from_email": db.get("DEFAULT_FROM_EMAIL", "") or db.get("EMAIL_HOST_USER", ""),
    }


class SMTPNotConfiguredError(Exception):
    """Raised when EMAIL_HOST is empty in system_settings."""


def send_mail(
    subject: str,
    message: str,
    recipient_list: list[str],
    *,
    html_message: str | None = None,
    from_email: str | None = None,
    fail_silently: bool = False,
) -> int:
    """
    Send an email using SMTP settings from the system_settings table.
    Returns 1 on success, 0 on failure (when fail_silently=True).
    Raises SMTPNotConfiguredError or smtplib errors when fail_silently=False.
    """
    from django.core.mail.backends.smtp import EmailBackend
    from django.core.mail import EmailMultiAlternatives

    try:
        cfg = _get_smtp_settings()
        sender = from_email or cfg["from_email"]

        backend = EmailBackend(
            host=cfg["host"],
            port=cfg["port"],
            username=cfg["username"],
            password=cfg["password"],
            use_tls=cfg["use_tls"],
            use_ssl=False,
            fail_silently=fail_silently,
            timeout=10,
        )

        email = EmailMultiAlternatives(
            subject=subject,
            body=message,
            from_email=sender,
            to=recipient_list,
            connection=backend,
        )
        if html_message:
            email.attach_alternative(html_message, "text/html")

        return email.send(fail_silently=fail_silently)

    except SMTPNotConfiguredError:
        if fail_silently:
            return 0
        raise
    except Exception:
        if fail_silently:
            return 0
        raise


def send_test_email(recipient: str) -> dict:
    """
    Send a test email and return a result dict.
    Used by the /config/test-email/ endpoint.
    """
    import traceback

    try:
        cfg = _get_smtp_settings()
        count = send_mail(
            subject="✅ Correo de prueba — LMS Corporativo",
            message=(
                "Este es un correo de prueba enviado desde el panel de administración.\n\n"
                "Si recibes este mensaje, la configuración SMTP está correcta.\n\n"
                f"Configuración utilizada:\n"
                f"  Servidor: {cfg['host']}:{cfg['port']}\n"
                f"  Usuario:  {cfg['username']}\n"
                f"  TLS:      {'Sí' if cfg['use_tls'] else 'No'}\n"
                f"  Remitente: {cfg['from_email']}"
            ),
            recipient_list=[recipient],
            fail_silently=False,
        )
        return {
            "ok": count > 0,
            "message": f"Correo enviado correctamente a {recipient}.",
            "config": {
                "host": cfg["host"],
                "port": cfg["port"],
                "username": cfg["username"],
                "use_tls": cfg["use_tls"],
                "from_email": cfg["from_email"],
            },
        }
    except SMTPNotConfiguredError as exc:
        return {"ok": False, "message": str(exc), "config": {}}
    except Exception as exc:
        return {
            "ok": False,
            "message": f"Error al conectar con el servidor SMTP: {exc}",
            "detail": traceback.format_exc(),
            "config": {},
        }
