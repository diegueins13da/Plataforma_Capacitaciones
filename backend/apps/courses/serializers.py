from rest_framework import serializers

from .models import Certificate, Course, Enrollment, Module, ModuleProgress


class ModuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Module
        fields = [
            "id",
            "titulo",
            "descripcion",
            "tipo_contenido",
            "orden",
            "es_secuencial",
            "duracion_minutos",
            "url_video",
            "archivo_pdf",
            "contenido_html",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class ModuleCreateSerializer(serializers.Serializer):
    titulo = serializers.CharField(max_length=255)
    descripcion = serializers.CharField(required=False, default="", allow_blank=True)
    tipo_contenido = serializers.ChoiceField(choices=Module.TipoContenido.choices)
    orden = serializers.IntegerField(required=False, min_value=1)
    es_secuencial = serializers.BooleanField(required=False, default=True)
    duracion_minutos = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    # VIDEO
    url_video = serializers.URLField(required=False, allow_blank=True, default="")
    # TEXTO
    contenido_html = serializers.CharField(required=False, allow_blank=True, default="")
    # PDF is provided as a multipart file — not a serializer field

    def validate(self, data: dict) -> dict:
        tipo = data.get("tipo_contenido")
        if tipo == Module.TipoContenido.VIDEO and not data.get("url_video"):
            raise serializers.ValidationError(
                {"url_video": "Se requiere una URL de video para módulos de tipo VIDEO."}
            )
        return data


class CourseListSerializer(serializers.ModelSerializer):
    instructor_nombre = serializers.SerializerMethodField()
    area_nombre = serializers.SerializerMethodField()
    module_count = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = [
            "id",
            "titulo",
            "descripcion",
            "tipo",
            "estado",
            "fecha_limite",
            "version",
            "imagen_portada",
            "duracion_horas",
            "area_nombre",
            "instructor_nombre",
            "module_count",
            "created_at",
            "updated_at",
        ]

    def get_instructor_nombre(self, obj: Course) -> str:
        if obj.instructor:
            return obj.instructor.get_full_name() or obj.instructor.email
        return ""

    def get_area_nombre(self, obj: Course) -> str:
        return obj.area.nombre if obj.area else ""

    def get_module_count(self, obj: Course) -> int:
        return obj.modules.count()


class CourseDetailSerializer(CourseListSerializer):
    modules = ModuleSerializer(many=True, read_only=True)
    audiencia_grupos = serializers.SerializerMethodField()

    class Meta(CourseListSerializer.Meta):
        fields = CourseListSerializer.Meta.fields + ["modules", "audiencia_grupos", "cert_expira_meses"]

    def get_audiencia_grupos(self, obj: Course) -> list[dict]:
        return [{"id": g.id, "nombre": g.nombre} for g in obj.audiencia_grupos.all()]


class CourseCreateSerializer(serializers.ModelSerializer):
    audiencia_grupos = serializers.PrimaryKeyRelatedField(
        many=True,
        required=False,
        queryset=__import__("apps.users.models", fromlist=["Group"]).Group.objects.all(),
    )

    class Meta:
        model = Course
        fields = [
            "titulo",
            "descripcion",
            "tipo",
            "fecha_limite",
            "version",
            "imagen_portada",
            "duracion_horas",
            "cert_expira_meses",
            "area",
            "instructor",
            "audiencia_grupos",
        ]


class EnrollmentSerializer(serializers.ModelSerializer):
    course_titulo = serializers.CharField(source="course.titulo", read_only=True)
    user_email = serializers.CharField(source="user.email", read_only=True)

    class Meta:
        model = Enrollment
        fields = [
            "id",
            "user",
            "user_email",
            "course",
            "course_titulo",
            "estado",
            "progreso_porcentaje",
            "fecha_inscripcion",
            "fecha_completado",
        ]
        read_only_fields = [
            "id",
            "user_email",
            "course_titulo",
            "progreso_porcentaje",
            "fecha_inscripcion",
            "fecha_completado",
        ]


class CertificateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Certificate
        fields = [
            "id",
            "user",
            "course",
            "enrollment",
            "fecha_emision",
            "nota_obtenida",
            "url_pdf",
            "url_qr",
        ]
        read_only_fields = ["id", "fecha_emision"]
