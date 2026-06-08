"""
User app service layer — Group management + User CRUD.

All business logic lives here; views only handle HTTP serialisation.
"""
from __future__ import annotations

import secrets
import string
from typing import TYPE_CHECKING

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.mail import send_mail

from apps.reports.models import AuditLog

from .models import Group, User, UserProfile

if TYPE_CHECKING:
    pass


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _generate_temp_password() -> str:
    """
    Generate a 12-character password guaranteed to satisfy the policy:
    uppercase, lowercase, digit, special char.
    """
    special = "!@#$%^&*"
    pool = string.ascii_letters + string.digits + special
    pwd: list[str] = [
        secrets.choice(string.ascii_uppercase),
        secrets.choice(string.ascii_lowercase),
        secrets.choice(string.digits),
        secrets.choice(special),
    ] + [secrets.choice(pool) for _ in range(8)]
    secrets.SystemRandom().shuffle(pwd)
    return "".join(pwd)


def _blacklist_all_user_tokens(user: User) -> None:
    """Blacklist every outstanding JWT refresh token for this user."""
    try:
        from rest_framework_simplejwt.token_blacklist.models import (
            BlacklistedToken,
            OutstandingToken,
        )

        for token in OutstandingToken.objects.filter(user=user):
            BlacklistedToken.objects.get_or_create(token=token)
    except Exception:  # noqa: BLE001
        pass


def _username_from_email(email: str) -> str:
    """Derive a unique username from an email address."""
    base = email.split("@")[0][:20]
    candidate = base
    counter = 1
    while User.objects.filter(username=candidate).exists():
        candidate = f"{base}{counter}"
        counter += 1
    return candidate


# ---------------------------------------------------------------------------
# User CRUD
# ---------------------------------------------------------------------------


def create_user(
    *,
    email: str,
    first_name: str,
    last_name: str,
    role: str = User.Role.USUARIO,
    area: str = "",
    cargo: str = "",
    grupo_id: int | None = None,
    admin_user: User,
    ip: str,
) -> User:
    """
    Create a new user with a temporary password and send a welcome email.

    * The user is created with must_change_password=True.
    * An email with the temporary password is sent immediately.
    * An AuditLog entry is created by the admin.
    """
    temp_password = _generate_temp_password()
    username = _username_from_email(email)

    user = User.objects.create_user(
        username=username,
        email=email,
        first_name=first_name,
        last_name=last_name,
        password=temp_password,
        role=role,
        must_change_password=True,
    )

    # Update the auto-created profile (signal created it with blank fields)
    profile = user.profile
    profile.area = area
    profile.cargo = cargo
    if grupo_id is not None:
        profile.grupo_id = grupo_id
    profile.save()

    # Send welcome email
    frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:3000")
    from_email = settings.DEFAULT_FROM_EMAIL or getattr(settings, "EMAIL_HOST_USER", "")
    send_mail(
        subject="Bienvenido al Sistema de Capacitaciones",
        message=(
            f"Hola {first_name},\n\n"
            f"Se ha creado tu cuenta en el sistema de capacitaciones.\n\n"
            f"Correo: {email}\n"
            f"Contraseña temporal: {temp_password}\n\n"
            f"Por seguridad, deberás cambiar tu contraseña al iniciar sesión por primera vez.\n\n"
            f"Ingresa aquí: {frontend_url}/login\n\n"
            f"Si no esperabas este mensaje, ignóralo."
        ),
        from_email=from_email,
        recipient_list=[email],
        fail_silently=True,
    )

    AuditLog.objects.create(
        user=admin_user,
        accion="USER_CREATED",
        ip=ip,
        detalles_json={"target_user_id": user.pk, "email": email, "role": role},
    )

    return user


def update_user(
    user: User,
    *,
    first_name: str | None = None,
    last_name: str | None = None,
    area: str | None = None,
    cargo: str | None = None,
    grupo_id: int | None = None,
) -> User:
    """Update allowed user and profile fields (partial update)."""
    user_changed = False
    if first_name is not None:
        user.first_name = first_name
        user_changed = True
    if last_name is not None:
        user.last_name = last_name
        user_changed = True
    if user_changed:
        user.save(update_fields=["first_name", "last_name"])

    profile = user.profile
    profile_changed = False
    if area is not None:
        profile.area = area
        profile_changed = True
    if cargo is not None:
        profile.cargo = cargo
        profile_changed = True
    if grupo_id is not None:
        profile.grupo_id = grupo_id
        profile_changed = True
    if profile_changed:
        profile.save()

    return user


def change_role(user: User, *, new_role: str, admin_user: User, ip: str) -> User:
    """Change a user's role and record the event in AuditLog."""
    old_role = user.role
    user.role = new_role
    user.save(update_fields=["role"])

    AuditLog.objects.create(
        user=admin_user,
        accion="ROLE_CHANGED",
        ip=ip,
        detalles_json={
            "target_user_id": user.pk,
            "old_role": old_role,
            "new_role": new_role,
        },
    )
    return user


def deactivate_user(user: User, *, admin_user: User, ip: str) -> User:
    """
    Deactivate a user account:
    1. Set is_active=False
    2. Immediately blacklist ALL outstanding refresh tokens (closes active sessions)
    3. Record in AuditLog
    """
    user.is_active = False
    user.save(update_fields=["is_active"])

    _blacklist_all_user_tokens(user)

    AuditLog.objects.create(
        user=admin_user,
        accion="USER_DEACTIVATED",
        ip=ip,
        detalles_json={"target_user_id": user.pk},
    )
    return user


# ---------------------------------------------------------------------------
# Group CRUD
# ---------------------------------------------------------------------------


def create_group(*, nombre: str, descripcion: str = "", activo: bool = True) -> Group:
    return Group.objects.create(nombre=nombre, descripcion=descripcion, activo=activo)


def update_group(group: Group, **kwargs: object) -> Group:
    for field, value in kwargs.items():
        setattr(group, field, value)
    group.save()
    return group


def delete_group(group: Group) -> None:
    """Delete a group.  Raises ValidationError if the group still has members."""
    if group.members.exists():
        raise ValidationError(
            {"non_field_errors": ["No se puede eliminar un grupo que tiene miembros activos."]}
        )
    group.delete()


# ---------------------------------------------------------------------------
# Member management
# ---------------------------------------------------------------------------


def add_members(group: Group, user_ids: list[int]) -> list[UserProfile]:
    """Assign users to *group*.  Returns the updated UserProfile instances."""
    profiles: list[UserProfile] = []
    for uid in user_ids:
        try:
            profile = UserProfile.objects.select_related("user").get(user_id=uid)
        except UserProfile.DoesNotExist:
            raise ValidationError(
                {"user_ids": [f"No existe un usuario con id={uid}."]}
            )
        profile.grupo = group
        profile.save()
        profiles.append(profile)
    return profiles


def remove_member(group: Group, user_id: int) -> None:
    """Remove *user_id* from *group*.  Raises ValidationError if not a member."""
    try:
        profile = UserProfile.objects.get(user_id=user_id, grupo=group)
    except UserProfile.DoesNotExist:
        raise ValidationError(
            {"user_id": [f"El usuario id={user_id} no pertenece a este grupo."]}
        )
    profile.grupo = None
    profile.save()
