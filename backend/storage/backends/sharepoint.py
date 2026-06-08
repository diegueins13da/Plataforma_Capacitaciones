from typing import BinaryIO

from .base import StorageBackend


class SharePointStorage(StorageBackend):
    """
    SharePoint / OneDrive storage backend — Fase 3 implementation.
    Stub raises NotImplementedError so misconfiguration is caught immediately.
    """

    def save(self, name: str, content: BinaryIO) -> str:
        raise NotImplementedError("SharePoint storage is implemented in Fase 3")

    def url(self, name: str) -> str:
        raise NotImplementedError("SharePoint storage is implemented in Fase 3")

    def delete(self, name: str) -> None:
        raise NotImplementedError("SharePoint storage is implemented in Fase 3")

    def exists(self, name: str) -> bool:
        raise NotImplementedError("SharePoint storage is implemented in Fase 3")
