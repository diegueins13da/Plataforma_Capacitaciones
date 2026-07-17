"""
Celery tasks for the users app.
"""
from __future__ import annotations

import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(
    name="apps.users.tasks.catalog_sync_task",
    bind=True,
    max_retries=2,
    default_retry_delay=300,
)
def catalog_sync_task(self):
    """
    Periodic task: rebuild Area / Group / Cargo catalogs from Active Directory.
    Runs at 01:00 UTC daily (before user sync at 02:00 UTC).
    Only runs when LDAP_ENABLED=True.
    """
    from apps.config.ldap import get_ldap_config
    if not get_ldap_config().get("enabled"):
        logger.info("catalog_sync_task: LDAP not enabled in DB config, skipping.")
        return {"skipped": True}

    try:
        from apps.users.ldap_sync import run_catalog_sync
        result = run_catalog_sync(admin_user=None, ip="celery-beat")
        logger.info(
            "catalog_sync_task completed",
            extra={
                "areas_created": result["areas"]["created"],
                "areas_deleted": result["areas"]["deleted"],
                "grupos_created": result["grupos"]["created"],
                "grupos_deleted": result["grupos"]["deleted"],
                "cargos_created": result["cargos"]["created"],
                "cargos_deleted": result["cargos"]["deleted"],
            },
        )
        return result
    except Exception as exc:
        logger.exception("catalog_sync_task failed: %s", exc)
        raise self.retry(exc=exc)


@shared_task(
    name="apps.users.tasks.ldap_sync_task",
    bind=True,
    max_retries=2,
    default_retry_delay=300,
)
def ldap_sync_task(self):
    """
    Periodic task: synchronize users from Active Directory.
    Runs at 02:00 UTC daily (after catalog sync at 01:00 UTC).
    Only runs when LDAP_ENABLED=True.
    """
    from apps.config.ldap import get_ldap_config
    if not get_ldap_config().get("enabled"):
        logger.info("ldap_sync_task: LDAP not enabled in DB config, skipping.")
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
