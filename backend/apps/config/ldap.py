"""
LDAP helpers — read config from DB, test connection, bind as user.

All LDAP configuration is stored in the SystemSetting table (categoria='LDAP')
so admins can change it from the UI without touching .env or restarting containers.
"""
from __future__ import annotations

import logging
import time

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Config reader
# ---------------------------------------------------------------------------


def get_ldap_config() -> dict:
    """Return LDAP settings from the DB as a plain dict."""
    from apps.config.models import SystemSetting

    rows = SystemSetting.objects.filter(categoria="LDAP")
    raw = {s.clave: s.get_value() for s in rows}

    return {
        "enabled": raw.get("LDAP_ENABLED", False),
        "server_uri": raw.get("LDAP_SERVER_URI", ""),
        "bind_dn": raw.get("LDAP_BIND_DN", ""),
        "bind_password": raw.get("LDAP_BIND_PASSWORD", ""),
        "base_dn": raw.get("LDAP_BASE_DN", ""),
        "sync_filter": raw.get("LDAP_SYNC_FILTER", "(&(objectClass=person)(mail=*))"),
        "start_tls": raw.get("LDAP_START_TLS", False),
    }


# ---------------------------------------------------------------------------
# Connection test
# ---------------------------------------------------------------------------


def test_ldap_connection(config: dict | None = None) -> dict:
    """
    Test the service-account bind against the configured LDAP server.

    Returns:
        {"ok": True/False, "message": str, "latency_ms": int | None}
    """
    if config is None:
        config = get_ldap_config()

    if not config["server_uri"]:
        return {"ok": False, "message": "El servidor LDAP no está configurado.", "latency_ms": None}

    try:
        import ldap as _ldap
    except ImportError:
        return {"ok": False, "message": "python-ldap no está instalado en el servidor.", "latency_ms": None}

    t0 = time.perf_counter()
    conn = None
    try:
        conn = _ldap.initialize(config["server_uri"])
        conn.set_option(_ldap.OPT_REFERRALS, 0)
        conn.set_option(_ldap.OPT_NETWORK_TIMEOUT, 5)

        if config.get("start_tls"):
            conn.start_tls_s()

        conn.simple_bind_s(config["bind_dn"], config["bind_password"])
        latency_ms = int((time.perf_counter() - t0) * 1000)

        return {
            "ok": True,
            "message": f"Conexión exitosa · credenciales válidas · {latency_ms} ms",
            "latency_ms": latency_ms,
        }

    except _ldap.INVALID_CREDENTIALS:
        return {
            "ok": False,
            "message": "Credenciales inválidas — verifica el DN y la contraseña de servicio.",
            "latency_ms": None,
        }
    except _ldap.SERVER_DOWN:
        return {
            "ok": False,
            "message": f"El servidor no responde: {config['server_uri']}",
            "latency_ms": None,
        }
    except _ldap.LDAPError as exc:
        msg = exc.args[0].get("desc", str(exc)) if exc.args else str(exc)
        return {"ok": False, "message": f"Error LDAP: {msg}", "latency_ms": None}
    except Exception as exc:
        logger.exception("Unexpected error testing LDAP connection")
        return {"ok": False, "message": str(exc), "latency_ms": None}
    finally:
        if conn:
            try:
                conn.unbind_s()
            except Exception:
                pass


# ---------------------------------------------------------------------------
# User authentication
# ---------------------------------------------------------------------------


def ldap_bind_as_user(config: dict, user_dn: str, password: str) -> bool:
    """
    Try to authenticate a user by binding with their DN + password.

    Returns True on success, False on wrong password or LDAP error.
    """
    if not user_dn or not password:
        return False

    try:
        import ldap as _ldap
    except ImportError:
        return False

    conn = None
    try:
        conn = _ldap.initialize(config["server_uri"])
        conn.set_option(_ldap.OPT_REFERRALS, 0)
        conn.set_option(_ldap.OPT_NETWORK_TIMEOUT, 10)

        if config.get("start_tls"):
            conn.start_tls_s()

        conn.simple_bind_s(user_dn, password)
        return True

    except _ldap.INVALID_CREDENTIALS:
        return False
    except Exception:
        logger.exception("LDAP bind error for DN=%s", user_dn)
        return False
    finally:
        if conn:
            try:
                conn.unbind_s()
            except Exception:
                pass
