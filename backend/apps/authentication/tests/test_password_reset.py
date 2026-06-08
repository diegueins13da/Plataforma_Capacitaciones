"""
Tests for password reset (6-digit code) and forced change flows.
"""
import pytest
from django.contrib.auth.password_validation import validate_password
from django.core import mail
from rest_framework.test import APIClient

from apps.authentication import services as auth_services
from apps.reports.models import AuditLog
from apps.users.tests.factories import UserFactory

RESET_URL = "/api/v1/auth/password-reset/"
CONFIRM_URL = "/api/v1/auth/password-reset/confirm/"
CHANGE_URL = "/api/v1/auth/change-password/"


# ---------------------------------------------------------------------------
# Password reset request
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestPasswordResetRequest:
    def test_always_returns_200_even_for_unknown_email(self) -> None:
        client = APIClient()
        resp = client.post(RESET_URL, {"email": "nobody@example.com"})
        assert resp.status_code == 200

    def test_known_email_sends_code(self) -> None:
        user = UserFactory()
        client = APIClient()
        client.post(RESET_URL, {"email": user.email})
        assert len(mail.outbox) == 1
        assert user.email in mail.outbox[0].to

    def test_code_is_in_email_body(self) -> None:
        user = UserFactory()
        client = APIClient()
        client.post(RESET_URL, {"email": user.email})
        body = mail.outbox[0].body
        # The code is 6 digits — verify something numeric is in the body
        import re
        assert re.search(r"\b\d{6}\b", body), "6-digit code not found in email body"

    def test_unknown_email_sends_no_email(self) -> None:
        client = APIClient()
        client.post(RESET_URL, {"email": "ghost@example.com"})
        assert len(mail.outbox) == 0


# ---------------------------------------------------------------------------
# Password reset confirm
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestPasswordResetConfirm:
    def _request_code(self, user) -> str:
        """Helper: trigger a reset and pull the code from the email."""
        import re
        client = APIClient()
        client.post(RESET_URL, {"email": user.email})
        body = mail.outbox[-1].body
        match = re.search(r"\b(\d{6})\b", body)
        assert match, "No 6-digit code found in email"
        return match.group(1)

    def test_valid_code_updates_password(self) -> None:
        user = UserFactory()
        code = self._request_code(user)
        client = APIClient()
        resp = client.post(
            CONFIRM_URL,
            {"email": user.email, "code": code, "new_password": "NewValidPass1!"},
        )
        assert resp.status_code == 200
        user.refresh_from_db()
        assert user.check_password("NewValidPass1!")

    def test_wrong_code_returns_400(self) -> None:
        user = UserFactory()
        self._request_code(user)
        client = APIClient()
        resp = client.post(
            CONFIRM_URL,
            {"email": user.email, "code": "000000", "new_password": "NewValidPass1!"},
        )
        assert resp.status_code == 400

    def test_code_can_be_used_only_once(self) -> None:
        user = UserFactory()
        code = self._request_code(user)
        client = APIClient()
        # First use: OK
        client.post(
            CONFIRM_URL,
            {"email": user.email, "code": code, "new_password": "FirstValid1!"},
        )
        # Second use: should fail
        resp = client.post(
            CONFIRM_URL,
            {"email": user.email, "code": code, "new_password": "SecondValid1!"},
        )
        assert resp.status_code == 400

    def test_weak_password_returns_400(self) -> None:
        user = UserFactory()
        code = self._request_code(user)
        client = APIClient()
        resp = client.post(
            CONFIRM_URL,
            {"email": user.email, "code": code, "new_password": "weak"},
        )
        assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Change password (authenticated)
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestChangePassword:
    def test_change_password_updates_password(self) -> None:
        user = UserFactory(password="OldPassword1!")
        client = APIClient()
        login = client.post(
            "/api/v1/auth/login/",
            {"email": user.email, "password": "OldPassword1!"},
        )
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        resp = client.post(
            CHANGE_URL,
            {"current_password": "OldPassword1!", "new_password": "NewPassword2@"},
        )
        assert resp.status_code == 200
        user.refresh_from_db()
        assert user.check_password("NewPassword2@")

    def test_change_password_invalidates_all_tokens(self) -> None:
        user = UserFactory(password="OldPassword1!")
        client = APIClient()
        login = client.post(
            "/api/v1/auth/login/",
            {"email": user.email, "password": "OldPassword1!"},
        )
        refresh_token = login.data["refresh"]
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        client.post(
            CHANGE_URL,
            {"current_password": "OldPassword1!", "new_password": "NewPassword2@"},
        )
        # Old refresh token should now be blacklisted
        client2 = APIClient()
        resp = client2.post("/api/v1/auth/token/refresh/", {"refresh": refresh_token})
        assert resp.status_code == 401

    def test_change_password_creates_audit_log(self) -> None:
        user = UserFactory(password="OldPassword1!")
        client = APIClient()
        login = client.post(
            "/api/v1/auth/login/",
            {"email": user.email, "password": "OldPassword1!"},
        )
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        client.post(
            CHANGE_URL,
            {"current_password": "OldPassword1!", "new_password": "NewPassword2@"},
        )
        assert AuditLog.objects.filter(user=user, accion="PASSWORD_CHANGED").exists()

    def test_wrong_current_password_returns_400(self) -> None:
        user = UserFactory(password="OldPassword1!")
        client = APIClient()
        login = client.post(
            "/api/v1/auth/login/",
            {"email": user.email, "password": "OldPassword1!"},
        )
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        resp = client.post(
            CHANGE_URL,
            {"current_password": "WrongCurrent!", "new_password": "NewPassword2@"},
        )
        assert resp.status_code == 400

    def test_weak_new_password_returns_400(self) -> None:
        user = UserFactory(password="OldPassword1!")
        client = APIClient()
        login = client.post(
            "/api/v1/auth/login/",
            {"email": user.email, "password": "OldPassword1!"},
        )
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        resp = client.post(
            CHANGE_URL,
            {"current_password": "OldPassword1!", "new_password": "weak"},
        )
        assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Password policy validator
# ---------------------------------------------------------------------------


class TestPasswordPolicyValidator:
    def test_valid_password_passes(self) -> None:
        from apps.authentication.password_validators import PasswordPolicyValidator

        validator = PasswordPolicyValidator()
        # Should not raise
        validator.validate("ValidPass1!")

    def test_short_password_fails(self) -> None:
        from django.core.exceptions import ValidationError

        from apps.authentication.password_validators import PasswordPolicyValidator

        with pytest.raises(ValidationError):
            PasswordPolicyValidator().validate("Ab1!")

    def test_no_uppercase_fails(self) -> None:
        from django.core.exceptions import ValidationError

        from apps.authentication.password_validators import PasswordPolicyValidator

        with pytest.raises(ValidationError):
            PasswordPolicyValidator().validate("validpass1!")

    def test_no_digit_fails(self) -> None:
        from django.core.exceptions import ValidationError

        from apps.authentication.password_validators import PasswordPolicyValidator

        with pytest.raises(ValidationError):
            PasswordPolicyValidator().validate("ValidPass!")

    def test_no_special_char_fails(self) -> None:
        from django.core.exceptions import ValidationError

        from apps.authentication.password_validators import PasswordPolicyValidator

        with pytest.raises(ValidationError):
            PasswordPolicyValidator().validate("ValidPass1")
