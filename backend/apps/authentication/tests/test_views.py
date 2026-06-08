import pytest
from rest_framework.test import APIClient

from apps.reports.models import AuditLog
from apps.users.tests.factories import UserFactory


@pytest.mark.django_db
class TestLoginView:
    URL = "/api/v1/auth/login/"

    def test_valid_credentials_return_tokens(self) -> None:
        user = UserFactory(password="TestPassword123!")
        client = APIClient()
        response = client.post(self.URL, {"email": user.email, "password": "TestPassword123!"})
        assert response.status_code == 200
        data = response.json()
        assert "access" in data
        assert "refresh" in data

    def test_valid_credentials_return_user_info(self) -> None:
        user = UserFactory(password="TestPassword123!")
        client = APIClient()
        response = client.post(self.URL, {"email": user.email, "password": "TestPassword123!"})
        data = response.json()
        assert data["user"]["email"] == user.email
        assert data["user"]["role"] == user.role
        assert "force_password_change" in data["user"]

    def test_invalid_password_returns_401(self) -> None:
        user = UserFactory()
        client = APIClient()
        response = client.post(self.URL, {"email": user.email, "password": "WrongPassword!"})
        assert response.status_code == 401

    def test_unknown_email_returns_401(self) -> None:
        client = APIClient()
        response = client.post(
            self.URL, {"email": "nobody@example.com", "password": "anything"}
        )
        assert response.status_code == 401

    def test_invalid_credentials_error_message_is_generic(self) -> None:
        """Error message must not reveal whether the user exists (anti-enumeration)."""
        client = APIClient()
        response = client.post(
            self.URL, {"email": "nobody@example.com", "password": "anything"}
        )
        body = str(response.content)
        assert "nobody@example.com" not in body
        assert "no existe" not in body.lower()

    def test_successful_login_creates_audit_log(self) -> None:
        user = UserFactory(password="TestPassword123!")
        client = APIClient()
        client.post(self.URL, {"email": user.email, "password": "TestPassword123!"})
        assert AuditLog.objects.filter(user=user, accion="LOGIN_SUCCESS").exists()

    def test_failed_login_creates_audit_log(self) -> None:
        user = UserFactory()
        client = APIClient()
        client.post(self.URL, {"email": user.email, "password": "WrongPassword!"})
        assert AuditLog.objects.filter(accion="LOGIN_FAILED").exists()

    def test_inactive_user_cannot_login(self) -> None:
        user = UserFactory(is_active=False, password="TestPassword123!")
        client = APIClient()
        response = client.post(self.URL, {"email": user.email, "password": "TestPassword123!"})
        assert response.status_code == 401


@pytest.mark.django_db
class TestLogoutView:
    def test_logout_returns_200(self) -> None:
        user = UserFactory(password="TestPassword123!")
        client = APIClient()
        login = client.post("/api/v1/auth/login/", {"email": user.email, "password": "TestPassword123!"})
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        response = client.post("/api/v1/auth/logout/", {"refresh": login.data["refresh"]})
        assert response.status_code == 200

    def test_logout_blacklists_refresh_token(self) -> None:
        user = UserFactory(password="TestPassword123!")
        client = APIClient()
        login = client.post("/api/v1/auth/login/", {"email": user.email, "password": "TestPassword123!"})
        refresh_token = login.data["refresh"]
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        client.post("/api/v1/auth/logout/", {"refresh": refresh_token})
        # Try to use the blacklisted refresh token
        client2 = APIClient()
        response = client2.post("/api/v1/auth/token/refresh/", {"refresh": refresh_token})
        assert response.status_code == 401


@pytest.mark.django_db
class TestMeView:
    def test_authenticated_user_gets_own_data(self) -> None:
        user = UserFactory(password="TestPassword123!")
        client = APIClient()
        login = client.post("/api/v1/auth/login/", {"email": user.email, "password": "TestPassword123!"})
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        response = client.get("/api/v1/auth/me/")
        assert response.status_code == 200
        assert response.json()["email"] == user.email

    def test_unauthenticated_request_returns_401(self) -> None:
        client = APIClient()
        response = client.get("/api/v1/auth/me/")
        assert response.status_code == 401
