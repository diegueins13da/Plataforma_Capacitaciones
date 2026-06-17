"""
T12b — SystemSetting and Area API tests
"""
import pytest
from rest_framework import status

from apps.config.models import SystemSetting
from apps.users.models import Area
from apps.users.tests.factories import AdminUserFactory, AreaFactory, UserFactory

CONFIG_URL = "/api/v1/config/"
AREAS_URL = "/api/v1/areas/"


# ---------------------------------------------------------------------------
# SystemSetting model
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestSystemSettingModel:
    def test_get_value_boolean_true(self) -> None:
        s = SystemSetting(clave="TEST", valor="true", tipo_dato="BOOLEAN", categoria="SMTP")
        assert s.get_value() is True

    def test_get_value_boolean_false(self) -> None:
        s = SystemSetting(clave="TEST", valor="false", tipo_dato="BOOLEAN", categoria="SMTP")
        assert s.get_value() is False

    def test_get_value_integer(self) -> None:
        s = SystemSetting(clave="TEST", valor="587", tipo_dato="INTEGER", categoria="SMTP")
        assert s.get_value() == 587

    def test_get_value_string(self) -> None:
        s = SystemSetting(clave="TEST", valor="smtp.example.com", tipo_dato="STRING", categoria="SMTP")
        assert s.get_value() == "smtp.example.com"

    def test_default_settings_created_by_migration(self) -> None:
        assert SystemSetting.objects.filter(clave="EMAIL_HOST").exists()
        assert SystemSetting.objects.filter(clave="COMPANY_NAME").exists()
        assert SystemSetting.objects.filter(clave="PASSWORD_MIN_LENGTH").exists()
        assert SystemSetting.objects.filter(clave="NOTIFY_NEW_COURSE").exists()


# ---------------------------------------------------------------------------
# Config API — access control
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestConfigAPIAccess:
    def test_unauthenticated_gets_401(self, api_client) -> None:
        resp = api_client.get(CONFIG_URL)
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_regular_user_gets_403(self, api_client) -> None:
        user = UserFactory()
        api_client.force_authenticate(user=user)
        resp = api_client.get(CONFIG_URL)
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_admin_can_list(self, api_client) -> None:
        admin = AdminUserFactory()
        api_client.force_authenticate(user=admin)
        resp = api_client.get(CONFIG_URL)
        assert resp.status_code == status.HTTP_200_OK


# ---------------------------------------------------------------------------
# Config API — list and update
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestConfigAPI:
    def test_list_returns_grouped_by_category(self, api_client) -> None:
        admin = AdminUserFactory()
        api_client.force_authenticate(user=admin)
        resp = api_client.get(CONFIG_URL)
        assert resp.status_code == status.HTTP_200_OK
        assert "SMTP" in resp.data
        assert "BRANDING" in resp.data
        assert "SEGURIDAD" in resp.data
        assert "NOTIF" in resp.data

    def test_sensitive_fields_masked_in_list(self, api_client) -> None:
        SystemSetting.objects.filter(clave="EMAIL_HOST_PASSWORD").update(valor="secret")
        admin = AdminUserFactory()
        api_client.force_authenticate(user=admin)
        resp = api_client.get(CONFIG_URL)
        smtp_settings = resp.data.get("SMTP", [])
        pwd_setting = next((s for s in smtp_settings if s["clave"] == "EMAIL_HOST_PASSWORD"), None)
        assert pwd_setting is not None
        assert pwd_setting["valor_display"] == "••••••"

    def test_retrieve_single_setting(self, api_client) -> None:
        admin = AdminUserFactory()
        api_client.force_authenticate(user=admin)
        resp = api_client.get(f"{CONFIG_URL}COMPANY_NAME/")
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["clave"] == "COMPANY_NAME"

    def test_patch_updates_value(self, api_client) -> None:
        admin = AdminUserFactory()
        api_client.force_authenticate(user=admin)
        resp = api_client.patch(
            f"{CONFIG_URL}COMPANY_NAME/",
            {"valor": "Acme Corp"},
            format="json",
        )
        assert resp.status_code == status.HTTP_200_OK
        assert SystemSetting.objects.get(clave="COMPANY_NAME").valor == "Acme Corp"

    def test_patch_records_updated_by(self, api_client) -> None:
        admin = AdminUserFactory()
        api_client.force_authenticate(user=admin)
        api_client.patch(f"{CONFIG_URL}COMPANY_NAME/", {"valor": "Corp"}, format="json")
        setting = SystemSetting.objects.get(clave="COMPANY_NAME")
        assert setting.updated_by_id == admin.pk

    def test_cannot_change_clave_via_patch(self, api_client) -> None:
        admin = AdminUserFactory()
        api_client.force_authenticate(user=admin)
        resp = api_client.patch(
            f"{CONFIG_URL}COMPANY_NAME/",
            {"clave": "NEW_KEY", "valor": "Corp"},
            format="json",
        )
        assert resp.status_code == status.HTTP_200_OK
        assert not SystemSetting.objects.filter(clave="NEW_KEY").exists()

    def test_patch_non_existent_key_returns_404(self, api_client) -> None:
        admin = AdminUserFactory()
        api_client.force_authenticate(user=admin)
        resp = api_client.patch(f"{CONFIG_URL}DOES_NOT_EXIST/", {"valor": "x"}, format="json")
        assert resp.status_code == status.HTTP_404_NOT_FOUND


# ---------------------------------------------------------------------------
# Area API
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestAreaAPIAccess:
    def test_unauthenticated_gets_401(self, api_client) -> None:
        resp = api_client.get(AREAS_URL)
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_any_authenticated_user_can_list(self, api_client) -> None:
        user = UserFactory()
        api_client.force_authenticate(user=user)
        resp = api_client.get(AREAS_URL)
        assert resp.status_code == status.HTTP_200_OK

    def test_regular_user_cannot_create(self, api_client) -> None:
        user = UserFactory()
        api_client.force_authenticate(user=user)
        resp = api_client.post(AREAS_URL, {"nombre": "TI"}, format="json")
        assert resp.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
class TestAreaAPICRUD:
    def test_admin_can_create_area(self, api_client) -> None:
        admin = AdminUserFactory()
        api_client.force_authenticate(user=admin)
        resp = api_client.post(AREAS_URL, {"nombre": "Riesgos", "descripcion": "Área de riesgos"})
        assert resp.status_code == status.HTTP_201_CREATED
        assert Area.objects.filter(nombre="Riesgos").exists()

    def test_create_area_returns_user_count(self, api_client) -> None:
        admin = AdminUserFactory()
        api_client.force_authenticate(user=admin)
        resp = api_client.post(AREAS_URL, {"nombre": "TI"})
        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.data["user_count"] == 0

    def test_list_areas(self, api_client) -> None:
        AreaFactory.create_batch(3)
        admin = AdminUserFactory()
        api_client.force_authenticate(user=admin)
        resp = api_client.get(AREAS_URL)
        assert resp.status_code == status.HTTP_200_OK
        results = resp.data.get("results", resp.data)
        assert len(results) >= 3

    def test_admin_can_update_area(self, api_client) -> None:
        area = AreaFactory(nombre="Viejo")
        admin = AdminUserFactory()
        api_client.force_authenticate(user=admin)
        resp = api_client.patch(f"{AREAS_URL}{area.pk}/", {"nombre": "Nuevo"})
        assert resp.status_code == status.HTTP_200_OK
        assert Area.objects.get(pk=area.pk).nombre == "Nuevo"

    def test_cannot_delete_area_with_users(self, api_client) -> None:
        from apps.users.tests.factories import UserFactory as UF
        area = AreaFactory(nombre="Asignada")
        user = UF()
        user.profile.area = area
        user.profile.save()
        admin = AdminUserFactory()
        api_client.force_authenticate(user=admin)
        resp = api_client.delete(f"{AREAS_URL}{area.pk}/")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert Area.objects.filter(pk=area.pk).exists()

    def test_can_delete_empty_area(self, api_client) -> None:
        area = AreaFactory()
        admin = AdminUserFactory()
        api_client.force_authenticate(user=admin)
        resp = api_client.delete(f"{AREAS_URL}{area.pk}/")
        assert resp.status_code == status.HTTP_204_NO_CONTENT
        assert not Area.objects.filter(pk=area.pk).exists()

    def test_duplicate_nombre_returns_400(self, api_client) -> None:
        AreaFactory(nombre="TI")
        admin = AdminUserFactory()
        api_client.force_authenticate(user=admin)
        resp = api_client.post(AREAS_URL, {"nombre": "TI"})
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
