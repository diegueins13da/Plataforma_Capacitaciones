"""
T12 — Bulk Excel import tests

Covers:
  - bulk_import_preview service: size guard, magic bytes, column check, per-row validation
  - bulk_import_commit service: user creation, audit log, race-condition guard
  - View endpoints: /users/bulk-import/preview/ and /users/bulk-import/confirm/
"""
from __future__ import annotations

import io

import pytest
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status

from apps.reports.models import AuditLog
from apps.users import services
from apps.users.models import User
from apps.users.tests.factories import AdminUserFactory, AreaFactory, GroupFactory, UserFactory

PREVIEW_URL = "/api/v1/users/bulk-import/preview/"
CONFIRM_URL = "/api/v1/users/bulk-import/confirm/"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

HEADER = ["email", "nombre", "apellido", "rol", "area", "cargo", "grupo"]


def _make_xlsx(rows: list[list]) -> bytes:
    """Build a minimal .xlsx file from a list of rows (header first)."""
    from openpyxl import Workbook

    wb = Workbook()
    ws = wb.active
    for row in rows:
        ws.append(row)
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.read()


def _uploaded(xlsx_bytes: bytes, name: str = "users.xlsx") -> SimpleUploadedFile:
    return SimpleUploadedFile(
        name,
        xlsx_bytes,
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


def _preview_file(rows: list[list]) -> SimpleUploadedFile:
    """Convenience: build .xlsx from rows and wrap in SimpleUploadedFile."""
    return _uploaded(_make_xlsx(rows))


# ---------------------------------------------------------------------------
# Service — bulk_import_preview
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestBulkImportPreviewService:
    def test_valid_single_row_returns_valid_count(self) -> None:
        f = _preview_file([HEADER, ["nuevo@empresa.com", "Ana", "Torres", "usuario"]])
        result = services.bulk_import_preview(f)
        assert result["valid_count"] == 1
        assert result["error_count"] == 0

    def test_valid_row_data_mapped_correctly(self) -> None:
        ti = AreaFactory(nombre="TI")
        f = _preview_file([HEADER, ["ana@empresa.com", "Ana", "Torres", "capacitador", "TI", "Dev"]])
        result = services.bulk_import_preview(f)
        row = result["valid_rows"][0]
        assert row["email"] == "ana@empresa.com"
        assert row["first_name"] == "Ana"
        assert row["last_name"] == "Torres"
        assert row["role"] == User.Role.TRAINER
        assert row["area_id"] == ti.pk
        assert row["cargo"] == "Dev"
        assert row["row"] == 2

    def test_role_spanish_labels_are_mapped(self) -> None:
        rows = [
            HEADER,
            ["a@e.com", "A", "A", "administrador"],
            ["b@e.com", "B", "B", "capacitador"],
            ["c@e.com", "C", "C", "usuario"],
        ]
        result = services.bulk_import_preview(_preview_file(rows))
        roles = {r["email"]: r["role"] for r in result["valid_rows"]}
        assert roles["a@e.com"] == User.Role.ADMIN
        assert roles["b@e.com"] == User.Role.TRAINER
        assert roles["c@e.com"] == User.Role.USUARIO

    def test_group_name_resolved_to_id(self) -> None:
        grp = GroupFactory(nombre="Riesgos")
        rows = [HEADER, ["x@e.com", "X", "X", "usuario", "", "", "Riesgos"]]
        result = services.bulk_import_preview(_preview_file(rows))
        assert result["valid_rows"][0]["grupo_id"] == grp.pk

    def test_unknown_group_name_creates_error(self) -> None:
        rows = [HEADER, ["x@e.com", "X", "X", "usuario", "", "", "NoExiste"]]
        result = services.bulk_import_preview(_preview_file(rows))
        assert result["error_count"] == 1
        assert any("grupo" in e.lower() for e in result["error_rows"][0]["errors"])

    def test_duplicate_email_in_file_creates_error(self) -> None:
        rows = [
            HEADER,
            ["dup@empresa.com", "A", "A", "usuario"],
            ["dup@empresa.com", "B", "B", "usuario"],
        ]
        result = services.bulk_import_preview(_preview_file(rows))
        assert result["valid_count"] == 1
        assert result["error_count"] == 1
        assert any("duplicado" in e.lower() for e in result["error_rows"][0]["errors"])

    def test_email_already_in_db_creates_error(self) -> None:
        UserFactory(email="exists@empresa.com")
        rows = [HEADER, ["exists@empresa.com", "X", "X", "usuario"]]
        result = services.bulk_import_preview(_preview_file(rows))
        assert result["error_count"] == 1
        assert any("ya existe" in e.lower() for e in result["error_rows"][0]["errors"])

    def test_invalid_email_format_creates_error(self) -> None:
        rows = [HEADER, ["not-an-email", "X", "X", "usuario"]]
        result = services.bulk_import_preview(_preview_file(rows))
        assert result["error_count"] == 1

    def test_missing_email_creates_error(self) -> None:
        rows = [HEADER, ["", "X", "X", "usuario"]]
        result = services.bulk_import_preview(_preview_file(rows))
        assert result["error_count"] == 1
        assert any("correo" in e.lower() for e in result["error_rows"][0]["errors"])

    def test_missing_first_name_creates_error(self) -> None:
        rows = [HEADER, ["x@e.com", "", "X", "usuario"]]
        result = services.bulk_import_preview(_preview_file(rows))
        assert result["error_count"] == 1

    def test_missing_last_name_creates_error(self) -> None:
        rows = [HEADER, ["x@e.com", "X", "", "usuario"]]
        result = services.bulk_import_preview(_preview_file(rows))
        assert result["error_count"] == 1

    def test_unknown_role_creates_error(self) -> None:
        rows = [HEADER, ["x@e.com", "X", "X", "superadmin"]]
        result = services.bulk_import_preview(_preview_file(rows))
        assert result["error_count"] == 1
        assert any("rol" in e.lower() for e in result["error_rows"][0]["errors"])

    def test_missing_role_creates_error(self) -> None:
        rows = [HEADER, ["x@e.com", "X", "X", ""]]
        result = services.bulk_import_preview(_preview_file(rows))
        assert result["error_count"] == 1

    def test_empty_rows_are_skipped(self) -> None:
        rows = [HEADER, ["good@e.com", "A", "B", "usuario"], [None, None, None, None]]
        result = services.bulk_import_preview(_preview_file(rows))
        assert result["valid_count"] == 1
        assert result["error_count"] == 0

    def test_row_numbers_start_at_2(self) -> None:
        rows = [HEADER, ["bad-email", "X", "X", "usuario"]]
        result = services.bulk_import_preview(_preview_file(rows))
        assert result["error_rows"][0]["row"] == 2

    def test_file_too_large_raises(self) -> None:
        big = SimpleUploadedFile("big.xlsx", b"PK\x03\x04" + b"x" * (6 * 1024 * 1024))
        with pytest.raises(ValidationError, match="límite"):
            services.bulk_import_preview(big)

    def test_invalid_magic_bytes_raises(self) -> None:
        not_xlsx = SimpleUploadedFile("file.xlsx", b"\x89PNG\r\n\x1a\n" + b"x" * 100)
        with pytest.raises(ValidationError, match="xlsx"):
            services.bulk_import_preview(not_xlsx)

    def test_missing_required_columns_raises(self) -> None:
        # Header missing 'rol' column
        bad_header = ["email", "nombre", "apellido"]
        f = _preview_file([bad_header, ["x@e.com", "X", "X"]])
        with pytest.raises(ValidationError, match="rol"):
            services.bulk_import_preview(f)

    def test_empty_file_raises(self) -> None:
        from openpyxl import Workbook
        wb = Workbook()
        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)
        f = _uploaded(buf.read())
        with pytest.raises(ValidationError):
            services.bulk_import_preview(f)

    def test_email_normalised_to_lowercase(self) -> None:
        rows = [HEADER, ["UPPER@EMPRESA.COM", "X", "X", "usuario"]]
        result = services.bulk_import_preview(_preview_file(rows))
        assert result["valid_rows"][0]["email"] == "upper@empresa.com"

    def test_multiple_valid_and_error_rows(self) -> None:
        rows = [
            HEADER,
            ["ok1@e.com", "A", "A", "usuario"],
            ["bad-email", "B", "B", "usuario"],
            ["ok2@e.com", "C", "C", "admin"],
            ["ok1@e.com", "D", "D", "usuario"],  # duplicate
        ]
        result = services.bulk_import_preview(_preview_file(rows))
        assert result["valid_count"] == 2
        assert result["error_count"] == 2


# ---------------------------------------------------------------------------
# Service — bulk_import_commit
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestBulkImportCommitService:
    def _admin(self) -> User:
        return AdminUserFactory()

    def test_creates_users_from_valid_rows(self) -> None:
        admin = self._admin()
        rows: list[services.ValidRow] = [
            {
                "row": 2,
                "email": "new1@empresa.com",
                "first_name": "Ana",
                "last_name": "Torres",
                "role": User.Role.USUARIO,
                "area_id": None,
                "cargo": "",
                "grupo_id": None,
            },
            {
                "row": 3,
                "email": "new2@empresa.com",
                "first_name": "Luis",
                "last_name": "García",
                "role": User.Role.TRAINER,
                "area_id": None,
                "cargo": "Dev",
                "grupo_id": None,
            },
        ]
        result = services.bulk_import_commit(rows, admin_user=admin, ip="127.0.0.1")
        assert result["created"] == 2
        assert result["failed"] == 0
        assert User.objects.filter(email="new1@empresa.com").exists()
        assert User.objects.filter(email="new2@empresa.com").exists()

    def test_records_audit_log(self) -> None:
        admin = self._admin()
        rows: list[services.ValidRow] = [
            {
                "row": 2,
                "email": "audit@empresa.com",
                "first_name": "A",
                "last_name": "B",
                "role": User.Role.USUARIO,
                "area_id": None,
                "cargo": "",
                "grupo_id": None,
            },
        ]
        services.bulk_import_commit(rows, admin_user=admin, ip="10.0.0.1")
        log = AuditLog.objects.filter(accion="BULK_USER_IMPORT", user=admin).last()
        assert log is not None
        assert log.detalles_json["created"] == 1
        assert log.ip == "10.0.0.1"

    def test_race_condition_skips_existing_email(self) -> None:
        admin = self._admin()
        UserFactory(email="race@empresa.com")
        rows: list[services.ValidRow] = [
            {
                "row": 2,
                "email": "race@empresa.com",
                "first_name": "A",
                "last_name": "B",
                "role": User.Role.USUARIO,
                "area_id": None,
                "cargo": "",
                "grupo_id": None,
            },
        ]
        result = services.bulk_import_commit(rows, admin_user=admin, ip="127.0.0.1")
        assert result["created"] == 0
        assert result["failed"] == 1
        assert any("ya existe" in e.lower() for e in result["errors"][0]["errors"])

    def test_partial_success_returns_correct_counts(self) -> None:
        admin = self._admin()
        UserFactory(email="exists@empresa.com")
        rows: list[services.ValidRow] = [
            {
                "row": 2,
                "email": "good@empresa.com",
                "first_name": "G",
                "last_name": "G",
                "role": User.Role.USUARIO,
                "area_id": None,
                "cargo": "",
                "grupo_id": None,
            },
            {
                "row": 3,
                "email": "exists@empresa.com",
                "first_name": "E",
                "last_name": "E",
                "role": User.Role.USUARIO,
                "area_id": None,
                "cargo": "",
                "grupo_id": None,
            },
        ]
        result = services.bulk_import_commit(rows, admin_user=admin, ip="127.0.0.1")
        assert result["created"] == 1
        assert result["failed"] == 1


# ---------------------------------------------------------------------------
# View — /users/bulk-import/preview/
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestBulkImportPreviewView:
    def test_valid_file_returns_200_with_preview(self, api_client) -> None:
        admin = AdminUserFactory()
        api_client.force_authenticate(user=admin)
        xlsx = _make_xlsx([HEADER, ["v@e.com", "V", "V", "usuario"]])
        resp = api_client.post(
            PREVIEW_URL,
            {"file": _uploaded(xlsx)},
            format="multipart",
        )
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["valid_count"] == 1
        assert resp.data["error_count"] == 0

    def test_no_file_returns_400(self, api_client) -> None:
        admin = AdminUserFactory()
        api_client.force_authenticate(user=admin)
        resp = api_client.post(PREVIEW_URL, {}, format="multipart")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_non_xlsx_returns_400(self, api_client) -> None:
        admin = AdminUserFactory()
        api_client.force_authenticate(user=admin)
        f = SimpleUploadedFile("users.xlsx", b"not-excel", content_type="application/octet-stream")
        resp = api_client.post(PREVIEW_URL, {"file": f}, format="multipart")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_non_admin_gets_403(self, api_client) -> None:
        user = UserFactory(role=User.Role.USUARIO)
        api_client.force_authenticate(user=user)
        xlsx = _make_xlsx([HEADER, ["x@e.com", "X", "X", "usuario"]])
        resp = api_client.post(PREVIEW_URL, {"file": _uploaded(xlsx)}, format="multipart")
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_trainer_gets_403(self, api_client) -> None:
        trainer = UserFactory(role=User.Role.TRAINER)
        api_client.force_authenticate(user=trainer)
        xlsx = _make_xlsx([HEADER, ["x@e.com", "X", "X", "usuario"]])
        resp = api_client.post(PREVIEW_URL, {"file": _uploaded(xlsx)}, format="multipart")
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_unauthenticated_gets_401(self, api_client) -> None:
        xlsx = _make_xlsx([HEADER, ["x@e.com", "X", "X", "usuario"]])
        resp = api_client.post(PREVIEW_URL, {"file": _uploaded(xlsx)}, format="multipart")
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_file_with_errors_returns_200_with_error_rows(self, api_client) -> None:
        admin = AdminUserFactory()
        api_client.force_authenticate(user=admin)
        xlsx = _make_xlsx([HEADER, ["bad-email", "X", "X", "usuario"]])
        resp = api_client.post(PREVIEW_URL, {"file": _uploaded(xlsx)}, format="multipart")
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["error_count"] == 1
        assert len(resp.data["error_rows"]) == 1


# ---------------------------------------------------------------------------
# View — /users/bulk-import/confirm/
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestBulkImportConfirmView:
    def _valid_rows_payload(self) -> dict:
        return {
            "rows": [
                {
                    "row": 2,
                    "email": "confirm@empresa.com",
                    "first_name": "C",
                    "last_name": "C",
                    "role": "USUARIO",
                    "area_id": None,
                    "cargo": "",
                    "grupo_id": None,
                }
            ]
        }

    def test_valid_rows_creates_users_and_returns_200(self, api_client) -> None:
        admin = AdminUserFactory()
        api_client.force_authenticate(user=admin)
        resp = api_client.post(CONFIRM_URL, self._valid_rows_payload(), format="json")
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["created"] == 1
        assert resp.data["failed"] == 0
        assert User.objects.filter(email="confirm@empresa.com").exists()

    def test_empty_rows_returns_400(self, api_client) -> None:
        admin = AdminUserFactory()
        api_client.force_authenticate(user=admin)
        resp = api_client.post(CONFIRM_URL, {"rows": []}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_non_admin_gets_403(self, api_client) -> None:
        user = UserFactory(role=User.Role.USUARIO)
        api_client.force_authenticate(user=user)
        resp = api_client.post(CONFIRM_URL, self._valid_rows_payload(), format="json")
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_unauthenticated_gets_401(self, api_client) -> None:
        resp = api_client.post(CONFIRM_URL, self._valid_rows_payload(), format="json")
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_confirm_records_audit_log(self, api_client) -> None:
        admin = AdminUserFactory()
        api_client.force_authenticate(user=admin)
        api_client.post(CONFIRM_URL, self._valid_rows_payload(), format="json")
        assert AuditLog.objects.filter(accion="BULK_USER_IMPORT", user=admin).exists()

    def test_duplicate_confirm_race_condition(self, api_client) -> None:
        admin = AdminUserFactory()
        api_client.force_authenticate(user=admin)
        payload = self._valid_rows_payload()
        # First confirm succeeds
        resp1 = api_client.post(CONFIRM_URL, payload, format="json")
        assert resp1.data["created"] == 1
        # Second confirm with same email should report failure
        resp2 = api_client.post(CONFIRM_URL, payload, format="json")
        assert resp2.status_code == status.HTTP_200_OK
        assert resp2.data["created"] == 0
        assert resp2.data["failed"] == 1
