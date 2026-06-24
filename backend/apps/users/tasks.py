"""
Celery tasks for the users app.
"""
from __future__ import annotations

import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(
    name="apps.users.tasks.ldap_sync_task",
    bind=True,
    max_retries=2,
    default_retry_delay=300,
)
def ldap_sync_task(self):
    """
    Periodic task: synchronize users from Active Directory.
    Scheduled daily via Celery Beat (configured in settings/base.py).
    Only runs when LDAP_ENABLED=True.
    """
    from django.conf import settings

    if not getattr(settings, "LDAP_ENABLED", False):
        logger.info("ldap_sync_task: LDAP not enabled, skipping.")
        return {"skipped": True}

    try:
        from apps.users.ldap_sync import run_ldap_sync
        result = run_ldap_sync(admin_user=None, ip="celery-beat")
        logger.info(
            "ldap_sync_task completed",
            extra={
                "created": result["created"],
                "updated": result["updated"],
                "deactivated": result["deactivated"],
                "errors": result["errors"],
            },
        )
        return result
    except Exception as exc:
        logger.exception("ldap_sync_task failed: %s", exc)
        raise self.retry(exc=exc)
