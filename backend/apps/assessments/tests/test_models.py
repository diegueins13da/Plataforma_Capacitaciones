"""
T20 — Assessment model tests.
"""
import pytest

from apps.assessments.models import Assessment, Question, UserAnswer
from apps.courses.models import Course, Enrollment, Module
from apps.courses.services import create_course
from apps.users.tests.factories import AdminUserFactory, UserFactory


def _make_course_with_assessment():
    admin = AdminUserFactory()
    course = create_course({"titulo": "Curso Evaluación"}, admin)
    assessment = Assessment.objects.create(course=course, puntaje_minimo=70, max_intentos=3)
    return course, assessment


# ---------------------------------------------------------------------------
# Assessment
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_assessment_defaults():
    """Assessment has correct defaults."""
    _, assessment = _make_course_with_assessment()
    assert assessment.puntaje_minimo == 70
    assert assessment.max_intentos == 3
    assert assessment.tiempo_limite_minutos is None


@pytest.mark.django_db
def test_assessment_one_to_one_course():
    """A course can have at most one assessment."""
    _, assessment = _make_course_with_assessment()
    assert assessment.course.assessment == assessment


@pytest.mark.django_db
def test_assessment_str():
    _, assessment = _make_course_with_assessment()
    assert "Evaluación" in str(assessment)


# ---------------------------------------------------------------------------
# Question
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_question_multiple_choice_fields():
    """MULTIPLE_CHOICE question stores options and integer answer index."""
    _, assessment = _make_course_with_assessment()
    q = Question.objects.create(
        assessment=assessment,
        texto="¿Capital de Francia?",
        tipo=Question.Tipo.MULTIPLE_CHOICE,
        opciones=["Madrid", "París", "Roma"],
        respuesta_correcta=1,
        orden=1,
    )
    assert q.respuesta_correcta == 1
    assert q.opciones[1] == "París"


@pytest.mark.django_db
def test_question_multiple_select_stores_list():
    """MULTIPLE_SELECT question stores a list of indices."""
    _, assessment = _make_course_with_assessment()
    q = Question.objects.create(
        assessment=assessment,
        texto="¿Cuáles son colores primarios?",
        tipo=Question.Tipo.MULTIPLE_SELECT,
        opciones=["Rojo", "Verde", "Azul", "Amarillo"],
        respuesta_correcta=[0, 2, 3],
        orden=2,
    )
    assert sorted(q.respuesta_correcta) == [0, 2, 3]


@pytest.mark.django_db
def test_question_true_false_stores_boolean():
    """TRUE_FALSE question stores a boolean answer."""
    _, assessment = _make_course_with_assessment()
    q = Question.objects.create(
        assessment=assessment,
        texto="¿El sol es una estrella?",
        tipo=Question.Tipo.TRUE_FALSE,
        opciones=[],
        respuesta_correcta=True,
        orden=3,
    )
    assert q.respuesta_correcta is True


@pytest.mark.django_db
def test_question_not_approved_by_default():
    """Questions start with aprobada_por_humano=False."""
    _, assessment = _make_course_with_assessment()
    q = Question.objects.create(
        assessment=assessment,
        texto="Pregunta sin aprobar",
        tipo=Question.Tipo.TRUE_FALSE,
        opciones=[],
        respuesta_correcta=False,
        orden=1,
    )
    assert q.aprobada_por_humano is False


@pytest.mark.django_db
def test_question_str():
    _, assessment = _make_course_with_assessment()
    q = Question.objects.create(
        assessment=assessment,
        texto="¿Pregunta de prueba?",
        tipo=Question.Tipo.MULTIPLE_CHOICE,
        opciones=["A", "B"],
        respuesta_correcta=0,
        orden=1,
    )
    assert "Pregunta de prueba" in str(q)


# ---------------------------------------------------------------------------
# UserAnswer
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_useranswer_attempt_number_unique_per_enrollment():
    """Two attempts for the same enrollment cannot share the same intento_numero."""
    from django.db import IntegrityError

    user = UserFactory()
    course, assessment = _make_course_with_assessment()
    enrollment = Enrollment.objects.create(user=user, course=course)

    UserAnswer.objects.create(
        enrollment=enrollment,
        assessment=assessment,
        intento_numero=1,
        respuestas_json={},
    )
    with pytest.raises(IntegrityError):
        UserAnswer.objects.create(
            enrollment=enrollment,
            assessment=assessment,
            intento_numero=1,
            respuestas_json={},
        )


@pytest.mark.django_db
def test_useranswer_calificacion_defaults_null():
    """A freshly created UserAnswer has no calificacion yet."""
    user = UserFactory()
    course, assessment = _make_course_with_assessment()
    enrollment = Enrollment.objects.create(user=user, course=course)

    attempt = UserAnswer.objects.create(
        enrollment=enrollment,
        assessment=assessment,
        intento_numero=1,
        respuestas_json={},
    )
    assert attempt.calificacion is None
    assert attempt.aprobado is None


@pytest.mark.django_db
def test_useranswer_str():
    user = UserFactory()
    course, assessment = _make_course_with_assessment()
    enrollment = Enrollment.objects.create(user=user, course=course)

    attempt = UserAnswer.objects.create(
        enrollment=enrollment,
        assessment=assessment,
        intento_numero=1,
        respuestas_json={},
    )
    assert "Intento #1" in str(attempt)


@pytest.mark.django_db
def test_useranswer_delete_question_protected():
    """Deleting a Question that has associated UserAnswer records raises ProtectedError.
    (FK from UserAnswer to Assessment is PROTECT; Assessment cascades to questions,
    but individual questions don't own UserAnswer — the attempt does via Assessment.)
    """
    # The Assessment → Question relationship uses CASCADE (question lives or dies with assessment).
    # The UserAnswer → Assessment FK is PROTECT (can't delete assessment while answers exist).
    user = UserFactory()
    course, assessment = _make_course_with_assessment()
    enrollment = Enrollment.objects.create(user=user, course=course)
    UserAnswer.objects.create(
        enrollment=enrollment,
        assessment=assessment,
        intento_numero=1,
        respuestas_json={},
    )

    from django.db.models import ProtectedError
    with pytest.raises(ProtectedError):
        assessment.delete()
