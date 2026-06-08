"""
T09b — Group model + CRUD API tests

Covers:
  - Group model constraints (nombre unique, activo default, created_at)
  - UserProfile.grupo FK (nullable, SET_NULL on delete)
  - Group service layer
  - GroupViewSet endpoints (CRUD + members sub-resource)
  - Role-based access: only ADMIN can manage groups
"""
import pytest
from django.core.exceptions import ValidationError
from rest_framework import status

from apps.users.models import Group, User, UserProfile
from apps.users import services as group_service
from apps.users.tests.factories import AdminUserFactory, TrainerUserFactory, UserFactory


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def make_group(**kwargs) -> Group:
    defaults = {"nombre": "TI", "descripcion": "Equipo de TI"}
    defaults.update(kwargs)
    return Group.objects.create(**defaults)


# ---------------------------------------------------------------------------
# Model tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestGroupModel:
    def test_create_with_required_fields(self) -> None:
        g = Group.objects.create(nombre="Finanzas")
        assert g.pk is not None
        assert g.nombre == "Finanzas"

    def test_activo_default_true(self) -> None:
        g = Group.objects.create(nombre="RR.HH.")
        assert g.activo is True

    def test_descripcion_optional(self) -> None:
        g = Group.objects.create(nombre="Operaciones")
        assert g.descripcion == ""

    def test_created_at_auto_set(self) -> None:
        g = Group.objects.create(nombre="Marketing")
        assert g.created_at is not None

    def test_nombre_unique(self) -> None:
        Group.objects.create(nombre="Ventas")
        with pytest.raises(Exception):  # IntegrityError
            Group.objects.create(nombre="Ventas")

    def test_userprofile_grupo_nullable(self) -> None:
        user = UserFactory()
        profile = user.profile  # auto-created by signal
        assert profile.grupo is None

    def test_userprofile_grupo_fk(self) -> None:
        group = make_group()
        user = UserFactory()
        profile = user.profile
        profile.grupo = group
        profile.save()
        profile.refresh_from_db()
        assert profile.grupo == group

    def test_group_set_null_on_delete(self) -> None:
        """Deleting a group does NOT delete the UserProfile — just NULLs the FK."""
        group = make_group()
        user = UserFactory()
        profile = user.profile
        profile.grupo = group
        profile.save()
        group.delete()
        profile.refresh_from_db()
        assert profile.grupo is None


# ---------------------------------------------------------------------------
# Service tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestGroupService:
    def test_create_group(self) -> None:
        g = group_service.create_group(nombre="Contabilidad", descripcion="Área contable")
        assert g.pk is not None
        assert g.nombre == "Contabilidad"

    def test_update_group(self) -> None:
        g = make_group()
        updated = group_service.update_group(g, nombre="TI Avanzado", activo=False)
        assert updated.nombre == "TI Avanzado"
        assert updated.activo is False

    def test_delete_empty_group(self) -> None:
        g = make_group(nombre="Temporal")
        group_id = g.pk
        group_service.delete_group(g)
        assert not Group.objects.filter(pk=group_id).exists()

    def test_delete_group_with_members_raises(self) -> None:
        g = make_group()
        user = UserFactory()
        user.profile.grupo = g
        user.profile.save()
        with pytest.raises(ValidationError):
            group_service.delete_group(g)

    def test_add_members(self) -> None:
        g = make_group()
        u1, u2 = UserFactory(), UserFactory()
        profiles = group_service.add_members(g, [u1.pk, u2.pk])
        assert len(profiles) == 2
        assert all(p.grupo == g for p in profiles)

    def test_remove_member(self) -> None:
        g = make_group()
        user = UserFactory()
        user.profile.grupo = g
        user.profile.save()
        group_service.remove_member(g, user.pk)
        user.profile.refresh_from_db()
        assert user.profile.grupo is None

    def test_remove_nonexistent_member_raises(self) -> None:
        g = make_group()
        user = UserFactory()  # not in this group
        with pytest.raises(ValidationError):
            group_service.remove_member(g, user.pk)


# ---------------------------------------------------------------------------
# API endpoint tests
# ---------------------------------------------------------------------------


GROUPS_URL = "/api/v1/groups/"


def groups_url(pk=None, suffix=""):
    if pk:
        return f"{GROUPS_URL}{pk}/{suffix}"
    return GROUPS_URL


@pytest.mark.django_db
class TestGroupAPI:
    # --- List ---

    def test_list_groups_requires_admin(self, api_client):
        resp = api_client.get(GROUPS_URL)
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_trainer_gets_403_on_list(self, api_client, trainer_user):
        api_client.force_authenticate(user=trainer_user)
        resp = api_client.get(GROUPS_URL)
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_regular_user_gets_403_on_list(self, api_client, regular_user):
        api_client.force_authenticate(user=regular_user)
        resp = api_client.get(GROUPS_URL)
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_list_returns_groups_with_member_count(self, api_client, admin_user):
        g = make_group()
        user = UserFactory()
        user.profile.grupo = g
        user.profile.save()
        api_client.force_authenticate(user=admin_user)
        resp = api_client.get(GROUPS_URL)
        assert resp.status_code == status.HTTP_200_OK
        results = resp.data.get("results", resp.data)
        group_data = next(r for r in results if r["id"] == g.pk)
        assert group_data["member_count"] == 1

    # --- Create ---

    def test_create_group(self, api_client, admin_user):
        api_client.force_authenticate(user=admin_user)
        resp = api_client.post(GROUPS_URL, {"nombre": "Sistemas", "descripcion": "Área TI"})
        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.data["nombre"] == "Sistemas"

    def test_create_group_duplicate_nombre_returns_400(self, api_client, admin_user):
        make_group(nombre="Duplicado")
        api_client.force_authenticate(user=admin_user)
        resp = api_client.post(GROUPS_URL, {"nombre": "Duplicado"})
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    # --- Update ---

    def test_patch_group(self, api_client, admin_user):
        g = make_group(nombre="Original")
        api_client.force_authenticate(user=admin_user)
        resp = api_client.patch(groups_url(g.pk), {"nombre": "Actualizado"})
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["nombre"] == "Actualizado"

    # --- Delete ---

    def test_delete_empty_group(self, api_client, admin_user):
        g = make_group(nombre="Borrable")
        api_client.force_authenticate(user=admin_user)
        resp = api_client.delete(groups_url(g.pk))
        assert resp.status_code == status.HTTP_204_NO_CONTENT

    def test_delete_group_with_members_returns_400(self, api_client, admin_user):
        g = make_group(nombre="ConMiembros")
        user = UserFactory()
        user.profile.grupo = g
        user.profile.save()
        api_client.force_authenticate(user=admin_user)
        resp = api_client.delete(groups_url(g.pk))
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    # --- Members sub-resource ---

    def test_list_members(self, api_client, admin_user):
        g = make_group()
        user = UserFactory()
        user.profile.grupo = g
        user.profile.save()
        api_client.force_authenticate(user=admin_user)
        resp = api_client.get(groups_url(g.pk, "members/"))
        assert resp.status_code == status.HTTP_200_OK
        results = resp.data.get("results", resp.data)
        assert len(results) == 1

    def test_add_members(self, api_client, admin_user):
        g = make_group()
        u1, u2 = UserFactory(), UserFactory()
        api_client.force_authenticate(user=admin_user)
        resp = api_client.post(groups_url(g.pk, "members/"), {"user_ids": [u1.pk, u2.pk]})
        assert resp.status_code == status.HTTP_200_OK
        assert g.members.count() == 2

    def test_remove_member(self, api_client, admin_user):
        g = make_group()
        user = UserFactory()
        user.profile.grupo = g
        user.profile.save()
        api_client.force_authenticate(user=admin_user)
        resp = api_client.delete(groups_url(g.pk, f"members/{user.pk}/"))
        assert resp.status_code == status.HTTP_204_NO_CONTENT
        user.profile.refresh_from_db()
        assert user.profile.grupo is None

    def test_remove_nonexistent_member_returns_400(self, api_client, admin_user):
        g = make_group()
        user = UserFactory()  # not in this group
        api_client.force_authenticate(user=admin_user)
        resp = api_client.delete(groups_url(g.pk, f"members/{user.pk}/"))
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
