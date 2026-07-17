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

from apps.reports.audit import log_event
from storage.factory import get_storage

from .models import Course, Enrollment, Module, ModuleProgress, Tema

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


def _next_tema_orden(module: "Module") -> int:
    last = module.temas.aggregate(max_orden=django_models.Max("orden"))["max_orden"]
    return (last or 0) + 1


def _validate_video_file(file: Any) -> None:
    ALLOWED = (b"ftyp", b"moov", b"mdat", b"free", b"wide")
    file.seek(4)
    box_type = file.read(4)
    file.seek(0)
    # Accept any file <= 500 MB — strict format check is optional
    file.seek(0, 2)
    size = file.tell()
    file.seek(0)
    if size > 500 * 1024 * 1024:
        raise CourseValidationError("El video supera el límite de 500 MB.")


def _validate_image_file(file: Any) -> None:
    header = file.read(8)
    file.seek(0)
    MAGIC = [b"\xff\xd8\xff", b"\x89PNG", b"GIF8", b"RIFF", b"WEBP"]
    if not any(header.startswith(m) for m in MAGIC):
        raise CourseValidationError("El archivo no es una imagen válida (JPG, PNG, GIF, WebP).")
    file.seek(0, 2)
    if file.tell() > 10 * 1024 * 1024:
        raise CourseValidationError("La imagen supera el límite de 10 MB.")
    file.seek(0)


# ---------------------------------------------------------------------------
# Course CRUD
# ---------------------------------------------------------------------------


def list_courses(
    user: "User",
    *,
    estado: str | None = None,
    area_id: int | None = None,
    as_student: bool = False,
) -> "QuerySet[Course]":
    qs = Course.objects.select_related("instructor", "area", "created_by").prefetch_related(
        "audiencia_grupos"
    )
    if user.role == "ADMIN" and not as_student:
        pass  # Admin sees all courses without enrollment filter
    elif user.role == "TRAINER" and not as_student:
        qs = qs.filter(created_by=user)
    else:
        # USUARIO always, or TRAINER/ADMIN requesting their student view
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
        is_enrolled = Enrollment.objects.filter(course=course, user=user).exists()
        if not is_enrolled:
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


def add_module(course_id: int, data: dict, user: "User") -> "Module":
    course = get_course(course_id, user)
    _assert_owner(course, user)
    if "orden" not in data or data["orden"] is None:
        data["orden"] = _next_module_orden(course)
    # Strip any stale content fields if passed from old clients
    for f in ("tipo_contenido", "url_video", "archivo_pdf", "contenido_html", "duracion_minutos"):
        data.pop(f, None)
    return Module.objects.create(course=course, **data)


def update_module(course_id: int, module_id: int, data: dict, user: "User") -> "Module":
    course = get_course(course_id, user)
    _assert_owner(course, user)
    try:
        module = course.modules.get(pk=module_id)
    except Module.DoesNotExist:
        raise Module.DoesNotExist(module_id)
    for f in ("tipo_contenido", "url_video", "archivo_pdf", "contenido_html", "duracion_minutos"):
        data.pop(f, None)
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
    # Cascade deletes temas; clean up stored files first
    storage = get_storage()
    for tema in module.temas.all():
        if tema.archivo_pdf:
            storage.delete(tema.archivo_pdf)
        if tema.archivo_video:
            storage.delete(tema.archivo_video.name)
        if tema.archivo_imagen:
            storage.delete(tema.archivo_imagen.name)
    module.delete()


# ---------------------------------------------------------------------------
# Tema management
# ---------------------------------------------------------------------------


def list_temas(course_id: int, module_id: int, user: "User") -> "QuerySet[Tema]":
    course = get_course(course_id, user)
    try:
        module = course.modules.get(pk=module_id)
    except Module.DoesNotExist:
        raise Module.DoesNotExist(module_id)
    return module.temas.all()


def add_tema(
    course_id: int,
    module_id: int,
    data: dict,
    user: "User",
    pdf_file: Any | None = None,
    video_file: Any | None = None,
    imagen_file: Any | None = None,
) -> "Tema":
    course = get_course(course_id, user)
    _assert_owner(course, user)
    try:
        module = course.modules.get(pk=module_id)
    except Module.DoesNotExist:
        raise Module.DoesNotExist(module_id)

    tipo = data.get("tipo_contenido")
    storage = get_storage()

    if tipo == Tema.TipoContenido.PDF:
        if not pdf_file:
            raise CourseValidationError("Se requiere un archivo PDF para temas de tipo PDF.")
        _validate_pdf_file(pdf_file)
        path = f"courses/{course_id}/modules/{module_id}/temas/{uuid.uuid4()}.pdf"
        data["archivo_pdf"] = storage.save(path, pdf_file)

    if tipo == Tema.TipoContenido.VIDEO and video_file:
        _validate_video_file(video_file)
        ext = video_file.name.rsplit(".", 1)[-1].lower() if "." in video_file.name else "mp4"
        path = f"courses/{course_id}/modules/{module_id}/temas/{uuid.uuid4()}.{ext}"
        data["archivo_video"] = storage.save(path, video_file)

    if tipo == Tema.TipoContenido.IMAGEN:
        if not imagen_file:
            raise CourseValidationError("Se requiere una imagen para temas de tipo IMAGEN.")
        _validate_image_file(imagen_file)
        ext = imagen_file.name.rsplit(".", 1)[-1].lower() if "." in imagen_file.name else "jpg"
        path = f"courses/{course_id}/modules/{module_id}/temas/{uuid.uuid4()}.{ext}"
        data["archivo_imagen"] = storage.save(path, imagen_file)

    if tipo == Tema.TipoContenido.TEXTO:
        data["contenido_html"] = _sanitize_html(data.get("contenido_html", ""))

    if "orden" not in data or data["orden"] is None:
        data["orden"] = _next_tema_orden(module)

    return Tema.objects.create(module=module, **data)


def update_tema(
    course_id: int,
    module_id: int,
    tema_id: int,
    data: dict,
    user: "User",
    pdf_file: Any | None = None,
    video_file: Any | None = None,
    imagen_file: Any | None = None,
) -> "Tema":
    course = get_course(course_id, user)
    _assert_owner(course, user)
    try:
        module = course.modules.get(pk=module_id)
        tema = module.temas.get(pk=tema_id)
    except (Module.DoesNotExist, Tema.DoesNotExist):
        raise Tema.DoesNotExist(tema_id)

    tipo = data.get("tipo_contenido", tema.tipo_contenido)
    storage = get_storage()

    if pdf_file:
        _validate_pdf_file(pdf_file)
        if tema.archivo_pdf:
            storage.delete(tema.archivo_pdf)
        path = f"courses/{course_id}/modules/{module_id}/temas/{uuid.uuid4()}.pdf"
        data["archivo_pdf"] = storage.save(path, pdf_file)

    if video_file:
        _validate_video_file(video_file)
        if tema.archivo_video:
            storage.delete(tema.archivo_video.name)
        ext = video_file.name.rsplit(".", 1)[-1].lower() if "." in video_file.name else "mp4"
        path = f"courses/{course_id}/modules/{module_id}/temas/{uuid.uuid4()}.{ext}"
        data["archivo_video"] = storage.save(path, video_file)

    if imagen_file:
        _validate_image_file(imagen_file)
        if tema.archivo_imagen:
            storage.delete(tema.archivo_imagen.name)
        ext = imagen_file.name.rsplit(".", 1)[-1].lower() if "." in imagen_file.name else "jpg"
        path = f"courses/{course_id}/modules/{module_id}/temas/{uuid.uuid4()}.{ext}"
        data["archivo_imagen"] = storage.save(path, imagen_file)

    if "contenido_html" in data:
        data["contenido_html"] = _sanitize_html(data["contenido_html"])

    for field, value in data.items():
        setattr(tema, field, value)
    tema.save()
    return tema


def delete_tema(course_id: int, module_id: int, tema_id: int, user: "User") -> None:
    course = get_course(course_id, user)
    _assert_owner(course, user)
    try:
        module = course.modules.get(pk=module_id)
        tema = module.temas.get(pk=tema_id)
    except (Module.DoesNotExist, Tema.DoesNotExist):
        raise Tema.DoesNotExist(tema_id)

    storage = get_storage()
    if tema.archivo_pdf:
        storage.delete(tema.archivo_pdf)
    if tema.archivo_video:
        storage.delete(tema.archivo_video.name)
    if tema.archivo_imagen:
        storage.delete(tema.archivo_imagen.name)

    tema.delete()


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

    for module in course.modules.prefetch_related("temas").all():
        if not module.temas.exists():
            raise CourseValidationError(
                f"El módulo '{module.titulo}' no tiene temas. Agrega al menos un tema antes de publicar."
            )
        for tema in module.temas.all():
            if tema.tipo_contenido == Tema.TipoContenido.VIDEO:
                if not tema.url_video and not tema.archivo_video:
                    raise CourseValidationError(
                        f"El tema '{tema.titulo}' es de tipo Video pero no tiene URL ni archivo. "
                        "Añade una URL o sube un archivo de video."
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

    log_event(
        accion="COURSE_PUBLISHED",
        actor=user,
        ip=ip,
        entidad_tipo="Course",
        entidad_id=course.pk,
        entidad_nombre=course.titulo,
        detalle={"inscripciones_creadas": enrollments_created},
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

    # When all modules are done, handle course-level completion
    if enrollment.estado == "COMPLETADO":
        # Auto-issue certificate for courses without approved exam questions
        from apps.assessments.models import Assessment  # noqa: PLC0415
        try:
            course_has_exam = (
                Assessment.objects.filter(course=enrollment.course)
                .filter(questions__aprobada_por_humano=True)
                .exists()
            )
        except Exception:
            course_has_exam = False
        if not course_has_exam:
            from apps.courses.models import Certificate  # noqa: PLC0415
            Certificate.objects.get_or_create(
                user=enrollment.user,
                course=enrollment.course,
                defaults={"enrollment": enrollment},
            )

        instructor = enrollment.course.created_by
        if instructor and instructor.pk != enrollment.user.pk:
            from apps.notifications.services import notify_instructor_alumno_completo  # noqa: PLC0415
            notify_instructor_alumno_completo(instructor, enrollment.user, enrollment)

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
