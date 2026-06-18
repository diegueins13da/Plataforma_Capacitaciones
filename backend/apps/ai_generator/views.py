import os
import uuid

from celery.result import AsyncResult
from rest_framework import status
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.permissions import IsAdminOrTrainer

from .serializers import DocumentUploadSerializer, GenerateQuestionsSerializer
from .tasks import analyze_document, generate_questions_task

ALLOWED_EXTENSIONS = {".pdf", ".pptx", ".ppt"}
MAX_FILE_SIZE_MB = 20


class DocumentUploadView(APIView):
    """Upload a PDF/PPT document and start the AI analysis task."""

    parser_classes = [MultiPartParser]
    permission_classes = [IsAuthenticated, IsAdminOrTrainer]

    def post(self, request: Request) -> Response:
        serializer = DocumentUploadSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        uploaded = request.FILES["file"]
        ext = os.path.splitext(uploaded.name)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            return Response(
                {"error": f"Tipo de archivo no permitido. Usa: {', '.join(ALLOWED_EXTENSIONS)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if uploaded.size > MAX_FILE_SIZE_MB * 1024 * 1024:
            return Response(
                {"error": f"El archivo supera el límite de {MAX_FILE_SIZE_MB} MB."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Save to a temporary location for the Celery worker to read
        from django.conf import settings as django_settings  # noqa: PLC0415

        media_root = getattr(django_settings, "MEDIA_ROOT", "/tmp")
        tmp_dir = os.path.join(media_root, "ai_uploads")
        os.makedirs(tmp_dir, exist_ok=True)
        unique_name = f"{uuid.uuid4().hex}{ext}"
        file_path = os.path.join(tmp_dir, unique_name)
        with open(file_path, "wb") as f:
            for chunk in uploaded.chunks():
                f.write(chunk)

        file_type = "pdf" if ext == ".pdf" else "pptx"
        config = {"cantidad_modulos": serializer.validated_data.get("cantidad_modulos", 5)}

        task = analyze_document.delay(file_path, file_type, config)
        return Response({"task_id": task.id}, status=status.HTTP_202_ACCEPTED)


class TaskStatusView(APIView):
    """Poll the status of a Celery task."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, task_id: str) -> Response:
        result = AsyncResult(task_id)
        data: dict = {"task_id": task_id, "status": result.status}
        if result.successful():
            data["result"] = result.result
        elif result.failed():
            data["error"] = str(result.result)
        return Response(data)


class GenerateQuestionsView(APIView):
    """Start a question-generation task for a given content text."""

    permission_classes = [IsAuthenticated, IsAdminOrTrainer]

    def post(self, request: Request) -> Response:
        serializer = GenerateQuestionsSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        config = {
            "cantidad": serializer.validated_data["cantidad"],
            "tipos": serializer.validated_data.get("tipos") or ["MULTIPLE_CHOICE"],
            "dificultad": serializer.validated_data["dificultad"],
        }
        task = generate_questions_task.delay(
            serializer.validated_data["content"], config
        )
        return Response({"task_id": task.id}, status=status.HTTP_202_ACCEPTED)
