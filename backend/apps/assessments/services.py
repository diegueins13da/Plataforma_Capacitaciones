"""
Assessment app service layer — Question bank management.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

from django.db.models import QuerySet

from .models import Assessment, Question

if TYPE_CHECKING:
    from apps.users.models import User


class AssessmentPermissionDenied(Exception):
    """Raised when a TRAINER tries to manage another trainer's assessment."""

    def __init__(self) -> None:
        super().__init__("Solo puedes gestionar las evaluaciones de tus propios cursos.")


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
