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
