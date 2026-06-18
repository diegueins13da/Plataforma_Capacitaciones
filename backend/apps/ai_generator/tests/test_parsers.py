import os
import pytest

from apps.ai_generator.exceptions import DocumentParseError
from apps.ai_generator.parsers import extract_text_from_pdf, extract_text_from_pptx

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")
PDF_PATH = os.path.join(FIXTURES, "sample.pdf")
PPTX_PATH = os.path.join(FIXTURES, "sample.pptx")


class TestPdfParser:
    def test_extracts_text(self):
        text = extract_text_from_pdf(PDF_PATH)
        assert isinstance(text, str)
        assert len(text) > 0

    def test_does_not_exceed_max_chars(self):
        text = extract_text_from_pdf(PDF_PATH)
        assert len(text) <= 100_000 + len("\n\n[CONTENIDO TRUNCADO")

    def test_missing_file_raises(self):
        with pytest.raises((DocumentParseError, Exception)):
            extract_text_from_pdf("/tmp/nonexistent_file.pdf")

    def test_truncation_marker_on_large_text(self, tmp_path, monkeypatch):
        monkeypatch.setattr(
            "apps.ai_generator.parsers.MAX_CHARS", 10
        )
        text = extract_text_from_pdf(PDF_PATH)
        assert "[CONTENIDO TRUNCADO" in text


class TestPptxParser:
    def test_extracts_text_from_all_slides(self):
        text = extract_text_from_pptx(PPTX_PATH)
        assert isinstance(text, str)
        assert len(text) > 0

    def test_text_contains_slide_content(self):
        text = extract_text_from_pptx(PPTX_PATH)
        assert "Diapositiva" in text or "Fundamentos" in text or "gestion" in text.lower()

    def test_does_not_exceed_max_chars(self):
        text = extract_text_from_pptx(PPTX_PATH)
        assert len(text) <= 100_000 + len("\n\n[CONTENIDO TRUNCADO")

    def test_missing_file_raises(self):
        with pytest.raises((DocumentParseError, Exception)):
            extract_text_from_pptx("/tmp/nonexistent_file.pptx")

    def test_truncation_marker_on_large_text(self, monkeypatch):
        monkeypatch.setattr(
            "apps.ai_generator.parsers.MAX_CHARS", 10
        )
        text = extract_text_from_pptx(PPTX_PATH)
        assert "[CONTENIDO TRUNCADO" in text
