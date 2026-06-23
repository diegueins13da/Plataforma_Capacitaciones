"""
Assessment app service layer — Question bank management + exam grading.
"""
from __future__ import annotations

import random
from datetime import timedelta
from typing import TYPE_CHECKING

from django.db import transaction
from django.db.models import QuerySet
from django.utils import timezone

from .models import Assessment, Question, UserAnswer

if TYPE_CHECKING:
    from apps.users.models import User


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class AssessmentPermissionDenied(Exception):
    """Raised when a TRAINER tries to manage another trainer's assessment."""

    def __init__(self) -> None:
        super().__init__("Solo puedes gestionar las evaluaciones de tus propios cursos.")


class ExamError(Exception):
    """General exam business rule violation."""


class TooManyAttemptsError(ExamError):
    """Raised when the user has exhausted all allowed attempts."""

    def __init__(self) -> None:
        super().__init__("Has agotado el número máximo de intentos permitidos.")


def _assert_assessment_owner(assessment: "Assessment", user: "User") -> None:
    if user.role == "TRAINER" and assessment.course.created_by_id != user.pk:
        raise AssessmentPermissionDenied()


# ---------------------------------------------------------------------------
# Assessment management
# ---------------------------------------------------------------------------


def get_assessment(assessment_id: int, user: "User") -> "Assessment":
    assessment = Assessment.objects.select_related("course__created_by").get(pk=assessment_id)
    if user.role == "TRAINER":
        _assert_assessment_owner(assessment, user)
    return assessment


def get_or_create_course_assessment(course_id: int, user: "User") -> "Assessment":
    """Return the assessment for a course, creating it with defaults if it doesn't exist."""
    from apps.courses.models import Course

    course = Course.objects.select_related("created_by").get(pk=course_id)
    if user.role == "TRAINER" and course.created_by_id != user.pk:
        raise AssessmentPermissionDenied()

    assessment, _ = Assessment.objects.get_or_create(
        course=course,
        defaults={"puntaje_minimo": 70, "max_intentos": 3},
    )
    return assessment


def update_assessment(assessment_id: int, data: dict, user: "User") -> "Assessment":
    assessment = Assessment.objects.select_related("course__created_by").get(pk=assessment_id)
    _assert_assessment_owner(assessment, user)
    for field, value in data.items():
        setattr(assessment, field, value)
    assessment.save()
    return assessment


# ---------------------------------------------------------------------------
# Question management
# ---------------------------------------------------------------------------


def list_questions(assessment_id: int, user: "User") -> "QuerySet[Question]":
    assessment = Assessment.objects.select_related("course__created_by").get(pk=assessment_id)
    if user.role == "TRAINER":
        _assert_assessment_owner(assessment, user)
    return assessment.questions.all()


def create_question(assessment_id: int, data: dict, user: "User") -> "Question":
    assessment = Assessment.objects.select_related("course__created_by").get(pk=assessment_id)
    _assert_assessment_owner(assessment, user)
    return Question.objects.create(
        assessment=assessment,
        aprobada_por_humano=True,
        **data,
    )


def update_question(assessment_id: int, question_id: int, data: dict, user: "User") -> "Question":
    assessment = Assessment.objects.select_related("course__created_by").get(pk=assessment_id)
    _assert_assessment_owner(assessment, user)
    question = assessment.questions.get(pk=question_id)
    for field, value in data.items():
        setattr(question, field, value)
    question.save()
    return question


def delete_question(assessment_id: int, question_id: int, user: "User") -> None:
    assessment = Assessment.objects.select_related("course__created_by").get(pk=assessment_id)
    if user.role != "USUARIO":
        _assert_assessment_owner(assessment, user)
    question = assessment.questions.get(pk=question_id)
    question.delete()


# ---------------------------------------------------------------------------
# Exam helpers
# ---------------------------------------------------------------------------


class ConflictError(ExamError):
    """Raised when a concurrent exam attempt is detected."""

    def __init__(self) -> None:
        super().__init__("Ya tienes un examen activo en otra pestaña.")


def get_active_attempt(enrollment: object, assessment: "Assessment") -> "UserAnswer | None":
    """Return the in-progress attempt (fecha_fin is None) for an enrollment, if any."""
    return UserAnswer.objects.filter(
        enrollment=enrollment, assessment=assessment, fecha_fin__isnull=True
    ).first()


def grade_answers(assessment: "Assessment", answers: dict) -> tuple[float, bool]:
    """
    Grade the user's answers against the assessment's approved questions.

    answers: {str(question_id): user_answer_value}

    Returns (calificacion_pct, aprobado).
    """
    questions = list(assessment.questions.filter(aprobada_por_humano=True))
    if not questions:
        return 0.0, False

    correct = 0
    for q in questions:
        user_ans = answers.get(str(q.pk))
        if user_ans is None:
            continue
        expected = q.respuesta_correcta
        if q.tipo == Question.Tipo.MULTIPLE_SELECT:
            if set(user_ans) == set(expected):
                correct += 1
        elif user_ans == expected:
            correct += 1

    score = round((correct / len(questions)) * 100, 2)
    return score, score >= assessment.puntaje_minimo


# ---------------------------------------------------------------------------
# Exam lifecycle
# ---------------------------------------------------------------------------


def start_exam(assessment_id: int, user: "User") -> "UserAnswer":
    """
    Start a new exam attempt for the user.

    - Validates enrollment and course completion.
    - Enforces max_intentos limit.
    - Protects against concurrent starts via select_for_update.
    """
    from apps.courses.models import Enrollment

    assessment = Assessment.objects.select_related("course").get(pk=assessment_id)
    try:
        enrollment = Enrollment.objects.get(user=user, course=assessment.course)
    except Enrollment.DoesNotExist:
        raise ExamError("No estás inscrito en este curso.")

    with transaction.atomic():
        # Lock the enrollment row to prevent concurrent starts
        Enrollment.objects.select_for_update().get(pk=enrollment.pk)

        # Check for an already in-progress attempt
        active = get_active_attempt(enrollment, assessment)
        if active:
            raise ConflictError()

        # Count completed (graded) attempts
        completed_count = UserAnswer.objects.filter(
            enrollment=enrollment, assessment=assessment, fecha_fin__isnull=False
        ).count()
        if completed_count >= assessment.max_intentos:
            raise TooManyAttemptsError()

        # Shuffle approved questions and fix order for this attempt
        approved = list(assessment.questions.filter(aprobada_por_humano=True).order_by("orden"))
        random.shuffle(approved)
        question_order = [q.pk for q in approved]

        next_intento = UserAnswer.objects.filter(
            enrollment=enrollment, assessment=assessment
        ).count() + 1

        attempt = UserAnswer.objects.create(
            enrollment=enrollment,
            assessment=assessment,
            intento_numero=next_intento,
            respuestas_json={"_order": question_order},
        )
    return attempt


def save_exam_progress(assessment_id: int, user: "User", answers: dict) -> "UserAnswer":
    """Merge partial answers into the active attempt (auto-save every 30 s)."""
    from apps.courses.models import Enrollment

    assessment = Assessment.objects.select_related("course").get(pk=assessment_id)
    try:
        enrollment = Enrollment.objects.get(user=user, course=assessment.course)
    except Enrollment.DoesNotExist:
        raise ExamError("No estás inscrito en este curso.")

    attempt = get_active_attempt(enrollment, assessment)
    if not attempt:
        raise ExamError("No tienes un examen en curso.")

    # Merge without overwriting _order
    current = attempt.respuestas_json or {}
    current.update({k: v for k, v in answers.items() if not k.startswith("_")})
    attempt.respuestas_json = current
    attempt.save(update_fields=["respuestas_json"])
    return attempt


def submit_exam(assessment_id: int, user: "User", answers: dict) -> dict:
    """
    Grade and finalize the exam attempt.

    If approved, creates a Certificate stub (UUID + fecha_emision only).
    Returns dict with calificacion, aprobado, and correct_answers for review.
    """
    from apps.courses.models import Certificate, Enrollment

    assessment = Assessment.objects.select_related("course").get(pk=assessment_id)
    try:
        enrollment = Enrollment.objects.get(user=user, course=assessment.course)
    except Enrollment.DoesNotExist:
        raise ExamError("No estás inscrito en este curso.")

    attempt = get_active_attempt(enrollment, assessment)
    if not attempt:
        raise ExamError("No tienes un examen en curso.")

    # Validate time limit
    if assessment.tiempo_limite_minutos:
        elapsed = timezone.now() - attempt.fecha_inicio
        if elapsed > timedelta(minutes=assessment.tiempo_limite_minutos):
            # Auto-fail: close the attempt
            attempt.calificacion = 0
            attempt.aprobado = False
            attempt.fecha_fin = timezone.now()
            attempt.save(update_fields=["calificacion", "aprobado", "fecha_fin"])
            raise ExamError("El tiempo límite del examen ha expirado.")

    # Merge final answers
    current = attempt.respuestas_json or {}
    current.update({k: v for k, v in answers.items() if not k.startswith("_")})

    calificacion, aprobado = grade_answers(assessment, current)

    attempt.respuestas_json = current
    attempt.calificacion = calificacion
    attempt.aprobado = aprobado
    attempt.fecha_fin = timezone.now()
    attempt.save(update_fields=["respuestas_json", "calificacion", "aprobado", "fecha_fin"])

    if aprobado:
        Certificate.objects.get_or_create(
            user=user,
            course=assessment.course,
            defaults={"enrollment": enrollment},
        )

    # Fire exam result notifications
    from apps.notifications.services import (  # noqa: PLC0415
        notify_examen_aprobado,
        notify_examen_reprobado,
    )

    completed_count = UserAnswer.objects.filter(
        enrollment=enrollment, assessment=assessment, fecha_fin__isnull=False
    ).count()
    remaining = max(0, assessment.max_intentos - completed_count)

    if aprobado:
        notify_examen_aprobado(user, enrollment, float(calificacion))
    else:
        notify_examen_reprobado(user, enrollment, float(calificacion), remaining)

    # Notify the course instructor about the exam result
    from apps.notifications.services import (  # noqa: PLC0415
        notify_instructor_alumno_aprobado,
        notify_instructor_alumno_reprobado,
    )
    instructor = assessment.course.created_by
    if instructor and instructor.pk != user.pk:
        if aprobado:
            notify_instructor_alumno_aprobado(instructor, user, enrollment, float(calificacion))
        else:
            notify_instructor_alumno_reprobado(instructor, user, enrollment, float(calificacion))

    # Build correct_answers map for the review screen
    questions = list(assessment.questions.filter(aprobada_por_humano=True))
    correct_answers = {str(q.pk): q.respuesta_correcta for q in questions}

    return {
        "attempt_id": attempt.pk,
        "intento_numero": attempt.intento_numero,
        "calificacion": float(calificacion),
        "aprobado": aprobado,
        "correct_answers": correct_answers,
    }


# ---------------------------------------------------------------------------
# Admin utilities
# ---------------------------------------------------------------------------


def reset_attempts(assessment_id: int, target_user_id: int, admin_user: "User") -> int:
    """ADMIN: delete all exam attempts for a user on a given assessment."""
    from apps.courses.models import Enrollment
    from apps.reports.audit import log_event

    if admin_user.role != "ADMIN":
        raise ExamError("Solo el administrador puede resetear intentos de examen.")

    assessment = Assessment.objects.select_related("course").get(pk=assessment_id)
    try:
        enrollment = Enrollment.objects.get(user_id=target_user_id, course=assessment.course)
    except Enrollment.DoesNotExist:
        raise ExamError("El usuario no está inscrito en este curso.")

    deleted_count, _ = UserAnswer.objects.filter(
        enrollment=enrollment, assessment=assessment
    ).delete()

    log_event(
        accion="EXAM_ATTEMPTS_RESET",
        actor=admin_user,
        entidad_tipo="Assessment",
        entidad_id=assessment.pk,
        entidad_nombre=assessment.course.titulo,
        detalle={
            "usuario_id": target_user_id,
            "intentos_eliminados": deleted_count,
        },
    )
    return deleted_count


def get_user_attempts(assessment_id: int, target_user_id: int, admin_user: "User") -> "QuerySet[UserAnswer]":
    """ADMIN: return all attempts for a user on a given assessment."""
    from apps.courses.models import Enrollment

    if admin_user.role != "ADMIN":
        raise ExamError("Solo el administrador puede consultar intentos ajenos.")

    assessment = Assessment.objects.select_related("course").get(pk=assessment_id)
    try:
        enrollment = Enrollment.objects.get(user_id=target_user_id, course=assessment.course)
    except Enrollment.DoesNotExist:
        raise ExamError("El usuario no está inscrito en este curso.")

    return UserAnswer.objects.filter(enrollment=enrollment, assessment=assessment)
