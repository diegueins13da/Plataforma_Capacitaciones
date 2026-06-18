from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from apps.users.permissions import IsAdmin, IsAdminOrTrainer

from . import services
from .models import Course, Enrollment, Module, ModuleProgress
from .serializers import (
    CourseCreateSerializer,
    CourseDetailSerializer,
    CourseListSerializer,
    ModuleCreateSerializer,
    ModuleSerializer,
)


class CourseViewSet(GenericViewSet):
    """
    Course management endpoints.

    Permissions:
    - list/retrieve: any authenticated user (USUARIO sees published courses;
      TRAINER sees own; ADMIN sees all)
    - create/update/delete: ADMIN or TRAINER (TRAINER restricted to own courses)
    - modules sub-resource: same as course ownership
    """

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdminOrTrainer()]

    # ------------------------------------------------------------------
    # Course CRUD
    # ------------------------------------------------------------------

    def list(self, request: Request) -> Response:
        estado = request.query_params.get("estado")
        area_id = request.query_params.get("area")
        qs = services.list_courses(
            request.user,
            estado=estado,
            area_id=int(area_id) if area_id else None,
        )
        ctx = {"request": request}
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(
                CourseListSerializer(page, many=True, context=ctx).data
            )
        return Response(CourseListSerializer(qs, many=True, context=ctx).data)

    def retrieve(self, request: Request, pk: str | None = None) -> Response:
        try:
            course = services.get_course(int(pk), request.user)
        except Course.DoesNotExist:
            return Response({"error": "Curso no encontrado."}, status=status.HTTP_404_NOT_FOUND)
        except services.CoursePermissionDenied as exc:
            return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
        return Response(CourseDetailSerializer(course, context={"request": request}).data)

    def create(self, request: Request) -> Response:
        serializer = CourseCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
        try:
            course = services.create_course(dict(serializer.validated_data), request.user)
        except services.CourseValidationError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(CourseDetailSerializer(course, context={"request": request}).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request: Request, pk: str | None = None) -> Response:
        serializer = CourseCreateSerializer(data=request.data, partial=True)
        if not serializer.is_valid():
            return Response({"errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
        try:
            course = services.update_course(int(pk), dict(serializer.validated_data), request.user)
        except Course.DoesNotExist:
            return Response({"error": "Curso no encontrado."}, status=status.HTTP_404_NOT_FOUND)
        except services.CoursePermissionDenied as exc:
            return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
        return Response(CourseDetailSerializer(course, context={"request": request}).data)

    def destroy(self, request: Request, pk: str | None = None) -> Response:
        try:
            course = services.get_course(int(pk), request.user)
        except Course.DoesNotExist:
            return Response({"error": "Curso no encontrado."}, status=status.HTTP_404_NOT_FOUND)
        except services.CoursePermissionDenied as exc:
            return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
        if course.estado == Course.Estado.PUBLICADO:
            return Response(
                {"error": "No se puede eliminar un curso publicado. Archívalo primero."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        course.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ------------------------------------------------------------------
    # Assessment (get-or-create for the course wizard)
    # ------------------------------------------------------------------

    @action(detail=True, methods=["get"], url_path="assessment")
    def assessment(self, request: Request, pk: str | None = None) -> Response:
        from apps.assessments.serializers import AssessmentSerializer
        from apps.assessments.services import (
            AssessmentPermissionDenied,
            get_or_create_course_assessment,
        )

        try:
            a = get_or_create_course_assessment(int(pk), request.user)
        except Course.DoesNotExist:
            return Response({"error": "Curso no encontrado."}, status=status.HTTP_404_NOT_FOUND)
        except AssessmentPermissionDenied as exc:
            return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
        return Response(AssessmentSerializer(a, context={"request": request}).data)

    # ------------------------------------------------------------------
    # Publication
    # ------------------------------------------------------------------

    @action(detail=True, methods=["post"], url_path="publish")
    def publish(self, request: Request, pk: str | None = None) -> Response:
        ip = request.META.get("REMOTE_ADDR")
        try:
            course = services.publish_course(int(pk), request.user, ip=ip)
        except Course.DoesNotExist:
            return Response({"error": "Curso no encontrado."}, status=status.HTTP_404_NOT_FOUND)
        except services.CoursePermissionDenied as exc:
            return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
        except services.CourseValidationError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except ValueError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(CourseDetailSerializer(course, context={"request": request}).data)

    # ------------------------------------------------------------------
    # Module sub-resource
    # ------------------------------------------------------------------

    @action(detail=True, methods=["get", "post"], url_path="modules")
    def modules(self, request: Request, pk: str | None = None) -> Response:
        if request.method == "GET":
            return self._list_modules(request, pk)
        return self._create_module(request, pk)

    @action(
        detail=True,
        methods=["patch", "put", "delete"],
        url_path=r"modules/(?P<module_id>\d+)",
    )
    def module_detail(
        self, request: Request, pk: str | None = None, module_id: str | None = None
    ) -> Response:
        if request.method in ("PATCH", "PUT"):
            return self._update_module(request, pk, module_id)
        return self._delete_module(request, pk, module_id)

    def _list_modules(self, request: Request, pk: str | None) -> Response:
        try:
            qs = services.list_modules(int(pk), request.user)
        except Course.DoesNotExist:
            return Response({"error": "Curso no encontrado."}, status=status.HTTP_404_NOT_FOUND)
        except services.CoursePermissionDenied as exc:
            return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
        return Response(ModuleSerializer(qs, many=True).data)

    def _create_module(self, request: Request, pk: str | None) -> Response:
        serializer = ModuleCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
        pdf_file = request.FILES.get("archivo_pdf")
        try:
            module = services.add_module(
                int(pk), dict(serializer.validated_data), request.user, pdf_file=pdf_file
            )
        except Course.DoesNotExist:
            return Response({"error": "Curso no encontrado."}, status=status.HTTP_404_NOT_FOUND)
        except services.CoursePermissionDenied as exc:
            return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
        except services.CourseValidationError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ModuleSerializer(module).data, status=status.HTTP_201_CREATED)

    def _update_module(
        self, request: Request, pk: str | None, module_id: str | None
    ) -> Response:
        serializer = ModuleCreateSerializer(data=request.data, partial=True)
        if not serializer.is_valid():
            return Response({"errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
        pdf_file = request.FILES.get("archivo_pdf")
        try:
            module = services.update_module(
                int(pk), int(module_id), dict(serializer.validated_data), request.user, pdf_file=pdf_file
            )
        except (Course.DoesNotExist, Module.DoesNotExist):
            return Response({"error": "Recurso no encontrado."}, status=status.HTTP_404_NOT_FOUND)
        except services.CoursePermissionDenied as exc:
            return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
        except services.CourseValidationError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ModuleSerializer(module).data)

    def _delete_module(
        self, request: Request, pk: str | None, module_id: str | None
    ) -> Response:
        try:
            services.delete_module(int(pk), int(module_id), request.user)
        except (Course.DoesNotExist, Module.DoesNotExist):
            return Response({"error": "Recurso no encontrado."}, status=status.HTTP_404_NOT_FOUND)
        except services.CoursePermissionDenied as exc:
            return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
        return Response(status=status.HTTP_204_NO_CONTENT)


class EnrollmentViewSet(GenericViewSet):
    """
    Enrollment sub-resource endpoints.

    Allows a user to:
    - Mark a module as completed (POST .../complete/)
    - Read and update their position within a module (GET/PATCH .../progress/)
    """

    permission_classes = [IsAuthenticated]

    @action(
        detail=True,
        methods=["post"],
        url_path=r"modules/(?P<module_id>\d+)/complete",
    )
    def complete_module(
        self, request: Request, pk: str | None = None, module_id: str | None = None
    ) -> Response:
        try:
            enrollment = services.complete_module(int(pk), int(module_id), request.user)
        except (Enrollment.DoesNotExist, Module.DoesNotExist):
            return Response({"error": "Recurso no encontrado."}, status=status.HTTP_404_NOT_FOUND)
        except services.CoursePermissionDenied as exc:
            return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
        except services.CourseValidationError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
        return Response(
            {
                "id": enrollment.pk,
                "estado": enrollment.estado,
                "progreso_porcentaje": enrollment.progreso_porcentaje,
                "fecha_completado": (
                    enrollment.fecha_completado.isoformat()
                    if enrollment.fecha_completado
                    else None
                ),
            }
        )

    @action(
        detail=True,
        methods=["get", "patch"],
        url_path=r"modules/(?P<module_id>\d+)/progress",
    )
    def module_progress(
        self, request: Request, pk: str | None = None, module_id: str | None = None
    ) -> Response:
        if request.method == "GET":
            return self._get_progress(request, pk, module_id)
        return self._patch_progress(request, pk, module_id)

    def _get_progress(
        self, request: Request, pk: str | None, module_id: str | None
    ) -> Response:
        try:
            mp = services.get_module_progress(int(pk), int(module_id), request.user)
        except (Enrollment.DoesNotExist, Module.DoesNotExist):
            return Response({"error": "Recurso no encontrado."}, status=status.HTTP_404_NOT_FOUND)
        except services.CoursePermissionDenied as exc:
            return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
        return Response(
            {
                "module_id": mp.module_id,
                "is_completed": mp.is_completed,
                "last_position_json": mp.last_position_json,
                "fecha_completado": (
                    mp.fecha_completado.isoformat() if mp.fecha_completado else None
                ),
            }
        )

    def _patch_progress(
        self, request: Request, pk: str | None, module_id: str | None
    ) -> Response:
        position_json = request.data.get("last_position_json")
        if position_json is None or not isinstance(position_json, dict):
            return Response(
                {"error": "Se requiere last_position_json como objeto JSON."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            mp = services.update_module_position(
                int(pk), int(module_id), position_json, request.user
            )
        except (Enrollment.DoesNotExist, Module.DoesNotExist):
            return Response({"error": "Recurso no encontrado."}, status=status.HTTP_404_NOT_FOUND)
        except services.CoursePermissionDenied as exc:
            return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
        return Response(
            {
                "module_id": mp.module_id,
                "is_completed": mp.is_completed,
                "last_position_json": mp.last_position_json,
            }
        )
