"""
User app serializers.
"""
from rest_framework import serializers

from .models import Group, User, UserProfile


class GroupSerializer(serializers.ModelSerializer):
    """Used for list and create endpoints."""

    member_count = serializers.SerializerMethodField()
    # Placeholder — will be annotated from Enrollments in T13+
    cursos_activos = serializers.SerializerMethodField()

    class Meta:
        model = Group
        fields = ["id", "nombre", "descripcion", "activo", "created_at", "member_count", "cursos_activos"]
        read_only_fields = ["id", "created_at"]

    def get_member_count(self, obj: Group) -> int:
        return obj.members.count()

    def get_cursos_activos(self, obj: Group) -> int:  # noqa: ARG002
        # Will be implemented in T13 when the Course model exists
        return 0


class GroupMemberSerializer(serializers.ModelSerializer):
    """Compact user representation for the members sub-resource."""

    id = serializers.IntegerField(source="user.id")
    email = serializers.EmailField(source="user.email")
    full_name = serializers.SerializerMethodField()
    role = serializers.CharField(source="user.role")
    is_active = serializers.BooleanField(source="user.is_active")
    area = serializers.CharField()
    cargo = serializers.CharField()

    class Meta:
        model = UserProfile
        fields = ["id", "email", "full_name", "role", "is_active", "area", "cargo"]

    def get_full_name(self, obj: UserProfile) -> str:
        return obj.user.get_full_name()


class AddMembersSerializer(serializers.Serializer):
    user_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        min_length=1,
    )


# ---------------------------------------------------------------------------
# User serializers
# ---------------------------------------------------------------------------


class UserListSerializer(serializers.ModelSerializer):
    """Compact representation used in list and create responses."""

    full_name = serializers.SerializerMethodField()
    area = serializers.SerializerMethodField()
    cargo = serializers.SerializerMethodField()
    grupo_nombre = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "email", "first_name", "last_name", "full_name",
            "role", "is_active", "must_change_password",
            "area", "cargo", "grupo_nombre",
        ]

    def get_full_name(self, obj: User) -> str:
        return obj.get_full_name()

    def get_area(self, obj: User) -> str:
        return getattr(obj, "profile", None) and obj.profile.area or ""

    def get_cargo(self, obj: User) -> str:
        return getattr(obj, "profile", None) and obj.profile.cargo or ""

    def get_grupo_nombre(self, obj: User) -> str | None:
        profile = getattr(obj, "profile", None)
        if profile and profile.grupo:
            return profile.grupo.nombre
        return None


class UserCreateSerializer(serializers.Serializer):
    """Validated input for creating a user via the API."""

    email = serializers.EmailField()
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    role = serializers.ChoiceField(choices=User.Role.choices, default=User.Role.USUARIO)
    area = serializers.CharField(max_length=150, default="", required=False, allow_blank=True)
    cargo = serializers.CharField(max_length=150, default="", required=False, allow_blank=True)
    grupo_id = serializers.IntegerField(required=False, allow_null=True)

    def validate_email(self, value: str) -> str:
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Ya existe un usuario con este correo.")
        return value.lower()


class UserUpdateSerializer(serializers.Serializer):
    """Validated input for PATCH /users/{id}/."""

    first_name = serializers.CharField(max_length=150, required=False)
    last_name = serializers.CharField(max_length=150, required=False)
    area = serializers.CharField(max_length=150, required=False, allow_blank=True)
    cargo = serializers.CharField(max_length=150, required=False, allow_blank=True)
    grupo_id = serializers.IntegerField(required=False, allow_null=True)


class ChangeRoleSerializer(serializers.Serializer):
    new_role = serializers.ChoiceField(choices=User.Role.choices)
