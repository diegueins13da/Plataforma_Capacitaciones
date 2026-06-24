"""
Custom LDAP authentication backend.

Only activates for users whose UserProfile.auth_source == 'LDAP'.
This prevents local accounts (like the superuser admin) from being
accidentally matched against Active Directory.
"""
from __future__ import annotations

import logging

from django.conf import settings

logger = logging.getLogger(__name__)


class LMSLdapBackend:
    """
    Thin wrapper around django-auth-ldap's LDAPBackend.

    Authentication is attempted only when:
      1. LDAP is enabled (LDAP_ENABLED=True in .env).
      2. A local User record exists for the username AND its profile
         has auth_source == 'LDAP'.
    """

    def authenticate(self, request, username: str | None = None, password: str | None = None, **kwargs):
        if not getattr(settings, "LDAP_ENABLED", False):
            return None

        if not username or not password:
            return None

        # Only allow LDAP auth for users explicitly marked as LDAP users.
        try:
            from apps.users.models import UserProfile
            profile = UserProfile.objects.select_related("user").get(user__username=username)
            if profile.auth_source != UserProfile.AUTH_SOURCE_LDAP:
                return None
        except UserProfile.DoesNotExist:
            return None

        try:
            from django_auth_ldap.backend import LDAPBackend
            backend = LDAPBackend()
            user = backend.authenticate(request, username=username, password=password)
            return user
        except Exception:
            logger.exception("LDAP authentication error for user=%s", username)
            return None

    def get_user(self, user_id: int):
        try:
            from apps.users.models import User
            return User.objects.get(pk=user_id)
        except Exception:
            return None
