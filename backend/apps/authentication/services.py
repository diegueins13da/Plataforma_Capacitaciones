"""
Authentication service layer.
All authentication business logic lives here — views are kept thin.
"""
from __future__ import annotations

import secrets
from typing import TYPE_CHECKING

from django.conf import settings
from django.contrib.auth import authenticate
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.utils import timezone

from apps.reports.models import AuditLog

if TYPE_CHECKING:
    from apps.users.models import User

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
_RESET_CODE_TTL = 1800  # 30 minutes in seconds
_RESET_CACHE_PREFIX = "pwd_reset"


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class AuthenticationError(Exception):
    """
    Raised when login fails.
    Message is always generic to prevent user enumeration.
    `attempts_left` is None when axes is disabled or count is unknown.
    """

    def __init__(self, message: str, attempts_left: int | None = None) -> None:
        super().__init__(message)
        self.attempts_left = attempts_left


class PasswordResetError(Exception):
    """Raised when a reset code is invalid or expired."""


# ---------------------------------------------------------------------------
# Login / Logout
# ---------------------------------------------------------------------------


def login(*, email: str, password: str, ip: str) -> dict:
    """
    Authenticate a user by email + password and return JWT tokens.

    Returns:
        {"access": str, "refresh": str, "user": User}

    Raises:
        AuthenticationError — on any failure
    """
    from apps.users.models import User
    from rest_framework_simplejwt.tokens import RefreshToken

    _GENERIC_ERROR = "Credenciales incorrectas. Verifica tu correo y contraseña."

    try:
        user = User.objects.select_related("profile").get(email=email)
    except User.DoesNotExist:
        AuditLog.objects.create(
            accion="LOGIN_FAILED",
            ip=ip,
            detalles_json={"reason": "user_not_found"},
        )
        raise AuthenticationError(_GENERIC_ERROR)

    authenticated_user = authenticate(username=user.username, password=password)

    if authenticated_user is None:
        AuditLog.objects.create(
            user=user,
            accion="LOGIN_FAILED",
            ip=ip,
            detalles_json={"reason": "invalid_credentials"},
        )
        attempts_left = _get_attempts_left(user.username)
        raise AuthenticationError(_GENERIC_ERROR, attempts_left=attempts_left)

    if not authenticated_user.is_active:
        AuditLog.objects.create(
            user=authenticated_user,
            accion="LOGIN_FAILED",
            ip=ip,
            detalles_json={"reason": "inactive_account"},
        )
        raise AuthenticationError("Cuenta inactiva. Contacta al administrador.")

    refresh = RefreshToken.for_user(authenticated_user)

    AuditLog.objects.create(
        user=authenticated_user,
        accion="LOGIN_SUCCESS",
        ip=ip,
    )

    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "user": authenticated_user,
    }


def logout(*, user: "User", refresh_token: str | None, ip: str) -> None:
    """Blacklist the refresh token and record the logout event."""
    from rest_framework_simplejwt.exceptions import TokenError
    from rest_framework_simplejwt.tokens import RefreshToken

    if refresh_token:
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except TokenError:
            pass

    AuditLog.objects.create(user=user, accion="LOGOUT", ip=ip)


# ---------------------------------------------------------------------------
# Password reset (unauthenticated flow — 6-digit code)
# ---------------------------------------------------------------------------


def request_password_reset(*, email: str) -> None:
    """
    Generate a 6-digit reset code and email it to the user.
    ALWAYS returns silently — never reveals whether the email exists.
    """
    from apps.users.models import User

    try:
        user = User.objects.get(email=email, is_active=True)
    except User.DoesNotExist:
        return  # Silent — anti-enumeration

    code = f"{secrets.randbelow(1_000_000):06d}"
    cache_key = f"{_RESET_CACHE_PREFIX}:{user.pk}"
    cache.set(cache_key, {"code": code, "used": False}, timeout=_RESET_CODE_TTL)

    frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:3000")
    from_email = settings.DEFAULT_FROM_EMAIL or settings.EMAIL_HOST_USER

    send_mail(
        subject="Código de recuperación de contraseña",
        message=(
            f"Tu código de recuperación es: {code}\n\n"
            f"Este código expira en 30 minutos y es de un solo uso.\n\n"
            f"Si no solicitaste este código, ignora este mensaje.\n\n"
            f"{frontend_url}"
        ),
        from_email=from_email,
        recipient_list=[user.email],
        fail_silently=True,  # Never crash because of an email failure
    )


def confirm_password_reset(*, email: str, code: str, new_password: str) -> None:
    """
    Validate the reset code and update the user's password.

    Raises:
        PasswordResetError — if code is wrong, expired, or already used
        ValidationError — if new_password fails policy
    """
    from apps.users.models import User

    try:
        user = User.objects.get(email=email, is_active=True)
    except User.DoesNotExist:
        raise PasswordResetError("Código inválido o expirado.")

    cache_key = f"{_RESET_CACHE_PREFIX}:{user.pk}"
    stored = cache.get(cache_key)

    if stored is None:
        raise PasswordResetError("El código ha expirado o ya fue utilizado.")

    if stored.get("used"):
        raise PasswordResetError("Este código ya fue utilizado.")

    if not secrets.compare_digest(str(stored["code"]), str(code)):
        raise PasswordResetError("Código incorrecto.")

    # Validate password policy before saving
    _validate_password(new_password, user)

    # Mark code as used (prevents replay)
    stored["used"] = True
    cache.set(cache_key, stored, timeout=_RESET_CODE_TTL)

    user.set_password(new_password)
    user.must_change_password = False
    user.save(update_fields=["password", "must_change_password"])

    AuditLog.objects.create(
        user=user,
        accion="PASSWORD_RESET",
        detalles_json={"method": "code"},
    )


# ---------------------------------------------------------------------------
# Change password (authenticated)
# ---------------------------------------------------------------------------


def change_password(*, user: "User", current_password: str, new_password: str, ip: str) -> None:
    """
    Change the user's password, blacklist ALL their outstanding tokens,
    and record the event in AuditLog.

    Raises:
        PasswordResetError — if current password is wrong
        ValidationError — if new_password fails policy
    """
    if not user.check_password(current_password):
        raise PasswordResetError("La contraseña actual es incorrecta.")

    _validate_password(new_password, user)

    user.set_password(new_password)
    user.must_change_password = False
    user.save(update_fields=["password", "must_change_password"])

    # Invalidate ALL active sessions — security critical (T03 spec)
    _blacklist_all_tokens(user)

    AuditLog.objects.create(
        user=user,
        accion="PASSWORD_CHANGED",
        ip=ip,
    )


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------


def get_client_ip(request) -> str:
    """Extract the real client IP, respecting X-Forwarded-For set by Nginx."""
    x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded_for:
        return x_forwarded_for.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "")


def _validate_password(password: str, user=None) -> None:
    """Run all AUTH_PASSWORD_VALIDATORS against the password."""
    from django.contrib.auth.password_validation import validate_password

    validate_password(password, user)  # raises ValidationError on failure


def _blacklist_all_tokens(user: "User") -> None:
    """Blacklist every outstanding JWT refresh token for this user."""
    try:
        from rest_framework_simplejwt.token_blacklist.models import (
            BlacklistedToken,
            OutstandingToken,
        )

        for token in OutstandingToken.objects.filter(user=user):
            BlacklistedToken.objects.get_or_create(token=token)
    except Exception:  # noqa: BLE001
        pass  # Token blacklist table might not exist in edge cases


def _get_attempts_left(username: str) -> int | None:
    """
    Query axes' AccessAttempt table for remaining login attempts.
    Returns None when axes is disabled or the database handler isn't active.
    """
    if not getattr(settings, "AXES_ENABLED", True):
        return None

    try:
        from axes.models import AccessAttempt

        limit: int = getattr(settings, "AXES_FAILURE_LIMIT", 5)
        attempt = (
            AccessAttempt.objects.filter(username=username)
            .order_by("-attempt_time")
            .first()
        )
        return max(0, limit - (attempt.failures_since_start if attempt else 1))
    except Exception:  # noqa: BLE001
        return None
