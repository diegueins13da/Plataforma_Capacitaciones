from django.db import connection
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status


@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    """
    Shallow health check — used by load balancers to verify the process is up.
    Returns 200 immediately without hitting dependencies.
    """
    return Response({"status": "ok"})


@api_view(["GET"])
@permission_classes([AllowAny])
def deep_health_check(request):
    """
    Deep health check — verifies DB, Redis, and Celery worker reachability.
    Returns 503 if any dependency is down.
    """
    checks: dict[str, str] = {}
    healthy = True

    # Database
    try:
        connection.ensure_connection()
        checks["database"] = "ok"
    except Exception as exc:
        checks["database"] = f"error: {exc}"
        healthy = False

    # Redis / Celery broker
    try:
        from django.core.cache import cache
        cache.set("_health", "1", timeout=5)
        assert cache.get("_health") == "1"
        checks["redis"] = "ok"
    except Exception as exc:
        checks["redis"] = f"error: {exc}"
        healthy = False

    # Celery workers (inspect ping — non-blocking, 1s timeout)
    try:
        from config.celery import app as celery_app
        inspector = celery_app.control.inspect(timeout=1)
        pong = inspector.ping()
        checks["celery"] = "ok" if pong else "no_workers"
    except Exception as exc:
        checks["celery"] = f"error: {exc}"
        # Celery being unavailable is non-fatal for web requests
        checks.setdefault("celery", "error")

    http_status = status.HTTP_200_OK if healthy else status.HTTP_503_SERVICE_UNAVAILABLE
    return Response({"status": "ok" if healthy else "degraded", "checks": checks}, status=http_status)
