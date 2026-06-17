"""
T14 — API view tests for CourseViewSet.
"""
import io

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from apps.courses.models import Course, Module
from apps.courses.services import create_course, add_module
from apps.users.tests.factories import (
    AdminUserFactory,
    GroupFactory,
    TrainerUserFactory,
    UserFactory,
)

COURSES_URL = "/api/v1/courses/"


def _url(pk: int) -> str:
    return f"{COURSES_URL}{pk}/"


def _modules_url(course_pk: int) -> str:
    return f"{COURSES_URL}{course_pk}/modules/"


def _module_url(course_pk: int, mod_pk: int) -> str:
    return f"{COURSES_URL}{course_pk}/modules/{mod_pk}/"


def _client(user=None) -> APIClient:
    c = APIClient()
    if user:
        c.force_authenticate(user=user)
    return c


_PDF_CONTENT = b"%PDF-1.4 minimal"


# ---------------------------------------------------------------------------
# Permissions — list
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestCourseListPermissions:
    def test_unauthenticated_returns_401(self):
        resp = _client().get(COURSES_URL)
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_authenticated_user_can_list(self):
        user = UserFactory()
        resp = _client(user).get(COURSES_URL)
        assert resp.status_code == status.HTTP_200_OK

    def test_trainer_can_list(self):
        trainer = TrainerUserFactory()
        resp = _client(trainer).get(COURSES_URL)
        assert resp.status_code == status.HTTP_200_OK


# ---------------------------------------------------------------------------
# Permissions — create
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestCourseCreatePermissions:
    def test_usuario_cannot_create(self):
        user = UserFactory()
        resp = _client(user).post(COURSES_URL, {"titulo": "X"}, format="json")
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_trainer_can_create(self):
        trainer = TrainerUserFactory()
        resp = _client(trainer).post(COURSES_URL, {"titulo": "Trainer Course"}, format="json")
        assert resp.status_code == status.HTTP_201_CREATED

    def test_admin_can_create(self):
        admin = AdminUserFactory()
        resp = _client(admin).post(COURSES_URL, {"titulo": "Admin Course"}, format="json")
        assert resp.status_code == status.HTTP_201_CREATED


# ---------------------------------------------------------------------------
# Course CRUD
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestCourseCRUD:
    def test_create_returns_borrador(self):
        admin = AdminUserFactory()
        resp = _client(admin).post(COURSES_URL, {"titulo": "New"}, format="json")
        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.data["estado"] == Course.Estado.BORRADOR

    def test_retrieve_course(self):
        admin = AdminUserFactory()
        course = create_course({"titulo": "Detail"}, admin)
        resp = _client(admin).get(_url(course.pk))
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["titulo"] == "Detail"

    def test_retrieve_not_found(self):
        admin = AdminUserFactory()
        resp = _client(admin).get(_url(9999))
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_partial_update(self):
        admin = AdminUserFactory()
        course = create_course({"titulo": "Old"}, admin)
        resp = _client(admin).patch(_url(course.pk), {"titulo": "New"}, format="json")
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["titulo"] == "New"

    def test_trainer_cannot_update_others_course(self):
        trainer1 = TrainerUserFactory()
        trainer2 = TrainerUserFactory()
        course = create_course({"titulo": "T1's"}, trainer1)
        resp = _client(trainer2).patch(_url(course.pk), {"titulo": "Stolen"}, format="json")
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_delete_borrador(self):
        admin = AdminUserFactory()
        course = create_course({"titulo": "Delete me"}, admin)
        resp = _client(admin).delete(_url(course.pk))
        assert resp.status_code == status.HTTP_204_NO_CONTENT

    def test_cannot_delete_published(self):
        admin = AdminUserFactory()
        course = create_course({"titulo": "Published"}, admin)
        Module.objects.create(
            course=course, titulo="M", tipo_contenido=Module.TipoContenido.TEXTO, orden=1
        )
        course.publish()
        resp = _client(admin).delete(_url(course.pk))
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_trainer_only_sees_own_in_list(self):
        trainer1 = TrainerUserFactory()
        trainer2 = TrainerUserFactory()
        create_course({"titulo": "T1"}, trainer1)
        create_course({"titulo": "T2"}, trainer2)
        resp = _client(trainer1).get(COURSES_URL)
        assert resp.status_code == status.HTTP_200_OK
        titles = [c["titulo"] for c in resp.data["results"]]
        assert "T1" in titles
        assert "T2" not in titles


# ---------------------------------------------------------------------------
# Module endpoints
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestModuleCRUD:
    def test_list_modules(self):
        admin = AdminUserFactory()
        course = create_course({"titulo": "C"}, admin)
        Module.objects.create(
            course=course, titulo="M1", tipo_contenido=Module.TipoContenido.TEXTO, orden=1
        )
        resp = _client(admin).get(_modules_url(course.pk))
        assert resp.status_code == status.HTTP_200_OK
        assert len(resp.data) == 1

    def test_create_video_module(self):
        admin = AdminUserFactory()
        course = create_course({"titulo": "C"}, admin)
        resp = _client(admin).post(
            _modules_url(course.pk),
            {
                "titulo": "Video M",
                "tipo_contenido": "VIDEO",
                "url_video": "https://youtube.com/watch?v=abc",
            },
            format="json",
        )
        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.data["tipo_contenido"] == "VIDEO"

    def test_create_texto_module(self):
        admin = AdminUserFactory()
        course = create_course({"titulo": "C"}, admin)
        resp = _client(admin).post(
            _modules_url(course.pk),
            {
                "titulo": "Text M",
                "tipo_contenido": "TEXTO",
                "contenido_html": "<p>Hello</p>",
            },
            format="json",
        )
        assert resp.status_code == status.HTTP_201_CREATED

    def test_create_pdf_module(self):
        admin = AdminUserFactory()
        course = create_course({"titulo": "C"}, admin)
        pdf = io.BytesIO(_PDF_CONTENT)
        pdf.name = "test.pdf"
        resp = _client(admin).post(
            _modules_url(course.pk),
            {"titulo": "PDF M", "tipo_contenido": "PDF", "archivo_pdf": pdf},
            format="multipart",
        )
        assert resp.status_code == status.HTTP_201_CREATED

    def test_scorm_returns_400(self):
        admin = AdminUserFactory()
        course = create_course({"titulo": "C"}, admin)
        resp = _client(admin).post(
            _modules_url(course.pk),
            {"titulo": "SCORM M", "tipo_contenido": "SCORM"},
            format="json",
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert "Fase 2" in resp.data["error"]

    def test_pdf_with_invalid_magic_bytes(self):
        admin = AdminUserFactory()
        course = create_course({"titulo": "C"}, admin)
        evil = io.BytesIO(b"PK\x03\x04 not a pdf")
        evil.name = "evil.pdf"
        resp = _client(admin).post(
            _modules_url(course.pk),
            {"titulo": "Evil", "tipo_contenido": "PDF", "archivo_pdf": evil},
            format="multipart",
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert "magic bytes" in resp.data["error"]

    def test_script_tag_stripped_from_texto(self):
        admin = AdminUserFactory()
        course = create_course({"titulo": "C"}, admin)
        resp = _client(admin).post(
            _modules_url(course.pk),
            {
                "titulo": "XSS",
                "tipo_contenido": "TEXTO",
                "contenido_html": "<p>Hi</p><script>evil()</script>",
            },
            format="json",
        )
        assert resp.status_code == status.HTTP_201_CREATED
        assert "<script>" not in resp.data["contenido_html"]

    def test_update_module(self):
        admin = AdminUserFactory()
        course = create_course({"titulo": "C"}, admin)
        module = add_module(
            course.pk,
            {"titulo": "Old", "tipo_contenido": Module.TipoContenido.TEXTO, "contenido_html": "<p>X</p>"},
            admin,
        )
        resp = _client(admin).patch(
            _module_url(course.pk, module.pk),
            {"titulo": "New"},
            format="json",
        )
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["titulo"] == "New"

    def test_delete_module(self):
        admin = AdminUserFactory()
        course = create_course({"titulo": "C"}, admin)
        module = add_module(
            course.pk,
            {"titulo": "Delete me", "tipo_contenido": Module.TipoContenido.TEXTO, "contenido_html": "<p>X</p>"},
            admin,
        )
        resp = _client(admin).delete(_module_url(course.pk, module.pk))
        assert resp.status_code == status.HTTP_204_NO_CONTENT

    def test_module_access_control_401(self):
        admin = AdminUserFactory()
        course = create_course({"titulo": "C"}, admin)
        resp = _client().get(_modules_url(course.pk))
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_usuario_cannot_create_module(self):
        admin = AdminUserFactory()
        user = UserFactory()
        course = create_course({"titulo": "C"}, admin)
        resp = _client(user).post(
            _modules_url(course.pk),
            {"titulo": "M", "tipo_contenido": "TEXTO", "contenido_html": "<p>X</p>"},
            format="json",
        )
        assert resp.status_code == status.HTTP_403_FORBIDDEN
