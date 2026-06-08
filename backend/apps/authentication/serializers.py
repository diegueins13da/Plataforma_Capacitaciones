from rest_framework import serializers

from apps.users.models import User


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------


class LoginRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, style={"input_type": "password"})


class UserBriefSerializer(serializers.ModelSerializer):
    """Minimal user info returned with the login response."""

    force_password_change = serializers.BooleanField(source="must_change_password")

    class Meta:
        model = User
        fields = ["id", "email", "role", "force_password_change"]


class LoginResponseSerializer(serializers.Serializer):
    access = serializers.CharField()
    refresh = serializers.CharField()
    user = UserBriefSerializer()


# ---------------------------------------------------------------------------
# Me
# ---------------------------------------------------------------------------


class MeSerializer(serializers.ModelSerializer):
    """Full user info returned by GET /api/v1/auth/me/"""

    full_name = serializers.SerializerMethodField()
    area = serializers.SerializerMethodField()
    grupo = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "role",
            "full_name",
            "area",
            "grupo",
            "must_change_password",
            "is_active",
        ]

    def get_full_name(self, obj: User) -> str:
        return obj.get_full_name() or obj.email

    def get_area(self, obj: User) -> str:
        try:
            return obj.profile.area
        except Exception:
            return ""

    def get_grupo(self, obj: User) -> dict | None:
        # Group FK added to UserProfile in T09b — safe fallback until then
        try:
            profile = obj.profile
        except Exception:
            return None
        group = getattr(profile, "grupo", None)
        if group is None:
            return None
        return {"id": group.id, "name": group.name}


# ---------------------------------------------------------------------------
# Password reset
# ---------------------------------------------------------------------------


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(min_length=6, max_length=6)
    new_password = serializers.CharField(
        write_only=True, style={"input_type": "password"}, min_length=8
    )


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(
        write_only=True, style={"input_type": "password"}
    )
    new_password = serializers.CharField(
        write_only=True, style={"input_type": "password"}, min_length=8
    )
