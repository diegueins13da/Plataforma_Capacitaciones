from rest_framework import serializers


class DocumentUploadSerializer(serializers.Serializer):
    file = serializers.FileField()
    cantidad_modulos = serializers.IntegerField(required=False, default=5, min_value=1, max_value=15)


class GenerateQuestionsSerializer(serializers.Serializer):
    content = serializers.CharField(min_length=50)
    cantidad = serializers.IntegerField(default=5, min_value=1, max_value=20)
    tipos = serializers.ListField(
        child=serializers.ChoiceField(choices=["MULTIPLE_CHOICE", "MULTIPLE_SELECT", "TRUE_FALSE"]),
        required=False,
    )
    dificultad = serializers.ChoiceField(
        choices=["FACIL", "MEDIO", "DIFICIL"], default="MEDIO"
    )
