import pytest
from django.test import Client


@pytest.mark.django_db
class TestHealthCheck:
    def test_returns_200(self, client: Client) -> None:
        response = client.get("/api/health/")
        assert response.status_code == 200

    def test_returns_ok_payload(self, client: Client) -> None:
        response = client.get("/api/health/")
        assert response.json() == {"status": "ok"}

    def test_allows_unauthenticated_access(self, client: Client) -> None:
        response = client.get("/api/health/")
        assert response.status_code != 401
