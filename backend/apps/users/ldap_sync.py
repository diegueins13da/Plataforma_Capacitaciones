"""
LDAP / Active Directory synchronization service.

Two independent operations:

  run_catalog_sync() — reads unique company/department/title values from AD
                       and rebuilds the Area / Group / Cargo catalogs.
                       Entries absent from AD are DELETED (dev-phase policy).

  run_ldap_sync()    — creates/updates/deactivates User records from AD.
                       Attribute mapping:
                         company    → profile.area
                         department → profile.grupo
                         title      → profile.cargo (text)

Calling convention:
    from apps.users.ldap_sync import run_catalog_sync, run_ldap_sync
    result = run_catalog_sync(admin_user=request.user, ip="127.0.0.1")
    result = run_ldap_sync(admin_user=request.user, ip="127.0.0.1")
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING, TypedDict

if TYPE_CHECKING:
    from apps.users.models import User

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Return type
# ---------------------------------------------------------------------------


class CatalogSyncStats(TypedDict):
    created: int
    deleted: int


class CatalogSyncResult(TypedDict):
    areas: CatalogSyncStats
    grupos: CatalogSyncStats
    cargos: CatalogSyncStats


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
# Catalog sync
# ---------------------------------------------------------------------------


def _ad_connect(ldap_cfg: dict):
    """Return an open LDAP connection. Caller must unbind_s() when done."""
    import ldap as _ldap

    server_uri: str = ldap_cfg["server_uri"]
    bind_dn: str = ldap_cfg["bind_dn"]
    bind_password: str = ldap_cfg["bind_password"]
    try:
        conn = _ldap.initialize(server_uri)
        conn.set_option(_ldap.OPT_REFERRALS, 0)
        conn.simple_bind_s(bind_dn, bind_password)
        return conn
    except _ldap.LDAPError as exc:
        msg = f"Cannot connect to LDAP server {server_uri}: {exc}"
        logger.error(msg)
        raise RuntimeError(msg) from exc


def run_catalog_sync(
    *,
    admin_user: "User | None" = None,
    ip: str = "system",
) -> CatalogSyncResult:
    """
    Read distinct company / department / title values from AD and rebuild the
    Area / Group / Cargo catalogs.

    Policy (dev phase): entries that no longer exist in AD are DELETED.
    Entries found in AD are created if they don't exist yet.
    """
    from apps.config.ldap import get_ldap_config as _get_ldap_config
    ldap_cfg = _get_ldap_config()
    if not ldap_cfg.get("enabled"):
        raise RuntimeError("LDAP no está habilitado. Actívalo en Configuración → LDAP.")

    import ldap as _ldap

    from apps.reports.audit import log_event
    from apps.users.models import Area, Cargo
    from apps.users.models import Group as OrgGroup

    result: CatalogSyncResult = {
        "areas":  {"created": 0, "deleted": 0},
        "grupos": {"created": 0, "deleted": 0},
        "cargos": {"created": 0, "deleted": 0},
    }

    conn = _ad_connect(ldap_cfg)
    try:
        raw_results = conn.search_s(
            ldap_cfg["base_dn"],
            _ldap.SCOPE_SUBTREE,
            ldap_cfg["catalog_filter"],
            ["company", "department", "title"],
        )
    except _ldap.LDAPError as exc:
        msg = f"LDAP search failed: {exc}"
        logger.error(msg)
        raise RuntimeError(msg) from exc
    finally:
        try:
            conn.unbind_s()
        except Exception:
            pass

    # Collect unique non-empty values from AD
    ad_areas: set[str] = set()
    ad_grupos: set[str] = set()
    ad_cargos: set[str] = set()

    for _dn, attrs in raw_results:
        if not attrs or not isinstance(attrs, dict):
            continue
        if v := _decode(attrs, "company"):
            ad_areas.add(v)
        if v := _decode(attrs, "department"):
            ad_grupos.add(v)
        if v := _decode(attrs, "title"):
            ad_cargos.add(v)

    # ── Areas (company) ───────────────────────────────────────────────────────
    deleted_areas = Area.objects.exclude(nombre__in=ad_areas).delete()
    result["areas"]["deleted"] = deleted_areas[0]
    for nombre in ad_areas:
        obj, created = Area.objects.get_or_create(nombre=nombre)
        if created:
            result["areas"]["created"] += 1
        if not obj.from_ad:
            obj.from_ad = True
            obj.save(update_fields=["from_ad"])

    # ── Groups (department) ───────────────────────────────────────────────────
    deleted_grupos = OrgGroup.objects.exclude(nombre__in=ad_grupos).delete()
    result["grupos"]["deleted"] = deleted_grupos[0]
    for nombre in ad_grupos:
        obj, created = OrgGroup.objects.get_or_create(nombre=nombre)
        if created:
            result["grupos"]["created"] += 1
        if not obj.from_ad:
            obj.from_ad = True
            obj.save(update_fields=["from_ad"])

    # ── Cargos (title) ────────────────────────────────────────────────────────
    deleted_cargos = Cargo.objects.exclude(nombre__in=ad_cargos).delete()
    result["cargos"]["deleted"] = deleted_cargos[0]
    for nombre in ad_cargos:
        obj = Cargo.objects.filter(nombre=nombre).first()
        if obj is None:
            Cargo.objects.create(nombre=nombre, area=None, from_ad=True)
            result["cargos"]["created"] += 1
        elif not obj.from_ad:
            obj.from_ad = True
            obj.save(update_fields=["from_ad"])

    log_event(
        accion="CATALOG_SYNC",
        actor=admin_user,
        ip=ip,
        resultado="OK",
        entidad_tipo="Catalog",
        detalle={
            "areas_creadas": result["areas"]["created"],
            "areas_eliminadas": result["areas"]["deleted"],
            "grupos_creados": result["grupos"]["created"],
            "grupos_eliminados": result["grupos"]["deleted"],
            "cargos_creados": result["cargos"]["created"],
            "cargos_eliminados": result["cargos"]["deleted"],
        },
    )

    return result


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
    from apps.config.ldap import get_ldap_config as _get_ldap_config
    ldap_cfg = _get_ldap_config()
    if not ldap_cfg.get("enabled"):
        raise RuntimeError("LDAP no está habilitado. Actívalo en Configuración → LDAP.")

    import ldap as _ldap

    from apps.reports.audit import log_event
    from apps.users.models import Area, Cargo, User, UserProfile
    from apps.users.models import Group as OrgGroup

    result: LdapSyncResult = {
        "created": 0,
        "updated": 0,
        "deactivated": 0,
        "skipped": 0,
        "errors": 0,
        "error_details": [],
    }

    # ── Connect to AD ─────────────────────────────────────────────────────────
    conn = _ad_connect(ldap_cfg)

    # ── Fetch users ───────────────────────────────────────────────────────────
    # company → Area, department → Group, title → cargo (text)
    attrs_to_fetch = [
        "sAMAccountName",
        "mail",
        "givenName",
        "sn",
        "company",
        "department",
        "title",
        "userAccountControl",
        "distinguishedName",
    ]

    try:
        raw_results = conn.search_s(
            ldap_cfg["base_dn"],
            _ldap.SCOPE_SUBTREE,
            ldap_cfg["sync_filter"],
            attrs_to_fetch,
        )
    except _ldap.LDAPError as exc:
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
        company = _decode(attrs, "company")       # → Area
        department = _decode(attrs, "department")  # → Group
        title = _decode(attrs, "title")            # → cargo (text)
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
                profile.mfa_enabled = True
                profile.ldap_dn = distinguished_name
                profile.cargo = title

                # company → Area
                if company:
                    area = Area.objects.filter(nombre__iexact=company).first()
                    if area:
                        profile.area = area

                # department → Group
                if department:
                    grupo = OrgGroup.objects.filter(nombre__iexact=department).first()
                    if grupo:
                        profile.grupo = grupo

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

                # company → Area
                if company:
                    area = Area.objects.filter(nombre__iexact=company).first()
                    if area and profile.area_id != area.pk:
                        profile.area = area
                        profile_changed.append("area")

                # department → Group
                if department:
                    grupo = OrgGroup.objects.filter(nombre__iexact=department).first()
                    if grupo and profile.grupo_id != grupo.pk:
                        profile.grupo = grupo
                        profile_changed.append("grupo")

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
