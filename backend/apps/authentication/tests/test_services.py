import pytest

from apps.authentication import services
from apps.reports.models import AuditLog
from apps.users.tests.factories import UserFactory


@pytest.mark.django_db
class TestLoginService:
    def test_returns_tokens_on_success(self) -> None:
        user = UserFactory(password="TestPassword123!")
        result = services.login(email=user.email, password="TestPassword123!", ip="127.0.0.1")
        assert "access" in result
        assert "refresh" in result
        assert result["user"] == user

    def test_raises_on_wrong_password(self) -> None:
        user = UserFactory()
        with pytest.raises(services.AuthenticationError):
            services.login(email=user.email, password="WrongPassword!", ip="127.0.0.1")

    def test_raises_on_unknown_email(self) -> None:
        with pytest.raises(services.AuthenticationError):
            services.login(
                email="ghost@example.com", password="anything", ip="127.0.0.1"
            )

    def test_logs_success(self) -> None:
        user = UserFactory(password="TestPassword123!")
        services.login(email=user.email, password="TestPassword123!", ip="10.0.0.1")
        log = AuditLog.objects.get(user=user, accion="LOGIN_SUCCESS")
        assert log.ip == "10.0.0.1"

    def test_logs_failure(self) -> None:
        user = UserFactory()
        with pytest.raises(services.AuthenticationError):
            services.login(email=user.email, password="BadPassword!", ip="10.0.0.2")
        assert AuditLog.objects.filter(accion="LOGIN_FAILED", ip="10.0.0.2").exists()

    def test_inactive_user_raises(self) -> None:
        user = UserFactory(is_active=False, password="TestPassword123!")
        with pytest.raises(services.AuthenticationError):
            services.login(email=user.email, password="TestPassword123!", ip="127.0.0.1")
