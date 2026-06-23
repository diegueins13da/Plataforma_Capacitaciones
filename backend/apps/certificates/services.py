"""
Certificate generation service.

Generates a PDF certificate using WeasyPrint from an HTML template.
Called directly (sync) or via Celery task (async).

Rules:
  - A certificate is issued ONCE per enrollment.
  - Once url_pdf is set, this service will refuse to overwrite it.
  - Signatures (rubrica) are embedded at generation time and never change.
"""
from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import TYPE_CHECKING

from django.conf import settings
from django.template.loader import render_to_string
from django.utils import timezone

if TYPE_CHECKING:
    from apps.courses.models import Certificate

logger = logging.getLogger(__name__)

# ── Helpers ────────────────────────────────────────────────────────────────


def _hex_to_rgb(hex_color: str) -> str:
    """Convert #rrggbb to 'r, g, b' string for CSS rgba()."""
    hex_color = hex_color.lstrip("#")
    try:
        r, g, b = int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16)
        return f"{r}, {g}, {b}"
    except Exception:
        return "79, 70, 229"  # indigo fallback


def _get_setting(clave: str, default: str = "") -> str:
    """Read a SystemSetting value without crashing if table doesn't exist."""
    try:
        from apps.config.models import SystemSetting
        setting = SystemSetting.objects.filter(clave=clave).first()
        return setting.valor if setting else default
    except Exception:
        return default


def _absolute_media_path(relative_url: str) -> str:
    """Convert a relative media URL (/media/...) to an absolute file path for WeasyPrint."""
    if not relative_url:
        return ""
    if relative_url.startswith("/media/"):
        return os.path.join(settings.MEDIA_ROOT, relative_url[len("/media/"):])
    if relative_url.startswith("http"):
        return relative_url
    return relative_url


def _month_name_es(month: int) -> str:
    months = [
        "enero", "febrero", "marzo", "abril", "mayo", "junio",
        "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
    ]
    return months[month - 1]


# ── Main public function ───────────────────────────────────────────────────


def generate_certificate_pdf(certificate_id: str) -> str | None:
    """
    Generate and persist the PDF for a given Certificate.

    Returns the relative URL of the saved PDF, or None on failure.
    Raises ValueError if the certificate already has a PDF (immutability rule).
    """
    from apps.courses.models import Certificate

    try:
        cert = Certificate.objects.select_related(
            "user__profile",
            "course__instructor__profile",
            "enrollment",
        ).get(pk=certificate_id)
    except Certificate.DoesNotExist:
        logger.error("Certificate %s not found", certificate_id)
        return None

    if cert.url_pdf:
        raise ValueError(
            f"Certificate {certificate_id} already has a PDF — immutability rule prevents regeneration."
        )

    # ── Gather all template context ──────────────────────────────────────
    primary_color = _get_setting("PRIMARY_COLOR", "#1a7a3c")
    accent_color = _get_setting("ACCENT_COLOR", "#c9a227")  # gold fallback
    company_name = _get_setting("COMPANY_NAME", "Mi Empresa")
    system_name = _get_setting("SYSTEM_NAME", "LMS Corporativo")
    logo_url = _get_setting("LOGO_URL", "")
    cert_city = _get_setting("CERT_CITY", "la ciudad")
    manager_title = _get_setting("CERT_MANAGER_TITLE", "GERENTE GENERAL")
    manager_name = _get_setting("CERT_MANAGER_NAME", "")
    rubrica_gerente_url = _absolute_media_path(_get_setting("RUBRICA_GERENTE_URL", ""))

    participant = cert.user
    course = cert.course
    instructor = course.instructor

    completion_dt = cert.enrollment.fecha_completado if cert.enrollment else cert.fecha_emision
    completion_date = (completion_dt or cert.fecha_emision).astimezone(timezone.get_current_timezone())

    rubrica_instructor = ""
    if instructor and hasattr(instructor, "profile") and instructor.profile.rubrica:
        rubrica_instructor = _absolute_media_path(instructor.profile.rubrica.url)

    logo_path = _absolute_media_path(logo_url)

    context = {
        "primary_color": primary_color,
        "accent_color": accent_color,
        "primary_rgb": _hex_to_rgb(primary_color),
        "company_name": company_name,
        "logo_url": logo_path,
        "cert_city": cert_city,
        "participant_name": participant.get_full_name() or participant.email,
        "course_title": course.titulo,
        "duration_hours": course.duracion_horas or 0,
        "completion_day": completion_date.day,
        "completion_month_year": f"{_month_name_es(completion_date.month)} del {completion_date.year}",
        "instructor_name": instructor.get_full_name() if instructor else system_name,
        "manager_name": manager_name,
        "manager_title": manager_title,
        "rubrica_gerente_url": rubrica_gerente_url,
        "rubrica_instructor_url": rubrica_instructor,
        "cert_id": str(cert.id),
        "nota_obtenida": str(cert.nota_obtenida) if cert.nota_obtenida else "",
    }

    # ── Render HTML ───────────────────────────────────────────────────────
    html_string = render_to_string("certificates/certificate.html", context)

    # ── Generate PDF with WeasyPrint ──────────────────────────────────────
    try:
        from weasyprint import HTML as WeasyHTML
        from weasyprint.text.fonts import FontConfiguration
    except ImportError:
        logger.error("WeasyPrint is not installed. Cannot generate certificate PDF.")
        return None

    output_dir = Path(settings.MEDIA_ROOT) / "certificates"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"{cert.id}.pdf"

    try:
        font_config = FontConfiguration()
        WeasyHTML(string=html_string, base_url=settings.MEDIA_ROOT).write_pdf(
            str(output_path),
            font_config=font_config,
        )
    except Exception as exc:
        logger.exception("WeasyPrint failed for certificate %s: %s", certificate_id, exc)
        return None

    # ── Persist URL (immutable write) ────────────────────────────────────
    relative_url = f"/media/certificates/{cert.id}.pdf"
    Certificate.objects.filter(pk=certificate_id, url_pdf="").update(url_pdf=relative_url)

    logger.info("Certificate %s PDF generated at %s", certificate_id, relative_url)
    return relative_url
