from django.conf import settings

from .backends.base import StorageBackend
from .backends.local import LocalStorage
from .backends.sharepoint import SharePointStorage

_BACKENDS = {
    "local": LocalStorage,
    "sharepoint": SharePointStorage,
}


def get_storage() -> StorageBackend:
    """Return the configured storage backend instance."""
    backend_name = getattr(settings, "STORAGE_BACKEND", "local")
    backend_class = _BACKENDS.get(backend_name)
    if backend_class is None:
        raise ValueError(
            f"Unknown STORAGE_BACKEND '{backend_name}'. Choices: {list(_BACKENDS)}"
        )
    return backend_class()
