from rest_framework import serializers

from .models import Assessment, Question


class AssessmentSerializer(serializers.ModelSerializer):
    question_count_approved = serializers.SerializerMethodField()
    question_count_total = serializers.SerializerMethodField()

    class Meta:
        model = Assessment
        fields = [
            "id",
            "course",
            "puntaje_minimo",
            "max_intentos",
            "tiempo_limite_minutos",
            "question_count_approved",
            "question_count_total",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "course", "created_at", "updated_at"]

    def get_question_count_approved(self, obj: Assessment) -> int:
        return obj.questions.filter(aprobada_por_humano=True).count()

    def get_question_count_total(self, obj: Assessment) -> int:
        return obj.questions.count()


class AssessmentUpdateSerializer(serializers.Serializer):
    puntaje_minimo = serializers.IntegerField(required=False, min_value=0, max_value=100)
    max_intentos = serializers.IntegerField(required=False, min_value=1)
    tiempo_limite_minutos = serializers.IntegerField(required=False, allow_null=True, min_value=1)


class QuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = [
            "id",
            "assessment",
            "texto",
            "tipo",
            "opciones",
            "respuesta_correcta",
            "orden",
            "aprobada_por_humano",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "assessment", "aprobada_por_humano", "created_at", "updated_at"]


class QuestionCreateSerializer(serializers.Serializer):
    texto = serializers.CharField()
    tipo = serializers.ChoiceField(choices=Question.Tipo.choices)
    opciones = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    respuesta_correcta = serializers.JSONField()
    orden = serializers.IntegerField(required=False, min_value=1, default=1)
