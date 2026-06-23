from rest_framework import serializers

from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = [
            "id",
            "timestamp",
            # Actor snapshot (non-repudiation)
            "actor_email",
            "actor_nombre",
            "actor_rol",
            # Event
            "accion",
            "resultado",
            # Network
            "ip",
            "user_agent",
            # Affected entity
            "entidad_tipo",
            "entidad_id",
            "entidad_nombre",
            # Payload
            "detalles_json",
            "error_detalle",
        ]
        read_only_fields = fields
