import os
import pickle
import numpy as np
from typing import List, Tuple, Dict, Optional, Any
import logging
from pathlib import Path
from functools import lru_cache
import time
import re

# Configure logging
logger = logging.getLogger(__name__)

# Third-party imports
try:
    import faiss
    from sentence_transformers import SentenceTransformer
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
except ImportError as e:
    logger.error(f"Missing required libraries: {e}")
    exit(1)

# --- Configuration ---
BASE_DIR = Path(__file__).resolve().parent.parent
VECTOR_DIR = BASE_DIR / "vectors"
MODELS_DIR = BASE_DIR / "models"
VECTOR_STORE_PATH = VECTOR_DIR / "vector_store.faiss"
TEXT_CHUNKS_PATH = VECTOR_DIR / "texts.pkl"
METADATA_PATH = VECTOR_DIR / "metadata.pkl"
KEYWORD_VECTORIZER_PATH = MODELS_DIR / "keyword_vectorizer.pkl"
KEYWORD_VOCAB_PATH = MODELS_DIR / "keyword_vocab.pkl"
EMBEDDING_MODEL_NAME = "all-mpnet-base-v2"

# Intent-specific search configuration (NOW A FALLBACK)
# The top_k values in chatbot.py's RETRIEVAL_CONFIG will take precedence
SEARCH_CONFIG = {
    "Craving_Urgent": {
        "top_k": 3, # Fallback k
        "use_keyword_boost": True,
        "boost_weight": 0.3,
        "keywords": ["craving", "urge", "immediate", "now", "right now", "distract", "breathe"]
    },
    "Coping_Strategies": {
        "top_k": 4, # Fallback k
        "use_keyword_boost": True,
        "boost_weight": 0.2,
        "keywords": ["try", "method", "strategy", "technique", "exercise", "distract"]
    },
    "Trigger_Management": {
        "top_k": 3, # Fallback k
        "use_keyword_boost": True,
        "boost_weight": 0.25,
        "keywords": ["trigger", "avoid", "situation", "environment", "manage"]
    },
    "Relapse_Support": {
        "top_k": 3, # Fallback k
        "use_keyword_boost": False,
        "boost_weight": 0.0,
        "keywords": ["relapse", "slip", "recover", "back on track"]
    },
    "Motivation": {
        "top_k": 2, # Fallback k
        "use_keyword_boost": False,
        "boost_weight": 0.0,
        "keywords": ["motivation", "benefit", "reason", "why quit"]
    },
    "General": {
        "top_k": 2, # Fallback k
        "use_keyword_boost": False,
        "boost_weight": 0.0,
        "keywords": []
    }
}

class VectorStore:
    """Unified vector store manager with caching and optimized retrieval."""

    def __init__(self):
        self.index = None
        self.texts = []
        self.metadata = []
        self.embedding_model = None
        self.keyword_vectorizer = None
        self.keyword_vocabulary = []
        self._is_loaded = False

    def load(self) -> bool:
        """Load all vector store components."""
        if self._is_loaded:
            return True

        logger.info("Loading vector database...")
        required_files = [VECTOR_STORE_PATH, TEXT_CHUNKS_PATH, METADATA_PATH]
        if not all(path.exists() for path in required_files):
            logger.error("Vector store files not found. Run data ingestion first.")
            return False

    def reload(self) -> bool:
        self.index = None
        self.texts = []
        self.metadata = []
        self.embedding_model = self.embedding_model
        self.keyword_vectorizer = None
        self.keyword_vocabulary = []
        self._is_loaded = False
        return self.load()

        try:
            self.index = faiss.read_index(str(VECTOR_STORE_PATH))
            with open(TEXT_CHUNKS_PATH, "rb") as f:
                self.texts = pickle.load(f)
            with open(METADATA_PATH, "rb") as f:
                self.metadata = pickle.load(f)

            # Pre-load components for speed
            self._load_embedding_model()
            self._load_keyword_components()

            self._is_loaded = True
            logger.info(f"✅ Vector store loaded: {self.index.ntotal} vectors, {len(self.texts)} chunks")
            return True

        except Exception as e:
            logger.error(f"Failed to load vector store: {e}", exc_info=True)
            return False

    def _load_embedding_model(self) -> SentenceTransformer:
        """Load embedding model with caching - ULTRA FAST VERSION."""
        if self.embedding_model is None:
            import transformers
            transformers.logging.set_verbosity(40)  # ERROR level only
            os.environ["TOKENIZERS_PARALLELISM"] = "false"
            try:
                self.embedding_model = SentenceTransformer(
                    EMBEDDING_MODEL_NAME,
                    device='cpu',
                    trust_remote_code=True
                )
            except Exception as e:
                logger.error(f"Failed to load embedding model: {e}")
                raise
        return self.embedding_model

    def _load_keyword_components(self) -> bool:
        """Load keyword vectorizer and vocabulary."""
        if self.keyword_vectorizer is not None:
            return True
        if not KEYWORD_VECTORIZER_PATH.exists() or not KEYWORD_VOCAB_PATH.exists():
            logger.warning("Keyword vectorizer files not found")
            return False
        try:
            with open(KEYWORD_VECTORIZER_PATH, "rb") as f:
                self.keyword_vectorizer = pickle.load(f)
            with open(KEYWORD_VOCAB_PATH, "rb") as f:
                self.keyword_vocabulary = pickle.load(f)
            logger.info("✅ Keyword vectorizer loaded")
            return True
        except Exception as e:
            logger.warning(f"Failed to load keyword components: {e}")
            return False

    # OPTIMIZED: Added cache for speed on repeated/similar queries
    @lru_cache(maxsize=100)
    def embed_query(self, query: str) -> Optional[np.ndarray]:
        """Generate embedding for query."""
        try:
            model = self._load_embedding_model()
            embedding = model.encode([query], normalize_embeddings=True)
            embedding = embedding.astype('float32')
            if embedding.ndim == 2 and embedding.shape[0] == 1:
                embedding = embedding[0]  # shape becomes (D,)
            return embedding.reshape(1, -1)  # shape (1, D)
        except Exception as e:
            logger.error(f"Failed to embed query: {e}")
            return None

    def semantic_search(self, query_vector: np.ndarray, top_k: int = 10) -> List[Dict[str, Any]]:
        """Perform semantic search using FAISS."""
        if not self._is_loaded:
            logger.error("Vector store not loaded")
            return []
        try:
            # Ensure k is not larger than ntotal
            search_k = min(top_k, self.index.ntotal)
            if search_k == 0:
                return []
                
            scores, indices = self.index.search(query_vector, search_k)

            results = []
            for score, idx in zip(scores[0], indices[0]):
                if 0 <= idx < len(self.texts):
                    results.append({
                        'text': self.texts[idx],
                        'metadata': self.metadata[idx],
                        'semantic_score': float(score),
                        'index': idx
                    })
            return results
        except Exception as e:
            logger.error(f"Semantic search failed: {e}")
            return []

    def keyword_boost_search(self, query: str, semantic_results: List[Dict], boost_weight: float = 0.2) -> List[Dict[str, Any]]:
        """Apply keyword boosting to semantic search results."""
        if not semantic_results or self.keyword_vectorizer is None:
            return semantic_results
        try:
            chunk_texts = [result['text'] for result in semantic_results]
            chunk_vectors = self.keyword_vectorizer.transform(chunk_texts)
            query_vector = self.keyword_vectorizer.transform([query])
            keyword_scores = cosine_similarity(query_vector, chunk_vectors).flatten()

            boosted_results = []
            for i, result in enumerate(semantic_results):
                hybrid_score = ((1 - boost_weight) * result['semantic_score'] +
                                boost_weight * keyword_scores[i])
                boosted_results.append({
                    **result,
                    'keyword_score': float(keyword_scores[i]),
                    'hybrid_score': float(hybrid_score)
                })
            return boosted_results
        except Exception as e:
            logger.warning(f"Keyword boost failed: {e}. Using semantic results.")
            return semantic_results

    # OPTIMIZED: Synchronized search function
    def search(self, query: str, intent: str = "General", requested_top_k: int = 4) -> List[Tuple[str, float]]:
        """
        Main search function with intent-aware retrieval.
        It now respects the 'requested_top_k' from the chatbot.
        Returns list of (chunk_text, score) tuples.
        """
        if not self._is_loaded and not self.load():
            return []

        # Get search configuration for intent
        config = SEARCH_CONFIG.get(intent, SEARCH_CONFIG["General"])
        
        # SYNCHRONIZATION: Use the 'requested_top_k' from chatbot.py
        # Use the config['top_k'] as a fallback if 0 is passed
        top_k = requested_top_k if requested_top_k > 0 else config["top_k"]
        if top_k == 0:
            return [] # 'General' intent might have k=0

        query_vector = self.embed_query(query)
        if query_vector is None:
            return []

        # Retrieve *more* candidates for reranking (e.g., 4x the final k)
        candidate_k = max(top_k * 4, 10)
        semantic_results = self.semantic_search(query_vector, candidate_k)
        if not semantic_results:
            return []

        # Apply keyword boosting if configured
        if config["use_keyword_boost"]:
            boosted_results = self.keyword_boost_search(
                query, semantic_results, config["boost_weight"]
            )
            boosted_results.sort(key=lambda x: x['hybrid_score'], reverse=True)
            final_results = boosted_results
            logger.debug(f"Used hybrid search for intent: {intent}")
        else:
            semantic_results.sort(key=lambda x: x['semantic_score'], reverse=True)
            final_results = semantic_results
            logger.debug(f"Used semantic search for intent: {intent}")

        # Return the final top_k
        return [
            (result['text'], result.get('hybrid_score', result['semantic_score']))
            for result in final_results[:top_k]
        ]

    def get_stats(self) -> Dict[str, Any]:
        """Get vector store statistics."""
        if not self._is_loaded:
            self.load() # Try to load
            
        if not self._is_loaded:
            return {"loaded": False}

        return {
            "loaded": True,
            "total_vectors": self.index.ntotal,
            "total_chunks": len(self.texts),
            "embedding_dimension": self.index.d,
            "has_keyword_vectorizer": self.keyword_vectorizer is not None
        }

# Global instance for easy access
_vector_store = None

def get_vector_store() -> VectorStore:
    """Get or create vector store instance."""
    global _vector_store
    if _vector_store is None:
        _vector_store = VectorStore()
    return _vector_store

# --- Legacy/Utility Functions (unchanged, but kept for compatibility) ---

def load_vector_db() -> Tuple[Optional[Any], List[str], List[Dict]]:
    store = get_vector_store()
    if store.load():
        return store.index, store.texts, store.metadata
    return None, [], []

def embed_query(query: str) -> Optional[np.ndarray]:
    store = get_vector_store()
    return store.embed_query(query)

def search_similar_chunks(query: str, predicted_intent: str, top_k: int = 4) -> List[Tuple[str, float]]:
    store = get_vector_store()
    return store.search(query, predicted_intent, requested_top_k=top_k)

@lru_cache(maxsize=1000)
def clean_retrieved_text(text: str) -> str:
    if not text:
        return ""
    text = ' '.join(text.split())
    artifacts = [
        r'\[\d+\]', r'\*+\s*\d+\s*\*+', r'\.{4,}', r'\bpp?\.?\s*\d+\b',
        r'scan to download|click here|visit website', r'chapter\s+\d+',
        r'figure\s+\d+|table\s+\d+', r'references?|bibliography'
    ]
    for pattern in artifacts:
        text = re.sub(pattern, '', text, flags=re.IGNORECASE)
    return text.strip()

def format_search_results(results: List[Tuple[str, float]], max_length: int = 500) -> List[Tuple[str, float]]:
    formatted = []
    for text, score in results:
        cleaned = clean_retrieved_text(text)
        if len(cleaned) > max_length:
            truncated = cleaned[:max_length]
            last_sentence_end = max(
                truncated.rfind('.'), truncated.rfind('!'), truncated.rfind('?')
            )
            if last_sentence_end > max_length * 0.6:
                cleaned = truncated[:last_sentence_end + 1]
            else:
                cleaned = truncated + "..."
        formatted.append((cleaned, score))
    return formatted

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    store = get_vector_store()
    stats = store.get_stats()
    print("Vector Store Stats:", stats)

    if stats["loaded"]:
        test_query = "How to deal with cigarette cravings?"
        # Test the new search signature
        results = store.search(test_query, "Craving_Urgent", requested_top_k=5)
        print(f"\nTest search for '{test_query}' (k=5):")
        for i, (text, score) in enumerate(results, 1):
            print(f"{i}. Score: {score:.3f}")
            print(f"   Text: {text[:100]}...")