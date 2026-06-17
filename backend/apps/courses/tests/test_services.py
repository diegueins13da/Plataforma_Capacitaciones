"""
T14 — Tests for CourseService: CRUD, module management, PDF validation,
HTML sanitization, TRAINER ownership rules.
"""
import io
from unittest.mock import MagicMock, patch

import pytest

from apps.courses.models import Course, Module
from apps.courses.services import (
    CoursePermissionDenied,
    CourseValidationError,
    add_module,
    create_course,
    delete_module,
    get_course,
    list_courses,
    update_course,
    update_module,
)
from apps.users.tests.factories import (
    AdminUserFactory,
    GroupFactory,
    TrainerUserFactory,
    UserFactory,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_MIN_VALID_PDF = b"%PDF-1.4 1 0 obj<</Type /Catalog>> endobj\r\n"


def _pdf_file(content: bytes = _MIN_VALID_PDF) -> io.BytesIO:
    f = io.BytesIO(content)
    f.name = "test.pdf"
    return f


def _make_course(user=None, **kwargs):
    if user is None:
        user = AdminUserFactory()
    return create_course({"titulo": "Test Course", **kwargs}, user)


# ---------------------------------------------------------------------------
# list_courses
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestListCourses:
    def test_admin_sees_all_courses(self):
        admin = AdminUserFactory()
        t1 = TrainerUserFactory()
        t2 = TrainerUserFactory()
        create_course({"titulo": "A"}, admin)
        create_course({"titulo": "B"}, t1)
        create_course({"titulo": "C"}, t2)
        assert list_courses(admin).count() == 3

    def test_trainer_sees_only_own(self):
        trainer = TrainerUserFactory()
        admin = AdminUserFactory()
        create_course({"titulo": "Mine"}, trainer)
        create_course({"titulo": "Admin's"}, admin)
        qs = list_courses(trainer)
        assert qs.count() == 1
        assert qs.first().titulo == "Mine"

    def test_filter_by_estado(self):
        admin = AdminUserFactory()
        c = create_course({"titulo": "P"}, admin)
        c.publish()
        create_course({"titulo": "B"}, admin)  # borrador
        qs = list_courses(admin, estado=Course.Estado.PUBLICADO)
        assert qs.count() == 1


# ---------------------------------------------------------------------------
# get_course
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestGetCourse:
    def test_admin_can_get_any(self):
        trainer = TrainerUserFactory()
        admin = AdminUserFactory()
        course = create_course({"titulo": "T"}, trainer)
        result = get_course(course.pk, admin)
        assert result.pk == course.pk

    def test_trainer_can_get_own(self):
        trainer = TrainerUserFactory()
        course = create_course({"titulo": "T"}, trainer)
        result = get_course(course.pk, trainer)
        assert result.pk == course.pk

    def test_trainer_cannot_get_others(self):
        trainer1 = TrainerUserFactory()
        trainer2 = TrainerUserFactory()
        course = create_course({"titulo": "T"}, trainer1)
        with pytest.raises(CoursePermissionDenied):
            get_course(course.pk, trainer2)

    def test_not_found_raises(self):
        admin = AdminUserFactory()
        with pytest.raises(Course.DoesNotExist):
            get_course(9999, admin)


# ---------------------------------------------------------------------------
# create_course
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestCreateCourse:
    def test_creates_in_borrador(self):
        admin = AdminUserFactory()
        course = create_course({"titulo": "Seguridad"}, admin)
        assert course.estado == Course.Estado.BORRADOR
        assert course.created_by == admin

    def test_sets_audiencia_grupos(self):
        admin = AdminUserFactory()
        g1 = GroupFactory()
        g2 = GroupFactory()
        course = create_course({"titulo": "T", "audiencia_grupos": [g1, g2]}, admin)
        assert course.audiencia_grupos.count() == 2

    def test_trainer_creates_own(self):
        trainer = TrainerUserFactory()
        course = create_course({"titulo": "Trainer Course"}, trainer)
        assert course.created_by == trainer


# ---------------------------------------------------------------------------
# update_course
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestUpdateCourse:
    def test_admin_updates_any(self):
        trainer = TrainerUserFactory()
        admin = AdminUserFactory()
        course = create_course({"titulo": "Old"}, trainer)
        updated = update_course(course.pk, {"titulo": "New"}, admin)
        assert updated.titulo == "New"

    def test_trainer_updates_own(self):
        trainer = TrainerUserFactory()
        course = create_course({"titulo": "Mine"}, trainer)
        updated = update_course(course.pk, {"titulo": "Updated"}, trainer)
        assert updated.titulo == "Updated"

    def test_trainer_cannot_update_others(self):
        trainer1 = TrainerUserFactory()
        trainer2 = TrainerUserFactory()
        course = create_course({"titulo": "Theirs"}, trainer1)
        with pytest.raises(CoursePermissionDenied):
            update_course(course.pk, {"titulo": "Stolen"}, trainer2)


# ---------------------------------------------------------------------------
# add_module — VIDEO
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestAddVideoModule:
    def test_adds_video_module(self):
        admin = AdminUserFactory()
        course = _make_course(admin)
        module = add_module(
            course.pk,
            {
                "titulo": "Intro video",
                "tipo_contenido": Module.TipoContenido.VIDEO,
                "url_video": "https://youtu.be/abc123",
            },
            admin,
        )
        assert module.tipo_contenido == Module.TipoContenido.VIDEO
        assert module.url_video == "https://youtu.be/abc123"
        assert module.orden == 1

    def test_auto_increments_orden(self):
        admin = AdminUserFactory()
        course = _make_course(admin)
        m1 = add_module(
            course.pk,
            {"titulo": "M1", "tipo_contenido": Module.TipoContenido.TEXTO, "contenido_html": "<p>A</p>"},
            admin,
        )
        m2 = add_module(
            course.pk,
            {"titulo": "M2", "tipo_contenido": Module.TipoContenido.TEXTO, "contenido_html": "<p>B</p>"},
            admin,
        )
        assert m1.orden == 1
        assert m2.orden == 2


# ---------------------------------------------------------------------------
# add_module — PDF
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestAddPdfModule:
    @patch("apps.courses.services.get_storage")
    def test_adds_pdf_module(self, mock_get_storage):
        mock_storage = MagicMock()
        mock_storage.save.return_value = "courses/1/modules/file.pdf"
        mock_get_storage.return_value = mock_storage

        admin = AdminUserFactory()
        course = _make_course(admin)
        module = add_module(
            course.pk,
            {"titulo": "PDF Module", "tipo_contenido": Module.TipoContenido.PDF},
            admin,
            pdf_file=_pdf_file(),
        )
        assert module.tipo_contenido == Module.TipoContenido.PDF
        assert "courses/" in module.archivo_pdf
        mock_storage.save.assert_called_once()

    def test_pdf_required_for_pdf_type(self):
        admin = AdminUserFactory()
        course = _make_course(admin)
        with pytest.raises(CourseValidationError, match="Se requiere"):
            add_module(
                course.pk,
                {"titulo": "PDF no file", "tipo_contenido": Module.TipoContenido.PDF},
                admin,
            )

    def test_rejects_non_pdf_magic_bytes(self):
        admin = AdminUserFactory()
        course = _make_course(admin)
        fake_file = io.BytesIO(b"PK\x03\x04fake zip content")
        fake_file.name = "evil.pdf"
        with pytest.raises(CourseValidationError, match="magic bytes"):
            add_module(
                course.pk,
                {"titulo": "Evil", "tipo_contenido": Module.TipoContenido.PDF},
                admin,
                pdf_file=fake_file,
            )

    def test_rejects_oversized_pdf(self):
        admin = AdminUserFactory()
        course = _make_course(admin)
        big_file = io.BytesIO(b"%PDF" + b"X" * (51 * 1024 * 1024))
        big_file.name = "huge.pdf"
        with pytest.raises(CourseValidationError, match="50 MB"):
            add_module(
                course.pk,
                {"titulo": "Big", "tipo_contenido": Module.TipoContenido.PDF},
                admin,
                pdf_file=big_file,
            )


# ---------------------------------------------------------------------------
# add_module — TEXTO (HTML sanitization)
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestAddTextoModule:
    def test_sanitizes_script_tags(self):
        admin = AdminUserFactory()
        course = _make_course(admin)
        module = add_module(
            course.pk,
            {
                "titulo": "T",
                "tipo_contenido": Module.TipoContenido.TEXTO,
                "contenido_html": "<p>OK</p><script>alert('xss')</script>",
            },
            admin,
        )
        assert "<script>" not in module.contenido_html
        assert "<p>OK</p>" in module.contenido_html

    def test_sanitizes_onclick(self):
        admin = AdminUserFactory()
        course = _make_course(admin)
        module = add_module(
            course.pk,
            {
                "titulo": "T",
                "tipo_contenido": Module.TipoContenido.TEXTO,
                "contenido_html": '<a href="http://safe.com" onclick="evil()">Click</a>',
            },
            admin,
        )
        assert "onclick" not in module.contenido_html
        assert 'href="http://safe.com"' in module.contenido_html

    def test_allows_safe_tags(self):
        admin = AdminUserFactory()
        course = _make_course(admin)
        safe_html = "<h2>Title</h2><ul><li><strong>Bold</strong></li></ul>"
        module = add_module(
            course.pk,
            {"titulo": "T", "tipo_contenido": Module.TipoContenido.TEXTO, "contenido_html": safe_html},
            admin,
        )
        assert "<h2>Title</h2>" in module.contenido_html
        assert "<strong>Bold</strong>" in module.contenido_html


# ---------------------------------------------------------------------------
# add_module — SCORM (400)
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestScormRejection:
    def test_scorm_raises_validation_error(self):
        admin = AdminUserFactory()
        course = _make_course(admin)
        with pytest.raises(CourseValidationError, match="Fase 2"):
            add_module(
                course.pk,
                {"titulo": "SCORM", "tipo_contenido": Module.TipoContenido.SCORM},
                admin,
            )


# ---------------------------------------------------------------------------
# update_module
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestUpdateModule:
    def test_updates_titulo(self):
        admin = AdminUserFactory()
        course = _make_course(admin)
        module = add_module(
            course.pk,
            {"titulo": "Old", "tipo_contenido": Module.TipoContenido.TEXTO, "contenido_html": "<p>X</p>"},
            admin,
        )
        updated = update_module(course.pk, module.pk, {"titulo": "New"}, admin)
        assert updated.titulo == "New"

    def test_resanitizes_html_on_update(self):
        admin = AdminUserFactory()
        course = _make_course(admin)
        module = add_module(
            course.pk,
            {"titulo": "T", "tipo_contenido": Module.TipoContenido.TEXTO, "contenido_html": "<p>Safe</p>"},
            admin,
        )
        updated = update_module(
            course.pk,
            module.pk,
            {"contenido_html": "<p>Good</p><script>evil()</script>"},
            admin,
        )
        assert "<script>" not in updated.contenido_html
        assert "<p>Good</p>" in updated.contenido_html

    def test_module_not_found(self):
        admin = AdminUserFactory()
        course = _make_course(admin)
        with pytest.raises(Module.DoesNotExist):
            update_module(course.pk, 9999, {"titulo": "X"}, admin)


# ---------------------------------------------------------------------------
# delete_module
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestDeleteModule:
    def test_deletes_module(self):
        admin = AdminUserFactory()
        course = _make_course(admin)
        module = add_module(
            course.pk,
            {"titulo": "T", "tipo_contenido": Module.TipoContenido.TEXTO, "contenido_html": "<p>X</p>"},
            admin,
        )
        delete_module(course.pk, module.pk, admin)
        assert not Module.objects.filter(pk=module.pk).exists()

    @patch("apps.courses.services.get_storage")
    def test_deletes_pdf_from_storage(self, mock_get_storage):
        mock_storage = MagicMock()
        mock_storage.save.return_value = "courses/1/modules/f.pdf"
        mock_get_storage.return_value = mock_storage

        admin = AdminUserFactory()
        course = _make_course(admin)
        module = add_module(
            course.pk,
            {"titulo": "PDF", "tipo_contenido": Module.TipoContenido.PDF},
            admin,
            pdf_file=_pdf_file(),
        )
        delete_module(course.pk, module.pk, admin)
        mock_storage.delete.assert_called_once()

    def test_trainer_cannot_delete_others_module(self):
        trainer1 = TrainerUserFactory()
        trainer2 = TrainerUserFactory()
        course = create_course({"titulo": "T"}, trainer1)
        module = add_module(
            course.pk,
            {"titulo": "M", "tipo_contenido": Module.TipoContenido.TEXTO, "contenido_html": "<p>X</p>"},
            trainer1,
        )
        with pytest.raises(CoursePermissionDenied):
            delete_module(course.pk, module.pk, trainer2)
