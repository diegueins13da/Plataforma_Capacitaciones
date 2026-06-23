"""
Centralized audit logging utility.

All application code must call `log_event()` instead of
`AuditLog.objects.create()` directly.  This ensures:
  - actor snapshot fields are always populated (non-repudiation)
  - IP and User-Agent are extracted consistently from the request
  - the event catalog is the single source of truth

Event catalog
-------------
Authentication
    LOGIN_SUCCESS         User authenticated successfully
    LOGIN_FAILED          Authentication attempt failed
    LOGOUT                User explicitly logged out
    ACCOUNT_LOCKED        Account locked after repeated failures
    ACCOUNT_UNLOCKED      Admin manually unlocked an account
    PASSWORD_CHANGED      User changed their own password
    PASSWORD_RESET        Password reset via recovery code

Users
    USER_CREATED          Admin created a new user
    USER_UPDATED          User profile / data changed
    USER_DEACTIVATED      Account deactivated
    USER_ACTIVATED        Account reactivated
    ROLE_CHANGED          User role changed
    BULK_USER_IMPORT      Bulk CSV import completed
    RUBRICA_UPLOADED      Trainer uploaded their signature image
    RUBRICA_REPLACED      Trainer replaced their existing signature image
    RUBRICA_AUTO_GENERATED  System auto-generated a signature from the trainer's name

Courses
    COURSE_CREATED        New course record created
    COURSE_UPDATED        Course metadata edited
    COURSE_PUBLISHED      Course moved to PUBLICADO
    COURSE_ARCHIVED       Course moved to ARCHIVADO
    COURSE_DELETED        Course permanently deleted
    MODULE_CREATED        Module added to a course
    MODULE_UPDATED        Module content/metadata edited
    MODULE_DELETED        Module removed from a course

Assessments & exams
    ASSESSMENT_UPDATED    Evaluation config changed (min score, attempts…)
    QUESTION_CREATED      Question added to the bank
    QUESTION_UPDATED      Question edited
    QUESTION_DELETED      Question removed
    EXAM_STARTED          User began an exam attempt
    EXAM_COMPLETED        Exam attempt submitted (pass or fail recorded in detalle)
    EXAM_ATTEMPTS_RESET   Admin reset attempts for a user

Enrollments
    COURSE_ENROLLED       User enrolled in a course

Certificates
    CERTIFICATE_GENERATED       PDF certificate created successfully
    CERTIFICATE_DOWNLOADED      User/admin downloaded a certificate PDF
    CERTIFICATE_GENERATION_FAILED  PDF generation failed

Configuration
    CONFIG_UPDATED        System configuration parameter changed
    BRANDING_UPDATED      Branding (logo, colors, name) updated
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from .models import AuditLog


def log_event(
    *,
    accion: str,
    resultado: str = "OK",
    request: Any = None,
    actor: Any = None,
    ip: str | None = None,
    entidad_tipo: str = "",
    entidad_id: str | int = "",
    entidad_nombre: str = "",
    detalle: dict | None = None,
    error_detalle: str = "",
) -> "AuditLog":
    """
    Create an immutable AuditLog record.

    Parameters
    ----------
    accion          Event code from the catalog above (UPPERCASE_SNAKE_CASE)
    resultado       "OK" (default) or "ERROR"
    request         DRF/Django request — used to extract user, IP, User-Agent
    actor           Explicit User instance (overrides request.user)
    ip              Override IP address (used when request is unavailable)
    entidad_tipo    Type of the affected object, e.g. "Course", "User"
    entidad_id      PK/UUID of the affected object
    entidad_nombre  Human-readable name of the object at the time of the event
    detalle         Extra structured payload (before/after state, counts, etc.)
    error_detalle   Full error message or traceback excerpt when resultado=ERROR
    """
    from .models import AuditLog

    # ── Resolve actor ─────────────────────────────────────────────────────────
    user = actor
    if user is None and request is not None:
        req_user = getattr(request, "user", None)
        if req_user is not None and getattr(req_user, "is_authenticated", False):
            user = req_user

    # ── Snapshot actor identity at this moment ────────────────────────────────
    actor_email = ""
    actor_nombre = ""
    actor_rol = ""
    if user is not None:
        actor_email = getattr(user, "email", "") or ""
        full_name = ""
        if callable(getattr(user, "get_full_name", None)):
            full_name = user.get_full_name().strip()
        actor_nombre = full_name or actor_email
        actor_rol = getattr(user, "role", "") or ""

    # ── Resolve IP ────────────────────────────────────────────────────────────
    resolved_ip = ip
    if resolved_ip is None and request is not None:
        forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
        resolved_ip = (
            forwarded.split(",")[0].strip()
            if forwarded
            else request.META.get("REMOTE_ADDR")
        ) or None

    # ── Resolve User-Agent ────────────────────────────────────────────────────
    ua = ""
    if request is not None:
        ua = (request.META.get("HTTP_USER_AGENT") or "")[:500]

    return AuditLog.objects.create(
        user=user,
        accion=accion,
        ip=resolved_ip,
        detalles_json=detalle or {},
        # snapshot fields
        actor_email=actor_email,
        actor_nombre=actor_nombre,
        actor_rol=actor_rol,
        user_agent=ua,
        # result
        resultado=resultado,
        error_detalle=(error_detalle or "")[:2000],
        # entity
        entidad_tipo=entidad_tipo,
        entidad_id=str(entidad_id) if entidad_id else "",
        entidad_nombre=(entidad_nombre or "")[:300],
    )
