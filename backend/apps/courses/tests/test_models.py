"""
T13 — Tests for Course, Module, Enrollment, ModuleProgress, Certificate models.
Covers: state machine transitions, sequential modules, progress calculation,
unique constraints, Certificate UUID generation, and StorageBackend interface.
"""

import io
import uuid
from unittest.mock import MagicMock

import pytest
from django.utils import timezone

from apps.courses.models import (
    Certificate,
    Course,
    Enrollment,
    Module,
    ModuleProgress,
)
from apps.users.tests.factories import GroupFactory, UserFactory
from storage.backends.base import StorageBackend
from storage.backends.local import LocalStorage
from storage.backends.sharepoint import SharePointStorage
from storage.factory import get_storage


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def make_course(**kwargs) -> Course:
    defaults = {"titulo": "Introducción a Riesgos"}
    defaults.update(kwargs)
    return Course.objects.create(**defaults)


def make_module(course: Course, orden: int = 1, **kwargs) -> Module:
    defaults = {
        "titulo": f"Módulo {orden}",
        "tipo_contenido": Module.TipoContenido.TEXTO,
        "orden": orden,
        "contenido_html": "<p>Contenido</p>",
    }
    defaults.update(kwargs)
    return Module.objects.create(course=course, **defaults)


# ---------------------------------------------------------------------------
# Course — state machine
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestCourseStateMachine:
    def test_new_course_is_borrador(self):
        course = make_course()
        assert course.estado == Course.Estado.BORRADOR

    def test_publish_from_borrador(self):
        course = make_course()
        course.publish()
        course.refresh_from_db()
        assert course.estado == Course.Estado.PUBLICADO

    def test_archive_from_publicado(self):
        course = make_course()
        course.publish()
        course.archive()
        course.refresh_from_db()
        assert course.estado == Course.Estado.ARCHIVADO

    def test_cannot_publish_archived_course(self):
        course = make_course()
        course.publish()
        course.archive()
        with pytest.raises(ValueError):
            course.publish()

    def test_cannot_archive_from_borrador(self):
        course = make_course(estado=Course.Estado.BORRADOR)
        with pytest.raises(ValueError):
            course.archive()

    def test_cannot_republish_already_published(self):
        course = make_course()
        course.publish()
        with pytest.raises(ValueError):
            course.publish()

    def test_can_publish_returns_true_for_borrador(self):
        course = make_course()
        assert course.can_publish() is True
        assert course.can_archive() is False

    def test_can_archive_returns_true_for_publicado(self):
        course = make_course()
        course.publish()
        assert course.can_archive() is True
        assert course.can_publish() is False

    def test_can_neither_for_archivado(self):
        course = make_course()
        course.publish()
        course.archive()
        assert course.can_publish() is False
        assert course.can_archive() is False


# ---------------------------------------------------------------------------
# Course — other fields
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestCourseFields:
    def test_fecha_limite_nullable(self):
        course = make_course()
        assert course.fecha_limite is None

    def test_fecha_limite_can_be_set(self):
        from datetime import date
        course = make_course(fecha_limite=date(2027, 12, 31))
        assert course.fecha_limite is not None

    def test_cert_expira_meses_nullable(self):
        course = make_course()
        assert course.cert_expira_meses is None

    def test_cert_expira_meses_stored(self):
        course = make_course(cert_expira_meses=12)
        assert course.cert_expira_meses == 12

    def test_audiencia_grupos_m2m(self, db):
        group = GroupFactory()
        course = make_course()
        course.audiencia_grupos.add(group)
        assert course.audiencia_grupos.filter(pk=group.pk).exists()

    def test_str_returns_titulo(self):
        course = make_course(titulo="Seguridad Corporativa")
        assert str(course) == "Seguridad Corporativa"


# ---------------------------------------------------------------------------
# Module
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestModule:
    def test_es_secuencial_default_true(self):
        course = make_course()
        module = make_module(course)
        assert module.es_secuencial is True

    def test_tipo_contenido_choices(self):
        course = make_course()
        for tipo in Module.TipoContenido:
            m = Module.objects.create(
                course=course,
                titulo=f"Módulo {tipo}",
                tipo_contenido=tipo,
                orden=Module.objects.filter(course=course).count() + 1,
            )
            assert m.tipo_contenido == tipo

    def test_unique_orden_per_course(self):
        from django.db import IntegrityError
        course = make_course()
        make_module(course, orden=1)
        with pytest.raises(IntegrityError):
            Module.objects.create(
                course=course,
                titulo="Otro módulo",
                tipo_contenido=Module.TipoContenido.TEXTO,
                orden=1,
            )

    def test_modules_ordered_by_orden(self):
        course = make_course()
        make_module(course, orden=3)
        make_module(course, orden=1)
        make_module(course, orden=2)
        ordenes = list(course.modules.values_list("orden", flat=True))
        assert ordenes == [1, 2, 3]


# ---------------------------------------------------------------------------
# Enrollment
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestEnrollment:
    def test_default_estado_en_progreso(self):
        user = UserFactory()
        course = make_course()
        enrollment = Enrollment.objects.create(user=user, course=course)
        assert enrollment.estado == Enrollment.Estado.EN_PROGRESO

    def test_unique_per_user_course(self):
        from django.db import IntegrityError
        user = UserFactory()
        course = make_course()
        Enrollment.objects.create(user=user, course=course)
        with pytest.raises(IntegrityError):
            Enrollment.objects.create(user=user, course=course)

    def test_progress_zero_no_modules(self):
        user = UserFactory()
        course = make_course()
        enrollment = Enrollment.objects.create(user=user, course=course)
        enrollment.update_progress()
        enrollment.refresh_from_db()
        assert enrollment.progreso_porcentaje == 0
        assert enrollment.estado == Enrollment.Estado.EN_PROGRESO

    def test_progress_partial(self):
        user = UserFactory()
        course = make_course()
        m1 = make_module(course, orden=1)
        make_module(course, orden=2)
        enrollment = Enrollment.objects.create(user=user, course=course)
        ModuleProgress.objects.create(enrollment=enrollment, module=m1, is_completed=True)
        enrollment.update_progress()
        enrollment.refresh_from_db()
        assert enrollment.progreso_porcentaje == 50
        assert enrollment.estado == Enrollment.Estado.EN_PROGRESO

    def test_progress_100_marks_completado(self):
        user = UserFactory()
        course = make_course()
        m1 = make_module(course, orden=1)
        m2 = make_module(course, orden=2)
        enrollment = Enrollment.objects.create(user=user, course=course)
        ModuleProgress.objects.create(enrollment=enrollment, module=m1, is_completed=True)
        ModuleProgress.objects.create(enrollment=enrollment, module=m2, is_completed=True)
        enrollment.update_progress()
        enrollment.refresh_from_db()
        assert enrollment.progreso_porcentaje == 100
        assert enrollment.estado == Enrollment.Estado.COMPLETADO
        assert enrollment.fecha_completado is not None

    def test_vencido_not_overridden_by_update_progress(self):
        user = UserFactory()
        course = make_course()
        enrollment = Enrollment.objects.create(
            user=user, course=course, estado=Enrollment.Estado.VENCIDO
        )
        enrollment.update_progress()
        enrollment.refresh_from_db()
        assert enrollment.estado == Enrollment.Estado.VENCIDO


# ---------------------------------------------------------------------------
# ModuleProgress
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestModuleProgress:
    def test_default_not_completed(self):
        user = UserFactory()
        course = make_course()
        module = make_module(course)
        enrollment = Enrollment.objects.create(user=user, course=course)
        mp = ModuleProgress.objects.create(enrollment=enrollment, module=module)
        assert mp.is_completed is False

    def test_unique_enrollment_module(self):
        from django.db import IntegrityError
        user = UserFactory()
        course = make_course()
        module = make_module(course)
        enrollment = Enrollment.objects.create(user=user, course=course)
        ModuleProgress.objects.create(enrollment=enrollment, module=module)
        with pytest.raises(IntegrityError):
            ModuleProgress.objects.create(enrollment=enrollment, module=module)

    def test_last_position_json_default_dict(self):
        user = UserFactory()
        course = make_course()
        module = make_module(course)
        enrollment = Enrollment.objects.create(user=user, course=course)
        mp = ModuleProgress.objects.create(enrollment=enrollment, module=module)
        assert mp.last_position_json == {}

    def test_last_position_json_stores_video_second(self):
        user = UserFactory()
        course = make_course()
        module = make_module(course, tipo_contenido=Module.TipoContenido.VIDEO)
        enrollment = Enrollment.objects.create(user=user, course=course)
        mp = ModuleProgress.objects.create(
            enrollment=enrollment,
            module=module,
            last_position_json={"second": 142},
        )
        mp.refresh_from_db()
        assert mp.last_position_json["second"] == 142

    def test_str_shows_status(self):
        user = UserFactory()
        course = make_course()
        module = make_module(course)
        enrollment = Enrollment.objects.create(user=user, course=course)
        mp = ModuleProgress.objects.create(enrollment=enrollment, module=module)
        assert "○" in str(mp)
        mp.is_completed = True
        mp.save()
        assert "✓" in str(mp)


# ---------------------------------------------------------------------------
# Certificate
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestCertificate:
    def test_id_is_uuid(self):
        user = UserFactory()
        course = make_course()
        cert = Certificate.objects.create(user=user, course=course)
        assert isinstance(cert.id, uuid.UUID)

    def test_two_certs_have_different_uuids(self):
        user = UserFactory()
        c1 = make_course(titulo="Curso A")
        c2 = make_course(titulo="Curso B")
        cert1 = Certificate.objects.create(user=user, course=c1)
        cert2 = Certificate.objects.create(user=user, course=c2)
        assert cert1.id != cert2.id

    def test_nota_obtenida_nullable(self):
        user = UserFactory()
        course = make_course()
        cert = Certificate.objects.create(user=user, course=course)
        assert cert.nota_obtenida is None

    def test_url_pdf_empty_by_default(self):
        user = UserFactory()
        course = make_course()
        cert = Certificate.objects.create(user=user, course=course)
        assert cert.url_pdf == ""
        assert cert.url_qr == ""

    def test_one_cert_per_enrollment(self):
        from django.db import IntegrityError
        user = UserFactory()
        course = make_course()
        enrollment = Enrollment.objects.create(user=user, course=course)
        Certificate.objects.create(user=user, course=course, enrollment=enrollment)
        with pytest.raises(IntegrityError):
            Certificate.objects.create(user=user, course=course, enrollment=enrollment)


# ---------------------------------------------------------------------------
# StorageBackend interface
# ---------------------------------------------------------------------------


class TestStorageBackendInterface:
    def test_storage_backend_is_abstract(self):
        """Cannot instantiate StorageBackend directly."""
        with pytest.raises(TypeError):
            StorageBackend()  # type: ignore[abstract]

    def test_local_storage_is_concrete(self):
        storage = LocalStorage()
        assert isinstance(storage, StorageBackend)

    def test_sharepoint_raises_not_implemented(self):
        storage = SharePointStorage()
        with pytest.raises(NotImplementedError):
            storage.save("test.pdf", MagicMock())
        with pytest.raises(NotImplementedError):
            storage.url("test.pdf")
        with pytest.raises(NotImplementedError):
            storage.delete("test.pdf")
        with pytest.raises(NotImplementedError):
            storage.exists("test.pdf")

    def test_get_storage_returns_local_by_default(self, settings):
        settings.STORAGE_BACKEND = "local"
        storage = get_storage()
        assert isinstance(storage, LocalStorage)

    def test_get_storage_raises_for_unknown_backend(self, settings):
        settings.STORAGE_BACKEND = "s3"
        with pytest.raises(ValueError, match="Unknown STORAGE_BACKEND"):
            get_storage()
