"""
Course app service layer — Course CRUD + Module management.

All business logic lives here; views only handle HTTP serialization.
"""
from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, Any

import bleach
from django.db import models as django_models
from django.db.models import QuerySet

from apps.reports.models import AuditLog
from storage.factory import get_storage

from .models import Course, Enrollment, Module, ModuleProgress

if TYPE_CHECKING:
    from django.core.files.uploadedfile import InMemoryUploadedFile, UploadedFile
    from apps.users.models import User

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

PDF_MAGIC = b"%PDF"
PDF_MAX_BYTES = 50 * 1024 * 1024  # 50 MB

ALLOWED_HTML_TAGS = [
    "h1", "h2", "h3", "h4",
    "p", "ul", "ol", "li",
    "strong", "em", "a", "img",
    "br", "blockquote", "code", "pre",
]
ALLOWED_HTML_ATTRS: dict[str, list[str]] = {
    "a": ["href", "title", "target"],
    "img": ["src", "alt", "width", "height"],
}


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class CoursePermissionDenied(Exception):
    """Raised when a TRAINER tries to modify another trainer's course."""

    def __init__(self) -> None:
        super().__init__("Solo puedes modificar tus propios cursos.")


class CourseValidationError(Exception):
    """Business-logic validation failure in the course domain."""


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _assert_owner(course: "Course", user: "User") -> None:
    if user.role == "TRAINER" and course.created_by_id != user.pk:
        raise CoursePermissionDenied()


def _validate_pdf_file(file: Any) -> None:
    header = file.read(4)
    file.seek(0)
    if header != PDF_MAGIC:
        raise CourseValidationError(
            "El archivo no es un PDF válido (magic bytes incorrectos)."
        )
    file.seek(0, 2)
    size = file.tell()
    file.seek(0)
    if size > PDF_MAX_BYTES:
        raise CourseValidationError(
            f"El archivo supera el límite de 50 MB ({size // (1024*1024)} MB)."
        )


def _sanitize_html(raw: str) -> str:
    return bleach.clean(
        raw,
        tags=ALLOWED_HTML_TAGS,
        attributes=ALLOWED_HTML_ATTRS,
        strip=True,
    )


def _next_module_orden(course: "Course") -> int:
    last = course.modules.aggregate(max_orden=django_models.Max("orden"))["max_orden"]
    return (last or 0) + 1


# ---------------------------------------------------------------------------
# Course CRUD
# ---------------------------------------------------------------------------


def list_courses(user: "User", *, estado: str | None = None, area_id: int | None = None) -> "QuerySet[Course]":
    qs = Course.objects.select_related("instructor", "area", "created_by").prefetch_related(
        "audiencia_grupos"
    )
    if user.role == "TRAINER":
        qs = qs.filter(created_by=user)
    elif user.role == "USUARIO":
        # Regular users only see courses they are enrolled in
        enrolled_ids = Enrollment.objects.filter(user=user).values_list("course_id", flat=True)
        qs = qs.filter(pk__in=enrolled_ids)
    if estado:
        qs = qs.filter(estado=estado)
    if area_id:
        qs = qs.filter(area_id=area_id)
    return qs


def get_course(course_id: int, user: "User") -> "Course":
    try:
        course = Course.objects.select_related("instructor", "area", "created_by").prefetch_related(
            "audiencia_grupos", "modules"
        ).get(pk=course_id)
    except Course.DoesNotExist:
        raise Course.DoesNotExist(course_id)
    if user.role == "TRAINER":
        _assert_owner(course, user)
    return course


def create_course(data: dict, user: "User") -> "Course":
    groups = data.pop("audiencia_grupos", [])
    course = Course.objects.create(created_by=user, **data)
    if groups:
        course.audiencia_grupos.set(groups)
    return course


def update_course(course_id: int, data: dict, user: "User") -> "Course":
    course = get_course(course_id, user)
    _assert_owner(course, user)
    groups = data.pop("audiencia_grupos", None)
    for field, value in data.items():
        setattr(course, field, value)
    course.save()
    if groups is not None:
        course.audiencia_grupos.set(groups)
    course.refresh_from_db()
    return course


# ---------------------------------------------------------------------------
# Module management
# ---------------------------------------------------------------------------


def list_modules(course_id: int, user: "User") -> "QuerySet[Module]":
    course = get_course(course_id, user)
    return course.modules.all()


def add_module(course_id: int, data: dict, user: "User", pdf_file: Any | None = None) -> "Module":
    course = get_course(course_id, user)
    _assert_owner(course, user)

    tipo = data.get("tipo_contenido")

    if tipo == Module.TipoContenido.SCORM:
        raise CourseValidationError("SCORM disponible en Fase 2.")

    if tipo == Module.TipoContenido.PDF:
        if not pdf_file:
            raise CourseValidationError("Se requiere un archivo PDF para módulos de tipo PDF.")
        _validate_pdf_file(pdf_file)
        path = f"courses/{course_id}/modules/{uuid.uuid4()}.pdf"
        storage = get_storage()
        data["archivo_pdf"] = storage.save(path, pdf_file)

    if tipo == Module.TipoContenido.TEXTO:
        data["contenido_html"] = _sanitize_html(data.get("contenido_html", ""))

    if "orden" not in data or data["orden"] is None:
        data["orden"] = _next_module_orden(course)

    return Module.objects.create(course=course, **data)


def update_module(
    course_id: int,
    module_id: int,
    data: dict,
    user: "User",
    pdf_file: Any | None = None,
) -> "Module":
    course = get_course(course_id, user)
    _assert_owner(course, user)

    try:
        module = course.modules.get(pk=module_id)
    except Module.DoesNotExist:
        raise Module.DoesNotExist(module_id)

    tipo = data.get("tipo_contenido", module.tipo_contenido)

    if tipo == Module.TipoContenido.SCORM:
        raise CourseValidationError("SCORM disponible en Fase 2.")

    if pdf_file:
        if tipo != Module.TipoContenido.PDF:
            raise CourseValidationError("Solo se puede subir un archivo para módulos de tipo PDF.")
        _validate_pdf_file(pdf_file)
        if module.archivo_pdf:
            get_storage().delete(module.archivo_pdf)
        path = f"courses/{course_id}/modules/{uuid.uuid4()}.pdf"
        data["archivo_pdf"] = get_storage().save(path, pdf_file)

    if "contenido_html" in data:
        data["contenido_html"] = _sanitize_html(data["contenido_html"])

    for field, value in data.items():
        setattr(module, field, value)
    module.save()
    return module


def delete_module(course_id: int, module_id: int, user: "User") -> None:
    course = get_course(course_id, user)
    _assert_owner(course, user)

    try:
        module = course.modules.get(pk=module_id)
    except Module.DoesNotExist:
        raise Module.DoesNotExist(module_id)

    if module.archivo_pdf:
        get_storage().delete(module.archivo_pdf)

    module.delete()


# ---------------------------------------------------------------------------
# Publication + enrollment
# ---------------------------------------------------------------------------


def publish_course(course_id: int, user: "User", ip: str | None = None) -> "Course":
    """
    Publish a course and automatically enroll all users in the assigned groups.
    Creates a Notification per new Enrollment and records an AuditLog entry.
    """
    from apps.notifications.models import Notification
    from apps.notifications.services import create_notification

    course = get_course(course_id, user)
    _assert_owner(course, user)

    if not course.modules.exists():
        raise CourseValidationError(
            "No se puede publicar un curso sin módulos. Agrega al menos un módulo."
        )

    course.publish()  # raises ValueError if already published/archived

    enrollments_created = 0
    for group in course.audiencia_grupos.prefetch_related("members__user").all():
        for profile in group.members.select_related("user").filter(user__is_active=True):
            enrollment, created = Enrollment.objects.get_or_create(
                user=profile.user, course=course
            )
            if created:
                enrollments_created += 1
                create_notification(
                    user=profile.user,
                    tipo=Notification.Tipo.NUEVO_CURSO,
                    titulo=f"Nuevo curso asignado: {course.titulo}",
                    mensaje=(
                        f"Se te ha inscrito en el curso '{course.titulo}'. "
                        f"{'Fecha límite: ' + course.fecha_limite.strftime('%d/%m/%Y') if course.fecha_limite else 'Sin fecha límite.'}"
                    ),
                    referencia_id=course.pk,
                    referencia_tipo="course",
                )

    AuditLog.objects.create(
        user=user,
        accion="CURSO_PUBLICADO",
        ip=ip,
        detalles_json={
            "course_id": course.pk,
            "titulo": course.titulo,
            "enrollments_created": enrollments_created,
        },
    )

    return course


# ---------------------------------------------------------------------------
# Completion tracking + resume position
# ---------------------------------------------------------------------------


def complete_module(enrollment_id: int, module_id: int, user: "User") -> "Enrollment":
    """
    Mark a module as completed for a user's enrollment.

    Validates enrollment ownership and sequential unlock rules.
    Recalculates enrollment progress after marking complete.
    Idempotent: calling twice has no additional effect.
    """
    from django.utils import timezone

    try:
        enrollment = Enrollment.objects.select_related("course", "user").get(pk=enrollment_id)
    except Enrollment.DoesNotExist:
        raise Enrollment.DoesNotExist(enrollment_id)

    if enrollment.user_id != user.pk:
        raise CoursePermissionDenied()

    try:
        module = enrollment.course.modules.get(pk=module_id)
    except Module.DoesNotExist:
        raise Module.DoesNotExist(module_id)

    # Sequential lock: all prior modules must be completed first
    if module.es_secuencial and module.orden > 1:
        prev_modules = list(enrollment.course.modules.filter(orden__lt=module.orden))
        completed_ids = set(
            enrollment.module_progress.filter(is_completed=True).values_list("module_id", flat=True)
        )
        if not all(m.pk in completed_ids for m in prev_modules):
            raise CourseValidationError(
                "Debes completar los módulos anteriores antes de continuar."
            )

    progress, _ = ModuleProgress.objects.get_or_create(
        enrollment=enrollment,
        module=module,
    )
    if not progress.is_completed:
        progress.is_completed = True
        progress.fecha_completado = timezone.now()
        progress.save(update_fields=["is_completed", "fecha_completado"])

    enrollment.update_progress()
    enrollment.refresh_from_db()
    return enrollment


def update_module_position(
    enrollment_id: int, module_id: int, position_json: dict, user: "User"
) -> "ModuleProgress":
    """Save the user's current position in a module (video second, PDF page, text scroll)."""
    try:
        enrollment = Enrollment.objects.select_related("course").get(pk=enrollment_id)
    except Enrollment.DoesNotExist:
        raise Enrollment.DoesNotExist(enrollment_id)

    if enrollment.user_id != user.pk:
        raise CoursePermissionDenied()

    try:
        module = enrollment.course.modules.get(pk=module_id)
    except Module.DoesNotExist:
        raise Module.DoesNotExist(module_id)

    progress, _ = ModuleProgress.objects.get_or_create(
        enrollment=enrollment,
        module=module,
    )
    progress.last_position_json = position_json
    progress.save(update_fields=["last_position_json"])
    return progress


def get_module_progress(enrollment_id: int, module_id: int, user: "User") -> "ModuleProgress":
    """Return the user's progress record for a module; creates an empty one if missing."""
    try:
        enrollment = Enrollment.objects.select_related("course").get(pk=enrollment_id)
    except Enrollment.DoesNotExist:
        raise Enrollment.DoesNotExist(enrollment_id)

    if enrollment.user_id != user.pk:
        raise CoursePermissionDenied()

    try:
        module = enrollment.course.modules.get(pk=module_id)
    except Module.DoesNotExist:
        raise Module.DoesNotExist(module_id)

    progress, _ = ModuleProgress.objects.get_or_create(
        enrollment=enrollment,
        module=module,
    )
    return progress
