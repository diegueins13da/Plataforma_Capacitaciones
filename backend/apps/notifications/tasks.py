"""
Scheduled Celery tasks for deadline monitoring, enrollment expiration,
and transactional email delivery.
"""
from __future__ import annotations

import logging
from datetime import date, timedelta

from celery import shared_task
from django.conf import settings
from django.core.mail import EmailMultiAlternatives, get_connection
from django.db import transaction
from django.utils.html import strip_tags

logger = logging.getLogger(__name__)


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
                send_vencimiento_email.delay(enrollment.user.pk, enrollment.pk, dias)
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


def _get_setting(clave: str, default: str = "") -> str:
    """Read a value from SystemSetting table, falling back to default."""
    from apps.config.models import SystemSetting  # noqa: PLC0415
    try:
        obj = SystemSetting.objects.filter(clave=clave).only("valor").first()
        return obj.valor if obj and obj.valor else default
    except Exception:
        return default


def _build_enrollment_email_html(
    nombre: str,
    curso_titulo: str,
    curso_descripcion: str,
    modulos_count: int,
    plazo: str,
    acceso_url: str,
    company_name: str,
    logo_url: str,
    primary_color: str,
) -> str:
    modulos_line = (
        f'<td style="padding:6px 0;color:#6b7280;font-size:14px;">📚 Módulos</td>'
        f'<td style="padding:6px 0;font-size:14px;font-weight:600;color:#111827;">'
        f'{modulos_count} módulo{"s" if modulos_count != 1 else ""}</td>'
    ) if modulos_count else ""

    plazo_color = "#dc2626" if plazo != "Ilimitado" else "#6b7280"
    descripcion_block = (
        f'<p style="margin:0 0 20px 0;color:#4b5563;font-size:15px;line-height:1.7;">'
        f'{curso_descripcion}</p>'
    ) if curso_descripcion else ""

    logo_block = (
        f'<img src="{logo_url}" alt="{company_name}" '
        f'style="max-height:52px;max-width:240px;object-fit:contain;display:block;" />'
    ) if logo_url else (
        f'<span style="color:{primary_color};font-size:20px;font-weight:700;">{company_name}</span>'
    )

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>Nueva capacitación asignada</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
               style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;
                      overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- HEADER: white band so logo is visible -->
          <tr>
            <td style="background:#ffffff;padding:20px 40px;
                       border-bottom:4px solid {primary_color};">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>{logo_block}</td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="color:{primary_color};font-size:11px;font-weight:700;
                                 text-transform:uppercase;letter-spacing:1.5px;">
                      Capacitación
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- HERO BAND -->
          <tr>
            <td style="background:{primary_color};padding:28px 40px 32px 40px;">
              <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;line-height:1.3;">
                Nueva capacitación asignada
              </h1>
              <p style="margin:8px 0 0 0;color:rgba(255,255,255,0.85);font-size:15px;">
                Tienes una nueva actividad de formación pendiente
              </p>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="padding:36px 40px 0 40px;">
              <p style="margin:0 0 24px 0;color:#374151;font-size:16px;line-height:1.6;">
                Estimado/a <strong>{nombre}</strong>,
              </p>
              <p style="margin:0 0 24px 0;color:#4b5563;font-size:15px;line-height:1.7;">
                Se le ha asignado una nueva capacitación en la plataforma de formación corporativa.
                Le invitamos a completarla dentro del plazo establecido.
              </p>

              <!-- COURSE CARD -->
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;
                            margin-bottom:28px;">
                <tr>
                  <td style="padding:24px 28px;">
                    <p style="margin:0 0 4px 0;font-size:11px;font-weight:700;
                               color:{primary_color};text-transform:uppercase;letter-spacing:1px;">
                      Capacitación asignada
                    </p>
                    <h2 style="margin:0 0 16px 0;font-size:20px;font-weight:700;color:#111827;
                                line-height:1.4;">
                      {curso_titulo}
                    </h2>
                    {descripcion_block}
                    <table cellpadding="0" cellspacing="0">
                      {modulos_line}
                      <tr>
                        <td style="padding:6px 20px 6px 0;color:#6b7280;font-size:14px;">
                          ⏰ Plazo
                        </td>
                        <td style="padding:6px 0;font-size:14px;font-weight:600;
                                   color:{plazo_color};">
                          {plazo}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA BUTTON -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td align="center">
                    <a href="{acceso_url}" target="_blank"
                       style="display:inline-block;background:{primary_color};
                              color:#ffffff;font-size:16px;font-weight:700;
                              text-decoration:none;padding:16px 40px;border-radius:8px;
                              letter-spacing:0.3px;">
                      Ingresar a la capacitación →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 32px 0;color:#6b7280;font-size:13px;line-height:1.6;
                         border-top:1px solid #e5e7eb;padding-top:24px;">
                Si el botón no funciona, copie y pegue este enlace en su navegador:<br />
                <a href="{acceso_url}" style="color:{primary_color};word-break:break-all;">
                  {acceso_url}
                </a>
              </p>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #e5e7eb;
                        padding:24px 40px;text-align:center;">
              <p style="margin:0 0 4px 0;font-size:13px;font-weight:600;color:#374151;">
                Equipo de Capacitación
              </p>
              <p style="margin:0;font-size:12px;color:#9ca3af;">{company_name}</p>
              <p style="margin:12px 0 0 0;font-size:11px;color:#d1d5db;">
                Este es un mensaje automático, por favor no responda a este correo.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


@shared_task(name="notifications.send_enrollment_email", bind=True, max_retries=2)
def send_enrollment_email(self, user_id: int, course_id: int) -> dict:
    """
    Send a course-assignment notification email to the enrolled user.
    Reads SMTP credentials and branding from SystemSetting so no redeploy
    is needed when credentials change.
    Retries up to 2 times with 60-second backoff on transient SMTP errors.
    """
    from apps.courses.models import Course, Module  # noqa: PLC0415
    from django.contrib.auth import get_user_model  # noqa: PLC0415

    User = get_user_model()

    # Skip if NOTIFY_NEW_COURSE is disabled
    if _get_setting("NOTIFY_NEW_COURSE", "true").lower() != "true":
        return {"skipped": True, "reason": "NOTIFY_NEW_COURSE disabled"}

    try:
        user = User.objects.get(pk=user_id)
        course = Course.objects.get(pk=course_id)
    except (User.DoesNotExist, Course.DoesNotExist):
        return {"skipped": True, "reason": "user or course not found"}

    # Build variables
    nombre = user.get_full_name() or user.email
    modulos_count = Module.objects.filter(course=course).count()
    plazo = (
        course.fecha_limite.strftime("%d de %B de %Y")
        if course.fecha_limite
        else "Ilimitado"
    )
    frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:3000")
    acceso_url = f"{frontend_url}/courses/{course.pk}"

    # Branding from SystemSetting
    company_name = _get_setting("COMPANY_NAME", "Equipo de Capacitación")
    logo_url     = _get_setting("LOGO_URL", "")
    primary_color = _get_setting("PRIMARY_COLOR", "#1e3a5f")

    html_body = _build_enrollment_email_html(
        nombre=nombre,
        curso_titulo=course.titulo,
        curso_descripcion=course.descripcion or "",
        modulos_count=modulos_count,
        plazo=plazo,
        acceso_url=acceso_url,
        company_name=company_name,
        logo_url=logo_url,
        primary_color=primary_color,
    )
    text_body = (
        f"Estimado/a {nombre},\n\n"
        f"Se le ha asignado la siguiente capacitación: {course.titulo}\n\n"
        f"Plazo: {plazo}\n\n"
        f"Ingrese a la plataforma: {acceso_url}\n\n"
        f"Saludos,\nEquipo de Capacitación\n{company_name}"
    )

    # SMTP credentials from SystemSetting (override Django defaults)
    smtp_host     = _get_setting("EMAIL_HOST", settings.EMAIL_HOST)
    smtp_port     = int(_get_setting("EMAIL_PORT", str(settings.EMAIL_PORT)))
    smtp_user     = _get_setting("EMAIL_HOST_USER", settings.EMAIL_HOST_USER)
    smtp_password = _get_setting("EMAIL_HOST_PASSWORD", "")
    from_email    = _get_setting("DEFAULT_FROM_EMAIL", smtp_user) or smtp_user

    if not smtp_user or not smtp_password:
        logger.warning(
            "send_enrollment_email: SMTP credentials not configured — "
            "check EMAIL_HOST_USER / EMAIL_HOST_PASSWORD in SystemSetting."
        )
        return {"skipped": True, "reason": "SMTP credentials not configured"}

    try:
        connection = get_connection(
            backend="django.core.mail.backends.smtp.EmailBackend",
            host=smtp_host,
            port=smtp_port,
            username=smtp_user,
            password=smtp_password,
            use_tls=True,
            fail_silently=False,
        )
        msg = EmailMultiAlternatives(
            subject=f"Nueva capacitación asignada: {course.titulo}",
            body=text_body,
            from_email=f"Capacitación <{from_email}>",
            to=[user.email],
            connection=connection,
        )
        msg.attach_alternative(html_body, "text/html")
        msg.send()
        logger.info("Enrollment email sent to %s for course '%s'", user.email, course.titulo)
        return {"sent": True, "to": user.email, "course": course.titulo}
    except Exception as exc:
        logger.error("send_enrollment_email failed: %s", exc)
        raise self.retry(exc=exc, countdown=60)


# ── MFA email ─────────────────────────────────────────────────────────────────

@shared_task(name="notifications.send_mfa_email", bind=True, max_retries=2)
def send_mfa_email(self, user_id: int, mfa_token: str, otp_code: str, ip: str = "") -> dict:
    """
    Send a one-time MFA verification code.
    Retried up to 2× with 30-second backoff so a transient SMTP hiccup
    doesn't lock the user out of their account.
    """
    from django.contrib.auth import get_user_model  # noqa: PLC0415

    User = get_user_model()
    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return {"skipped": True, "reason": "user not found"}

    # In DEBUG, log the OTP so developers can test without SMTP configured
    if settings.DEBUG:
        logger.warning("[MFA DEBUG] OTP for %s: %s", user.email, otp_code)

    company_name  = _get_setting("COMPANY_NAME", "Equipo de Capacitación")
    logo_url      = _get_setting("LOGO_URL", "")
    primary_color = _get_setting("PRIMARY_COLOR", "#1e3a5f")
    nombre        = user.get_full_name() or user.email

    # Render each digit as an individual table cell (email-client safe — no flexbox)
    digit_cells = "".join(
        f'<td style="padding:0 5px;">'
        f'<div style="width:46px;height:58px;background:#f9fafb;'
        f'border:2px solid {primary_color};border-radius:10px;'
        f'text-align:center;line-height:58px;font-size:28px;font-weight:700;'
        f'color:#111827;font-family:monospace;">{d}</div></td>'
        for d in otp_code
    )
    ip_note = (
        f'<p style="margin:8px 0 0;font-size:12px;color:#9ca3af;">IP de origen: {ip}</p>'
        if ip else ""
    )

    inner_html = f"""
    <p style="margin:0 0 28px 0;color:#4b5563;font-size:15px;line-height:1.7;">
      Su código de verificación de acceso es:
    </p>
    <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
      <tr>{digit_cells}</tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0"
           style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;margin-bottom:28px;">
      <tr><td style="padding:20px 24px;">
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#c2410c;
                   text-transform:uppercase;letter-spacing:1px;">⏰ Importante</p>
        <p style="margin:0;font-size:14px;color:#7c2d12;line-height:1.65;">
          Este código es válido por <strong>10 minutos</strong> y de <strong>un solo uso</strong>.
          Nunca lo comparta con nadie, ni siquiera con soporte técnico.
        </p>
        {ip_note}
      </td></tr>
    </table>
    <p style="margin:0 0 32px 0;color:#6b7280;font-size:13px;line-height:1.6;
               border-top:1px solid #e5e7eb;padding-top:24px;">
      Si usted no intentó iniciar sesión, su contraseña puede estar comprometida.
      Cámbiela de inmediato desde la plataforma.
    </p>"""

    html_body = _build_notification_email_html(
        nombre=nombre,
        hero_bg=primary_color,
        hero_title="Verificación de acceso",
        hero_subtitle="Código de un solo uso para iniciar sesión",
        inner_html=inner_html,
        company_name=company_name,
        logo_url=logo_url,
        primary_color=primary_color,
    )
    text_body = (
        f"Estimado/a {nombre},\n\n"
        f"Su código de verificación de acceso es:\n\n"
        f"  {otp_code}\n\n"
        f"Este código es válido por 10 minutos y de un solo uso.\n"
        f"Nunca lo comparta con nadie.\n\n"
        f"Si usted no intentó iniciar sesión, cambie su contraseña de inmediato.\n\n"
        f"Saludos,\n{company_name}"
    )

    try:
        sent = _send_smtp_email(
            user.email,
            "Código de verificación — Acceso a la plataforma",
            html_body,
            text_body,
        )
    except Exception as exc:
        logger.error("send_mfa_email failed: %s", exc)
        raise self.retry(exc=exc, countdown=30)

    if sent:
        logger.info("MFA email sent to %s", user.email)
        return {"sent": True, "to": user.email}
    logger.warning("send_mfa_email: SMTP credentials not configured — check SystemSetting")
    return {"skipped": True, "reason": "SMTP not configured"}


# ── Shared helpers for notification emails ────────────────────────────────────

_MESES_ES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]


def _format_date_es(d) -> str:
    return f"{d.day} de {_MESES_ES[d.month - 1]} de {d.year}"


def _send_smtp_email(to_email: str, subject: str, html_body: str, text_body: str) -> bool:
    """Send via SMTP using credentials from SystemSetting. Returns False if not configured."""
    smtp_host     = _get_setting("EMAIL_HOST", settings.EMAIL_HOST)
    smtp_port     = int(_get_setting("EMAIL_PORT", str(settings.EMAIL_PORT)))
    smtp_user     = _get_setting("EMAIL_HOST_USER", settings.EMAIL_HOST_USER)
    smtp_password = _get_setting("EMAIL_HOST_PASSWORD", "")
    from_raw      = _get_setting("DEFAULT_FROM_EMAIL", smtp_user) or smtp_user
    company_name  = _get_setting("COMPANY_NAME", "Capacitación")

    if not smtp_user or not smtp_password:
        return False

    connection = get_connection(
        backend="django.core.mail.backends.smtp.EmailBackend",
        host=smtp_host, port=smtp_port, username=smtp_user,
        password=smtp_password, use_tls=True, fail_silently=False,
    )
    msg = EmailMultiAlternatives(
        subject=subject, body=text_body,
        from_email=f"{company_name} <{from_raw}>",
        to=[to_email], connection=connection,
    )
    msg.attach_alternative(html_body, "text/html")
    msg.send()
    return True


def _build_notification_email_html(
    *,
    nombre: str,
    hero_bg: str,
    hero_title: str,
    hero_subtitle: str,
    inner_html: str,
    company_name: str,
    logo_url: str,
    primary_color: str,
) -> str:
    logo_block = (
        f'<img src="{logo_url}" alt="{company_name}" '
        f'style="max-height:52px;max-width:240px;object-fit:contain;display:block;" />'
    ) if logo_url else (
        f'<span style="color:{primary_color};font-size:20px;font-weight:700;">{company_name}</span>'
    )
    return f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>{hero_title}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
             style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;
                    overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#ffffff;padding:20px 40px;border-bottom:4px solid {primary_color};">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td>{logo_block}</td>
              <td align="right" style="vertical-align:middle;">
                <span style="color:{primary_color};font-size:11px;font-weight:700;
                             text-transform:uppercase;letter-spacing:1.5px;">Capacitación</span>
              </td>
            </tr></table>
          </td>
        </tr>
        <tr>
          <td style="background:{hero_bg};padding:28px 40px 32px 40px;">
            <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;line-height:1.3;">
              {hero_title}
            </h1>
            <p style="margin:8px 0 0 0;color:rgba(255,255,255,0.85);font-size:15px;">
              {hero_subtitle}
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px 0 40px;">
            <p style="margin:0 0 24px 0;color:#374151;font-size:16px;line-height:1.6;">
              Estimado/a <strong>{nombre}</strong>,
            </p>
            {inner_html}
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:24px 40px;text-align:center;">
            <p style="margin:0 0 4px 0;font-size:13px;font-weight:600;color:#374151;">
              Equipo de Capacitación
            </p>
            <p style="margin:0;font-size:12px;color:#9ca3af;">{company_name}</p>
            <p style="margin:12px 0 0 0;font-size:11px;color:#d1d5db;">
              Este es un mensaje automático, por favor no responda a este correo.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


# ── Vencimiento email (7d / 1d reminder) ─────────────────────────────────────

@shared_task(name="notifications.send_vencimiento_email", bind=True, max_retries=2)
def send_vencimiento_email(self, user_id: int, enrollment_id: int, dias: int) -> dict:
    """Send a deadline-reminder email (7 days or 1 day before expiry)."""
    from apps.courses.models import Enrollment  # noqa: PLC0415
    from django.contrib.auth import get_user_model  # noqa: PLC0415

    User = get_user_model()
    try:
        user = User.objects.get(pk=user_id)
        enrollment = Enrollment.objects.select_related("course").get(pk=enrollment_id)
    except (User.DoesNotExist, Enrollment.DoesNotExist):
        return {"skipped": True, "reason": "user or enrollment not found"}

    course = enrollment.course
    nombre = user.get_full_name() or user.email
    fecha_str = _format_date_es(course.fecha_limite) if course.fecha_limite else "—"
    frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:3000")
    acceso_url = f"{frontend_url}/courses/{course.pk}"

    company_name  = _get_setting("COMPANY_NAME", "Equipo de Capacitación")
    logo_url      = _get_setting("LOGO_URL", "")
    primary_color = _get_setting("PRIMARY_COLOR", "#1e3a5f")

    if dias == 1:
        hero_bg    = "#dc2626"
        hero_title = "¡Tu capacitación vence mañana!"
        hero_sub   = "Complétala hoy para no perder el acceso"
        card_label = "⚠️ Vence mañana"
        card_color = "#dc2626"
        cta_label  = "¡Completar ahora!"
        body_msg   = "Le recordamos que su capacitación vence <strong>mañana</strong>. Aún puede completarla a tiempo."
        subject    = f"¡Urgente! Tu capacitación vence mañana: {course.titulo}"
    else:
        hero_bg    = "#b45309"
        hero_title = "Recordatorio de vencimiento"
        hero_sub   = "Tu capacitación vence en 7 días"
        card_label = "📅 Vence en 7 días"
        card_color = "#b45309"
        cta_label  = "Continuar capacitación"
        body_msg   = "Le recordamos que tiene <strong>7 días</strong> para completar su capacitación."
        subject    = f"Recordatorio: Tu capacitación vence en 7 días — {course.titulo}"

    inner_html = f"""
    <p style="margin:0 0 24px 0;color:#4b5563;font-size:15px;line-height:1.7;">{body_msg}</p>
    <table width="100%" cellpadding="0" cellspacing="0"
           style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;margin-bottom:28px;">
      <tr><td style="padding:24px 28px;">
        <p style="margin:0 0 4px 0;font-size:11px;font-weight:700;
                   color:{card_color};text-transform:uppercase;letter-spacing:1px;">{card_label}</p>
        <h2 style="margin:0 0 16px 0;font-size:20px;font-weight:700;color:#111827;line-height:1.4;">
          {course.titulo}
        </h2>
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="padding:6px 20px 6px 0;color:#6b7280;font-size:14px;">📅 Fecha límite</td>
          <td style="padding:6px 0;font-size:14px;font-weight:600;color:{card_color};">{fecha_str}</td>
        </tr></table>
      </td></tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
      <tr><td align="center">
        <a href="{acceso_url}" target="_blank"
           style="display:inline-block;background:{card_color};color:#ffffff;
                  font-size:16px;font-weight:700;text-decoration:none;
                  padding:16px 40px;border-radius:8px;">{cta_label} →</a>
      </td></tr>
    </table>
    <p style="margin:0 0 32px 0;color:#6b7280;font-size:13px;line-height:1.6;
               border-top:1px solid #e5e7eb;padding-top:24px;">
      Si el botón no funciona, copie y pegue este enlace en su navegador:<br />
      <a href="{acceso_url}" style="color:{primary_color};word-break:break-all;">{acceso_url}</a>
    </p>"""

    html_body = _build_notification_email_html(
        nombre=nombre, hero_bg=hero_bg, hero_title=hero_title, hero_subtitle=hero_sub,
        inner_html=inner_html, company_name=company_name, logo_url=logo_url,
        primary_color=primary_color,
    )
    text_body = (
        f"Estimado/a {nombre},\n\n{strip_tags(body_msg)}\n\n"
        f"Curso: {course.titulo}\n"
        f"Fecha límite: {fecha_str}\n\n"
        f"Ingrese a la plataforma: {acceso_url}\n\n"
        f"Saludos,\nEquipo de Capacitación\n{company_name}"
    )

    try:
        sent = _send_smtp_email(user.email, subject, html_body, text_body)
    except Exception as exc:
        logger.error("send_vencimiento_email failed: %s", exc)
        raise self.retry(exc=exc, countdown=60)

    if sent:
        logger.info("Vencimiento email (%sd) sent to %s for '%s'", dias, user.email, course.titulo)
        return {"sent": True, "to": user.email, "dias": dias}
    logger.warning("send_vencimiento_email: SMTP credentials not configured")
    return {"skipped": True, "reason": "SMTP credentials not configured"}


# ── Exam result email (approved / failed) ─────────────────────────────────────

@shared_task(name="notifications.send_examen_result_email", bind=True, max_retries=2)
def send_examen_result_email(
    self,
    user_id: int,
    enrollment_id: int,
    calificacion: float,
    aprobado: bool,
    intentos_restantes: int,
) -> dict:
    """Send an exam-result notification email (congratulations or encouragement)."""
    from apps.courses.models import Enrollment  # noqa: PLC0415
    from django.contrib.auth import get_user_model  # noqa: PLC0415

    User = get_user_model()
    try:
        user = User.objects.get(pk=user_id)
        enrollment = Enrollment.objects.select_related("course").get(pk=enrollment_id)
    except (User.DoesNotExist, Enrollment.DoesNotExist):
        return {"skipped": True, "reason": "user or enrollment not found"}

    course = enrollment.course
    nombre = user.get_full_name() or user.email
    frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:3000")
    acceso_url = f"{frontend_url}/courses/{course.pk}"
    score_str = f"{calificacion:.1f}%"

    company_name  = _get_setting("COMPANY_NAME", "Equipo de Capacitación")
    logo_url      = _get_setting("LOGO_URL", "")
    primary_color = _get_setting("PRIMARY_COLOR", "#1e3a5f")

    if aprobado:
        hero_bg      = primary_color
        hero_title   = "¡Felicitaciones, aprobaste!"
        hero_sub     = "Has completado exitosamente la evaluación"
        result_color = "#15803d"
        result_label = "¡Aprobado!"
        body_msg     = "Ha completado exitosamente la evaluación. Su esfuerzo y dedicación han dado frutos."
        subject      = f"¡Aprobaste! — {course.titulo}"
        attempts_row = ""
        cta_html     = f"""
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
          <tr><td align="center">
            <a href="{acceso_url}" target="_blank"
               style="display:inline-block;background:{primary_color};color:#ffffff;
                      font-size:16px;font-weight:700;text-decoration:none;
                      padding:16px 40px;border-radius:8px;">Ver mis logros →</a>
          </td></tr>
        </table>"""
    else:
        hero_bg      = "#d97706"
        hero_title   = "Resultado de tu evaluación"
        hero_sub     = "Revisa tu calificación y vuelve a intentarlo"
        result_color = "#b45309"
        result_label = "No aprobado"
        body_msg     = "No alcanzaste el puntaje mínimo requerido. ¡Ánimo! Cada intento te acerca más al objetivo."
        subject      = f"Resultado de evaluación: {course.titulo}"
        if intentos_restantes > 0:
            attempts_row = f"""
            <tr>
              <td style="padding:6px 20px 6px 0;color:#6b7280;font-size:14px;">🔄 Intentos restantes</td>
              <td style="padding:6px 0;font-size:14px;font-weight:600;color:#374151;">
                {intentos_restantes}
              </td>
            </tr>"""
            cta_html = f"""
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
              <tr><td align="center">
                <a href="{acceso_url}" target="_blank"
                   style="display:inline-block;background:#d97706;color:#ffffff;
                          font-size:16px;font-weight:700;text-decoration:none;
                          padding:16px 40px;border-radius:8px;">Reintentar examen →</a>
              </td></tr>
            </table>"""
        else:
            attempts_row = """
            <tr>
              <td colspan="2" style="padding:10px 0;font-size:14px;color:#dc2626;">
                Ha agotado los intentos disponibles. Contacte a su instructor.
              </td>
            </tr>"""
            cta_html = ""

    inner_html = f"""
    <p style="margin:0 0 24px 0;color:#4b5563;font-size:15px;line-height:1.7;">{body_msg}</p>
    <table width="100%" cellpadding="0" cellspacing="0"
           style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;margin-bottom:28px;">
      <tr><td style="padding:24px 28px;">
        <p style="margin:0 0 4px 0;font-size:11px;font-weight:700;
                   color:{result_color};text-transform:uppercase;letter-spacing:1px;">
          📋 Resultado del examen
        </p>
        <h2 style="margin:0 0 16px 0;font-size:20px;font-weight:700;color:#111827;line-height:1.4;">
          {course.titulo}
        </h2>
        <table cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:6px 20px 6px 0;color:#6b7280;font-size:14px;">📊 Calificación</td>
            <td style="padding:6px 0;font-size:22px;font-weight:700;color:{result_color};">
              {score_str}
              <span style="font-size:13px;color:#6b7280;font-weight:400;margin-left:8px;">
                {result_label}
              </span>
            </td>
          </tr>
          {attempts_row}
        </table>
      </td></tr>
    </table>
    {cta_html}
    <p style="margin:0 0 32px 0;color:#6b7280;font-size:13px;line-height:1.6;
               border-top:1px solid #e5e7eb;padding-top:24px;">
      Si el botón no funciona, copie y pegue este enlace en su navegador:<br />
      <a href="{acceso_url}" style="color:{primary_color};word-break:break-all;">{acceso_url}</a>
    </p>"""

    html_body = _build_notification_email_html(
        nombre=nombre, hero_bg=hero_bg, hero_title=hero_title, hero_subtitle=hero_sub,
        inner_html=inner_html, company_name=company_name, logo_url=logo_url,
        primary_color=primary_color,
    )
    estado_str = "Aprobado" if aprobado else "No aprobado"
    text_body = (
        f"Estimado/a {nombre},\n\n{body_msg}\n\n"
        f"Curso: {course.titulo}\n"
        f"Calificación: {score_str} — {estado_str}\n"
    )
    if not aprobado and intentos_restantes > 0:
        text_body += f"Intentos restantes: {intentos_restantes}\n"
    text_body += (
        f"\nIngrese a la plataforma: {acceso_url}\n\n"
        f"Saludos,\nEquipo de Capacitación\n{company_name}"
    )

    try:
        sent = _send_smtp_email(user.email, subject, html_body, text_body)
    except Exception as exc:
        logger.error("send_examen_result_email failed: %s", exc)
        raise self.retry(exc=exc, countdown=60)

    if sent:
        logger.info(
            "Exam result email sent to %s for '%s' (aprobado=%s)",
            user.email, course.titulo, aprobado,
        )
        return {"sent": True, "to": user.email, "aprobado": aprobado}
    logger.warning("send_examen_result_email: SMTP credentials not configured")
    return {"skipped": True, "reason": "SMTP credentials not configured"}
