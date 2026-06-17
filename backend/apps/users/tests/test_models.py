import pytest
from django.db import IntegrityError

from apps.users.models import Area, User, UserProfile


@pytest.mark.django_db
class TestUserModel:
    def test_role_choices_exist(self) -> None:
        roles = {choice[0] for choice in User.Role.choices}
        assert roles == {"ADMIN", "TRAINER", "USUARIO"}

    def test_default_role_is_usuario(self) -> None:
        user = User.objects.create_user(
            username="test_default",
            email="default@test.com",
            password="TestPass123!",
        )
        assert user.role == User.Role.USUARIO

    def test_must_change_password_default_false(self) -> None:
        user = User.objects.create_user(
            username="test_pwd",
            email="pwd@test.com",
            password="TestPass123!",
        )
        assert user.must_change_password is False

    def test_email_is_unique(self) -> None:
        User.objects.create_user(username="u1", email="dup@test.com", password="Pass123!")
        with pytest.raises(IntegrityError):
            User.objects.create_user(username="u2", email="dup@test.com", password="Pass123!")

    def test_full_name_property(self) -> None:
        user = User(first_name="Ana", last_name="García")
        assert user.get_full_name() == "Ana García"


@pytest.mark.django_db
class TestUserProfile:
    def test_profile_auto_created_on_user_creation(self) -> None:
        """Signal creates a UserProfile automatically when a User is saved."""
        user = User.objects.create_user(
            username="signal_user",
            email="signal@test.com",
            password="TestPass123!",
        )
        assert UserProfile.objects.filter(user=user).exists()
        assert user.profile is not None

    def test_profile_links_to_user(self) -> None:
        user = User.objects.create_user(
            username="profile_user",
            email="profile@test.com",
            password="TestPass123!",
        )
        # Profile already created by signal — fetch and update it
        area = Area.objects.create(nombre="TI")
        profile = user.profile
        profile.area = area
        profile.cargo = "Desarrollador"
        profile.save()
        user.refresh_from_db()
        assert user.profile.area.nombre == "TI"
        assert user.profile.user == user

    def test_profile_area_cargo_optional(self) -> None:
        user = User.objects.create_user(
            username="minimal_user",
            email="minimal@test.com",
            password="TestPass123!",
        )
        # Signal creates the profile with blank defaults
        profile = user.profile
        assert profile.area is None
        assert profile.cargo == ""
