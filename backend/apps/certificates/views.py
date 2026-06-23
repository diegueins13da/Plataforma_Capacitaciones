"""
Certificate endpoints.

  GET  /v1/certificates/mine/          — list user's own certificates
  GET  /v1/certificates/admin/         — (admin) all certs grouped by course
  GET  /v1/certificates/{id}/download/ — download/stream PDF
  GET  /v1/certificates/{id}/verify/   — public verification (no auth)
  POST /v1/certificates/{id}/generate/ — (admin) trigger (re)generation
"""
from __future__ import annotations

import os

from django.http import FileResponse, Http404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.courses.models import Certificate
from apps.reports.audit import log_event
from apps.users.permissions import IsAdmin


def _cert_data(cert: Certificate, request=None) -> dict:
    instructor = cert.course.instructor
    rubrica_url = ""
    if instructor and hasattr(instructor, "profile") and instructor.profile.rubrica:
        rubrica_url = (
            request.build_absolute_uri(instructor.profile.rubrica.url)
            if request else instructor.profile.rubrica.url
        )
    download_url = (
        request.build_absolute_uri(f"/api/v1/certificates/{cert.id}/download/")
        if request else ""
    )
    return {
        "id": str(cert.id),
        "course_title": cert.course.titulo,
        "course_duracion_horas": cert.course.duracion_horas,
        "participant_name": cert.user.get_full_name() or cert.user.email,
        "user_email": cert.user.email,
        "instructor_name": instructor.get_full_name() if instructor else "",
        "fecha_emision": cert.fecha_emision,
        "nota_obtenida": str(cert.nota_obtenida) if cert.nota_obtenida else None,
        "has_pdf": bool(cert.url_pdf),
        "download_url": download_url,
    }


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_certificates(request):
    """GET /v1/certificates/mine/ — authenticated user's certificates."""
    certs = (
        Certificate.objects.select_related(
            "course__instructor__profile",
            "enrollment",
        )
        .filter(user=request.user)
        .order_by("-fecha_emision")
    )
    return Response([_cert_data(c, request) for c in certs])


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def download_certificate(request, cert_id):
    """GET /v1/certificates/{id}/download/ — stream the PDF to the client."""
    try:
        cert = Certificate.objects.get(pk=cert_id)
    except Certificate.DoesNotExist:
        raise Http404

    # Users can only download their own; admins can download any
    if cert.user != request.user and request.user.role != "ADMIN":
        return Response(
            {"detail": "No tienes permiso para descargar este certificado."},
            status=status.HTTP_403_FORBIDDEN,
        )

    if not cert.url_pdf:
        # Trigger generation and return 202
        from .tasks import generate_certificate_pdf_task
        generate_certificate_pdf_task.delay(str(cert.id))
        return Response(
            {"detail": "El certificado se está generando. Inténtalo en unos segundos."},
            status=status.HTTP_202_ACCEPTED,
        )

    from django.conf import settings
    pdf_path = os.path.join(settings.MEDIA_ROOT, "certificates", f"{cert.id}.pdf")

    if not os.path.exists(pdf_path):
        # File missing — regenerate
        from .tasks import generate_certificate_pdf_task
        generate_certificate_pdf_task.delay(str(cert.id))
        return Response(
            {"detail": "El archivo no está disponible. Regenerando, inténtalo en unos segundos."},
            status=status.HTTP_202_ACCEPTED,
        )

    filename = f"Certificado_{cert.user.last_name}_{cert.course.titulo[:30].replace(' ', '_')}.pdf"
    log_event(
        accion="CERTIFICATE_DOWNLOADED",
        request=request,
        entidad_tipo="Certificate",
        entidad_id=str(cert.id),
        entidad_nombre=f"{cert.user.get_full_name()} — {cert.course.titulo}",
    )
    response = FileResponse(
        open(pdf_path, "rb"),
        content_type="application/pdf",
        as_attachment=True,
        filename=filename,
    )
    return response


@api_view(["GET"])
@permission_classes([AllowAny])
def verify_certificate(request, cert_id):
    """GET /v1/certificates/{id}/verify/ — public QR verification endpoint."""
    try:
        cert = Certificate.objects.select_related(
            "user", "course__instructor"
        ).get(pk=cert_id)
    except Certificate.DoesNotExist:
        return Response(
            {"valid": False, "detail": "Certificado no encontrado."},
            status=status.HTTP_404_NOT_FOUND,
        )

    instructor = cert.course.instructor
    return Response({
        "valid": True,
        "id": str(cert.id),
        "participant": cert.user.get_full_name() or cert.user.email,
        "course": cert.course.titulo,
        "instructor": instructor.get_full_name() if instructor else "",
        "fecha_emision": cert.fecha_emision,
        "nota_obtenida": str(cert.nota_obtenida) if cert.nota_obtenida else None,
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsAdmin])
def generate_certificate(request, cert_id):
    """POST /v1/certificates/{id}/generate/ — admin trigger for PDF generation."""
    try:
        cert = Certificate.objects.get(pk=cert_id)
    except Certificate.DoesNotExist:
        raise Http404

    if cert.url_pdf:
        return Response(
            {"detail": "Este certificado ya tiene un PDF generado (inmutable)."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    from .tasks import generate_certificate_pdf_task
    generate_certificate_pdf_task.delay(str(cert.id))
    return Response(
        {"detail": "Generación iniciada. El PDF estará disponible en breve."},
        status=status.HTTP_202_ACCEPTED,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAdmin])
def admin_certificates(request):
    """GET /v1/certificates/admin/ — all certificates grouped by course."""
    from collections import defaultdict

    search = request.query_params.get("search", "").strip()
    course_filter = request.query_params.get("course_id")

    qs = (
        Certificate.objects.select_related("course__instructor", "user")
        .order_by("course__titulo", "-fecha_emision")
    )
    if course_filter:
        qs = qs.filter(course_id=course_filter)
    if search:
        qs = qs.filter(user__email__icontains=search) | qs.filter(
            user__first_name__icontains=search
        ) | qs.filter(user__last_name__icontains=search)

    grouped: dict = defaultdict(list)
    course_meta: dict = {}
    for cert in qs:
        cid = cert.course.id
        grouped[cid].append(_cert_data(cert, request))
        if cid not in course_meta:
            course_meta[cid] = {
                "course_id": cid,
                "course_title": cert.course.titulo,
                "instructor_name": (
                    cert.course.instructor.get_full_name()
                    if cert.course.instructor else ""
                ),
            }

    result = [
        {**course_meta[cid], "count": len(certs), "certificates": certs}
        for cid, certs in grouped.items()
    ]
    return Response(result)
