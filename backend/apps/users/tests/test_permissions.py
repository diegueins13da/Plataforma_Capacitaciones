"""
T09 — Permission class tests (IsAdmin, IsAdminOrTrainer)

Each class is tested against all three roles (ADMIN, TRAINER, USUARIO).
Uses the api_rf, admin_user, trainer_user, regular_user fixtures from conftest.py.
"""
import pytest
from rest_framework.test import APIRequestFactory

from apps.users.permissions import IsAdmin, IsAdminOrTrainer


def _req(rf: APIRequestFactory, user):
    """Build a minimal Django request with .user attached."""
    request = rf.get("/")
    request.user = user
    return request


# ---------------------------------------------------------------------------
# IsAdmin
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestIsAdmin:
    def test_admin_user_is_allowed(self, api_rf, admin_user):
        assert IsAdmin().has_permission(_req(api_rf, admin_user), None) is True

    def test_trainer_user_is_denied(self, api_rf, trainer_user):
        assert IsAdmin().has_permission(_req(api_rf, trainer_user), None) is False

    def test_regular_user_is_denied(self, api_rf, regular_user):
        assert IsAdmin().has_permission(_req(api_rf, regular_user), None) is False


# ---------------------------------------------------------------------------
# IsAdminOrTrainer
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestIsAdminOrTrainer:
    def test_admin_user_is_allowed(self, api_rf, admin_user):
        assert IsAdminOrTrainer().has_permission(_req(api_rf, admin_user), None) is True

    def test_trainer_user_is_allowed(self, api_rf, trainer_user):
        assert IsAdminOrTrainer().has_permission(_req(api_rf, trainer_user), None) is True

    def test_regular_user_is_denied(self, api_rf, regular_user):
        assert IsAdminOrTrainer().has_permission(_req(api_rf, regular_user), None) is False
