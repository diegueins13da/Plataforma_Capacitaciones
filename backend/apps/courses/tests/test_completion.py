"""
T19 — Tests for module completion tracking, progress saving, and resume position.
"""
import pytest
from rest_framework import status
from rest_framework.test import APIClient

from apps.courses.models import Course, Enrollment, Module, ModuleProgress
from apps.courses.services import (
    CoursePermissionDenied,
    CourseValidationError,
    complete_module,
    create_course,
    get_module_progress,
    update_module_position,
)
from apps.users.tests.factories import AdminUserFactory, UserFactory

ENROLLMENTS_URL = "/api/v1/enrollments/"


def _client(user=None) -> APIClient:
    c = APIClient()
    if user:
        c.force_authenticate(user=user)
    return c


def _complete_url(enrollment_id: int, module_id: int) -> str:
    return f"{ENROLLMENTS_URL}{enrollment_id}/modules/{module_id}/complete/"


def _progress_url(enrollment_id: int, module_id: int) -> str:
    return f"{ENROLLMENTS_URL}{enrollment_id}/modules/{module_id}/progress/"


def _make_enrolled_course(user=None):
    """Create a course with two sequential modules and enroll user."""
    admin = AdminUserFactory()
    if user is None:
        user = UserFactory()
    course = create_course({"titulo": "Test Course"}, admin)
    m1 = Module.objects.create(
        course=course, titulo="M1", tipo_contenido="TEXTO",
        orden=1, es_secuencial=True, contenido_html="<p>A</p>"
    )
    m2 = Module.objects.create(
        course=course, titulo="M2", tipo_contenido="TEXTO",
        orden=2, es_secuencial=True, contenido_html="<p>B</p>"
    )
    enrollment = Enrollment.objects.create(user=user, course=course)
    return enrollment, m1, m2


# ---------------------------------------------------------------------------
# Service: complete_module
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_complete_module_increases_progress():
    """Completing one of two modules sets progress to 50%."""
    user = UserFactory()
    enrollment, m1, m2 = _make_enrolled_course(user)

    result = complete_module(enrollment.pk, m1.pk, user)

    assert result.progreso_porcentaje == 50
    assert result.estado == Enrollment.Estado.EN_PROGRESO


@pytest.mark.django_db
def test_complete_all_modules_sets_completado():
    """Completing all modules sets enrollment estado to COMPLETADO."""
    user = UserFactory()
    enrollment, m1, m2 = _make_enrolled_course(user)

    complete_module(enrollment.pk, m1.pk, user)
    result = complete_module(enrollment.pk, m2.pk, user)

    assert result.progreso_porcentaje == 100
    assert result.estado == Enrollment.Estado.COMPLETADO
    assert result.fecha_completado is not None


@pytest.mark.django_db
def test_complete_module_sequential_lock_raises():
    """Completing module 2 before module 1 raises CourseValidationError."""
    user = UserFactory()
    enrollment, m1, m2 = _make_enrolled_course(user)

    with pytest.raises(CourseValidationError):
        complete_module(enrollment.pk, m2.pk, user)


@pytest.mark.django_db
def test_complete_module_wrong_user_raises():
    """A user cannot complete a module in another user's enrollment."""
    user = UserFactory()
    other = UserFactory()
    enrollment, m1, _ = _make_enrolled_course(user)

    with pytest.raises(CoursePermissionDenied):
        complete_module(enrollment.pk, m1.pk, other)


@pytest.mark.django_db
def test_complete_module_idempotent():
    """Completing an already-completed module does not change progress."""
    user = UserFactory()
    enrollment, m1, _ = _make_enrolled_course(user)

    complete_module(enrollment.pk, m1.pk, user)
    result = complete_module(enrollment.pk, m1.pk, user)

    assert result.progreso_porcentaje == 50
    # Only one ModuleProgress record created
    assert ModuleProgress.objects.filter(enrollment=enrollment, module=m1).count() == 1


@pytest.mark.django_db
def test_complete_module_non_sequential_skips_check():
    """Non-sequential modules can be completed in any order."""
    user = UserFactory()
    admin = AdminUserFactory()
    course = create_course({"titulo": "C"}, admin)
    m1 = Module.objects.create(
        course=course, titulo="M1", tipo_contenido="TEXTO",
        orden=1, es_secuencial=False, contenido_html="<p>A</p>"
    )
    m2 = Module.objects.create(
        course=course, titulo="M2", tipo_contenido="TEXTO",
        orden=2, es_secuencial=False, contenido_html="<p>B</p>"
    )
    enrollment = Enrollment.objects.create(user=user, course=course)

    # Can complete module 2 without completing module 1 first
    result = complete_module(enrollment.pk, m2.pk, user)
    assert result.progreso_porcentaje == 50


# ---------------------------------------------------------------------------
# Service: update_module_position + get_module_progress
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_update_module_position_saves_json():
    """update_module_position saves the provided position JSON."""
    user = UserFactory()
    enrollment, m1, _ = _make_enrolled_course(user)
    position = {"second": 45}

    mp = update_module_position(enrollment.pk, m1.pk, position, user)

    assert mp.last_position_json == {"second": 45}


@pytest.mark.django_db
def test_update_module_position_creates_record_if_missing():
    """update_module_position creates a ModuleProgress record if one does not exist."""
    user = UserFactory()
    enrollment, m1, _ = _make_enrolled_course(user)

    assert not ModuleProgress.objects.filter(enrollment=enrollment, module=m1).exists()

    update_module_position(enrollment.pk, m1.pk, {"page": 3}, user)

    assert ModuleProgress.objects.filter(enrollment=enrollment, module=m1).exists()


@pytest.mark.django_db
def test_get_module_progress_returns_position():
    """get_module_progress returns an existing record with correct position."""
    user = UserFactory()
    enrollment, m1, _ = _make_enrolled_course(user)
    ModuleProgress.objects.create(
        enrollment=enrollment, module=m1, last_position_json={"scroll": 120}
    )

    mp = get_module_progress(enrollment.pk, m1.pk, user)

    assert mp.last_position_json == {"scroll": 120}


@pytest.mark.django_db
def test_get_module_progress_creates_if_missing():
    """get_module_progress auto-creates an empty record if none exists."""
    user = UserFactory()
    enrollment, m1, _ = _make_enrolled_course(user)

    mp = get_module_progress(enrollment.pk, m1.pk, user)

    assert mp.last_position_json == {}
    assert mp.is_completed is False


# ---------------------------------------------------------------------------
# View endpoints
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_api_complete_module_success():
    """POST /enrollments/{id}/modules/{m}/complete/ returns 200 with enrollment data."""
    user = UserFactory()
    enrollment, m1, _ = _make_enrolled_course(user)
    c = _client(user)

    resp = c.post(_complete_url(enrollment.pk, m1.pk))

    assert resp.status_code == status.HTTP_200_OK
    assert resp.data["progreso_porcentaje"] == 50


@pytest.mark.django_db
def test_api_complete_module_sequential_lock_returns_403():
    """POST complete on locked module returns 403."""
    user = UserFactory()
    enrollment, m1, m2 = _make_enrolled_course(user)
    c = _client(user)

    resp = c.post(_complete_url(enrollment.pk, m2.pk))

    assert resp.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_api_complete_module_unauthenticated_returns_401():
    """Unauthenticated POST complete returns 401."""
    user = UserFactory()
    enrollment, m1, _ = _make_enrolled_course(user)

    resp = _client().post(_complete_url(enrollment.pk, m1.pk))

    assert resp.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_api_get_module_progress():
    """GET /enrollments/{id}/modules/{m}/progress/ returns position JSON."""
    user = UserFactory()
    enrollment, m1, _ = _make_enrolled_course(user)
    ModuleProgress.objects.create(
        enrollment=enrollment, module=m1, last_position_json={"second": 10}
    )
    c = _client(user)

    resp = c.get(_progress_url(enrollment.pk, m1.pk))

    assert resp.status_code == status.HTTP_200_OK
    assert resp.data["last_position_json"] == {"second": 10}


@pytest.mark.django_db
def test_api_patch_module_progress():
    """PATCH /enrollments/{id}/modules/{m}/progress/ updates position JSON."""
    user = UserFactory()
    enrollment, m1, _ = _make_enrolled_course(user)
    c = _client(user)

    resp = c.patch(_progress_url(enrollment.pk, m1.pk), {"last_position_json": {"page": 5}}, format="json")

    assert resp.status_code == status.HTTP_200_OK
    assert resp.data["last_position_json"] == {"page": 5}
