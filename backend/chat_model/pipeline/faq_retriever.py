"""Simple keyword FAQ retrieval — no embeddings / FAISS."""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import List, Tuple

BASE_DIR = Path(__file__).resolve().parent.parent
FAQ_PATH = BASE_DIR / "data" / "faqs.json"


@lru_cache(maxsize=1)
def _load_faqs() -> Tuple[Tuple[str, str], ...]:
    if not FAQ_PATH.exists():
        return tuple()
    with open(FAQ_PATH, "r", encoding="utf-8") as f:
        items = json.load(f)
    pairs = []
    for item in items:
        q = str(item.get("question", "")).strip()
        a = str(item.get("answer", "")).strip()
        if len(q) >= 5 and len(a) >= 10:
            pairs.append((q, a))
    return tuple(pairs)


def _tokenize(text: str) -> set[str]:
    return {t for t in re.findall(r"[a-z0-9']+", text.lower()) if len(t) > 2}


def retrieve_faq_context(query: str, top_k: int = 4) -> str:
    faqs = _load_faqs()
    if not faqs:
        return ""

    q_tokens = _tokenize(query)
    if not q_tokens:
        return ""

    scored: List[Tuple[float, str, str]] = []
    for question, answer in faqs:
        doc_tokens = _tokenize(f"{question} {answer}")
        overlap = len(q_tokens & doc_tokens)
        if overlap <= 0:
            continue
        # Prefer denser overlap relative to query size
        score = overlap + (overlap / max(len(q_tokens), 1))
        scored.append((score, question, answer))

    if not scored:
        return ""

    scored.sort(key=lambda x: x[0], reverse=True)
    blocks = []
    for _, question, answer in scored[:top_k]:
        blocks.append(f"Q: {question}\nA: {answer}")
    return "\n\n".join(blocks)
