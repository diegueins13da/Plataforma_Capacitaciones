"""
User app service layer — Group management.

All business logic lives here; views only handle HTTP serialisation.
"""
from django.core.exceptions import ValidationError

from .models import Group, UserProfile


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
