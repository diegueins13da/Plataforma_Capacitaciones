"""
T15 — Tests for course publication, enrollment auto-creation, and USUARIO course list.
"""
import pytest
from rest_framework import status
from rest_framework.test import APIClient

from apps.courses.models import Course, Enrollment, Module
from apps.courses.services import (
    CoursePermissionDenied,
    CourseValidationError,
    create_course,
    publish_course,
)
from apps.notifications.models import Notification
from apps.reports.models import AuditLog
from apps.users.models import UserProfile
from apps.users.tests.factories import (
    AdminUserFactory,
    GroupFactory,
    TrainerUserFactory,
    UserFactory,
)

COURSES_URL = "/api/v1/courses/"


def _client(user=None) -> APIClient:
    c = APIClient()
    if user:
        c.force_authenticate(user=user)
    return c


def _publish_url(pk: int) -> str:
    return f"{COURSES_URL}{pk}/publish/"


def _make_course_with_module(user=None) -> "Course":
    if user is None:
        user = AdminUserFactory()
    course = create_course({"titulo": "Test"}, user)
    Module.objects.create(
        course=course,
        titulo="Intro",
        tipo_contenido=Module.TipoContenido.TEXTO,
        orden=1,
        contenido_html="<p>Content</p>",
    )
    return course


def _assign_group(course: "Course", group) -> None:
    course.audiencia_grupos.add(group)


def _add_user_to_group(user, group) -> None:
    UserProfile.objects.filter(user=user).update(grupo=group)


# ---------------------------------------------------------------------------
# publish_course service
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestPublishCourseService:
    def test_publish_changes_estado(self):
        admin = AdminUserFactory()
        course = _make_course_with_module(admin)
        published = publish_course(course.pk, admin)
        assert published.estado == Course.Estado.PUBLICADO

    def test_cannot_publish_without_modules(self):
        admin = AdminUserFactory()
        course = create_course({"titulo": "Empty"}, admin)
        with pytest.raises(CourseValidationError, match="módulo"):
            publish_course(course.pk, admin)

    def test_creates_enrollment_for_group_members(self):
        admin = AdminUserFactory()
        group = GroupFactory()
        user1 = UserFactory()
        user2 = UserFactory()
        _add_user_to_group(user1, group)
        _add_user_to_group(user2, group)
        course = _make_course_with_module(admin)
        _assign_group(course, group)
        publish_course(course.pk, admin)
        assert Enrollment.objects.filter(course=course, user=user1).exists()
        assert Enrollment.objects.filter(course=course, user=user2).exists()

    def test_no_duplicate_enrollments_on_republish_attempt(self):
        admin = AdminUserFactory()
        group = GroupFactory()
        user = UserFactory()
        _add_user_to_group(user, group)
        course = _make_course_with_module(admin)
        _assign_group(course, group)
        publish_course(course.pk, admin)
        # Cannot publish again since already PUBLICADO
        with pytest.raises(ValueError):
            publish_course(course.pk, admin)
        # Enrollment still exists just once
        assert Enrollment.objects.filter(course=course, user=user).count() == 1

    def test_skips_inactive_users(self):
        admin = AdminUserFactory()
        group = GroupFactory()
        inactive_user = UserFactory(is_active=False)
        _add_user_to_group(inactive_user, group)
        course = _make_course_with_module(admin)
        _assign_group(course, group)
        publish_course(course.pk, admin)
        assert not Enrollment.objects.filter(course=course, user=inactive_user).exists()

    def test_creates_notification_per_enrollment(self):
        admin = AdminUserFactory()
        group = GroupFactory()
        user1 = UserFactory()
        user2 = UserFactory()
        _add_user_to_group(user1, group)
        _add_user_to_group(user2, group)
        course = _make_course_with_module(admin)
        _assign_group(course, group)
        publish_course(course.pk, admin)
        assert Notification.objects.filter(
            user=user1, tipo=Notification.Tipo.NUEVO_CURSO
        ).exists()
        assert Notification.objects.filter(
            user=user2, tipo=Notification.Tipo.NUEVO_CURSO
        ).exists()

    def test_notification_has_course_reference(self):
        admin = AdminUserFactory()
        group = GroupFactory()
        user = UserFactory()
        _add_user_to_group(user, group)
        course = _make_course_with_module(admin)
        _assign_group(course, group)
        publish_course(course.pk, admin)
        notif = Notification.objects.get(user=user, tipo=Notification.Tipo.NUEVO_CURSO)
        assert notif.referencia_id == course.pk
        assert notif.referencia_tipo == "course"
        assert course.titulo in notif.titulo

    def test_creates_audit_log(self):
        admin = AdminUserFactory()
        course = _make_course_with_module(admin)
        publish_course(course.pk, admin)
        log = AuditLog.objects.filter(accion="CURSO_PUBLICADO", user=admin).first()
        assert log is not None
        assert log.detalles_json["course_id"] == course.pk

    def test_trainer_cannot_publish_others_course(self):
        trainer1 = TrainerUserFactory()
        trainer2 = TrainerUserFactory()
        course = _make_course_with_module(trainer1)
        with pytest.raises(CoursePermissionDenied):
            publish_course(course.pk, trainer2)

    def test_no_groups_no_enrollments(self):
        admin = AdminUserFactory()
        course = _make_course_with_module(admin)
        publish_course(course.pk, admin)
        assert Enrollment.objects.filter(course=course).count() == 0


# ---------------------------------------------------------------------------
# publish endpoint
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestPublishEndpoint:
    def test_publish_returns_200(self):
        admin = AdminUserFactory()
        course = _make_course_with_module(admin)
        resp = _client(admin).post(_publish_url(course.pk))
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["estado"] == Course.Estado.PUBLICADO

    def test_unauthenticated_returns_401(self):
        admin = AdminUserFactory()
        course = _make_course_with_module(admin)
        resp = _client().post(_publish_url(course.pk))
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_usuario_cannot_publish(self):
        admin = AdminUserFactory()
        user = UserFactory()
        course = _make_course_with_module(admin)
        resp = _client(user).post(_publish_url(course.pk))
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_publish_without_module_returns_400(self):
        admin = AdminUserFactory()
        course = create_course({"titulo": "Empty"}, admin)
        resp = _client(admin).post(_publish_url(course.pk))
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert "módulo" in resp.data["error"]

    def test_course_not_found_returns_404(self):
        admin = AdminUserFactory()
        resp = _client(admin).post(_publish_url(9999))
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_publish_creates_enrollments_for_group(self):
        admin = AdminUserFactory()
        group = GroupFactory()
        user = UserFactory()
        _add_user_to_group(user, group)
        course = _make_course_with_module(admin)
        _assign_group(course, group)
        resp = _client(admin).post(_publish_url(course.pk))
        assert resp.status_code == status.HTTP_200_OK
        assert Enrollment.objects.filter(course=course, user=user).exists()


# ---------------------------------------------------------------------------
# USUARIO course list (only enrolled courses)
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestUsuarioCourseList:
    def test_usuario_sees_only_enrolled_courses(self):
        admin = AdminUserFactory()
        group = GroupFactory()
        user = UserFactory()
        _add_user_to_group(user, group)

        c_enrolled = _make_course_with_module(admin)
        c_enrolled.audiencia_grupos.add(group)
        publish_course(c_enrolled.pk, admin)

        c_not_enrolled = _make_course_with_module(admin)

        resp = _client(user).get(COURSES_URL)
        assert resp.status_code == status.HTTP_200_OK
        ids = [c["id"] for c in resp.data["results"]]
        assert c_enrolled.pk in ids
        assert c_not_enrolled.pk not in ids

    def test_admin_sees_all_courses(self):
        admin = AdminUserFactory()
        create_course({"titulo": "A"}, admin)
        create_course({"titulo": "B"}, admin)
        resp = _client(admin).get(COURSES_URL)
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["count"] == 2
