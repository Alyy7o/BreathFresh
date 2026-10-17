"""
BreathFresh chat pipeline powered by Groq + lightweight FAQ keyword retrieval.
No local transformers / FAISS / sentence-transformers.
"""

from __future__ import annotations

import logging
import time
from typing import Any, Dict, List, Optional

from .faq_retriever import retrieve_faq_context
from .groq_client import chat_completion, get_groq_client
from .refiner import _get_fallback_response

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are BreathFresh AI, an empathetic stop-smoking coach.
Give practical, supportive answers for cravings, triggers, motivation, relapse, and quit planning.
Use the FAQ CONTEXT when relevant. If context is weak, still answer helpfully from solid cessation guidance.
Keep replies to 2-3 short paragraphs. Do not mention FAQs, prompts, or that you are an AI model."""


class SmokingCessationChatbot:
    def __init__(self, enable_refiner: bool = True):
        self.enable_refiner = enable_refiner
        self.response_times: List[float] = []
        self.conversation_history: List[Dict[str, Any]] = []
        self.refiner = get_groq_client()
        self.vector_store = None  # kept for status compatibility
        logger.info(
            "Chatbot ready (provider=groq, available=%s)",
            self.refiner is not None,
        )

    def process_query(
        self,
        user_query: str,
        enable_refinement: Optional[bool] = None,
        model_params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        start = time.time()
        use_llm = (
            self.enable_refiner if enable_refinement is None else enable_refinement
        )
        top_k = 4
        if model_params and isinstance(model_params.get("top_k"), (int, float)):
            top_k = max(1, min(8, int(model_params["top_k"])))

        temperature = 0.4
        if model_params and isinstance(model_params.get("temperature"), (int, float)):
            temperature = float(model_params["temperature"])

        result: Dict[str, Any] = {
            "success": True,
            "response": "",
            "intent": "General",
            "confidence": 0.0,
            "used_retrieval": False,
            "used_refinement": False,
            "processing_time": 0.0,
            "chunks_retrieved": 0,
            "error": None,
        }

        try:
            context = retrieve_faq_context(user_query, top_k=top_k)
            chunks = [c for c in context.split("\n\n") if c.strip()] if context else []
            result["chunks_retrieved"] = len(chunks)
            result["used_retrieval"] = bool(chunks)
            result["intent"] = "Faq_Assisted" if chunks else "General"
            result["confidence"] = 0.75 if chunks else 0.5

            if not use_llm or get_groq_client() is None:
                result["response"] = _get_fallback_response("General")
                return self._finalize(result, start, user_query)

            user_block = user_query.strip()
            if context:
                user_block = (
                    f"FAQ CONTEXT:\n{context}\n\nUSER MESSAGE:\n{user_query.strip()}"
                )

            answer = chat_completion(
                [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_block},
                ],
                temperature=temperature,
                max_tokens=700,
            )
            result["response"] = answer
            result["used_refinement"] = True
        except Exception as e:
            logger.error("Chat pipeline error: %s", e, exc_info=True)
            result["error"] = str(e)
            result["response"] = _get_fallback_response("General")

        return self._finalize(result, start, user_query)

    def _finalize(
        self, response_data: Dict[str, Any], start_time: float, query: str
    ) -> Dict[str, Any]:
        elapsed = time.time() - start_time
        response_data["processing_time"] = elapsed
        self.response_times.append(elapsed)
        self.conversation_history.append(
            {
                "query": query,
                "response": response_data.get("response", ""),
                "intent": response_data.get("intent"),
                "timestamp": time.time(),
            }
        )
        return response_data

    def get_stats(self) -> Dict[str, Any]:
        avg = (
            sum(self.response_times) / len(self.response_times)
            if self.response_times
            else 0.0
        )
        return {
            "total_queries_processed": len(self.response_times),
            "average_response_time": avg,
            "vector_store_available": False,
            "provider": "groq",
            "refiner_available": get_groq_client() is not None,
            "refiner_enabled": self.enable_refiner,
        }


_chatbot_instance = None


def get_chatbot(enable_refiner: bool = True) -> SmokingCessationChatbot:
    global _chatbot_instance
    if _chatbot_instance is None:
        _chatbot_instance = SmokingCessationChatbot(enable_refiner=enable_refiner)
    return _chatbot_instance


def query_chatbot(user_query: str, enable_refinement: bool = True) -> str:
    return get_chatbot().process_query(
        user_query, enable_refinement=enable_refinement
    )["response"]
