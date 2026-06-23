import csv

from django.http import HttpResponse
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.permissions import IsAdmin

from .models import AuditLog
from .serializers import AuditLogSerializer


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


class AuditLogPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 200


def _csv_response(filename: str, headers: list, rows: list) -> HttpResponse:
    """Return a UTF-8 CSV response with BOM so Excel opens it correctly."""
    response = HttpResponse(content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    response.write("﻿")  # UTF-8 BOM for Excel
    writer = csv.writer(response)
    writer.writerow(headers)
    writer.writerows(rows)
    return response


# ---------------------------------------------------------------------------
# Audit log
# ---------------------------------------------------------------------------


class AuditLogListView(APIView):
    """GET /v1/reports/audit-logs/ — paginated audit log for admins."""

    permission_classes = [IsAuthenticated, IsAdmin]
    pagination_class = AuditLogPagination

    def get(self, request: Request) -> Response:
        qs = AuditLog.objects.order_by("-timestamp")

        actor_email = request.query_params.get("actor_email") or request.query_params.get("user_email")
        accion = request.query_params.get("accion")
        resultado = request.query_params.get("resultado")
        entidad_tipo = request.query_params.get("entidad_tipo")
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")

        if actor_email:
            qs = qs.filter(actor_email__icontains=actor_email)
        if accion:
            qs = qs.filter(accion__icontains=accion)
        if resultado:
            qs = qs.filter(resultado=resultado.upper())
        if entidad_tipo:
            qs = qs.filter(entidad_tipo__iexact=entidad_tipo)
        if date_from:
            qs = qs.filter(timestamp__date__gte=date_from)
        if date_to:
            qs = qs.filter(timestamp__date__lte=date_to)

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(qs, request)
        if page is not None:
            serializer = AuditLogSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)

        serializer = AuditLogSerializer(qs, many=True)
        return Response(serializer.data)


# ---------------------------------------------------------------------------
# CSV reports
# ---------------------------------------------------------------------------


class UserProgressReportView(APIView):
    """GET /v1/reports/users-progress/ — CSV: active users with course progress."""

    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request: Request) -> HttpResponse:
        from apps.users.models import User

        users = (
            User.objects.filter(is_active=True)
            .select_related("profile__area", "profile__grupo")
            .prefetch_related("enrollments")
            .order_by("last_name", "first_name")
        )
        rows = []
        for user in users:
            enrollments = list(user.enrollments.all())
            inscritos = len(enrollments)
            completados = sum(1 for e in enrollments if e.estado == "COMPLETADO")
            pct = (
                round(sum(e.progreso_porcentaje for e in enrollments) / inscritos)
                if inscritos
                else 0
            )
            profile = getattr(user, "profile", None)
            rows.append([
                user.get_full_name(),
                user.email,
                profile.cargo if profile else "",
                profile.area.nombre if (profile and profile.area_id) else "",
                profile.grupo.nombre if (profile and profile.grupo_id) else "",
                inscritos,
                completados,
                f"{pct}%",
            ])

        return _csv_response(
            "reporte_progreso_usuarios.csv",
            ["Nombre", "Email", "Cargo", "Área", "Grupo", "Inscritos", "Completados", "% Avance"],
            rows,
        )


class CoursesSummaryReportView(APIView):
    """GET /v1/reports/courses-summary/ — CSV: per-course enrollment & completion stats."""

    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request: Request) -> HttpResponse:
        from apps.courses.models import Course

        courses = (
            Course.objects.select_related("area", "instructor")
            .prefetch_related("enrollments__certificate")
            .order_by("titulo")
        )
        rows = []
        for course in courses:
            enrollments = list(course.enrollments.all())
            inscritos = len(enrollments)
            completados = sum(1 for e in enrollments if e.estado == "COMPLETADO")
            tasa = round(completados / inscritos * 100) if inscritos else 0
            notas = []
            for e in enrollments:
                cert = getattr(e, "certificate", None)
                if cert is not None and cert.nota_obtenida is not None:
                    notas.append(float(cert.nota_obtenida))
            nota_prom = round(sum(notas) / len(notas), 1) if notas else ""
            rows.append([
                course.titulo,
                course.get_tipo_display(),
                course.get_estado_display(),
                course.area.nombre if course.area_id else "",
                inscritos,
                completados,
                f"{tasa}%",
                nota_prom,
            ])

        return _csv_response(
            "reporte_resumen_cursos.csv",
            ["Curso", "Tipo", "Estado", "Área", "Inscritos", "Completados", "Tasa finalización", "Nota promedio"],
            rows,
        )


class CertificatesReportView(APIView):
    """GET /v1/reports/certificates/ — CSV: all issued certificates."""

    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request: Request) -> HttpResponse:
        from apps.courses.models import Certificate

        certs = (
            Certificate.objects.select_related("user", "course")
            .order_by("-fecha_emision")
        )
        rows = [
            [
                cert.user.get_full_name(),
                cert.user.email,
                cert.course.titulo,
                cert.fecha_emision.strftime("%d/%m/%Y %H:%M"),
                float(cert.nota_obtenida) if cert.nota_obtenida else "",
            ]
            for cert in certs
        ]

        return _csv_response(
            "reporte_certificados.csv",
            ["Nombre", "Email", "Curso", "Fecha emisión", "Nota"],
            rows,
        )
