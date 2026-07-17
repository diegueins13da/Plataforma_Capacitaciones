"""
Authentication service layer.
All authentication business logic lives here — views are kept thin.
"""
from __future__ import annotations

import hashlib
import secrets
import uuid as _uuid
from typing import TYPE_CHECKING

from django.conf import settings
from django.contrib.auth import authenticate
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.utils import timezone

from apps.reports.audit import log_event

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


class MFAError(Exception):
    """Raised when MFA verification fails (wrong code, expired, locked-out)."""


# ---------------------------------------------------------------------------
# Login / Logout
# ---------------------------------------------------------------------------


def login(*, email: str, password: str, ip: str, request=None) -> dict:
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
        log_event(
            accion="LOGIN_FAILED",
            ip=ip,
            detalle={"reason": "user_not_found", "email_intentado": email},
        )
        raise AuthenticationError(_GENERIC_ERROR)

    authenticated_user = authenticate(request=request, username=user.username, password=password)

    if authenticated_user is None:
        log_event(
            accion="LOGIN_FAILED",
            actor=user,
            ip=ip,
            entidad_tipo="User",
            entidad_id=user.pk,
            entidad_nombre=user.email,
            detalle={"reason": "invalid_credentials"},
        )
        attempts_left = _get_attempts_left(user.username)
        raise AuthenticationError(_GENERIC_ERROR, attempts_left=attempts_left)

    if not authenticated_user.is_active:
        log_event(
            accion="LOGIN_FAILED",
            actor=authenticated_user,
            ip=ip,
            entidad_tipo="User",
            entidad_id=authenticated_user.pk,
            entidad_nombre=authenticated_user.email,
            detalle={"reason": "inactive_account"},
        )
        raise AuthenticationError("Cuenta inactiva. Contacta al administrador.")

    # MFA — check global setting then per-user flag
    if _is_mfa_required_for_user(authenticated_user):
        user_agent = request.META.get("HTTP_USER_AGENT", "") if request else ""
        challenge = create_mfa_challenge(authenticated_user, ip, user_agent)
        return {
            "mfa_required": True,
            "mfa_token": str(challenge.token),
            "email_hint": _mask_email(authenticated_user.email),
        }

    # MFA disabled — issue tokens directly
    refresh = RefreshToken.for_user(authenticated_user)

    log_event(
        accion="LOGIN_SUCCESS",
        actor=authenticated_user,
        ip=ip,
        entidad_tipo="User",
        entidad_id=authenticated_user.pk,
        entidad_nombre=authenticated_user.email,
    )

    return {
        "mfa_required": False,
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

    log_event(
        accion="LOGOUT",
        actor=user,
        ip=ip,
        entidad_tipo="User",
        entidad_id=user.pk,
        entidad_nombre=user.email,
    )


# ---------------------------------------------------------------------------
# Password reset (unauthenticated flow — 6-digit code)
# ---------------------------------------------------------------------------


class LdapUserError(Exception):
    """Raised when a password reset is requested for an LDAP-managed user."""


def request_password_reset(*, email: str) -> None:
    """
    Generate a 6-digit reset code and email it to the user.
    ALWAYS returns silently — never reveals whether the email exists.

    Raises:
        LdapUserError — if the user authenticates via Active Directory
                        (password is managed by AD, cannot be reset here).
    """
    from apps.config.email import send_mail as db_send_mail
    from apps.users.models import User

    try:
        user = User.objects.select_related("profile").get(email=email, is_active=True)
    except User.DoesNotExist:
        return  # Silent — anti-enumeration

    # LDAP users must reset their password through Active Directory
    if hasattr(user, "profile") and user.profile.auth_source == "LDAP":
        raise LdapUserError(
            "Tu contraseña es administrada por Active Directory. "
            "Contacta al área de TI para restablecerla."
        )

    code = f"{secrets.randbelow(1_000_000):06d}"
    cache_key = f"{_RESET_CACHE_PREFIX}:{user.pk}"
    cache.set(cache_key, {"code": code, "used": False}, timeout=_RESET_CODE_TTL)

    frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:3000")

    db_send_mail(
        subject="Código de recuperación de contraseña",
        message=(
            f"Tu código de recuperación es: {code}\n\n"
            f"Este código expira en 30 minutos y es de un solo uso.\n\n"
            f"Si no solicitaste este código, ignora este mensaje.\n\n"
            f"{frontend_url}"
        ),
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

    log_event(
        accion="PASSWORD_RESET",
        actor=user,
        entidad_tipo="User",
        entidad_id=user.pk,
        entidad_nombre=user.email,
        detalle={"method": "code"},
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

    log_event(
        accion="PASSWORD_CHANGED",
        actor=user,
        ip=ip,
        entidad_tipo="User",
        entidad_id=user.pk,
        entidad_nombre=user.email,
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


# ---------------------------------------------------------------------------
# MFA helpers
# ---------------------------------------------------------------------------


def _is_mfa_required_for_user(user) -> bool:
    """Check if MFA is required for this specific user.

    Logic:
    1. If global SystemSetting MFA_ENABLED = 'False' → skip MFA for everyone.
    2. Otherwise → use the per-user UserProfile.mfa_enabled flag.
       (LDAP users default True; LOCAL users default False; admin can override.)
    """
    try:
        from apps.config.models import SystemSetting  # noqa: PLC0415

        obj = SystemSetting.objects.filter(clave="MFA_ENABLED").only("valor").first()
        if obj is not None and obj.valor.strip().lower() == "false":
            return False
        # obj is None or valor != 'false' → global is on → check per-user
    except Exception:
        return True  # fail-secure: if DB is down, stay on

    try:
        return bool(user.profile.mfa_enabled)
    except Exception:
        return True  # fail-secure: no profile → require MFA


def _generate_otp() -> str:
    """Cryptographically secure 6-digit OTP (uses secrets, not random)."""
    return f"{secrets.randbelow(1_000_000):06d}"


def _hash_otp(otp: str, salt: str) -> str:
    """SHA-256 of 'otp:salt'. Timing-safe comparison done by caller."""
    return hashlib.sha256(f"{otp}:{salt}".encode("utf-8")).hexdigest()


def _mask_email(email: str) -> str:
    """Partially mask an email: a***z@domain.com (anti-enumeration display)."""
    local, _, domain = email.partition("@")
    if len(local) <= 2:
        masked = local[0] + "***"
    else:
        masked = local[0] + "***" + local[-1]
    return f"{masked}@{domain}"


def create_mfa_challenge(user: "User", ip: str, user_agent: str):
    """
    Invalidate prior open challenges, create a new one, queue the OTP email.
    The OTP is never stored — only its SHA-256(otp:salt) hash.
    """
    from datetime import timedelta  # noqa: PLC0415

    from apps.users.models import MFAChallenge  # noqa: PLC0415
    from django.utils import timezone  # noqa: PLC0415

    # Housekeeping: remove old unused challenges for this user
    MFAChallenge.objects.filter(user=user, is_used=False).delete()

    otp = _generate_otp()
    salt = _uuid.uuid4()

    challenge = MFAChallenge.objects.create(
        user=user,
        otp_hash=_hash_otp(otp, str(salt)),
        salt=salt,
        expires_at=timezone.now() + timedelta(seconds=MFAChallenge.TTL_SECONDS),
        ip_address=ip[:45] if ip else None,
        user_agent=user_agent[:500],
    )

    from apps.notifications.tasks import send_mfa_email  # noqa: PLC0415

    send_mfa_email.delay(user.pk, str(challenge.token), otp, ip)

    log_event(
        accion="MFA_SENT",
        actor=user,
        ip=ip,
        entidad_tipo="MFAChallenge",
        entidad_id=challenge.pk,
        entidad_nombre=user.email,
    )
    return challenge


def verify_mfa(*, mfa_token: str, otp_code: str, ip: str, user_agent: str = "") -> dict:
    """
    Validate an OTP code against the stored challenge and issue JWT tokens.

    Security properties:
    - Timing-safe comparison via secrets.compare_digest
    - Locked out after MAX_ATTEMPTS wrong codes (challenge deleted)
    - Challenge deleted on expiry or success (one-time use enforced)
    - Audit-logged for every outcome
    """
    from apps.users.models import MFAChallenge  # noqa: PLC0415
    from django.utils import timezone  # noqa: PLC0415
    from rest_framework_simplejwt.tokens import RefreshToken  # noqa: PLC0415

    _GENERIC = "Código incorrecto o expirado."

    try:
        challenge = MFAChallenge.objects.select_related("user").get(
            token=mfa_token, is_used=False
        )
    except MFAChallenge.DoesNotExist:
        log_event(accion="MFA_FAILED", ip=ip, detalle={"reason": "token_not_found"})
        raise MFAError(_GENERIC)

    user = challenge.user

    # Expiry check
    if timezone.now() > challenge.expires_at:
        challenge.delete()
        log_event(accion="MFA_EXPIRED", actor=user, ip=ip, entidad_tipo="User", entidad_id=user.pk, entidad_nombre=user.email)
        raise MFAError("El código ha expirado. Por favor inicie sesión de nuevo.")

    # Lockout check (before processing the attempt)
    if challenge.attempts >= MFAChallenge.MAX_ATTEMPTS:
        challenge.delete()
        log_event(accion="MFA_LOCKED", actor=user, ip=ip, entidad_tipo="User", entidad_id=user.pk, entidad_nombre=user.email)
        raise MFAError("Demasiados intentos fallidos. Por favor inicie sesión de nuevo.")

    # Timing-safe OTP comparison
    expected = _hash_otp(otp_code.strip(), str(challenge.salt))
    if not secrets.compare_digest(challenge.otp_hash, expected):
        challenge.attempts += 1
        challenge.save(update_fields=["attempts"])
        remaining = MFAChallenge.MAX_ATTEMPTS - challenge.attempts
        log_event(
            accion="MFA_FAILED",
            actor=user,
            ip=ip,
            entidad_tipo="User",
            entidad_id=user.pk,
            entidad_nombre=user.email,
            detalle={"attempts": challenge.attempts, "remaining": remaining},
        )
        if remaining <= 0:
            challenge.delete()
            raise MFAError("Demasiados intentos fallidos. Por favor inicie sesión de nuevo.")
        word = "intento restante" if remaining == 1 else "intentos restantes"
        raise MFAError(f"Código incorrecto. {remaining} {word}.")

    # SUCCESS — mark used and issue tokens
    challenge.is_used = True
    challenge.save(update_fields=["is_used"])

    refresh = RefreshToken.for_user(user)

    log_event(
        accion="LOGIN_SUCCESS",
        actor=user,
        ip=ip,
        entidad_tipo="User",
        entidad_id=user.pk,
        entidad_nombre=user.email,
        detalle={"method": "mfa_email"},
    )

    return {
        "mfa_required": False,
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "user": user,
    }


def resend_mfa(*, mfa_token: str, ip: str) -> None:
    """
    Generate a new OTP for an existing challenge.
    Rate-limited: max MAX_RESENDS per challenge, 60-second cooldown between resends.
    """
    import uuid as _uuid2  # noqa: PLC0415
    from datetime import timedelta  # noqa: PLC0415

    from apps.users.models import MFAChallenge  # noqa: PLC0415
    from django.utils import timezone  # noqa: PLC0415

    try:
        challenge = MFAChallenge.objects.select_related("user").get(
            token=mfa_token, is_used=False
        )
    except MFAChallenge.DoesNotExist:
        raise MFAError("Sesión de verificación inválida.")

    if timezone.now() > challenge.expires_at:
        challenge.delete()
        raise MFAError("La sesión ha expirado. Por favor inicie sesión de nuevo.")

    if challenge.attempts >= MFAChallenge.MAX_ATTEMPTS:
        challenge.delete()
        raise MFAError("Cuenta bloqueada. Por favor inicie sesión de nuevo.")

    if challenge.resend_count >= MFAChallenge.MAX_RESENDS:
        raise MFAError("Límite de reenvíos alcanzado. Por favor inicie sesión de nuevo.")

    if challenge.last_resend_at:
        elapsed = (timezone.now() - challenge.last_resend_at).total_seconds()
        if elapsed < MFAChallenge.RESEND_COOLDOWN_SECONDS:
            wait = int(MFAChallenge.RESEND_COOLDOWN_SECONDS - elapsed)
            raise MFAError(f"Espere {wait} segundo{'s' if wait != 1 else ''} antes de solicitar un nuevo código.")

    otp = _generate_otp()
    salt = _uuid2.uuid4()

    challenge.otp_hash = _hash_otp(otp, str(salt))
    challenge.salt = salt
    challenge.attempts = 0  # reset attempt counter on resend
    challenge.resend_count += 1
    challenge.last_resend_at = timezone.now()
    challenge.expires_at = timezone.now() + timedelta(seconds=MFAChallenge.TTL_SECONDS)
    challenge.save(update_fields=[
        "otp_hash", "salt", "attempts", "resend_count", "last_resend_at", "expires_at",
    ])

    from apps.notifications.tasks import send_mfa_email  # noqa: PLC0415

    send_mfa_email.delay(challenge.user.pk, str(challenge.token), otp, ip)

    log_event(
        accion="MFA_RESENT",
        actor=challenge.user,
        ip=ip,
        entidad_tipo="MFAChallenge",
        entidad_id=challenge.pk,
        entidad_nombre=challenge.user.email,
    )


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
