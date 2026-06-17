from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from apps.users.permissions import IsAdminOrTrainer

from . import services
from .models import Assessment, Question
from .serializers import (
    AssessmentSerializer,
    AssessmentUpdateSerializer,
    QuestionCreateSerializer,
    QuestionSerializer,
)


class AssessmentViewSet(GenericViewSet):
    """
    Assessment management endpoints.

    Permissions:
    - retrieve: any authenticated user (USUARIO can view their own course assessment)
    - update / question management: ADMIN or TRAINER (TRAINER restricted to own courses)
    """

    def get_permissions(self):
        if self.action == "retrieve":
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdminOrTrainer()]

    def retrieve(self, request: Request, pk: str | None = None) -> Response:
        try:
            assessment = services.get_assessment(int(pk), request.user)
        except Assessment.DoesNotExist:
            return Response({"error": "Evaluación no encontrada."}, status=status.HTTP_404_NOT_FOUND)
        except services.AssessmentPermissionDenied as exc:
            return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
        return Response(AssessmentSerializer(assessment).data)

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
        return Response(AssessmentSerializer(assessment).data)

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
