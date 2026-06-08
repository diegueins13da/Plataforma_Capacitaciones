from abc import ABC, abstractmethod
from typing import BinaryIO


class StorageBackend(ABC):
    """
    Interface for all file storage backends.
    Implementations: LocalStorage (MVP), SharePointStorage (Fase 3).
    Business code depends only on this interface — never on a concrete class.
    """

    @abstractmethod
    def save(self, name: str, content: BinaryIO) -> str:
        """Persist a file and return its storage path/key."""
        ...

    @abstractmethod
    def url(self, name: str) -> str:
        """Return a URL from which the file can be accessed."""
        ...

    @abstractmethod
    def delete(self, name: str) -> None:
        """Remove the file from storage."""
        ...

    @abstractmethod
    def exists(self, name: str) -> bool:
        """Return True if the file exists in storage."""
        ...
