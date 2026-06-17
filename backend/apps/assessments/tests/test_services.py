"""
T21 — Assessment CRUD service tests.
"""
import pytest

from apps.assessments.models import Assessment, Question
from apps.assessments.services import (
    AssessmentPermissionDenied,
    create_question,
    delete_question,
    get_assessment,
    get_or_create_course_assessment,
    list_questions,
    update_assessment,
    update_question,
)
from apps.courses.services import create_course
from apps.users.tests.factories import AdminUserFactory, TrainerUserFactory, UserFactory


def _make_course_and_trainer():
    trainer = TrainerUserFactory()
    course = create_course({"titulo": "Curso"}, trainer)
    return course, trainer


# ---------------------------------------------------------------------------
# get_or_create_course_assessment
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_get_or_create_creates_if_missing():
    course, trainer = _make_course_and_trainer()
    assert not hasattr(course, "assessment") or not Assessment.objects.filter(course=course).exists()

    assessment = get_or_create_course_assessment(course.pk, trainer)

    assert assessment.course_id == course.pk
    assert assessment.puntaje_minimo == 70
    assert assessment.max_intentos == 3


@pytest.mark.django_db
def test_get_or_create_returns_existing():
    course, trainer = _make_course_and_trainer()
    existing = Assessment.objects.create(course=course, puntaje_minimo=80)

    assessment = get_or_create_course_assessment(course.pk, trainer)

    assert assessment.pk == existing.pk
    assert Assessment.objects.filter(course=course).count() == 1


@pytest.mark.django_db
def test_get_or_create_trainer_blocked_on_other_course():
    other_trainer = TrainerUserFactory()
    course, _ = _make_course_and_trainer()

    with pytest.raises(AssessmentPermissionDenied):
        get_or_create_course_assessment(course.pk, other_trainer)


# ---------------------------------------------------------------------------
# update_assessment
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_update_assessment_changes_config():
    course, trainer = _make_course_and_trainer()
    assessment = Assessment.objects.create(course=course)

    result = update_assessment(
        assessment.pk,
        {"puntaje_minimo": 60, "max_intentos": 5, "tiempo_limite_minutos": 45},
        trainer,
    )

    assert result.puntaje_minimo == 60
    assert result.max_intentos == 5
    assert result.tiempo_limite_minutos == 45


@pytest.mark.django_db
def test_update_assessment_partial():
    course, trainer = _make_course_and_trainer()
    assessment = Assessment.objects.create(course=course, puntaje_minimo=70, max_intentos=3)

    result = update_assessment(assessment.pk, {"puntaje_minimo": 90}, trainer)

    assert result.puntaje_minimo == 90
    assert result.max_intentos == 3  # unchanged


# ---------------------------------------------------------------------------
# create_question
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_create_question_sets_aprobada_por_humano():
    course, trainer = _make_course_and_trainer()
    assessment = Assessment.objects.create(course=course)

    q = create_question(
        assessment.pk,
        {
            "texto": "¿Qué es Django?",
            "tipo": Question.Tipo.MULTIPLE_CHOICE,
            "opciones": ["Framework", "Lenguaje", "Base de datos"],
            "respuesta_correcta": 0,
            "orden": 1,
        },
        trainer,
    )

    assert q.aprobada_por_humano is True
    assert q.assessment_id == assessment.pk


@pytest.mark.django_db
def test_create_question_multiple_select():
    course, trainer = _make_course_and_trainer()
    assessment = Assessment.objects.create(course=course)

    q = create_question(
        assessment.pk,
        {
            "texto": "¿Cuáles son frameworks de Python?",
            "tipo": Question.Tipo.MULTIPLE_SELECT,
            "opciones": ["Django", "React", "Flask", "Vue"],
            "respuesta_correcta": [0, 2],
            "orden": 1,
        },
        trainer,
    )

    assert q.respuesta_correcta == [0, 2]


@pytest.mark.django_db
def test_create_question_trainer_blocked_other_course():
    other_trainer = TrainerUserFactory()
    course, _ = _make_course_and_trainer()
    assessment = Assessment.objects.create(course=course)

    with pytest.raises(AssessmentPermissionDenied):
        create_question(
            assessment.pk,
            {
                "texto": "Pregunta",
                "tipo": Question.Tipo.TRUE_FALSE,
                "opciones": [],
                "respuesta_correcta": True,
                "orden": 1,
            },
            other_trainer,
        )


# ---------------------------------------------------------------------------
# list_questions
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_list_questions_returns_all_for_trainer():
    course, trainer = _make_course_and_trainer()
    assessment = Assessment.objects.create(course=course)
    q1 = Question.objects.create(
        assessment=assessment, texto="Q1", tipo="TRUE_FALSE", opciones=[],
        respuesta_correcta=True, orden=1, aprobada_por_humano=True,
    )
    q2 = Question.objects.create(
        assessment=assessment, texto="Q2", tipo="TRUE_FALSE", opciones=[],
        respuesta_correcta=False, orden=2, aprobada_por_humano=False,
    )

    qs = list(list_questions(assessment.pk, trainer))

    assert len(qs) == 2


# ---------------------------------------------------------------------------
# update_question / delete_question
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_update_question_changes_texto():
    course, trainer = _make_course_and_trainer()
    assessment = Assessment.objects.create(course=course)
    q = Question.objects.create(
        assessment=assessment, texto="Viejo texto", tipo="TRUE_FALSE",
        opciones=[], respuesta_correcta=True, orden=1,
    )

    result = update_question(assessment.pk, q.pk, {"texto": "Nuevo texto"}, trainer)

    assert result.texto == "Nuevo texto"


@pytest.mark.django_db
def test_delete_question_removes_record():
    course, trainer = _make_course_and_trainer()
    assessment = Assessment.objects.create(course=course)
    q = Question.objects.create(
        assessment=assessment, texto="Para borrar", tipo="TRUE_FALSE",
        opciones=[], respuesta_correcta=True, orden=1,
    )

    delete_question(assessment.pk, q.pk, trainer)

    assert not Question.objects.filter(pk=q.pk).exists()


@pytest.mark.django_db
def test_delete_question_does_not_delete_useranswers():
    """Deleting a question preserves UserAnswer records (Assessment FK is PROTECT)."""
    from apps.assessments.models import UserAnswer
    from apps.courses.models import Enrollment

    admin = AdminUserFactory()
    user = UserFactory()
    course = create_course({"titulo": "C"}, admin)
    assessment = Assessment.objects.create(course=course)
    q = Question.objects.create(
        assessment=assessment, texto="Q", tipo="TRUE_FALSE",
        opciones=[], respuesta_correcta=True, orden=1,
    )
    enrollment = Enrollment.objects.create(user=user, course=course)
    UserAnswer.objects.create(
        enrollment=enrollment, assessment=assessment, intento_numero=1, respuestas_json={}
    )

    # Deleting a single question should work (cascade from assessment, not from UserAnswer)
    delete_question(assessment.pk, q.pk, admin)

    # UserAnswer must still exist
    assert UserAnswer.objects.filter(enrollment=enrollment).exists()
