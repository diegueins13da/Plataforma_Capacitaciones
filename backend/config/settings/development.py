from .base import *  # noqa: F401, F403

DEBUG = True
ALLOWED_HOSTS = ["*"]

INSTALLED_APPS += ["debug_toolbar"]  # noqa: F405

MIDDLEWARE = [
    "debug_toolbar.middleware.DebugToolbarMiddleware",
] + MIDDLEWARE  # noqa: F405

INTERNAL_IPS = ["127.0.0.1", "::1"]

DEBUG_TOOLBAR_CONFIG = {
    # Only show toolbar on non-API, non-media paths
    "SHOW_TOOLBAR_CALLBACK": lambda req: not req.path.startswith(("/api/", "/media/")),
}

# Show all SQL queries in shell
LOGGING["root"]["level"] = "DEBUG"  # noqa: F405

CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
]

# Allow PDF modules to be embedded in iframes from the same origin
X_FRAME_OPTIONS = "SAMEORIGIN"
