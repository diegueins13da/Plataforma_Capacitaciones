"""
Config app views — SystemSetting CRUD (admin only).
"""
from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.users.permissions import IsAdmin

from .models import SystemSetting
from .serializers import SystemSettingSerializer, SystemSettingUpdateSerializer


class SystemSettingViewSet(viewsets.GenericViewSet):
    """
    GET  /config/          — list all settings grouped by category
    GET  /config/{clave}/  — retrieve one setting
    PATCH /config/{clave}/ — update the value (admin only)
    """

    permission_classes = [IsAuthenticated, IsAdmin]
    queryset = SystemSetting.objects.all()
    lookup_field = "clave"

    def list(self, request):
        qs = self.get_queryset()
        data = SystemSettingSerializer(qs, many=True).data
        # Group by category for convenient frontend consumption
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
        serializer = SystemSettingUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        setting.valor = serializer.validated_data["valor"]
        setting.updated_by = request.user
        setting.save(update_fields=["valor", "updated_by", "updated_at"])
        return Response(SystemSettingSerializer(setting).data)
