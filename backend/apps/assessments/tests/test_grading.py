"""
T22 — Exam grading service tests.
"""
import pytest
from rest_framework import status
from rest_framework.test import APIClient

from apps.assessments.models import Assessment, Question, UserAnswer
from apps.assessments.services import (
    ConflictError,
    ExamError,
    TooManyAttemptsError,
    get_active_attempt,
    grade_answers,
    reset_attempts,
    save_exam_progress,
    start_exam,
    submit_exam,
)
from apps.courses.models import Certificate, Enrollment, Module, ModuleProgress
from apps.courses.services import create_course
from apps.users.tests.factories import AdminUserFactory, UserFactory

ASSESSMENTS_URL = "/api/v1/assessments/"


def _client(user=None) -> APIClient:
    c = APIClient()
    if user:
        c.force_authenticate(user=user)
    return c


def _make_ready_exam(*, user=None, num_questions=3, puntaje_minimo=70, complete_modules=True):
    """Create a course with assessment + questions + enrolled user with all modules complete."""
    admin = AdminUserFactory()
    if user is None:
        user = UserFactory()
    course = create_course({"titulo": "Curso Examen"}, admin)
    m = Module.objects.create(
        course=course, titulo="M1", tipo_contenido="TEXTO",
        orden=1, contenido_html="<p>A</p>"
    )
    assessment = Assessment.objects.create(
        course=course, puntaje_minimo=puntaje_minimo, max_intentos=3
    )
    for i in range(num_questions):
        Question.objects.create(
            assessment=assessment,
            texto=f"Pregunta {i + 1}",
            tipo=Question.Tipo.MULTIPLE_CHOICE,
            opciones=["A", "B", "C"],
            respuesta_correcta=0,
            orden=i + 1,
            aprobada_por_humano=True,
        )
    enrollment = Enrollment.objects.create(user=user, course=course)
    if complete_modules:
        mp = ModuleProgress.objects.create(enrollment=enrollment, module=m, is_completed=True)
        enrollment.update_progress()
        enrollment.refresh_from_db()
    return course, assessment, enrollment, user


# ---------------------------------------------------------------------------
# start_exam
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_start_exam_creates_useranswer():
    _, assessment, enrollment, user = _make_ready_exam()
    attempt = start_exam(assessment.pk, user)

    assert attempt.enrollment_id == enrollment.pk
    assert attempt.intento_numero == 1
    assert attempt.fecha_fin is None
    assert "_order" in attempt.respuestas_json


@pytest.mark.django_db
def test_start_exam_returns_shuffled_question_ids():
    _, assessment, _, user = _make_ready_exam(num_questions=3)
    attempt = start_exam(assessment.pk, user)

    order = attempt.respuestas_json["_order"]
    assert len(order) == 3
    approved_ids = set(assessment.questions.filter(aprobada_por_humano=True).values_list("id", flat=True))
    assert set(order) == approved_ids


@pytest.mark.django_db
def test_start_exam_no_enrollment_raises():
    _, assessment, _, _ = _make_ready_exam()
    other_user = UserFactory()

    with pytest.raises(ExamError):
        start_exam(assessment.pk, other_user)


@pytest.mark.django_db
def test_start_exam_too_many_attempts_raises():
    _, assessment, enrollment, user = _make_ready_exam()
    # Exhaust all 3 attempts
    for i in range(1, 4):
        UserAnswer.objects.create(
            enrollment=enrollment, assessment=assessment,
            intento_numero=i, respuestas_json={}, calificacion=50, aprobado=False,
            fecha_fin=__import__("django.utils", fromlist=["timezone"]).timezone.now(),
        )

    with pytest.raises(TooManyAttemptsError):
        start_exam(assessment.pk, user)


@pytest.mark.django_db
def test_start_exam_active_attempt_raises_conflict():
    _, assessment, enrollment, user = _make_ready_exam()
    # Already has in-progress attempt
    UserAnswer.objects.create(
        enrollment=enrollment, assessment=assessment,
        intento_numero=1, respuestas_json={}
    )

    with pytest.raises(ConflictError):
        start_exam(assessment.pk, user)


@pytest.mark.django_db
def test_start_exam_increments_attempt_number():
    _, assessment, enrollment, user = _make_ready_exam()
    # Complete first attempt
    from django.utils import timezone
    UserAnswer.objects.create(
        enrollment=enrollment, assessment=assessment,
        intento_numero=1, respuestas_json={}, calificacion=50, aprobado=False,
        fecha_fin=timezone.now(),
    )

    attempt = start_exam(assessment.pk, user)
    assert attempt.intento_numero == 2


# ---------------------------------------------------------------------------
# grade_answers
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_grade_all_correct():
    _, assessment, enrollment, user = _make_ready_exam(num_questions=4, puntaje_minimo=70)
    questions = list(assessment.questions.filter(aprobada_por_humano=True))
    answers = {str(q.pk): 0 for q in questions}  # all correct (index 0)

    score, aprobado = grade_answers(assessment, answers)

    assert score == 100
    assert aprobado is True


@pytest.mark.django_db
def test_grade_none_correct():
    _, assessment, enrollment, user = _make_ready_exam(num_questions=4, puntaje_minimo=70)
    questions = list(assessment.questions.filter(aprobada_por_humano=True))
    answers = {str(q.pk): 2 for q in questions}  # all wrong (index 2)

    score, aprobado = grade_answers(assessment, answers)

    assert score == 0
    assert aprobado is False


@pytest.mark.django_db
def test_grade_exact_minimum_passes():
    _, assessment, enrollment, user = _make_ready_exam(num_questions=10, puntaje_minimo=70)
    questions = list(assessment.questions.filter(aprobada_por_humano=True))
    # Answer 7 out of 10 correctly
    answers = {}
    for i, q in enumerate(questions):
        answers[str(q.pk)] = 0 if i < 7 else 2  # first 7 correct, last 3 wrong

    score, aprobado = grade_answers(assessment, answers)

    assert score == 70
    assert aprobado is True


# ---------------------------------------------------------------------------
# submit_exam
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_submit_exam_passing_creates_certificate():
    _, assessment, enrollment, user = _make_ready_exam(num_questions=3, puntaje_minimo=60)
    attempt = start_exam(assessment.pk, user)
    questions = list(assessment.questions.filter(aprobada_por_humano=True))
    answers = {str(q.pk): 0 for q in questions}  # all correct

    result = submit_exam(assessment.pk, user, answers)

    assert result["aprobado"] is True
    assert result["calificacion"] == 100
    assert Certificate.objects.filter(enrollment=enrollment).exists()


@pytest.mark.django_db
def test_submit_exam_failing_no_certificate():
    _, assessment, enrollment, user = _make_ready_exam(num_questions=3, puntaje_minimo=70)
    attempt = start_exam(assessment.pk, user)
    questions = list(assessment.questions.filter(aprobada_por_humano=True))
    answers = {str(q.pk): 2 for q in questions}  # all wrong

    result = submit_exam(assessment.pk, user, answers)

    assert result["aprobado"] is False
    assert not Certificate.objects.filter(enrollment=enrollment).exists()


@pytest.mark.django_db
def test_submit_exam_no_active_attempt_raises():
    _, assessment, enrollment, user = _make_ready_exam()

    with pytest.raises(ExamError):
        submit_exam(assessment.pk, user, {})


@pytest.mark.django_db
def test_submit_exam_after_time_limit_raises():
    from datetime import timedelta
    from django.utils import timezone

    _, assessment, enrollment, user = _make_ready_exam()
    assessment.tiempo_limite_minutos = 1
    assessment.save()

    attempt = start_exam(assessment.pk, user)
    # Backdate the start time by 2 minutes
    attempt.fecha_inicio = timezone.now() - timedelta(minutes=2)
    attempt.save(update_fields=["fecha_inicio"])

    with pytest.raises(ExamError):
        submit_exam(assessment.pk, user, {})


# ---------------------------------------------------------------------------
# save_exam_progress
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_save_progress_merges_answers():
    _, assessment, enrollment, user = _make_ready_exam(num_questions=2)
    attempt = start_exam(assessment.pk, user)
    questions = list(assessment.questions.filter(aprobada_por_humano=True))

    save_exam_progress(assessment.pk, user, {str(questions[0].pk): 1})
    attempt.refresh_from_db()

    assert str(questions[0].pk) in attempt.respuestas_json


# ---------------------------------------------------------------------------
# reset_attempts
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_reset_attempts_deletes_useranswers():
    from django.utils import timezone

    _, assessment, enrollment, user = _make_ready_exam()
    UserAnswer.objects.create(
        enrollment=enrollment, assessment=assessment,
        intento_numero=1, respuestas_json={}, calificacion=40, aprobado=False,
        fecha_fin=timezone.now(),
    )
    admin = AdminUserFactory()

    reset_attempts(assessment.pk, user.pk, admin)

    assert UserAnswer.objects.filter(enrollment=enrollment).count() == 0


@pytest.mark.django_db
def test_reset_attempts_non_admin_raises():
    _, assessment, enrollment, user = _make_ready_exam()
    other_user = UserFactory()

    with pytest.raises(ExamError):
        reset_attempts(assessment.pk, user.pk, other_user)


# ---------------------------------------------------------------------------
# View endpoints
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_api_start_exam():
    _, assessment, _, user = _make_ready_exam()
    resp = _client(user).post(f"{ASSESSMENTS_URL}{assessment.pk}/start/")

    assert resp.status_code == status.HTTP_201_CREATED
    assert "questions" in resp.data
    assert "attempt_id" in resp.data


@pytest.mark.django_db
def test_api_submit_exam():
    _, assessment, _, user = _make_ready_exam(num_questions=2, puntaje_minimo=50)
    _client(user).post(f"{ASSESSMENTS_URL}{assessment.pk}/start/")
    questions = list(assessment.questions.filter(aprobada_por_humano=True))
    answers = {str(q.pk): 0 for q in questions}

    resp = _client(user).post(f"{ASSESSMENTS_URL}{assessment.pk}/submit/", {"answers": answers}, format="json")

    assert resp.status_code == status.HTTP_200_OK
    assert "calificacion" in resp.data


@pytest.mark.django_db
def test_api_reset_attempts_admin_only():
    _, assessment, _, user = _make_ready_exam()
    admin = AdminUserFactory()

    resp = _client(user).post(f"{ASSESSMENTS_URL}{assessment.pk}/users/{user.pk}/reset-attempts/")
    assert resp.status_code == status.HTTP_403_FORBIDDEN

    resp = _client(admin).post(f"{ASSESSMENTS_URL}{assessment.pk}/users/{user.pk}/reset-attempts/")
    assert resp.status_code == status.HTTP_200_OK
