"""
LDAP / Active Directory synchronization service.

Connects to the configured AD server, fetches all users matching
LDAP_SYNC_FILTER and creates, updates or deactivates them in the
local database.

Calling convention:
    from apps.users.ldap_sync import run_ldap_sync
    result = run_ldap_sync(admin_user=request.user, ip="127.0.0.1")
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING, TypedDict

from django.conf import settings

if TYPE_CHECKING:
    from apps.users.models import User

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Return type
# ---------------------------------------------------------------------------


class LdapSyncResult(TypedDict):
    created: int
    updated: int
    deactivated: int
    skipped: int
    errors: int
    error_details: list[str]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _decode(attrs: dict, key: str, default: str = "") -> str:
    values = attrs.get(key)
    if not values:
        return default
    raw = values[0]
    if isinstance(raw, bytes):
        return raw.decode("utf-8", errors="replace").strip()
    return str(raw).strip()


def _is_ad_account_disabled(attrs: dict) -> bool:
    """Return True if the userAccountControl ACCOUNTDISABLE bit (0x2) is set."""
    uac_raw = _decode(attrs, "userAccountControl", "512")
    try:
        return bool(int(uac_raw) & 2)
    except ValueError:
        return False


def _build_username(sam: str, email: str) -> str:
    """
    Choose a username for a new LDAP user.
    Prefer sAMAccountName; fall back to the local part of email.
    Ensures uniqueness by appending a counter when needed.
    """
    from apps.users.models import User

    base = (sam or email.split("@")[0])[:20]
    candidate = base
    counter = 1
    while User.objects.filter(username=candidate).exists():
        candidate = f"{base}{counter}"
        counter += 1
    return candidate


# ---------------------------------------------------------------------------
# Core sync
# ---------------------------------------------------------------------------


def run_ldap_sync(
    *,
    admin_user: "User | None" = None,
    ip: str = "system",
) -> LdapSyncResult:
    """
    Pull all users from Active Directory and sync them to the local DB.

    - New AD users  → created with auth_source='LDAP', unusable password.
    - Existing LDAP → name / cargo updated; deactivated if AD disables account.
    - Existing LOCAL → skipped entirely (never overwrite local accounts).

    Returns a dict with statistics.
    """
    if not getattr(settings, "LDAP_ENABLED", False):
        raise RuntimeError("LDAP is not enabled. Set LDAP_ENABLED=True in .env.")

    import ldap as _ldap

    from apps.reports.audit import log_event
    from apps.users.models import Area, User, UserProfile

    result: LdapSyncResult = {
        "created": 0,
        "updated": 0,
        "deactivated": 0,
        "skipped": 0,
        "errors": 0,
        "error_details": [],
    }

    # ── Connect to AD ─────────────────────────────────────────────────────────
    server_uri: str = settings.AUTH_LDAP_SERVER_URI
    bind_dn: str = settings.AUTH_LDAP_BIND_DN
    bind_password: str = settings.AUTH_LDAP_BIND_PASSWORD
    base_dn: str = settings.AUTH_LDAP_BASE_DN
    sync_filter: str = getattr(
        settings,
        "LDAP_SYNC_FILTER",
        "(&(objectClass=person)(mail=*))",
    )

    try:
        conn = _ldap.initialize(server_uri)
        conn.set_option(_ldap.OPT_REFERRALS, 0)
        conn.simple_bind_s(bind_dn, bind_password)
    except _ldap.LDAPError as exc:
        msg = f"Cannot connect to LDAP server {server_uri}: {exc}"
        logger.error(msg)
        raise RuntimeError(msg) from exc

    # ── Fetch users ───────────────────────────────────────────────────────────
    attrs_to_fetch = [
        "sAMAccountName",
        "mail",
        "givenName",
        "sn",
        "department",
        "title",
        "userAccountControl",
        "distinguishedName",
    ]

    try:
        raw_results = conn.search_s(
            base_dn,
            _ldap.SCOPE_SUBTREE,
            sync_filter,
            attrs_to_fetch,
        )
    except _ldap.LDAPError as exc:
        conn.unbind_s()
        msg = f"LDAP search failed: {exc}"
        logger.error(msg)
        raise RuntimeError(msg) from exc
    finally:
        try:
            conn.unbind_s()
        except Exception:
            pass

    # ── Process each AD entry ─────────────────────────────────────────────────
    for dn, attrs in raw_results:
        # Skip referral entries (no attributes)
        if not attrs or not isinstance(attrs, dict):
            continue

        email = _decode(attrs, "mail").lower()
        if not email:
            continue

        sam = _decode(attrs, "sAMAccountName")
        first_name = _decode(attrs, "givenName")
        last_name = _decode(attrs, "sn")
        department = _decode(attrs, "department")
        title = _decode(attrs, "title")
        is_disabled = _is_ad_account_disabled(attrs)
        distinguished_name = dn or _decode(attrs, "distinguishedName")

        try:
            existing_user = User.objects.select_related("profile").filter(email=email).first()

            if existing_user is None:
                # ── Create new LDAP user ───────────────────────────────────────
                username = _build_username(sam, email)
                new_user = User.objects.create(
                    username=username,
                    email=email,
                    first_name=first_name,
                    last_name=last_name,
                    is_active=not is_disabled,
                    role=User.Role.USUARIO,
                    must_change_password=False,
                )
                new_user.set_unusable_password()
                new_user.save(update_fields=["password"])

                profile = new_user.profile
                profile.auth_source = UserProfile.AUTH_SOURCE_LDAP
                profile.ldap_dn = distinguished_name
                profile.cargo = title

                # Resolve department → Area (best effort)
                if department:
                    area = Area.objects.filter(nombre__iexact=department, activo=True).first()
                    if area:
                        profile.area = area

                profile.save()

                result["created"] += 1

            elif existing_user.profile.auth_source == UserProfile.AUTH_SOURCE_LDAP:
                # ── Update existing LDAP user ─────────────────────────────────
                changed = []

                if existing_user.first_name != first_name:
                    existing_user.first_name = first_name
                    changed.append("first_name")
                if existing_user.last_name != last_name:
                    existing_user.last_name = last_name
                    changed.append("last_name")

                was_active = existing_user.is_active
                should_be_active = not is_disabled
                if was_active != should_be_active:
                    existing_user.is_active = should_be_active
                    changed.append("is_active")

                if changed:
                    existing_user.save(update_fields=changed)

                profile = existing_user.profile
                profile_changed = []

                if profile.cargo != title:
                    profile.cargo = title
                    profile_changed.append("cargo")
                if profile.ldap_dn != distinguished_name:
                    profile.ldap_dn = distinguished_name
                    profile_changed.append("ldap_dn")

                if department:
                    area = Area.objects.filter(nombre__iexact=department, activo=True).first()
                    if area and profile.area != area:
                        profile.area = area
                        profile_changed.append("area")

                if profile_changed:
                    profile.save(update_fields=profile_changed)

                if not should_be_active and was_active:
                    result["deactivated"] += 1
                else:
                    result["updated"] += 1

            else:
                # ── Local user — never touch ──────────────────────────────────
                result["skipped"] += 1

        except Exception as exc:
            error_msg = f"Error processing {email}: {exc}"
            logger.error(error_msg, exc_info=True)
            result["errors"] += 1
            result["error_details"].append(error_msg)

    # ── Audit log ─────────────────────────────────────────────────────────────
    log_event(
        accion="LDAP_SYNC",
        actor=admin_user,
        ip=ip,
        resultado="OK" if result["errors"] == 0 else "ERROR",
        entidad_tipo="User",
        detalle={
            "creados": result["created"],
            "actualizados": result["updated"],
            "desactivados": result["deactivated"],
            "omitidos": result["skipped"],
            "errores": result["errors"],
        },
        error_detalle="; ".join(result["error_details"][:5]) if result["error_details"] else "",
    )

    return result
