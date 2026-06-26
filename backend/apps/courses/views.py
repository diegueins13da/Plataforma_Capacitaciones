from datetime import date

from rest_framework import status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from apps.reports.audit import log_event
from apps.users.permissions import IsAdmin, IsAdminOrTrainer

from . import services
from .models import Course, Enrollment, Module, ModuleProgress, Tema
from .serializers import (
    CourseCreateSerializer,
    CourseDetailSerializer,
    CourseListSerializer,
    ModuleCreateSerializer,
    ModuleSerializer,
    TemaCreateSerializer,
    TemaSerializer,
)


# ---------------------------------------------------------------------------
# Instructor dashboard
# ---------------------------------------------------------------------------
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def instructor_dashboard(request):
    if request.user.role not in ("TRAINER", "ADMIN"):
        return Response({"detail": "Forbidden."}, status=403)

    instructor = request.user
    courses = (
        Course.objects.filter(created_by=instructor)
        .prefetch_related("enrollments", "enrollments__user")
        .select_related("assessment")
    )

    total_inscritos = 0
    total_completados = 0
    total_progreso_sum = 0
    cursos_data = []
    alumnos_data = []
    alertas = []

    for course in courses:
        enrollments = list(course.enrollments.all())
        count = len(enrollments)
        completed = [e for e in enrollments if e.estado == "COMPLETADO"]
        prog_sum = sum(e.progreso_porcentaje for e in enrollments)
        avg_prog = round(prog_sum / count) if count > 0 else 0

        total_inscritos += count
        total_completados += len(completed)
        total_progreso_sum += prog_sum

        # exam stats
        nota_promedio = None
        tasa_aprobacion = None
        try:
            attempts = list(
                course.assessment.attempts.filter(aprobado__isnull=False)
            )
            if attempts:
                scores = [float(a.calificacion) for a in attempts if a.calificacion is not None]
                passed = [a for a in attempts if a.aprobado]
                if scores:
                    nota_promedio = round(sum(scores) / len(scores), 1)
                tasa_aprobacion = round(len(passed) / len(attempts) * 100)
        except Exception:
            pass

        dias_vencer = None
        if course.fecha_limite:
            dias_vencer = (course.fecha_limite - date.today()).days

        cursos_data.append({
            "id": course.id,
            "titulo": course.titulo,
            "estado": course.estado,
            "tipo": course.tipo,
            "duracion_horas": course.duracion_horas,
            "total_inscritos": count,
            "completados": len(completed),
            "en_progreso": len([e for e in enrollments if e.estado == "EN_PROGRESO"]),
            "vencidos": len([e for e in enrollments if e.estado == "VENCIDO"]),
            "progreso_promedio": avg_prog,
            "fecha_limite": course.fecha_limite.isoformat() if course.fecha_limite else None,
            "dias_para_vencer": dias_vencer,
            "nota_promedio": nota_promedio,
            "tasa_aprobacion": tasa_aprobacion,
        })

        for e in enrollments:
            alumnos_data.append({
                "user_id": e.user.id,
                "nombre": e.user.get_full_name() or e.user.email,
                "email": e.user.email,
                "curso_id": course.id,
                "curso_titulo": course.titulo,
                "progreso": e.progreso_porcentaje,
                "estado": e.estado,
                "fecha_limite": course.fecha_limite.isoformat() if course.fecha_limite else None,
                "dias_para_vencer": dias_vencer,
            })

        if dias_vencer is not None and 0 <= dias_vencer <= 14:
            en_prog_count = len([e for e in enrollments if e.estado == "EN_PROGRESO"])
            if en_prog_count > 0:
                alertas.append({
                    "tipo": "VENCIMIENTO_PROXIMO",
                    "curso_id": course.id,
                    "curso_titulo": course.titulo,
                    "dias": dias_vencer,
                    "alumnos_afectados": en_prog_count,
                })

    kpis = {
        "total_alumnos": total_inscritos,
        "tasa_completado": round(total_completados / total_inscritos * 100) if total_inscritos else 0,
        "progreso_promedio": round(total_progreso_sum / total_inscritos) if total_inscritos else 0,
        "cursos_publicados": courses.filter(estado="PUBLICADO").count(),
        "cursos_borrador": courses.filter(estado="BORRADOR").count(),
        "cursos_archivados": courses.filter(estado="ARCHIVADO").count(),
    }

    alumnos_data.sort(key=lambda a: a["progreso"])

    return Response({
        "kpis": kpis,
        "cursos": cursos_data,
        "alumnos": alumnos_data,
        "alertas": alertas,
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def instructor_grades(request):
    """Return per-student exam results for all courses owned by the requesting instructor."""
    if request.user.role not in ("TRAINER", "ADMIN"):
        return Response({"detail": "Forbidden."}, status=403)

    from apps.assessments.models import UserAnswer

    instructor = request.user
    if instructor.role == "ADMIN":
        courses = Course.objects.all()
    else:
        courses = Course.objects.filter(instructor=instructor)
    courses = (
        courses
        .select_related("assessment")
        .prefetch_related("enrollments", "enrollments__user")
    )

    rows = []
    for course in courses:
        try:
            assessment = course.assessment
        except Exception:
            assessment = None

        for enrollment in course.enrollments.all():
            best = None
            if assessment:
                attempts = list(
                    UserAnswer.objects.filter(
                        assessment=assessment,
                        enrollment=enrollment,
                        aprobado__isnull=False,
                    ).order_by("-calificacion")[:1]
                )
                if attempts:
                    best = attempts[0]

            rows.append({
                "user_id": enrollment.user.id,
                "nombre": enrollment.user.get_full_name() or enrollment.user.email,
                "email": enrollment.user.email,
                "curso_id": course.id,
                "curso_titulo": course.titulo,
                "progreso": enrollment.progreso_porcentaje,
                "estado": enrollment.estado,
                "nota": float(best.calificacion) if best and best.calificacion is not None else None,
                "aprobado": best.aprobado if best else None,
                "fecha_examen": best.fecha_fin.isoformat() if best and best.fecha_fin else None,
            })

    rows.sort(key=lambda r: (r["curso_titulo"], r["nombre"]))
    return Response({"results": rows, "count": len(rows)})


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
        # Any authenticated user can read courses and view the course assessment
        if self.action in ("list", "retrieve", "assessment"):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdminOrTrainer()]

    # ------------------------------------------------------------------
    # Course CRUD
    # ------------------------------------------------------------------

    def list(self, request: Request) -> Response:
        estado = request.query_params.get("estado")
        area_id = request.query_params.get("area")
        as_student = request.query_params.get("as_student") == "true"
        qs = services.list_courses(
            request.user,
            estado=estado,
            area_id=int(area_id) if area_id else None,
            as_student=as_student,
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
        log_event(
            accion="COURSE_CREATED",
            request=request,
            entidad_tipo="Course",
            entidad_id=course.pk,
            entidad_nombre=course.titulo,
        )
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
        log_event(
            accion="COURSE_UPDATED",
            request=request,
            entidad_tipo="Course",
            entidad_id=course.pk,
            entidad_nombre=course.titulo,
            detalle={"campos": list(serializer.validated_data.keys())},
        )
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
        course_id, course_titulo = course.pk, course.titulo
        course.delete()
        log_event(
            accion="COURSE_DELETED",
            request=request,
            entidad_tipo="Course",
            entidad_id=course_id,
            entidad_nombre=course_titulo,
        )
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

    @action(detail=True, methods=["post"], url_path="archive")
    def archive(self, request: Request, pk: str | None = None) -> Response:
        try:
            course = Course.objects.get(pk=pk)
        except Course.DoesNotExist:
            return Response({"error": "Curso no encontrado."}, status=status.HTTP_404_NOT_FOUND)
        is_owner = hasattr(course, "instructor") and course.instructor == request.user
        if not (request.user.role == "ADMIN" or is_owner):
            return Response(
                {"error": "Sin permisos para archivar este curso."},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            course.archive()
        except ValueError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        log_event(
            accion="COURSE_ARCHIVED",
            request=request,
            entidad_tipo="Course",
            entidad_id=course.pk,
            entidad_nombre=course.titulo,
        )
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
        try:
            module = services.add_module(int(pk), dict(serializer.validated_data), request.user)
        except Course.DoesNotExist:
            return Response({"error": "Curso no encontrado."}, status=status.HTTP_404_NOT_FOUND)
        except services.CoursePermissionDenied as exc:
            return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
        except services.CourseValidationError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        log_event(
            accion="MODULE_CREATED", request=request,
            entidad_tipo="Module", entidad_id=module.pk,
            entidad_nombre=module.titulo, detalle={"course_id": int(pk)},
        )
        return Response(ModuleSerializer(module).data, status=status.HTTP_201_CREATED)

    def _update_module(self, request: Request, pk: str | None, module_id: str | None) -> Response:
        serializer = ModuleCreateSerializer(data=request.data, partial=True)
        if not serializer.is_valid():
            return Response({"errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
        try:
            module = services.update_module(int(pk), int(module_id), dict(serializer.validated_data), request.user)
        except (Course.DoesNotExist, Module.DoesNotExist):
            return Response({"error": "Recurso no encontrado."}, status=status.HTTP_404_NOT_FOUND)
        except services.CoursePermissionDenied as exc:
            return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
        log_event(
            accion="MODULE_UPDATED", request=request,
            entidad_tipo="Module", entidad_id=module.pk,
            entidad_nombre=module.titulo,
            detalle={"course_id": int(pk), "campos": list(serializer.validated_data.keys())},
        )
        return Response(ModuleSerializer(module).data)

    # ------------------------------------------------------------------
    # Tema sub-resource  (nested: /courses/{pk}/modules/{module_id}/temas/)
    # ------------------------------------------------------------------

    @action(detail=True, methods=["get", "post"], url_path=r"modules/(?P<module_id>\d+)/temas")
    def temas(self, request: Request, pk: str | None = None, module_id: str | None = None) -> Response:
        if request.method == "GET":
            try:
                qs = services.list_temas(int(pk), int(module_id), request.user)
            except (Course.DoesNotExist, Module.DoesNotExist):
                return Response({"error": "Recurso no encontrado."}, status=status.HTTP_404_NOT_FOUND)
            except services.CoursePermissionDenied as exc:
                return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
            return Response(TemaSerializer(qs, many=True).data)

        # POST — create tema
        serializer = TemaCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
        try:
            tema = services.add_tema(
                int(pk), int(module_id),
                dict(serializer.validated_data),
                request.user,
                pdf_file=request.FILES.get("archivo_pdf"),
                video_file=request.FILES.get("archivo_video"),
                imagen_file=request.FILES.get("archivo_imagen"),
            )
        except (Course.DoesNotExist, Module.DoesNotExist):
            return Response({"error": "Recurso no encontrado."}, status=status.HTTP_404_NOT_FOUND)
        except services.CoursePermissionDenied as exc:
            return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
        except services.CourseValidationError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        log_event(
            accion="TEMA_CREATED", request=request,
            entidad_tipo="Tema", entidad_id=tema.pk,
            entidad_nombre=tema.titulo,
            detalle={"course_id": int(pk), "module_id": int(module_id)},
        )
        return Response(TemaSerializer(tema).data, status=status.HTTP_201_CREATED)

    @action(
        detail=True, methods=["patch", "put", "delete"],
        url_path=r"modules/(?P<module_id>\d+)/temas/(?P<tema_id>\d+)",
    )
    def tema_detail(
        self, request: Request, pk: str | None = None,
        module_id: str | None = None, tema_id: str | None = None,
    ) -> Response:
        if request.method in ("PATCH", "PUT"):
            serializer = TemaCreateSerializer(data=request.data, partial=True)
            if not serializer.is_valid():
                return Response({"errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
            try:
                tema = services.update_tema(
                    int(pk), int(module_id), int(tema_id),
                    dict(serializer.validated_data),
                    request.user,
                    pdf_file=request.FILES.get("archivo_pdf"),
                    video_file=request.FILES.get("archivo_video"),
                    imagen_file=request.FILES.get("archivo_imagen"),
                )
            except (Course.DoesNotExist, Module.DoesNotExist, Tema.DoesNotExist):
                return Response({"error": "Recurso no encontrado."}, status=status.HTTP_404_NOT_FOUND)
            except services.CoursePermissionDenied as exc:
                return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
            except services.CourseValidationError as exc:
                return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
            log_event(
                accion="TEMA_UPDATED", request=request,
                entidad_tipo="Tema", entidad_id=tema.pk, entidad_nombre=tema.titulo,
                detalle={"course_id": int(pk), "module_id": int(module_id)},
            )
            return Response(TemaSerializer(tema).data)

        # DELETE
        try:
            services.delete_tema(int(pk), int(module_id), int(tema_id), request.user)
        except (Course.DoesNotExist, Module.DoesNotExist, Tema.DoesNotExist):
            return Response({"error": "Recurso no encontrado."}, status=status.HTTP_404_NOT_FOUND)
        except services.CoursePermissionDenied as exc:
            return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
        log_event(
            accion="TEMA_DELETED", request=request,
            entidad_tipo="Tema", entidad_id=int(tema_id), entidad_nombre="",
            detalle={"course_id": int(pk), "module_id": int(module_id)},
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    def _delete_module(
        self, request: Request, pk: str | None, module_id: str | None
    ) -> Response:
        try:
            module = Module.objects.select_related("course").get(pk=module_id, course_id=pk)
        except Module.DoesNotExist:
            return Response({"error": "Recurso no encontrado."}, status=status.HTTP_404_NOT_FOUND)
        module_titulo = module.titulo
        try:
            services.delete_module(int(pk), int(module_id), request.user)
        except Course.DoesNotExist:
            return Response({"error": "Recurso no encontrado."}, status=status.HTTP_404_NOT_FOUND)
        except services.CoursePermissionDenied as exc:
            return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
        log_event(
            accion="MODULE_DELETED",
            request=request,
            entidad_tipo="Module",
            entidad_id=int(module_id),
            entidad_nombre=module_titulo,
            detalle={"course_id": int(pk)},
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ------------------------------------------------------------------
    # User assignment (admin tool)
    # ------------------------------------------------------------------

    @action(detail=True, methods=["get"], url_path="enrollment-users")
    def enrollment_users(self, request: Request, pk: str | None = None) -> Response:
        """Return all active users with their enrollment status for this course."""
        if request.user.role not in ("ADMIN", "TRAINER"):
            return Response({"detail": "Forbidden."}, status=403)
        try:
            course = Course.objects.get(pk=pk)
        except Course.DoesNotExist:
            return Response({"error": "Curso no encontrado."}, status=status.HTTP_404_NOT_FOUND)

        from apps.users.models import User as AppUser  # noqa: PLC0415

        enrolled_map = {
            e.user_id: e.estado
            for e in Enrollment.objects.filter(course=course).select_related("user")
        }
        users = (
            AppUser.objects.filter(is_active=True)
            .exclude(role="ADMIN")
            .order_by("first_name", "last_name", "email")
        )
        result = [
            {
                "id": u.id,
                "nombre": u.get_full_name() or u.email,
                "email": u.email,
                "role": u.role,
                "estado_inscripcion": enrolled_map.get(u.id),
            }
            for u in users
        ]
        return Response(result)

    @action(detail=True, methods=["post"], url_path="bulk-assign")
    def bulk_assign(self, request: Request, pk: str | None = None) -> Response:
        """Create enrollments for a list of user IDs. Already-enrolled users are skipped."""
        if request.user.role not in ("ADMIN", "TRAINER"):
            return Response({"detail": "Forbidden."}, status=403)
        try:
            course = Course.objects.get(pk=pk)
        except Course.DoesNotExist:
            return Response({"error": "Curso no encontrado."}, status=status.HTTP_404_NOT_FOUND)
        if course.estado != Course.Estado.PUBLICADO:
            return Response(
                {"error": "Solo se puede asignar usuarios a cursos publicados."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user_ids = request.data.get("user_ids", [])
        if not isinstance(user_ids, list) or not user_ids:
            return Response({"error": "Envía user_ids como lista."}, status=status.HTTP_400_BAD_REQUEST)

        from apps.users.models import User as AppUser  # noqa: PLC0415

        existing = set(Enrollment.objects.filter(course=course, user_id__in=user_ids).values_list("user_id", flat=True))
        new_ids = [uid for uid in user_ids if uid not in existing]
        from apps.notifications.models import Notification  # noqa: PLC0415

        valid_users = AppUser.objects.filter(id__in=new_ids, is_active=True)
        fecha_str = (
            f" La fecha límite es el {course.fecha_limite.strftime('%d/%m/%Y')}."
            if course.fecha_limite
            else ""
        )
        from apps.notifications.services import notify_instructor_alumno_inscrito  # noqa: PLC0415

        instructor = course.created_by
        created = 0
        for user in valid_users:
            enrollment = Enrollment.objects.create(user=user, course=course)
            Notification.objects.create(
                user=user,
                tipo=Notification.Tipo.NUEVO_CURSO,
                titulo=f"{course.titulo}",
                mensaje=(
                    f"Se te ha asignado este curso.{fecha_str}"
                    f" Puedes comenzar cuando quieras."
                ),
                referencia_id=course.pk,
                referencia_tipo="course",
            )
            # Notify instructor if the assigner is different from the course creator
            if instructor and instructor.pk != request.user.pk:
                notify_instructor_alumno_inscrito(instructor, user, enrollment)
            created += 1
            log_event(
                accion="ENROLLMENT_ADMIN_ASSIGN",
                request=request,
                entidad_tipo="Enrollment",
                entidad_id=user.id,
                entidad_nombre=f"{user.email} → {course.titulo}",
                detalle={"course_id": course.pk, "assigned_by": request.user.email},
            )
        return Response({"created": created, "skipped": len(existing)})


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
