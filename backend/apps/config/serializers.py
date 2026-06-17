from rest_framework import serializers

from .models import SystemSetting


class SystemSettingSerializer(serializers.ModelSerializer):
    valor_display = serializers.SerializerMethodField()

    class Meta:
        model = SystemSetting
        fields = [
            "id", "clave", "valor", "valor_display",
            "tipo_dato", "categoria", "descripcion", "es_sensible",
            "updated_at",
        ]
        read_only_fields = ["id", "clave", "tipo_dato", "categoria", "descripcion", "es_sensible", "updated_at"]

    def get_valor_display(self, obj: SystemSetting) -> object:
        if obj.es_sensible:
            return "••••••" if obj.valor else ""
        return obj.get_value()


class SystemSettingUpdateSerializer(serializers.Serializer):
    valor = serializers.CharField(allow_blank=True)
