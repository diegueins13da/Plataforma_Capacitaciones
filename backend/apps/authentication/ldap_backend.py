"""
Custom LDAP authentication backend.

Reads connection settings from the DB (SystemSetting categoria='LDAP')
so everything is configurable from the admin UI without .env changes.

Only activates for users whose UserProfile.auth_source == 'LDAP'.
"""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


class LMSLdapBackend:
    """
    Authentication backend for LDAP / Active Directory users.

    Called by Django's authenticate() chain after AxesStandaloneBackend.
    Returns None (falls through to ModelBackend) for:
      - LDAP disabled in DB config
      - User not found in DB
      - User auth_source != 'LDAP'
      - Wrong password (LDAP bind fails)
    """

    def authenticate(self, request, username: str | None = None, password: str | None = None, **kwargs):
        if not username or not password:
            return None

        try:
            from apps.config.ldap import get_ldap_config, ldap_bind_as_user

            config = get_ldap_config()
            if not config["enabled"]:
                return None

            from apps.users.models import UserProfile

            profile = UserProfile.objects.select_related("user").get(user__username=username)
            if profile.auth_source != UserProfile.AUTH_SOURCE_LDAP:
                return None

            if not profile.ldap_dn:
                logger.warning("LDAP user %s has no ldap_dn stored — cannot authenticate", username)
                return None

            if ldap_bind_as_user(config, profile.ldap_dn, password):
                return profile.user

            return None

        except Exception:
            logger.exception("LMSLdapBackend error for username=%s", username)
            return None

    def get_user(self, user_id: int):
        try:
            from apps.users.models import User
            return User.objects.get(pk=user_id)
        except Exception:
            return None
