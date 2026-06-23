"""
Celery tasks for certificate generation.
Called after an enrollment transitions to COMPLETADO.
"""
from __future__ import annotations

import logging

from config.celery import app

logger = logging.getLogger(__name__)


@app.task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    name="certificates.generate_pdf",
)
def generate_certificate_pdf_task(self, certificate_id: str) -> None:
    """
    Async task: generate the PDF for certificate_id.
    Retries up to 3 times on transient failures.
    Does nothing if the certificate already has a PDF.
    """
    from .services import generate_certificate_pdf

    try:
        url = generate_certificate_pdf(certificate_id)
        if url:
            logger.info("Certificate PDF task completed: %s → %s", certificate_id, url)
        else:
            logger.warning("Certificate PDF task returned None for %s", certificate_id)
    except ValueError as exc:
        # Immutability violation — do not retry
        logger.warning("Certificate %s immutability: %s", certificate_id, exc)
    except Exception as exc:
        logger.exception("Certificate %s PDF generation failed: %s", certificate_id, exc)
        raise self.retry(exc=exc)
