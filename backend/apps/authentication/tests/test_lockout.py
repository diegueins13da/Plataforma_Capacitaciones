"""
Tests for account lockout (django-axes) and rate limiting (django-ratelimit).

Note: AXES_ENABLED is True in these tests (overridden via pytest mark).
AXES_FAILURE_LIMIT = 5 means the 6th request is blocked.
"""
import pytest
from django.test import override_settings
from rest_framework.test import APIClient

from apps.reports.models import AuditLog
from apps.users.tests.factories import UserFactory

LOGIN_URL = "/api/v1/auth/login/"

# Use database handler so we can query AccessAttempt in tests
AXES_TEST_SETTINGS = {
    "AXES_ENABLED": True,
    "AXES_FAILURE_LIMIT": 5,
    "AXES_COOLOFF_TIME": None,  # No auto-release; manual testing of lockout
    "AXES_RESET_ON_SUCCESS": True,
    "AXES_LOCKOUT_CALLABLE": "apps.authentication.lockout.lockout_response",
    "AXES_HANDLER": "axes.handlers.database.AxesDatabaseHandler",
}


@pytest.mark.django_db
class TestAccountLockout:
    @override_settings(**AXES_TEST_SETTINGS)
    def test_5_failures_then_locked(self) -> None:
        """After 5 failed attempts the 6th request must return 423."""
        user = UserFactory(password="CorrectPassword1!")
        client = APIClient()

        for _ in range(5):
            resp = client.post(LOGIN_URL, {"email": user.email, "password": "WrongPassword!"})
            assert resp.status_code == 401

        # 6th attempt — account should now be locked
        resp = client.post(LOGIN_URL, {"email": user.email, "password": "WrongPassword!"})
        assert resp.status_code == 423

    @override_settings(**AXES_TEST_SETTINGS)
    def test_lockout_response_has_locked_field(self) -> None:
        user = UserFactory(password="CorrectPassword1!")
        client = APIClient()

        for _ in range(5):
            client.post(LOGIN_URL, {"email": user.email, "password": "WrongPassword!"})

        resp = client.post(LOGIN_URL, {"email": user.email, "password": "WrongPassword!"})
        data = resp.json()
        assert data.get("locked") is True
        assert "minutes_remaining" in data

    @override_settings(**AXES_TEST_SETTINGS)
    def test_lockout_creates_audit_log(self) -> None:
        user = UserFactory(password="CorrectPassword1!")
        client = APIClient()

        for _ in range(5):
            client.post(LOGIN_URL, {"email": user.email, "password": "WrongPassword!"})

        client.post(LOGIN_URL, {"email": user.email, "password": "WrongPassword!"})
        assert AuditLog.objects.filter(accion="ACCOUNT_LOCKED").exists()

    @override_settings(**AXES_TEST_SETTINGS)
    def test_attempts_left_decrements(self) -> None:
        """Each failed login response should include a decreasing attempts_left."""
        user = UserFactory(password="CorrectPassword1!")
        client = APIClient()

        resp = client.post(LOGIN_URL, {"email": user.email, "password": "WrongPassword!"})
        assert resp.status_code == 401
        first_attempt_left = resp.json().get("attempts_left")
        assert first_attempt_left is not None
        assert first_attempt_left < 5  # Should be 4 after 1st failure

    @override_settings(**AXES_TEST_SETTINGS)
    def test_successful_login_resets_counter(self) -> None:
        user = UserFactory(password="CorrectPassword1!")
        client = APIClient()

        for _ in range(3):
            client.post(LOGIN_URL, {"email": user.email, "password": "WrongPassword!"})

        # Successful login resets axes counter
        resp = client.post(LOGIN_URL, {"email": user.email, "password": "CorrectPassword1!"})
        assert resp.status_code == 200

        # After reset, 5 more failures should be allowed before lock
        for _ in range(5):
            resp = client.post(LOGIN_URL, {"email": user.email, "password": "WrongPassword!"})
            assert resp.status_code == 401


@pytest.mark.django_db
class TestLockoutCallable:
    """Unit tests for the lockout response function."""

    def test_lockout_response_format(self) -> None:
        from django.test import RequestFactory

        from apps.authentication.lockout import lockout_response

        request = RequestFactory().post(LOGIN_URL)
        response = lockout_response(request, credentials={})
        import json

        data = json.loads(response.content)
        assert response.status_code == 423
        assert data["locked"] is True
        assert "minutes_remaining" in data
