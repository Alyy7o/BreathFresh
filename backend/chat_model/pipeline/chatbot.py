import random
import logging
from typing import List, Tuple, Dict, Any, Optional
import time
import re

logger = logging.getLogger(__name__)

# Import with proper error handling
try:
    from .intent_classifier import predict_intent, get_classifier
    from .refiner import _get_fallback_response, get_refiner, refine_response, post_process_response
    from .utils import get_vector_store
except ImportError:
    try:
        from intent_classifier import predict_intent, get_classifier
        from refiner import _get_fallback_response, get_refiner, refine_response, post_process_response
        from utils import get_vector_store
    except ImportError as e:
        logger.error(f"Failed to import pipeline components: {e}")
        raise

# =============================================================================
# RETRIEVAL CONFIGURATION
# =============================================================================
# (Config is fine, 'use_refiner' will be ignored)
RETRIEVAL_CONFIG = {
    "Craving_Urgent": {"top_k": 3, "min_confidence": 0.35},
    "Relapse_Support": {"top_k": 3, "min_confidence": 0.30},
    "Coping_Strategies": {"top_k": 3, "min_confidence": 0.25},
    "Trigger_Management": {"top_k": 3, "min_confidence": 0.35},
    "Motivation": {"top_k": 3, "min_confidence": 0.25},
    "Encouragement": {"top_k": 2, "min_confidence": 0.25},
    "Awareness_Education": {"top_k": 3, "min_confidence": 0.30},
    "Plan_Creation": {"top_k": 3, "min_confidence": 0.30},
    "General": {"top_k": 0, "min_confidence": 0.20}
}


# =============================================================================
# MAIN CHATBOT CLASS
# =============================================================================

class SmokingCessationChatbot:
    def __init__(self, enable_refiner: bool = True): 
        """
        Initialize the smoking cessation chatbot.
        """
        self.vector_store = None
        self.intent_classifier = None
        self.refiner = None 
        self.enable_refiner = enable_refiner 
        self.conversation_history = []
        self.response_times = []
        self._initialize_components()
    
    def _initialize_components(self):
        """Initialize all chatbot components."""
        logger.info("🚀 Initializing chatbot components...")
        
        # 1. Intent Classifier
        try:
            start_time = time.time()
            self.intent_classifier = get_classifier()
            intent_time = time.time() - start_time
            logger.info(f"✅ Intent classifier ready ({intent_time:.2f}s)")
        except Exception as e:
            logger.error(f"❌ Intent classifier failed: {e}")
            raise
        
        # 2. Vector Store (RAG)
        try:
            self.vector_store = get_vector_store()
            if self.vector_store and self.vector_store.load():
                logger.info("✅ Vector store loaded")
            else:
                logger.warning("⚠️ Vector store not loaded - RAG disabled")
        except Exception as e:
            logger.error(f"⚠️ Vector store failed: {e}")
            self.vector_store = None
        
        # 3. Response Refiner (Gemini API)
        if self.enable_refiner:
            try:
                start_time = time.time()
                self.refiner = get_refiner()
                refiner_time = time.time() - start_time
                if self.refiner is not None:
                    logger.info(f"✅ Gemini API client ready ({refiner_time:.2f}s)")
                else:
                    logger.warning("⚠️ Gemini client not configured. Will use fallbacks.")
            except Exception as e:
                logger.error(f"⚠️ Gemini client initialization failed: {e}")
                self.refiner = None
                self.enable_refiner = False
        else:
            logger.info("ℹ️ Response refiner is disabled by request.")
        
        logger.info("✅ Chatbot initialization complete")


    def _validate_chunk_quality(self, chunk: str, query: str, intent: str) -> float:
        # (This function is fine, no changes)
        if not chunk or len(chunk) < 50:
            return 0.0
        score = 0.5
        chunk_lower = chunk.lower()
        junk_patterns = [
            "i am not supposed to", "do not scold me", "you are a failure",
            "is not helpful, is nonsens", "intent]:", "athlete_education",
            "you are in a coma", "i'm an alcoholic", "therapist,' etc.)"
        ]
        if any(pattern in chunk_lower for pattern in junk_patterns):
            logger.debug(f"REJECTED chunk (junk pattern): {chunk[:50]}...")
            return 0.0
        query_terms = set(query.lower().split())
        chunk_terms = set(chunk_lower.split())
        overlap = len(query_terms & chunk_terms) / max(len(query_terms), 1)
        score += overlap * 0.2
        domain_words = ['quit', 'smoke', 'smoking', 'nicotine', 'craving', 'cigarette', 'tobacco']
        if any(word in chunk_lower for word in domain_words):
            score += 0.2
        if chunk_lower.startswith(query.lower()[:20]):
            score -= 0.3
        return max(0.0, min(1.0, score))
    
    def _rerank_results(
        self, 
        results: List[Tuple[str, float]], 
        query: str, 
        intent: str
    ) -> List[Tuple[str, float]]:
        # (This function is fine, no changes)
        reranked = []
        for chunk, original_score in results:
            quality_score = self._validate_chunk_quality(chunk, query, intent)
            if quality_score > 0.2: 
                combined_score = (original_score * 0.6) + (quality_score * 0.4)
                reranked.append((chunk, combined_score))
            else:
                logger.debug(f"DROPPED low-quality chunk: {chunk[:50]}...")
        reranked.sort(key=lambda x: x[1], reverse=True)
        return reranked

    def process_query(
        self,
        user_query: str,
        model_params: Optional[Dict[str, Any]] = None,
        enable_refinement: bool = None,  
    ) -> Dict[str, Any]:
        """
        Process a user query and generate response.
        """
        start_time = time.time()
        
        # Use instance default if not explicitly provided
        use_refiner = enable_refinement if enable_refinement is not None else self.enable_refiner
        
        response_data = {
            "success": False, "response": "", "intent": "General",
            "confidence": 0.0, "used_retrieval": False, "used_refinement": False,
            "processing_time": 0.0, "chunks_retrieved": 0, "error": None
        }

        try:
            # ===================================================================
            # STEP 1: Intent Classification
            # ===================================================================
            intent, confidence = predict_intent(user_query)
            response_data["intent"] = intent
            response_data["confidence"] = confidence
            logger.info(f"📝 Query: '{user_query[:50]}...'")
            logger.info(f"🎯 Intent: {intent} (confidence: {confidence:.2%})")

            config = RETRIEVAL_CONFIG.get(intent, RETRIEVAL_CONFIG["General"])
            # Allow overriding top_k via model_params
            if model_params and isinstance(model_params.get("top_k"), (int, float)):
                try:
                    tk = int(model_params.get("top_k"))
                    if tk >= 0:
                        config = {**config, "top_k": tk}
                except Exception:
                    pass

            # ===================================================================
            # STEP 2: Handle General Intent (No RAG needed, bypass directly to LLM)
            # ===================================================================
            if intent == "General":
                if use_refiner:
                    logger.info("🤖 Routing general query to Gemini")
                    refined = refine_response("", intent="General", query=user_query)
                    final_response = post_process_response(refined)
                else:
                    final_response = _get_fallback_response("General")

                response_data.update({
                    "success": True, "response": final_response, "used_refinement": use_refiner
                })
                return self._finalize_response(response_data, start_time, user_query)

            # ===================================================================
            # STEP 3: Check Confidence Threshold
            # ===================================================================
            if confidence < config["min_confidence"]:
                logger.info(f"⚠️ Low confidence ({confidence:.2%}), using fallback")
                response_data.update({
                    "success": True, "response": _get_fallback_response(intent),
                })
                return self._finalize_response(response_data, start_time, user_query)

            # ===================================================================
            # STEP 4: RAG Retrieval
            # ===================================================================
            if self.vector_store and config["top_k"] > 0:
                try:
                    # Retrieve candidates (get extra for reranking)
                    retrieval_results = self.vector_store.search(
                        user_query,
                        intent,
                        requested_top_k=config["top_k"] * 3 
                    )
                    
                    response_data["chunks_retrieved"] = len(retrieval_results)
                    logger.info(f"📚 Retrieved {len(retrieval_results)} candidate chunks")
                    
                    if retrieval_results:
                        # Rerank by quality
                        valid_results = self._rerank_results(
                            retrieval_results, 
                            user_query, 
                            intent
                        )
                        
                        if valid_results:
                            top_chunks = valid_results[:config["top_k"]]
                            logger.info(f"✅ Using {len(top_chunks)} high-quality chunks")
                            
                            if use_refiner:
                                # Compose raw context block
                                compiled_context = "\n".join([c[0] for c in top_chunks])
                                logger.info("✨ Sending context to Gemini refiner")
                                refined = refine_response(compiled_context, intent=intent, query=user_query)
                                final_response = post_process_response(refined)
                                
                                response_data.update({
                                    "success": True,
                                    "response": final_response,
                                    "used_retrieval": True,
                                    "used_refinement": True
                                })
                            else:
                                formatted_response = self._format_chunks_directly(top_chunks)
                                response_data.update({
                                    "success": True,
                                    "response": formatted_response,
                                    "used_retrieval": True,
                                    "used_refinement": False 
                                })
                            
                        else:
                            logger.warning("⚠️ No chunks passed quality filter, using fallback")
                            response_data.update({
                                "success": True, "response": _get_fallback_response(intent),
                            })
                    
                    else:
                        logger.info("ℹ️ No retrieval results, using fallback")
                        response_data.update({
                            "success": True, "response": _get_fallback_response(intent),
                        })
                        
                except Exception as e:
                    logger.error(f"❌ Retrieval error: {e}", exc_info=True)
                    response_data.update({
                        "success": True, "response": _get_fallback_response(intent),
                    })
            
            else:
                logger.info("ℹ️ No vector store or top_k=0, using fallback")
                response_data.update({
                    "success": True, "response": _get_fallback_response(intent),
                })

        except Exception as e:
            logger.error(f"❌ Pipeline error: {e}", exc_info=True)
            response_data["error"] = str(e)
            response_data["response"] = _get_fallback_response("General")
            response_data["success"] = True

        return self._finalize_response(response_data, start_time, user_query)

    def _format_chunks_directly(self, chunks: List[Tuple[str, float]]) -> str:
        """
        Format retrieved chunks directly without refinement.
        """
        cleaned_chunks = []
        
        for chunk, score in chunks:
            cleaned = self._clean_chunk_for_display(chunk)
            if cleaned and len(cleaned) > 20:
                cleaned_chunks.append(cleaned)
        
        if not cleaned_chunks:
            return _get_fallback_response("General") 
        
        if len(cleaned_chunks) == 1:
            return cleaned_chunks[0]
        
        # Multiple chunks - format as bullet points
        formatted = "Here are some tips and information that might help:\n\n"
        for i, chunk in enumerate(cleaned_chunks, 1):
            formatted += f"• {chunk}\n\n"
        
        return formatted.strip()

    def _clean_chunk_for_display(self, chunk: str) -> str:
        """Clean a chunk for direct display to user."""
        if not chunk:
            return ""
        
        # Remove citations and artifacts
        chunk = re.sub(r'\[\d+\]', '', chunk)
        chunk = re.sub(r'\(cid:\d+\)', '', chunk)
        chunk = re.sub(r'chapter \d+', '', chunk, flags=re.IGNORECASE)
        chunk = re.sub(r'figure \d+', '', chunk, flags=re.IGNORECASE)
        
        # Normalize whitespace
        chunk = ' '.join(chunk.split())
        
        # Extract meaningful sentences
        sentences = re.split(r'(?<=[.!?])\s+', chunk)
        meaningful = [
            s.strip() for s in sentences
            if len(s.strip()) > 15
        ]
        
        if meaningful:
            # Take first 3 sentences max
            result = ' '.join(meaningful[:3])
            
            # Make more conversational
            result = result.replace('One should', 'You can')
            result = result.replace('It is important to', 'Remember to')
            result = result.replace('One must', 'You should')
            
            # Ensure proper ending
            if result and result[-1] not in '.!?':
                result += '.'
            
            return result
        
        # Fallback - return truncated chunk
        return chunk[:300] + "..." if len(chunk) > 300 else chunk

    def _finalize_response(
        self, 
        response_data: Dict, 
        start_time: float, 
        query: str
    ) -> Dict:
        """Calculate timing and save to history."""
        total_time = time.time() - start_time
        response_data["processing_time"] = total_time
        
        self.response_times.append(total_time)
        self.conversation_history.append({
            "query": query,
            "response": response_data["response"],
            "intent": response_data["intent"],
            "confidence": response_data["confidence"],
            "used_refinement": response_data.get("used_refinement", False),
            "timestamp": time.time()
        })
        
        logger.info(f"⏱️ Response generated in {total_time:.3f}s")
        
        return response_data

    def get_stats(self) -> Dict[str, Any]:
        """Get chatbot statistics."""
        avg_time = sum(self.response_times) / len(self.response_times) if self.response_times else 0
        
        return {
            "total_queries_processed": len(self.response_times),
            "average_response_time": avg_time,
            "vector_store_available": self.vector_store is not None and getattr(self.vector_store, '_is_loaded', False),
            "refiner_available": self.refiner is not None, 
            "refiner_enabled": self.enable_refiner 
        }

# =============================================================================
# MODULE-LEVEL CONVENIENCE FUNCTIONS
# =============================================================================

_chatbot_instance = None

def get_chatbot(enable_refiner: bool = True) -> SmokingCessationChatbot:
    """Get or create global chatbot instance."""
    global _chatbot_instance
    if _chatbot_instance is None:
        _chatbot_instance = SmokingCessationChatbot(enable_refiner=enable_refiner)
    return _chatbot_instance

def query_chatbot(user_query: str, enable_refinement: bool = True) -> str:
    """
    Convenience function to query the chatbot.
    """
    chatbot = get_chatbot()
    result = chatbot.process_query(user_query, enable_refinement=enable_refinement) 
    return result["response"]