import pytest
from django.test import Client
from rest_framework.test import APIClient


@pytest.fixture
def client() -> Client:
    return Client()


@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


@pytest.fixture
def api_rf():
    from rest_framework.test import APIRequestFactory
    return APIRequestFactory()


@pytest.fixture
def admin_user(db):
    from apps.users.tests.factories import AdminUserFactory
    return AdminUserFactory()


@pytest.fixture
def trainer_user(db):
    from apps.users.tests.factories import TrainerUserFactory
    return TrainerUserFactory()


@pytest.fixture
def regular_user(db):
    from apps.users.tests.factories import UserFactory
    return UserFactory()


@pytest.fixture
def auth_api_client(api_client, regular_user):
    """API client pre-authenticated as a regular user."""
    api_client.force_authenticate(user=regular_user)
    return api_client


@pytest.fixture
def admin_api_client(api_client, admin_user):
    """API client pre-authenticated as an admin user."""
    api_client.force_authenticate(user=admin_user)
    return api_client
