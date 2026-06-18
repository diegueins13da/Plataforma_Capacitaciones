from datetime import date, timedelta
from unittest.mock import patch

import pytest
from django.utils import timezone

from apps.notifications.models import Notification
from apps.notifications.services import (
    create_notification,
    get_unread_count,
    mark_read,
    notify_examen_aprobado,
    notify_examen_reprobado,
    notify_nuevo_curso,
    notify_vencimiento,
    notify_curso_vencido,
)


@pytest.fixture()
def user(db):
    from apps.users.models import User
    return User.objects.create_user(username="testuser", email="u@test.com", password="pw", role="USUARIO")


@pytest.fixture()
def course(db, user):
    from apps.courses.models import Course
    return Course.objects.create(
        titulo="Curso de prueba",
        descripcion="Desc",
        estado=Course.Estado.PUBLICADO,
        created_by=user,
    )


@pytest.fixture()
def enrollment(db, user, course):
    from apps.courses.models import Enrollment
    return Enrollment.objects.create(user=user, course=course)


class TestCreateNotification:
    def test_creates_notification(self, user):
        n = create_notification(user, Notification.Tipo.NUEVO_CURSO, "Título", "Mensaje")
        assert n.pk is not None
        assert n.leida is False
        assert n.tipo == Notification.Tipo.NUEVO_CURSO

    def test_default_unread(self, user):
        create_notification(user, Notification.Tipo.NUEVO_CURSO, "T")
        assert get_unread_count(user) == 1


class TestExamNotifications:
    def test_aprobado(self, user, enrollment):
        n = notify_examen_aprobado(user, enrollment, 85.0)
        assert n.tipo == Notification.Tipo.EXAMEN_APROBADO
        assert "85" in n.mensaje

    def test_reprobado_with_attempts(self, user, enrollment):
        n = notify_examen_reprobado(user, enrollment, 40.0, intentos_restantes=2)
        assert n.tipo == Notification.Tipo.EXAMEN_REPROBADO
        assert "2" in n.mensaje

    def test_reprobado_no_attempts(self, user, enrollment):
        n = notify_examen_reprobado(user, enrollment, 30.0, intentos_restantes=0)
        assert "agotado" in n.mensaje


class TestDeadlineNotifications:
    def test_vencimiento_7d(self, user, enrollment):
        n = notify_vencimiento(user, enrollment, 7)
        assert n is not None
        assert n.tipo == Notification.Tipo.VENCIMIENTO_7D

    def test_vencimiento_1d(self, user, enrollment):
        n = notify_vencimiento(user, enrollment, 1)
        assert n is not None
        assert n.tipo == Notification.Tipo.VENCIMIENTO_1D

    def test_no_duplicate_within_25h(self, user, enrollment):
        n1 = notify_vencimiento(user, enrollment, 7)
        n2 = notify_vencimiento(user, enrollment, 7)
        assert n1 is not None
        assert n2 is None

    def test_nuevo_curso_no_duplicate(self, user, enrollment):
        n1 = notify_nuevo_curso(user, enrollment)
        n2 = notify_nuevo_curso(user, enrollment)
        assert n1 is not None
        assert n2 is None


class TestMarkRead:
    def test_mark_all_read(self, user):
        create_notification(user, Notification.Tipo.NUEVO_CURSO, "A")
        create_notification(user, Notification.Tipo.NUEVO_CURSO, "B")
        updated = mark_read(user)
        assert updated == 2
        assert get_unread_count(user) == 0

    def test_mark_single_read(self, user):
        n = create_notification(user, Notification.Tipo.NUEVO_CURSO, "A")
        create_notification(user, Notification.Tipo.NUEVO_CURSO, "B")
        updated = mark_read(user, n.pk)
        assert updated == 1
        assert get_unread_count(user) == 1


class TestDeadlineTasks:
    def test_check_upcoming_deadlines_sends_notification(self, user, course, enrollment):
        from apps.notifications.tasks import check_upcoming_deadlines

        target = date.today() + timedelta(days=7)
        course.fecha_limite = target
        course.save()
        result = check_upcoming_deadlines()
        assert result["notifications_sent"] >= 1

    def test_close_expired_enrollments(self, user, course, enrollment):
        from apps.courses.models import Enrollment as E
        from apps.notifications.tasks import close_expired_enrollments

        course.fecha_limite = date.today() - timedelta(days=1)
        course.save()
        result = close_expired_enrollments()
        assert result["closed"] >= 1
        enrollment.refresh_from_db()
        assert enrollment.estado == E.Estado.VENCIDO
