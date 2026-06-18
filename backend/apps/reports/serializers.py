from rest_framework import serializers

from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    user_email = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = ["id", "user_email", "accion", "ip", "timestamp", "detalles_json"]
        read_only_fields = fields

    def get_user_email(self, obj: AuditLog) -> str:
        return obj.user.email if obj.user else "sistema"
