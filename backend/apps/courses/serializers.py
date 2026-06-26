from rest_framework import serializers

from .models import Certificate, Course, Enrollment, Module, ModuleProgress, Tema


class UserEnrollmentSerializer(serializers.Serializer):
    """Enrollment data scoped to the requesting user — embedded in course responses."""

    id = serializers.IntegerField()
    estado = serializers.CharField()
    progreso_porcentaje = serializers.IntegerField()
    fecha_inscripcion = serializers.DateTimeField()
    fecha_completado = serializers.DateTimeField(allow_null=True)


class TemaSerializer(serializers.ModelSerializer):
    archivo_pdf = serializers.SerializerMethodField()
    archivo_video = serializers.SerializerMethodField()
    archivo_imagen = serializers.SerializerMethodField()

    def get_archivo_pdf(self, obj: "Tema") -> str:
        return f"/media/{obj.archivo_pdf}" if obj.archivo_pdf else ""

    def get_archivo_video(self, obj: "Tema") -> str:
        return obj.archivo_video.url if obj.archivo_video else ""

    def get_archivo_imagen(self, obj: "Tema") -> str:
        return obj.archivo_imagen.url if obj.archivo_imagen else ""

    class Meta:
        model = Tema
        fields = [
            "id", "titulo", "orden", "tipo_contenido", "duracion_minutos",
            "url_video", "archivo_video", "archivo_pdf",
            "contenido_html", "archivo_imagen", "url_iframe",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class TemaCreateSerializer(serializers.Serializer):
    titulo = serializers.CharField(max_length=255)
    orden = serializers.IntegerField(required=False, min_value=1)
    tipo_contenido = serializers.ChoiceField(choices=Tema.TipoContenido.choices)
    duracion_minutos = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    url_video = serializers.URLField(required=False, allow_blank=True, default="")
    contenido_html = serializers.CharField(required=False, allow_blank=True, default="")
    url_iframe = serializers.URLField(required=False, allow_blank=True, default="")

    def validate(self, data: dict) -> dict:
        tipo = data.get("tipo_contenido")
        if tipo == Tema.TipoContenido.VIDEO and not data.get("url_video"):
            # video file upload is handled separately — URL is optional if file provided
            pass
        if tipo == Tema.TipoContenido.IFRAME and not data.get("url_iframe"):
            raise serializers.ValidationError({"url_iframe": "Se requiere una URL para temas de tipo iFrame."})
        return data


class ModuleSerializer(serializers.ModelSerializer):
    temas = TemaSerializer(many=True, read_only=True)

    class Meta:
        model = Module
        fields = [
            "id", "titulo", "descripcion", "orden", "es_secuencial",
            "temas", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class ModuleCreateSerializer(serializers.Serializer):
    titulo = serializers.CharField(max_length=255)
    descripcion = serializers.CharField(required=False, default="", allow_blank=True)
    orden = serializers.IntegerField(required=False, min_value=1)
    es_secuencial = serializers.BooleanField(required=False, default=True)


class CourseListSerializer(serializers.ModelSerializer):
    instructor_nombre = serializers.SerializerMethodField()
    area_nombre = serializers.SerializerMethodField()
    module_count = serializers.SerializerMethodField()
    enrollment = serializers.SerializerMethodField()
    can_edit = serializers.SerializerMethodField()

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
            "enrollment",
            "can_edit",
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

    def get_enrollment(self, obj: Course) -> dict | None:
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        enrollment = obj.enrollments.filter(user=request.user).first()
        if not enrollment:
            return None
        return UserEnrollmentSerializer(enrollment).data

    def get_can_edit(self, obj: Course) -> bool:
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        user = request.user
        if user.role == "ADMIN":
            return True
        if user.role == "TRAINER" and obj.instructor_id == user.pk:
            return True
        return False


class CourseDetailSerializer(CourseListSerializer):
    modules_with_status = serializers.SerializerMethodField()
    audiencia_grupos = serializers.SerializerMethodField()
    has_assessment = serializers.SerializerMethodField()

    class Meta(CourseListSerializer.Meta):
        fields = CourseListSerializer.Meta.fields + [
            "area",
            "instructor",
            "modules_with_status",
            "audiencia_grupos",
            "cert_expira_meses",
            "has_assessment",
        ]

    def get_has_assessment(self, obj: Course) -> bool:
        try:
            return obj.assessment.questions.filter(aprobada_por_humano=True).exists()
        except Exception:
            return False

    def get_audiencia_grupos(self, obj: Course) -> list[dict]:
        return [{"id": g.id, "nombre": g.nombre} for g in obj.audiencia_grupos.all()]

    def get_modules_with_status(self, obj: Course) -> list[dict]:
        request = self.context.get("request")
        enrollment = None
        if request and request.user.is_authenticated:
            enrollment = obj.enrollments.filter(user=request.user).first()

        completed_ids: set[int] = set()
        position_map: dict[int, dict] = {}
        if enrollment:
            for mp in enrollment.module_progress.all():
                if mp.is_completed:
                    completed_ids.add(mp.module_id)
                position_map[mp.module_id] = mp.last_position_json

        result = []
        modules_ordered = list(obj.modules.prefetch_related("temas").order_by("orden"))
        for module in modules_ordered:
            is_completed = module.pk in completed_ids
            is_unlocked = True
            if module.es_secuencial and module.orden > 1:
                prev = [m for m in modules_ordered if m.orden < module.orden]
                is_unlocked = all(m.pk in completed_ids for m in prev)
            result.append({
                **ModuleSerializer(module).data,
                "is_completed": is_completed,
                "is_unlocked": is_unlocked,
                "last_position_json": position_map.get(module.pk, {}),
            })
        return result


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
