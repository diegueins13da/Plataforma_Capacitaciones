from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from apps.users.permissions import IsAdmin, IsAdminOrTrainer

from . import services
from .models import Assessment, Question, UserAnswer
from .serializers import (
    AssessmentSerializer,
    AssessmentUpdateSerializer,
    QuestionCreateSerializer,
    QuestionPublicSerializer,
    QuestionSerializer,
    UserAnswerSerializer,
)


class AssessmentViewSet(GenericViewSet):
    """
    Assessment management endpoints.

    Permissions:
    - retrieve: any authenticated user (USUARIO can view their own course assessment)
    - update / question management: ADMIN or TRAINER (TRAINER restricted to own courses)
    """

    _USER_ACTIONS = {"retrieve", "start", "save_progress", "submit"}
    _ADMIN_ACTIONS = {"reset_attempts", "get_attempts"}

    def get_permissions(self):
        if self.action in self._USER_ACTIONS:
            return [IsAuthenticated()]
        if self.action in self._ADMIN_ACTIONS:
            return [IsAuthenticated(), IsAdmin()]
        return [IsAuthenticated(), IsAdminOrTrainer()]

    def retrieve(self, request: Request, pk: str | None = None) -> Response:
        try:
            assessment = services.get_assessment(int(pk), request.user)
        except Assessment.DoesNotExist:
            return Response({"error": "Evaluación no encontrada."}, status=status.HTTP_404_NOT_FOUND)
        except services.AssessmentPermissionDenied as exc:
            return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
        return Response(AssessmentSerializer(assessment, context={"request": request}).data)

    def partial_update(self, request: Request, pk: str | None = None) -> Response:
        serializer = AssessmentUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
        try:
            assessment = services.update_assessment(int(pk), dict(serializer.validated_data), request.user)
        except Assessment.DoesNotExist:
            return Response({"error": "Evaluación no encontrada."}, status=status.HTTP_404_NOT_FOUND)
        except services.AssessmentPermissionDenied as exc:
            return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
        return Response(AssessmentSerializer(assessment, context={"request": request}).data)

    @action(detail=True, methods=["get", "post"], url_path="questions")
    def questions(self, request: Request, pk: str | None = None) -> Response:
        if request.method == "GET":
            return self._list_questions(request, pk)
        return self._create_question(request, pk)

    @action(
        detail=True,
        methods=["patch", "put", "delete"],
        url_path=r"questions/(?P<question_id>\d+)",
    )
    def question_detail(
        self, request: Request, pk: str | None = None, question_id: str | None = None
    ) -> Response:
        if request.method in ("PATCH", "PUT"):
            return self._update_question(request, pk, question_id)
        return self._delete_question(request, pk, question_id)

    def _list_questions(self, request: Request, pk: str | None) -> Response:
        try:
            qs = services.list_questions(int(pk), request.user)
        except Assessment.DoesNotExist:
            return Response({"error": "Evaluación no encontrada."}, status=status.HTTP_404_NOT_FOUND)
        except services.AssessmentPermissionDenied as exc:
            return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
        return Response(QuestionSerializer(qs, many=True).data)

    def _create_question(self, request: Request, pk: str | None) -> Response:
        serializer = QuestionCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
        try:
            question = services.create_question(int(pk), dict(serializer.validated_data), request.user)
        except Assessment.DoesNotExist:
            return Response({"error": "Evaluación no encontrada."}, status=status.HTTP_404_NOT_FOUND)
        except services.AssessmentPermissionDenied as exc:
            return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
        return Response(QuestionSerializer(question).data, status=status.HTTP_201_CREATED)

    def _update_question(
        self, request: Request, pk: str | None, question_id: str | None
    ) -> Response:
        serializer = QuestionCreateSerializer(data=request.data, partial=True)
        if not serializer.is_valid():
            return Response({"errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
        try:
            question = services.update_question(
                int(pk), int(question_id), dict(serializer.validated_data), request.user
            )
        except (Assessment.DoesNotExist, Question.DoesNotExist):
            return Response({"error": "Recurso no encontrado."}, status=status.HTTP_404_NOT_FOUND)
        except services.AssessmentPermissionDenied as exc:
            return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
        return Response(QuestionSerializer(question).data)

    def _delete_question(
        self, request: Request, pk: str | None, question_id: str | None
    ) -> Response:
        try:
            services.delete_question(int(pk), int(question_id), request.user)
        except (Assessment.DoesNotExist, Question.DoesNotExist):
            return Response({"error": "Recurso no encontrado."}, status=status.HTTP_404_NOT_FOUND)
        except services.AssessmentPermissionDenied as exc:
            return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ------------------------------------------------------------------
    # Exam lifecycle
    # ------------------------------------------------------------------

    @action(detail=True, methods=["post"], url_path="start", permission_classes=[IsAuthenticated])
    def start(self, request: Request, pk: str | None = None) -> Response:
        try:
            attempt = services.start_exam(int(pk), request.user)
        except Assessment.DoesNotExist:
            return Response({"error": "Evaluación no encontrada."}, status=status.HTTP_404_NOT_FOUND)
        except services.ConflictError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_409_CONFLICT)
        except services.TooManyAttemptsError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
        except services.ExamError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)

        # Return shuffled questions (no correct answers)
        order = attempt.respuestas_json.get("_order", [])
        questions = {q.pk: q for q in Question.objects.filter(pk__in=order)}
        ordered_questions = [questions[q_id] for q_id in order if q_id in questions]

        return Response(
            {
                "attempt_id": attempt.pk,
                "questions": QuestionPublicSerializer(ordered_questions, many=True).data,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="save-progress", permission_classes=[IsAuthenticated])
    def save_progress(self, request: Request, pk: str | None = None) -> Response:
        answers = request.data.get("answers", {})
        if not isinstance(answers, dict):
            return Response({"error": "answers debe ser un objeto JSON."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            attempt = services.save_exam_progress(int(pk), request.user, answers)
        except Assessment.DoesNotExist:
            return Response({"error": "Evaluación no encontrada."}, status=status.HTTP_404_NOT_FOUND)
        except services.ExamError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"saved": True, "attempt_id": attempt.pk})

    @action(detail=True, methods=["post"], url_path="submit", permission_classes=[IsAuthenticated])
    def submit(self, request: Request, pk: str | None = None) -> Response:
        answers = request.data.get("answers", {})
        if not isinstance(answers, dict):
            return Response({"error": "answers debe ser un objeto JSON."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            result = services.submit_exam(int(pk), request.user, answers)
        except Assessment.DoesNotExist:
            return Response({"error": "Evaluación no encontrada."}, status=status.HTTP_404_NOT_FOUND)
        except services.ExamError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(result)

    @action(
        detail=True,
        methods=["post"],
        url_path=r"users/(?P<target_user_id>\d+)/reset-attempts",
        permission_classes=[IsAuthenticated, IsAdmin],
    )
    def reset_attempts(
        self, request: Request, pk: str | None = None, target_user_id: str | None = None
    ) -> Response:
        try:
            count = services.reset_attempts(int(pk), int(target_user_id), request.user)
        except Assessment.DoesNotExist:
            return Response({"error": "Evaluación no encontrada."}, status=status.HTTP_404_NOT_FOUND)
        except services.ExamError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
        return Response({"deleted": count})

    @action(
        detail=True,
        methods=["get"],
        url_path=r"users/(?P<target_user_id>\d+)/attempts",
        permission_classes=[IsAuthenticated, IsAdmin],
    )
    def get_attempts(
        self, request: Request, pk: str | None = None, target_user_id: str | None = None
    ) -> Response:
        try:
            attempts = services.get_user_attempts(int(pk), int(target_user_id), request.user)
        except Assessment.DoesNotExist:
            return Response({"error": "Evaluación no encontrada."}, status=status.HTTP_404_NOT_FOUND)
        except services.ExamError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
        return Response(UserAnswerSerializer(attempts, many=True).data)
