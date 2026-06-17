"""
T10 — User management service tests

Tests for create_user, update_user, change_role, deactivate_user.
All service functions that write to the DB or send email are covered here.
"""
import pytest
from django.core import mail

from apps.reports.models import AuditLog
from apps.users.models import Area, User, UserProfile
from apps.users import services
from apps.users.tests.factories import AdminUserFactory, AreaFactory, UserFactory


# ---------------------------------------------------------------------------
# create_user
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestCreateUser:
    def _create(self, **kwargs):
        admin = AdminUserFactory()
        defaults = dict(
            email="new@empresa.com",
            first_name="Ana",
            last_name="Torres",
            role=User.Role.USUARIO,
            admin_user=admin,
            ip="127.0.0.1",
        )
        defaults.update(kwargs)
        return services.create_user(**defaults)

    def test_creates_user(self) -> None:
        user = self._create()
        assert user.pk is not None
        assert user.email == "new@empresa.com"

    def test_user_must_change_password(self) -> None:
        user = self._create()
        assert user.must_change_password is True

    def test_user_role_set(self) -> None:
        user = self._create(role=User.Role.TRAINER)
        assert user.role == User.Role.TRAINER

    def test_profile_created_with_area_cargo(self) -> None:
        AreaFactory(nombre="TI")
        user = self._create(area="TI", cargo="Desarrollador")
        profile = user.profile
        assert profile.area is not None
        assert profile.area.nombre == "TI"
        assert profile.cargo == "Desarrollador"

    def test_sends_welcome_email(self) -> None:
        self._create()
        assert len(mail.outbox) == 1
        msg = mail.outbox[0]
        assert "new@empresa.com" in msg.to
        assert "contraseña" in msg.body.lower()

    def test_audit_log_user_created(self) -> None:
        self._create()
        assert AuditLog.objects.filter(accion="USER_CREATED").exists()

    def test_duplicate_email_raises(self) -> None:
        from django.db import IntegrityError
        self._create()
        with pytest.raises((IntegrityError, Exception)):
            self._create()


# ---------------------------------------------------------------------------
# update_user
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestUpdateUser:
    def test_updates_name(self) -> None:
        user = UserFactory(first_name="Juan", last_name="García")
        updated = services.update_user(user, first_name="Pedro", last_name="López")
        assert updated.first_name == "Pedro"
        assert updated.last_name == "López"

    def test_updates_area_cargo(self) -> None:
        AreaFactory(nombre="Finanzas")
        user = UserFactory()
        services.update_user(user, area="Finanzas", cargo="Contador")
        user.profile.refresh_from_db()
        assert user.profile.area is not None
        assert user.profile.area.nombre == "Finanzas"
        assert user.profile.cargo == "Contador"

    def test_updates_grupo(self) -> None:
        from apps.users.models import Group
        g = Group.objects.create(nombre="TestGroup")
        user = UserFactory()
        services.update_user(user, grupo_id=g.pk)
        user.profile.refresh_from_db()
        assert user.profile.grupo_id == g.pk

    def test_partial_update_only_provided_fields(self) -> None:
        marketing = Area.objects.create(nombre="Marketing")
        user = UserFactory(first_name="Original")
        user.profile.area = marketing
        user.profile.save()
        services.update_user(user, cargo="Gerente")
        user.refresh_from_db()
        user.profile.refresh_from_db()
        assert user.first_name == "Original"  # unchanged
        assert user.profile.area.nombre == "Marketing"  # unchanged
        assert user.profile.cargo == "Gerente"


# ---------------------------------------------------------------------------
# change_role
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestChangeRole:
    def test_changes_role(self) -> None:
        user = UserFactory(role=User.Role.USUARIO)
        admin = AdminUserFactory()
        updated = services.change_role(user, new_role=User.Role.TRAINER, admin_user=admin, ip="10.0.0.1")
        assert updated.role == User.Role.TRAINER

    def test_audit_log_created(self) -> None:
        user = UserFactory()
        admin = AdminUserFactory()
        services.change_role(user, new_role=User.Role.TRAINER, admin_user=admin, ip="10.0.0.1")
        log = AuditLog.objects.filter(accion="ROLE_CHANGED").first()
        assert log is not None
        assert log.user == admin
        assert log.detalles_json["target_user_id"] == user.pk

    def test_same_role_is_idempotent(self) -> None:
        user = UserFactory(role=User.Role.USUARIO)
        admin = AdminUserFactory()
        services.change_role(user, new_role=User.Role.USUARIO, admin_user=admin, ip="10.0.0.1")
        user.refresh_from_db()
        assert user.role == User.Role.USUARIO


# ---------------------------------------------------------------------------
# deactivate_user
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestDeactivateUser:
    def test_sets_is_active_false(self) -> None:
        user = UserFactory(is_active=True)
        admin = AdminUserFactory()
        services.deactivate_user(user, admin_user=admin, ip="10.0.0.1")
        user.refresh_from_db()
        assert user.is_active is False

    def test_audit_log_created(self) -> None:
        user = UserFactory()
        admin = AdminUserFactory()
        services.deactivate_user(user, admin_user=admin, ip="10.0.0.1")
        log = AuditLog.objects.filter(accion="USER_DEACTIVATED").first()
        assert log is not None
        assert log.user == admin
        assert log.detalles_json["target_user_id"] == user.pk

    def test_blacklists_outstanding_tokens(self) -> None:
        """After deactivation, all outstanding JWT tokens must be blacklisted."""
        from rest_framework_simplejwt.tokens import RefreshToken
        from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

        user = UserFactory()
        admin = AdminUserFactory()
        # Issue a token so there is an OutstandingToken record
        RefreshToken.for_user(user)
        outstanding_count = OutstandingToken.objects.filter(user=user).count()
        assert outstanding_count >= 1

        services.deactivate_user(user, admin_user=admin, ip="10.0.0.1")

        blacklisted_count = BlacklistedToken.objects.filter(
            token__user=user
        ).count()
        assert blacklisted_count == outstanding_count
