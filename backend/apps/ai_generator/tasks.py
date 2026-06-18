from celery import shared_task


@shared_task(name="ai_generator.health_check", bind=True)
def health_check(self) -> dict:  # type: ignore[override]
    """Smoke-test task: verifies that Celery workers are reachable."""
    return {"status": "ok"}


@shared_task(name="ai_generator.analyze_document", bind=True)
def analyze_document(self, file_path: str, file_type: str, config: dict | None = None) -> dict:  # type: ignore[override]
    """
    Parse a document and generate course module proposals via Claude.
    Returns {"modules": [...]} on success.
    file_type: "pdf" | "pptx"
    """
    from .exceptions import AIGenerationError, DocumentParseError  # noqa: PLC0415
    from .parsers import extract_text_from_pdf, extract_text_from_pptx  # noqa: PLC0415
    from .services import generate_course_modules  # noqa: PLC0415

    try:
        if file_type == "pdf":
            text = extract_text_from_pdf(file_path)
        else:
            text = extract_text_from_pptx(file_path)
        modules = generate_course_modules(text, config or {})
        return {"modules": modules}
    except (DocumentParseError, AIGenerationError) as exc:
        raise self.retry(exc=exc, countdown=0, max_retries=0) from exc


@shared_task(name="ai_generator.generate_questions_task", bind=True)
def generate_questions_task(self, content: str, config: dict | None = None) -> dict:  # type: ignore[override]
    """
    Generate assessment questions for a given content text via Claude.
    Returns {"questions": [...]} on success.
    """
    from .exceptions import AIGenerationError  # noqa: PLC0415
    from .services import generate_questions  # noqa: PLC0415

    try:
        questions = generate_questions(content, config or {})
        return {"questions": questions}
    except AIGenerationError as exc:
        raise self.retry(exc=exc, countdown=0, max_retries=0) from exc
