import pytest

from apps.ai_generator.tasks import health_check


@pytest.mark.django_db
def test_health_check_runs_eagerly():
    result = health_check.delay()
    assert result.get(timeout=5) == {"status": "ok"}


@pytest.mark.django_db
def test_health_check_direct_call():
    assert health_check() == {"status": "ok"}
