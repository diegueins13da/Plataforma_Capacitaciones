from pathlib import Path
from typing import BinaryIO

from django.conf import settings
from django.core.files.storage import default_storage

from .base import StorageBackend


class LocalStorage(StorageBackend):
    """
    Stores files on the local filesystem using Django's default_storage.
    Files are served via Django's MEDIA_URL / Nginx in production.
    """

    def save(self, name: str, content: BinaryIO) -> str:
        return default_storage.save(name, content)

    def url(self, name: str) -> str:
        return default_storage.url(name)

    def delete(self, name: str) -> None:
        if default_storage.exists(name):
            default_storage.delete(name)

    def exists(self, name: str) -> bool:
        return default_storage.exists(name)
