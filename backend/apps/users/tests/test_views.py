"""
T10 — User management view tests

API tests for GET/POST /api/v1/users/, PATCH /api/v1/users/{id}/,
POST /api/v1/users/{id}/change-role/, POST /api/v1/users/{id}/deactivate/.
All endpoints require ADMIN.
"""
import pytest
from rest_framework import status

from apps.users.models import Area, User
from apps.users.tests.factories import AdminUserFactory, AreaFactory, TrainerUserFactory, UserFactory

USERS_URL = "/api/v1/users/"


def users_url(pk=None, suffix=""):
    if pk:
        return f"{USERS_URL}{pk}/{suffix}"
    return USERS_URL


# ---------------------------------------------------------------------------
# Access control
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestUserAPIAccessControl:
    def test_unauthenticated_gets_401(self, api_client):
        resp = api_client.get(USERS_URL)
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_trainer_gets_403(self, api_client, trainer_user):
        api_client.force_authenticate(user=trainer_user)
        resp = api_client.get(USERS_URL)
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_regular_user_gets_403(self, api_client, regular_user):
        api_client.force_authenticate(user=regular_user)
        resp = api_client.get(USERS_URL)
        assert resp.status_code == status.HTTP_403_FORBIDDEN


# ---------------------------------------------------------------------------
# List users
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestListUsersAPI:
    def test_lists_all_users(self, api_client, admin_user):
        UserFactory.create_batch(3)
        api_client.force_authenticate(user=admin_user)
        resp = api_client.get(USERS_URL)
        assert resp.status_code == status.HTTP_200_OK
        results = resp.data.get("results", resp.data)
        assert len(results) >= 3

    def test_filter_by_role(self, api_client, admin_user):
        UserFactory(role=User.Role.TRAINER)
        UserFactory(role=User.Role.USUARIO)
        api_client.force_authenticate(user=admin_user)
        resp = api_client.get(USERS_URL, {"role": "TRAINER"})
        results = resp.data.get("results", resp.data)
        assert all(u["role"] == "TRAINER" for u in results)

    def test_filter_by_is_active(self, api_client, admin_user):
        UserFactory(is_active=False)
        api_client.force_authenticate(user=admin_user)
        resp = api_client.get(USERS_URL, {"is_active": "false"})
        results = resp.data.get("results", resp.data)
        assert all(not u["is_active"] for u in results)

    def test_search_by_name(self, api_client, admin_user):
        UserFactory(first_name="Zorro", last_name="Test")
        api_client.force_authenticate(user=admin_user)
        resp = api_client.get(USERS_URL, {"search": "Zorro"})
        results = resp.data.get("results", resp.data)
        assert any("Zorro" in u["full_name"] for u in results)


# ---------------------------------------------------------------------------
# Create user
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestCreateUserAPI:
    def test_creates_user(self, api_client, admin_user):
        api_client.force_authenticate(user=admin_user)
        resp = api_client.post(
            USERS_URL,
            {
                "email": "nuevo@empresa.com",
                "first_name": "María",
                "last_name": "Gómez",
                "role": "USUARIO",
            },
        )
        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.data["email"] == "nuevo@empresa.com"

    def test_create_missing_email_returns_400(self, api_client, admin_user):
        api_client.force_authenticate(user=admin_user)
        resp = api_client.post(USERS_URL, {"first_name": "Sin", "last_name": "Email", "role": "USUARIO"})
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_create_duplicate_email_returns_400(self, api_client, admin_user):
        existing = UserFactory(email="dup@empresa.com")
        api_client.force_authenticate(user=admin_user)
        resp = api_client.post(
            USERS_URL,
            {"email": existing.email, "first_name": "X", "last_name": "Y", "role": "USUARIO"},
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST


# ---------------------------------------------------------------------------
# Update user
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestUpdateUserAPI:
    def test_patch_profile_fields(self, api_client, admin_user):
        AreaFactory(nombre="Ventas")
        user = UserFactory()
        api_client.force_authenticate(user=admin_user)
        resp = api_client.patch(users_url(user.pk), {"area": "Ventas", "cargo": "Ejecutivo"})
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["area"] == "Ventas"
        assert resp.data["cargo"] == "Ejecutivo"

    def test_patch_name(self, api_client, admin_user):
        user = UserFactory()
        api_client.force_authenticate(user=admin_user)
        resp = api_client.patch(users_url(user.pk), {"first_name": "Carlos"})
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["first_name"] == "Carlos"


# ---------------------------------------------------------------------------
# Change role
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestChangeRoleAPI:
    def test_changes_role(self, api_client, admin_user):
        user = UserFactory(role=User.Role.USUARIO)
        api_client.force_authenticate(user=admin_user)
        resp = api_client.post(users_url(user.pk, "change-role/"), {"new_role": "TRAINER"})
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["role"] == "TRAINER"

    def test_invalid_role_returns_400(self, api_client, admin_user):
        user = UserFactory()
        api_client.force_authenticate(user=admin_user)
        resp = api_client.post(users_url(user.pk, "change-role/"), {"new_role": "SUPERUSER"})
        assert resp.status_code == status.HTTP_400_BAD_REQUEST


# ---------------------------------------------------------------------------
# Deactivate user
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestDeactivateUserAPI:
    def test_deactivates_user(self, api_client, admin_user):
        user = UserFactory(is_active=True)
        api_client.force_authenticate(user=admin_user)
        resp = api_client.post(users_url(user.pk, "deactivate/"))
        assert resp.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert user.is_active is False

    def test_deactivate_nonexistent_user_returns_404(self, api_client, admin_user):
        api_client.force_authenticate(user=admin_user)
        resp = api_client.post(users_url(99999, "deactivate/"))
        assert resp.status_code == status.HTTP_404_NOT_FOUND
