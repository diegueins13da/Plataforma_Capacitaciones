import json
import pytest
from unittest.mock import MagicMock, patch

from apps.ai_generator.exceptions import AIGenerationError
from apps.ai_generator.services import generate_course_modules, generate_questions


SAMPLE_MODULES = [
    {"title": "Introducción", "objetivo": "Conocer los fundamentos", "descripcion": "Visión general del tema.", "orden": 1},
    {"title": "Módulo 2", "objetivo": "Aplicar conceptos", "descripcion": "Práctica guiada.", "orden": 2},
]

SAMPLE_QUESTIONS = [
    {
        "texto": "¿Cuál es el proceso de planificación?",
        "tipo": "MULTIPLE_CHOICE",
        "opciones": ["Organizar", "Planificar", "Dirigir", "Controlar"],
        "respuesta_correcta": 1,
        "dificultad": "MEDIO",
        "tema": "Administración",
    }
]


def _mock_response(content: str) -> MagicMock:
    msg = MagicMock()
    msg.content = [MagicMock(text=content)]
    return msg


class TestGenerateCourseModules:
    def test_returns_validated_modules(self):
        with patch("apps.ai_generator.services._call_claude") as mock_call:
            mock_call.return_value = json.dumps(SAMPLE_MODULES)
            result = generate_course_modules("Texto de ejemplo sobre administración empresarial.", {})
        assert isinstance(result, list)
        assert len(result) == 2
        assert result[0]["title"] == "Introducción"
        assert result[0]["orden"] == 1

    def test_retries_on_malformed_json(self):
        responses = ["no es json", "tampoco", json.dumps(SAMPLE_MODULES)]
        with patch("apps.ai_generator.services._call_claude", side_effect=responses):
            result = generate_course_modules("Texto", {})
        assert len(result) == 2

    def test_raises_after_max_retries(self):
        with patch("apps.ai_generator.services._call_claude", return_value="invalid"):
            with pytest.raises(AIGenerationError):
                generate_course_modules("Texto", {})

    def test_handles_titulo_alias(self):
        data = [{"titulo": "Módulo 1", "objetivo": "Obj", "descripcion": "Desc", "orden": 1}]
        with patch("apps.ai_generator.services._call_claude", return_value=json.dumps(data)):
            result = generate_course_modules("Texto", {})
        assert result[0]["title"] == "Módulo 1"

    def test_config_cantidad_applied(self):
        data = SAMPLE_MODULES[:1]
        with patch("apps.ai_generator.services._call_claude") as mock_call:
            mock_call.return_value = json.dumps(data)
            generate_course_modules("Texto", {"cantidad_modulos": 3})
        prompt_arg = mock_call.call_args[0][0]
        assert "3" in prompt_arg

    def test_extracts_json_from_markdown_block(self):
        wrapped = f"```json\n{json.dumps(SAMPLE_MODULES)}\n```"
        with patch("apps.ai_generator.services._call_claude", return_value=wrapped):
            result = generate_course_modules("Texto", {})
        assert len(result) == 2


class TestGenerateQuestions:
    def test_returns_validated_questions(self):
        with patch("apps.ai_generator.services._call_claude", return_value=json.dumps(SAMPLE_QUESTIONS)):
            result = generate_questions("Contenido sobre administración.", {})
        assert isinstance(result, list)
        assert result[0]["tipo"] == "MULTIPLE_CHOICE"
        assert result[0]["respuesta_correcta"] == 1

    def test_normalizes_invalid_tipo(self):
        data = [dict(SAMPLE_QUESTIONS[0], tipo="INVALIDO")]
        with patch("apps.ai_generator.services._call_claude", return_value=json.dumps(data)):
            result = generate_questions("Contenido", {})
        assert result[0]["tipo"] == "MULTIPLE_CHOICE"

    def test_normalizes_invalid_dificultad(self):
        data = [dict(SAMPLE_QUESTIONS[0], dificultad="EXTREMO")]
        with patch("apps.ai_generator.services._call_claude", return_value=json.dumps(data)):
            result = generate_questions("Contenido", {})
        assert result[0]["dificultad"] == "MEDIO"

    def test_raises_after_max_retries(self):
        with patch("apps.ai_generator.services._call_claude", return_value="not json"):
            with pytest.raises(AIGenerationError):
                generate_questions("Contenido", {})

    def test_true_false_question(self):
        data = [
            {
                "texto": "¿La administración incluye planificación?",
                "tipo": "TRUE_FALSE",
                "opciones": [],
                "respuesta_correcta": True,
                "dificultad": "FACIL",
                "tema": "General",
            }
        ]
        with patch("apps.ai_generator.services._call_claude", return_value=json.dumps(data)):
            result = generate_questions("Contenido", {"tipos": ["TRUE_FALSE"]})
        assert result[0]["tipo"] == "TRUE_FALSE"
        assert result[0]["respuesta_correcta"] is True
