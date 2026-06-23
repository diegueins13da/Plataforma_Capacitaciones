"""
Config app views — SystemSetting CRUD (admin only) + public branding endpoint.
"""
import os

from rest_framework import parsers, status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.users.permissions import IsAdmin

from .models import SystemSetting
from .serializers import SystemSettingSerializer, SystemSettingUpdateSerializer

# Keys that are safe to expose publicly (no auth required — used for login page branding)
_PUBLIC_BRANDING_KEYS = {
    "SYSTEM_NAME",
    "COMPANY_NAME",
    "LOGO_URL",
    "PRIMARY_COLOR",
    "FAVICON_URL",
}


class SystemSettingViewSet(viewsets.GenericViewSet):
    """
    GET   /config/          — list all settings grouped by category
    GET   /config/{clave}/  — retrieve one setting
    PATCH /config/{clave}/  — update the value (admin only)
    """

    permission_classes = [IsAuthenticated, IsAdmin]
    queryset = SystemSetting.objects.all()
    lookup_field = "clave"
    parser_classes = [parsers.MultiPartParser, parsers.JSONParser, parsers.FormParser]

    def list(self, request):
        qs = self.get_queryset()
        data = SystemSettingSerializer(qs, many=True).data
        grouped: dict[str, list] = {}
        for item in data:
            cat = item["categoria"]
            grouped.setdefault(cat, []).append(item)
        return Response(grouped)

    def retrieve(self, request, clave=None):
        setting = self.get_object()
        return Response(SystemSettingSerializer(setting).data)

    def partial_update(self, request, clave=None):
        setting = self.get_object()

        # Handle file upload for image settings (rubrica/logo)
        if "file" in request.FILES:
            uploaded = request.FILES["file"]
            from django.core.files.storage import default_storage
            filename = f"config/{clave.lower()}_{uploaded.name}"
            saved_path = default_storage.save(filename, uploaded)
            saved_url = default_storage.url(saved_path)
            setting.valor = saved_url
            setting.updated_by = request.user
            setting.save(update_fields=["valor", "updated_by", "updated_at"])
            return Response(SystemSettingSerializer(setting).data)

        serializer = SystemSettingUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        setting.valor = serializer.validated_data["valor"]
        setting.updated_by = request.user
        setting.save(update_fields=["valor", "updated_by", "updated_at"])
        return Response(SystemSettingSerializer(setting).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsAdmin])
def test_email(request):
    """
    POST /api/v1/config/test-email/
    Body: { "recipient": "test@example.com" }
    Sends a test email using the DB-configured SMTP settings.
    """
    from apps.config.email import send_test_email

    recipient = (request.data.get("recipient") or "").strip()
    if not recipient:
        return Response(
            {"ok": False, "message": "Debes indicar un correo destinatario."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    result = send_test_email(recipient)
    http_status = status.HTTP_200_OK if result["ok"] else status.HTTP_502_BAD_GATEWAY
    return Response(result, status=http_status)


@api_view(["GET"])
@permission_classes([AllowAny])
def public_branding(request):
    """
    GET /api/v1/config/public/
    Returns non-sensitive branding settings without authentication.
    Used by the login page to display company name, logo, and colors.
    """
    settings_qs = SystemSetting.objects.filter(clave__in=_PUBLIC_BRANDING_KEYS)
    result = {s.clave: s.get_value() for s in settings_qs}
    # Ensure all expected keys exist with defaults
    defaults = {
        "SYSTEM_NAME": "LMS Corporativo",
        "COMPANY_NAME": "Mi Empresa",
        "LOGO_URL": "",
        "PRIMARY_COLOR": "#4f46e5",
        "FAVICON_URL": "",
    }
    for key, default in defaults.items():
        result.setdefault(key, default)
    return Response(result)
