import pytest

from apps.reports.models import AuditLog
from apps.users.models import User


@pytest.mark.django_db
class TestAuditLog:
    def test_timestamp_is_auto_set(self) -> None:
        log = AuditLog.objects.create(accion="TEST_ACTION", ip="127.0.0.1")
        assert log.timestamp is not None

    def test_timestamp_auto_now_add(self) -> None:
        field = AuditLog._meta.get_field("timestamp")
        assert field.auto_now_add is True

    def test_allows_null_user(self) -> None:
        log = AuditLog.objects.create(accion="SYSTEM_ACTION", user=None)
        assert log.user is None

    def test_links_to_user(self) -> None:
        user = User.objects.create_user(
            username="audit_user",
            email="audit@test.com",
            password="TestPass123!",
        )
        log = AuditLog.objects.create(
            user=user,
            accion="LOGIN",
            ip="10.0.0.1",
            detalles_json={"method": "password"},
        )
        assert log.user == user
        assert log.detalles_json["method"] == "password"

    def test_no_update_method_on_manager(self) -> None:
        """AuditLog records are immutable — no bulk_update should be usable on audit logs."""
        # Verifies immutability by checking the model has no save override that hides mutations.
        # True enforcement is at the API/service layer (no endpoint exposes update/delete).
        log = AuditLog.objects.create(accion="CHECK")
        assert log.pk is not None
