class DocumentParseError(Exception):
    """Raised when a document cannot be parsed (corrupted, empty, or unsupported)."""


class AIGenerationError(Exception):
    """Raised when the AI service fails to produce a valid response after all retries."""
