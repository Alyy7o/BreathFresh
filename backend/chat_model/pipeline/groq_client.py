"""Lightweight Groq LLM helpers (no local GPU / embedding models)."""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile").strip()

_client = None


def get_groq_client():
    global _client
    if _client is not None:
        return _client
    if not GROQ_API_KEY:
        logger.warning("GROQ_API_KEY is not set")
        return None
    try:
        from groq import Groq

        _client = Groq(api_key=GROQ_API_KEY)
        return _client
    except Exception as e:
        logger.error("Failed to init Groq client: %s", e)
        return None


def chat_completion(
    messages: List[Dict[str, str]],
    *,
    temperature: float = 0.4,
    max_tokens: int = 700,
    model: Optional[str] = None,
) -> str:
    client = get_groq_client()
    if client is None:
        raise RuntimeError(
            "GROQ_API_KEY is missing. Add it to backend/chat_model/.env"
        )

    response = client.chat.completions.create(
        model=model or GROQ_MODEL,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    text = (response.choices[0].message.content or "").strip()
    if not text:
        raise RuntimeError("Groq returned an empty response")
    return text


def parse_json_object(raw_text: str) -> Dict[str, Any]:
    cleaned = raw_text.strip()
    if "```json" in cleaned:
        cleaned = cleaned.split("```json", 1)[1].split("```", 1)[0].strip()
    elif "```" in cleaned:
        cleaned = cleaned.split("```", 1)[1].split("```", 1)[0].strip()

    brace_start = cleaned.find("{")
    if brace_start == -1:
        raise ValueError("No JSON object found in model output")

    depth, brace_end = 0, -1
    for i in range(brace_start, len(cleaned)):
        if cleaned[i] == "{":
            depth += 1
        elif cleaned[i] == "}":
            depth -= 1
            if depth == 0:
                brace_end = i
                break
    if brace_end == -1:
        raise ValueError("Unbalanced JSON braces")

    return json.loads(cleaned[brace_start : brace_end + 1])


def looks_like_api_key(value: str) -> bool:
    return bool(re.match(r"^gsk_[A-Za-z0-9]+$", value or ""))
