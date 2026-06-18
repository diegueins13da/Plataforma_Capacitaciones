"""
AI generation services using the Anthropic Claude API.
All prompts are constructed here; actual HTTP calls are wrapped with retry logic.
"""
from __future__ import annotations

import json
import re
from typing import TYPE_CHECKING

from django.conf import settings

from .exceptions import AIGenerationError

if TYPE_CHECKING:
    pass

MAX_RETRIES = 3

_MODULE_SCHEMA = {
    "title": str,
    "objetivo": str,
    "descripcion": str,
    "orden": int,
}

_QUESTION_SCHEMA = {
    "texto": str,
    "tipo": str,
    "opciones": list,
    "respuesta_correcta": None,
    "dificultad": str,
    "tema": str,
}

_VALID_TIPOS = {"MULTIPLE_CHOICE", "MULTIPLE_SELECT", "TRUE_FALSE"}
_VALID_DIFICULTADES = {"FACIL", "MEDIO", "DIFICIL"}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _get_client():
    try:
        import anthropic  # noqa: PLC0415
    except ImportError as exc:
        raise AIGenerationError("El paquete anthropic no está instalado.") from exc

    api_key = settings.ANTHROPIC_API_KEY
    if not api_key:
        raise AIGenerationError("ANTHROPIC_API_KEY no está configurada.")

    return anthropic.Anthropic(api_key=api_key)


def _extract_json(text: str) -> object:
    """Extract the first valid JSON array or object from a text response."""
    # Try raw parse first
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        pass
    # Try markdown code block
    match = re.search(r"```(?:json)?\s*([\[{].*?[\]}])\s*```", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass
    # Fallback: find first [ or { and try from there
    for start_char, end_char in [("[", "]"), ("{", "}")]:
        idx = text.find(start_char)
        if idx != -1:
            try:
                return json.loads(text[idx:])
            except json.JSONDecodeError:
                pass
    raise ValueError("No se encontró JSON válido en la respuesta.")


def _call_claude(prompt: str, system: str = "") -> str:
    client = _get_client()
    messages = [{"role": "user", "content": prompt}]
    kwargs = {"model": settings.ANTHROPIC_MODEL, "max_tokens": 4096, "messages": messages}
    if system:
        kwargs["system"] = system
    response = client.messages.create(**kwargs)
    return response.content[0].text


# ---------------------------------------------------------------------------
# Module generation
# ---------------------------------------------------------------------------

_MODULES_SYSTEM = (
    "Eres un experto en diseño instruccional. Tu trabajo es analizar contenido "
    "educativo y estructurarlo en módulos de aprendizaje claros y accionables. "
    "Responde SOLO con un array JSON, sin texto adicional."
)


def _modules_prompt(text: str, config: dict) -> str:
    cantidad = config.get("cantidad_modulos", 5)
    idioma = config.get("idioma", "español")
    return (
        f"Analiza el siguiente contenido y genera exactamente {cantidad} módulos de curso en {idioma}.\n"
        "Responde con un array JSON. Cada elemento debe tener:\n"
        '  "title": string (título conciso del módulo),\n'
        '  "objetivo": string (objetivo de aprendizaje en una oración),\n'
        '  "descripcion": string (descripción de 2-3 oraciones del contenido),\n'
        '  "orden": number (empezando en 1)\n\n'
        f"CONTENIDO:\n{text[:8000]}"
    )


def generate_course_modules(text: str, config: dict | None = None) -> list[dict]:
    """
    Generate a list of course module proposals from extracted document text.
    Returns a list of dicts validated against _MODULE_SCHEMA.
    Retries up to MAX_RETRIES times if the response is malformed.
    """
    config = config or {}
    prompt = _modules_prompt(text, config)
    last_error: Exception | None = None

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            raw = _call_claude(prompt, _MODULES_SYSTEM)
            data = _extract_json(raw)
            if not isinstance(data, list):
                raise ValueError("La respuesta debe ser un array.")
            modules = _validate_modules(data)
            return modules
        except Exception as exc:
            last_error = exc
            if attempt < MAX_RETRIES:
                prompt += "\n\nIMPORTANTE: Responde SOLO con el array JSON, sin texto adicional."

    raise AIGenerationError(
        f"No se pudo generar módulos después de {MAX_RETRIES} intentos. "
        f"Último error: {last_error}"
    )


def _validate_modules(data: list) -> list[dict]:
    result = []
    for i, item in enumerate(data, 1):
        if not isinstance(item, dict):
            continue
        result.append(
            {
                "title": str(item.get("title") or item.get("titulo") or f"Módulo {i}"),
                "objetivo": str(item.get("objetivo") or ""),
                "descripcion": str(item.get("descripcion") or ""),
                "orden": int(item.get("orden") or i),
            }
        )
    if not result:
        raise ValueError("El array de módulos está vacío.")
    return result


# ---------------------------------------------------------------------------
# Question generation
# ---------------------------------------------------------------------------

_QUESTIONS_SYSTEM = (
    "Eres un experto en evaluación educativa. Genera preguntas de evaluación "
    "precisas y bien redactadas. Responde SOLO con un array JSON, sin texto adicional."
)


def _questions_prompt(content: str, config: dict) -> str:
    cantidad = config.get("cantidad", 5)
    tipos = config.get("tipos", ["MULTIPLE_CHOICE"])
    dificultad = config.get("dificultad", "MEDIO")
    tipos_str = ", ".join(tipos)
    return (
        f"Genera exactamente {cantidad} preguntas de evaluación sobre el siguiente contenido.\n"
        f"Tipos permitidos: {tipos_str}. Dificultad: {dificultad}.\n"
        "Responde con un array JSON. Cada elemento debe tener:\n"
        '  "texto": string (enunciado de la pregunta),\n'
        '  "tipo": "MULTIPLE_CHOICE" | "MULTIPLE_SELECT" | "TRUE_FALSE",\n'
        '  "opciones": array de strings (vacío para TRUE_FALSE),\n'
        '  "respuesta_correcta": number (índice 0-based para MC), array de números para MS, boolean para TF,\n'
        '  "dificultad": "FACIL" | "MEDIO" | "DIFICIL",\n'
        '  "tema": string (tema o subtema al que pertenece la pregunta)\n\n'
        f"CONTENIDO:\n{content[:6000]}"
    )


def generate_questions(content: str, config: dict | None = None) -> list[dict]:
    """
    Generate a list of assessment question proposals from content text.
    Returns a validated list of question dicts.
    """
    config = config or {}
    prompt = _questions_prompt(content, config)
    last_error: Exception | None = None

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            raw = _call_claude(prompt, _QUESTIONS_SYSTEM)
            data = _extract_json(raw)
            if not isinstance(data, list):
                raise ValueError("La respuesta debe ser un array.")
            return _validate_questions(data)
        except Exception as exc:
            last_error = exc
            if attempt < MAX_RETRIES:
                prompt += "\n\nIMPORTANTE: Responde SOLO con el array JSON."

    raise AIGenerationError(
        f"No se pudo generar preguntas después de {MAX_RETRIES} intentos. "
        f"Último error: {last_error}"
    )


def _validate_questions(data: list) -> list[dict]:
    result = []
    for item in data:
        if not isinstance(item, dict):
            continue
        tipo = str(item.get("tipo", "MULTIPLE_CHOICE")).upper()
        if tipo not in _VALID_TIPOS:
            tipo = "MULTIPLE_CHOICE"
        dificultad = str(item.get("dificultad", "MEDIO")).upper()
        if dificultad not in _VALID_DIFICULTADES:
            dificultad = "MEDIO"
        opciones = item.get("opciones") or []
        if not isinstance(opciones, list):
            opciones = []
        result.append(
            {
                "texto": str(item.get("texto") or ""),
                "tipo": tipo,
                "opciones": [str(o) for o in opciones],
                "respuesta_correcta": item.get("respuesta_correcta"),
                "dificultad": dificultad,
                "tema": str(item.get("tema") or ""),
            }
        )
    if not result:
        raise ValueError("El array de preguntas está vacío.")
    return result
