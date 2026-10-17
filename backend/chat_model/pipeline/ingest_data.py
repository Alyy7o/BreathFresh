import os
import re
import pickle
from tqdm import tqdm
from typing import List, Dict, Tuple, Any
import logging
import time
from pathlib import Path

logger = logging.getLogger(__name__)

try:
    import fitz  # PyMuPDF
    from langchain_text_splitters import RecursiveCharacterTextSplitter
    from sentence_transformers import SentenceTransformer
    import faiss
    import numpy as np
    from sklearn.feature_extraction.text import TfidfVectorizer
except ImportError as e:
    logger.error(f"Missing required library: {e}")
    exit(1)

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
VECTOR_DIR = BASE_DIR / "vectors"
MODELS_DIR = BASE_DIR / "models"
VECTOR_DIR.mkdir(exist_ok=True)
MODELS_DIR.mkdir(exist_ok=True)

CHUNK_SIZE = 600
CHUNK_OVERLAP = 150
EMBEDDING_MODEL_NAME = "all-mpnet-base-v2"
VECTOR_STORE_PATH = VECTOR_DIR / "vector_store.faiss"
TEXT_CHUNKS_PATH = VECTOR_DIR / "texts.pkl"
METADATA_PATH = VECTOR_DIR / "metadata.pkl"
KEYWORD_VECTORIZER_PATH = MODELS_DIR / "keyword_vectorizer.pkl"
KEYWORD_VOCAB_PATH = MODELS_DIR / "keyword_vocab.pkl"

SMOKING_CESSATION_KEYWORDS = {
    'craving_management': ['craving', 'urge', 'desire', 'need', 'want smoke', 'nicotine craving', 'withdrawal', 'temptation', 'trigger'],
    'coping_strategies': ['distract', 'breathe', 'deep breath', 'delay', 'wait', 'substitute', 'replace', 'avoid', 'prevent', 'manage', 'cope', 'handle'],
    'physical_actions': ['drink water', 'sip', 'chew', 'exercise', 'walk', 'move', 'stretch', 'gum', 'candy', 'activity', 'physical'],
    'mental_strategies': ['remind', 'reason', 'motivate', 'think', 'focus', 'mindful', 'visualize', 'imagine', 'positive', 'affirmation'],
    'relapse_prevention': ['slip', 'relapse', 'mistake', 'start over', 'reset', 'guilty', 'fail', 'setback', 'recovery', 'learn'],
    'social_support': ['call', 'talk', 'friend', 'support', 'help', 'share', 'family', 'counselor', 'group', 'community'],
    'withdrawal_symptoms': ['withdrawal', 'symptom', 'anxious', 'irritable', 'restless', 'hungry', 'headache', 'dizzy', 'sleep', 'mood'],
    'benefits': ['benefit', 'health', 'improve', 'better', 'energy', 'breathe better', 'save money', 'smell', 'taste', 'healing'],
    'timeline': ['hour', 'day', 'week', 'month', 'year', 'immediately', 'first', 'after quit', 'timeline', 'progress']
}
ALL_KEYWORDS = [word for sublist in SMOKING_CESSATION_KEYWORDS.values() for word in sublist]

def purify_text_block(text: str) -> str:
    """
    AGGRESSIVE text cleaning to remove all artifacts before embedding.
    """
    
    # Fix dot-separated text first
    text = re.sub(r'\.(?=[a-zA-Z0-9])', r'. ', text)
    
    # --- AGGRESSIVE CLEANING RULES ---
    
    # Remove URLs (http, https, www) and email addresses
    text = re.sub(r'https?://\S+|www\.\S+', '', text)
    text = re.sub(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '', text)
    
    # Remove journal citations (e.g., "Stead LF, Perera R, Bullen C...")
    text = re.sub(r'\b([A-Z][a-z]+,?\s+[A-Z]\.?,?\s+){2,}\d{4}', '', text)
    text = re.sub(r'\b\d{4};\d{1,3}:\d{1,4}-\d{1,4}', '', text) # 2006;68:1318-1322
    # Remove bracketed citations (e.g., [1, 2], [1-5],)
    text = re.sub(r'\[([\d,\s\-\w:]+)\]', '', text)
    # Remove parenthetical citations (e.g., (Smith, 2020), (ibid.))
    text = re.sub(r'\([\w\s,]+\d{4}\)', '', text)
    text = re.sub(r'\((ibid|et al)\.?,?\s*\d*\)', '', text, flags=re.IGNORECASE)
    
    # Remove common PDF/OCR artifacts
    text = re.sub(r'\(cid:\d+\)', '', text) # (cid:123)
    text = re.sub(r'\b[A-Za-z]+(\d)\b', lambda m: m.group(0)[:-1], text) # "E-cigarettes1" -> "E-cigarettes"
    
    # Remove publication/header/footer junk
    text = re.sub(r'Accessed at [A-Za-z0-9\./:_]+', '', text)
    text = re.sub(r'Reviewed \d{2}/\d{4}', '', text) # Reviewed 02/2012
    text = re.sub(r'\b(Vol|No|DOI|ISSN|ISBN)[\S\s]*?(\n|\.)', '', text, flags=re.IGNORECASE)
    text = re.sub(r'The University of Texas MD Anderson Cancer Center', '', text) # From log
    
    # Remove partial URLs/links that might be left
    text = re.sub(r'\b\w+\.(com|org|html|pdf|net)\b', '', text)
    
    # Remove form fields
    text = re.sub(r'_{5,}', '', text)
    
    # Remove non-standard unicode characters (keep basic punctuation)
    text = re.sub(r'[^\x00-\x7F]+', ' ', text) # Remove non-ASCII
    
    # --- END AGGRESSIVE RULES ---
    
    # Remove cross-page hyphenation
    text = re.sub(r'(\w)-\s*\n(\w)', r'\1\2', text)
    # Normalize whitespace but preserve paragraph breaks
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r'[ \t]+', ' ', text)
    # Remove orphaned bullets
    text = re.sub(r'^[•▪▶—\-❑]{1,3}\s*', '', text.strip(), flags=re.MULTILINE)
    # Remove floating page numbers
    text = re.sub(r'^\d+\s*$', '', text.strip(), flags=re.MULTILINE)
    text = re.sub(r'\b\d+\s*$', '', text.strip(), flags=re.MULTILINE)
    
    # Remove any line that is just noise or too short
    lines = text.split('\n')
    cleaned_lines = []
    for line in lines:
        stripped_line = line.strip()
        # Keep lines that are a reasonable length and not just symbols
        if len(stripped_line) > 15 and re.search(r'[a-zA-Z]', stripped_line):
             cleaned_lines.append(stripped_line)
    text = '\n\n'.join(cleaned_lines)
    
    # Final pass to remove excess spacing
    text = re.sub(r' {2,}', ' ', text).strip()
    
    return text.strip()

def is_junk_text(text: str, min_length: int = 75, max_length: int = 5000) -> bool: # Reduced min_length
    """
    BALANCED junk detection.
    """
    text_lower = text.lower().strip()
    
    if len(text_lower) < min_length:
        return True
    
    critical_junk = [
        r'^(chapter|section|part|appendix)\s*\d+\s*$', 
        r'^(page|figure|table)\s*\d+\s*(of\s*\d+)?\s*$',
        r'^\s*[\._{5,}]\s*$', # Dots or underscores
        r'^[^a-zA-Z0-9]{10,}$', # Only special characters
        r'^https?://', 
        r'^copyright\s+\d{4}', 
        r'scan to download|bookey|click here to',
        r'all rights reserved', r'references', r'bibliography',
        r'contents', r'index', r'american cancer society',
        r'national institutes of health', r'patient education' # From log
    ]
    
    for pattern in critical_junk:
        if re.search(pattern, text_lower):
            logger.debug(f"JUNK (critical pattern): {text[:50]}...")
            return True
    
    # Must have some real sentences
    sentence_count = len(re.findall(r'[.!?]+\s+[A-Z]', text))
    if sentence_count == 0 and len(text_lower) < 150:
        logger.debug(f"JUNK (no sentences): {text[:50]}...")
        return True
    
    # Must have reasonable vowel distribution
    vowel_ratio = len(re.findall('[aeiou]', text_lower)) / (len(text_lower) + 1e-6)
    if vowel_ratio < 0.15:
        logger.debug(f"JUNK (low vowel ratio): {text[:50]}...")
        return True
    
    # Check for excessive uppercase (likely a header)
    if len(text_lower) > 0:
        uppercase_ratio = len(re.findall(r'[A-Z]', text)) / len(text)
        if uppercase_ratio > 0.5 and len(text) < 200:
            logger.debug(f"JUNK (high uppercase): {text[:50]}...")
            return True
    
    # --- THIS IS THE FIX ---
    # Check for "indicator" words. Reverted to 2.
    positive_indicators = [
        'help', 'try', 'can', 'will', 'may', 'should', 'important',
        'because', 'when', 'after', 'before', 'during', 'while',
        'quit', 'smoke', 'nicotine', 'craving', 'support', 'benefit',
        'health', 'feel', 'urge', 'trigger'
    ]
    
    indicator_count = sum(1 for word in positive_indicators if word in text_lower)
    if indicator_count < 2: # Reverted from 3 back to 2. This will allow "benefits of stopping"
        logger.debug(f"JUNK (few indicators): {text[:50]}...")
        return True
    # --- END FIX ---
    
    return False

class Ingestor:
    def __init__(self, chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.embedding_model = None
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            length_function=len,
            separators=["\n\n", "\n", ". ", "! ", "? ", "; ", ", ", " ", ""],
            is_separator_regex=False,
            keep_separator=True
        )

    def _load_embedding_model(self):
        if self.embedding_model is None:
            import transformers
            transformers.logging.set_verbosity(40)
            os.environ["TOKENIZERS_PARALLELISM"] = "false"
            try:
                logger.info(f"Loading embedding model: {EMBEDDING_MODEL_NAME}")
                self.embedding_model = SentenceTransformer(
                    EMBEDDING_MODEL_NAME, device='cpu', trust_remote_code=True
                )
                logger.info("✅ Embedding model loaded successfully")
            except Exception as e:
                logger.error(f"Failed to load embedding model: {e}")
                raise
        return self.embedding_model

    def extract_text_from_pdf(self, pdf_path: Path) -> List[Tuple[str, int]]:
        logger.info(f"Reading PDF: {pdf_path.name}")
        doc = fitz.open(pdf_path)
        pages_content = []
        
        for page_num, page in enumerate(tqdm(doc, desc=f"Extracting {pdf_path.name}")):
            page_height, page_width = page.rect.height, page.rect.width
            
            blocks = page.get_text("blocks", 
                                  flags=fitz.TEXT_PRESERVE_LIGATURES | 
                                        fitz.TEXT_PRESERVE_WHITESPACE)
            
            page_text_chunks = []
            
            for block in blocks:
                x0, y0, x1, y1, block_text, block_no, block_type = block
                if block_type != 0: continue
                
                block_text = purify_text_block(block_text)
                
                is_header = y1 < (page_height * 0.08)
                is_footer = y0 > (page_height * 0.92)
                
                if (is_header or is_footer) and len(block_text) < 100:
                    continue
                
                if len(block_text) > 20:
                    page_text_chunks.append(block_text)
            
            if page_text_chunks:
                full_page_text = "\n\n".join(page_text_chunks)
                if len(full_page_text) > 30:
                    pages_content.append((full_page_text, page_num + 1))
        
        doc.close()
        logger.info(f"Extracted {len(pages_content)} pages from {pdf_path.name}")
        return pages_content

    def split_text_into_chunks(self, pages_content: List[Tuple[str, int]]) -> Tuple[List[str], List[Dict]]:
        if not pages_content: return [], []
        logger.info(f"Splitting {len(pages_content)} pages into chunks...")
        all_chunks, all_metadata = [], []
        
        for page_text, page_num in pages_content:
            try:
                page_docs = self.text_splitter.create_documents(
                    [page_text], metadatas=[{"page": page_num, "source": "pdf"}]
                )
                
                for doc in page_docs:
                    chunk_text = doc.page_content.strip()
                    
                    if not is_junk_text(chunk_text):
                        all_chunks.append(chunk_text)
                        all_metadata.append(doc.metadata)
                    else:
                        logger.warning(f"REJECTED chunk (junk): {chunk_text[:70]}...")
                            
            except Exception as e:
                logger.warning(f"Error splitting page {page_num}: {e}")
        
        logger.info(f"Created {len(all_chunks)} valid chunks")
        return all_chunks, all_metadata

    def generate_embeddings(self, texts: List[str]) -> np.ndarray:
        if not texts: return np.array([])
        model = self._load_embedding_model()
        logger.info(f"Generating embeddings for {len(texts)} chunks...")
        try:
            batch_size = 64
            all_embeddings = []
            for i in tqdm(range(0, len(texts), batch_size), desc="Embedding Chunks"):
                batch = texts[i:i + batch_size]
                batch_embeddings = model.encode(
                    batch, normalize_embeddings=True, batch_size=min(batch_size, 32)
                )
                all_embeddings.append(batch_embeddings)
            embeddings = np.vstack(all_embeddings).astype('float32')
            logger.info("✅ Embeddings generated successfully")
            return embeddings
        except Exception as e:
            logger.error(f"Failed to generate embeddings: {e}")
            raise

    def train_keyword_vectorizer(self, texts: List[str]) -> Tuple[TfidfVectorizer, List[str]]:
        logger.info("Training keyword vectorizer...")
        try:
            vectorizer = TfidfVectorizer(
                lowercase=True, stop_words='english', ngram_range=(1, 3),
                max_features=2000, min_df=3, max_df=0.7
            )
            vectorizer.fit(texts)
            feature_names = vectorizer.get_feature_names_out().tolist()
            combined_vocab = list(set(ALL_KEYWORDS + feature_names))
            logger.info(f"✅ Keyword vectorizer trained with {len(combined_vocab)} features")
            return vectorizer, combined_vocab
        except Exception as e:
            logger.error(f"Failed to train keyword vectorizer: {e}")
            vectorizer = TfidfVectorizer(vocabulary=ALL_KEYWORDS)
            vectorizer.fit(texts)
            return vectorizer, ALL_KEYWORDS

    def build_vector_store(self, pdf_path: Path, append: bool = False) -> Dict[str, Any]:
        results = {"success": False, "pdf_name": pdf_path.name, "chunks_processed": 0, "total_vectors": 0, "error": None}
        try:
            pages_content = self.extract_text_from_pdf(pdf_path)
            if not pages_content:
                results["error"] = "No text extracted from PDF"; return results
            
            chunks, chunk_metadata = self.split_text_into_chunks(pages_content)
            if not chunks:
                results["error"] = "No valid chunks created"; return results
            
            logger.info(f"\n--- SAMPLE CHUNKS (POST-BALANCED-CLEANING) ---")
            for i, example in enumerate(chunks[:5], 1):
                logger.info(f"Chunk {i}: {example[:250]}...")
            logger.info("------------------------------------------")
            
            for meta in chunk_metadata:
                meta['source'] = pdf_path.name
            
            embeddings = self.generate_embeddings(chunks)
            if embeddings.size == 0:
                results["error"] = "Failed to generate embeddings"; return results
            
            index, existing_texts, existing_metadata = self._load_existing_index() if append else (None, [], [])
            
            if index is not None and append:
                if index.d != embeddings.shape[1]:
                    results["error"] = f"Dimension mismatch: {index.d} vs {embeddings.shape[1]}"; return results
                offset = index.ntotal
                faiss.normalize_L2(embeddings)
                index.add(embeddings)
                for i, meta in enumerate(chunk_metadata): meta["chunk_id"] = offset + i
                all_texts = existing_texts + chunks
                all_metadata = existing_metadata + chunk_metadata
            else:
                dimension = embeddings.shape[1]
                index = faiss.IndexFlatIP(dimension)
                faiss.normalize_L2(embeddings)
                index.add(embeddings)
                for i, meta in enumerate(chunk_metadata): meta["chunk_id"] = i
                all_texts = chunks
                all_metadata = chunk_metadata
            
            self._save_vector_store(index, all_texts, all_metadata)
            
            # --- THIS IS THE CRASH FIX ---
            keyword_vectorizer, keyword_vocab = self.train_keyword_vectorizer(all_texts)
            # --- END FIX ---
            
            self._save_keyword_components(keyword_vectorizer, keyword_vocab)
            
            results.update({"success": True, "chunks_processed": len(chunks), "total_vectors": index.ntotal})
            logger.info(f"✅ Successfully processed {pdf_path.name}: {len(chunks)} chunks, {index.ntotal} total vectors")
        except Exception as e:
            results["error"] = str(e)
            logger.error(f"Failed to process {pdf_path.name}: {e}", exc_info=True)
        return results

    def _load_existing_index(self) -> Tuple:
        if not VECTOR_STORE_PATH.exists(): return None, [], []
        try:
            index = faiss.read_index(str(VECTOR_STORE_PATH))
            with open(TEXT_CHUNKS_PATH, "rb") as f: texts = pickle.load(f)
            with open(METADATA_PATH, "rb") as f: metadata = pickle.load(f)
            logger.info(f"Loaded existing index with {index.ntotal} vectors")
            return index, texts, metadata
        except Exception as e:
            logger.warning(f"Failed to load existing index: {e}")
            return None, [], []

    def _save_vector_store(self, index, texts: List[str], metadata: List[Dict]):
        try:
            faiss.write_index(index, str(VECTOR_STORE_PATH))
            with open(TEXT_CHUNKS_PATH, "wb") as f: pickle.dump(texts, f)
            with open(METADATA_PATH, "wb") as f: pickle.dump(metadata, f)
            logger.info(f"✅ Saved vector store: {index.ntotal} vectors, {len(texts)} texts")
        except Exception as e:
            logger.error(f"Failed to save vector store: {e}")
            raise

    def _save_keyword_components(self, vectorizer, vocabulary: List[str]):
        try:
            with open(KEYWORD_VECTORIZER_PATH, "wb") as f: pickle.dump(vectorizer, f)
            with open(KEYWORD_VOCAB_PATH, "wb") as f: pickle.dump(vocabulary, f)
            logger.info("✅ Saved keyword vectorizer components")
        except Exception as e:
            logger.error(f"Failed to save keyword components: {e}")
            raise

_ingestor = None

def get_ingestor() -> Ingestor:
    global _ingestor
    if _ingestor is None: _ingestor = Ingestor()
    return _ingestor

def ingest_pdf(pdf_path: str, append: bool = False) -> Dict[str, Any]:
    return get_ingestor().build_vector_store(Path(pdf_path), append)

def ingest_all_pdfs(data_dir: str = "data", append: bool = True) -> Dict[str, Any]:
    data_path = Path(data_dir)
    if not data_path.exists():
        return {"success": False, "error": f"Data directory not found: {data_dir}"}
    pdf_files = list(data_path.glob("*.pdf"))
    if not pdf_files:
        return {"success": False, "error": f"No PDF files found in {data_dir}"}
    
    logger.info(f"Found {len(pdf_files)} PDF files to process")
    ingestor = get_ingestor()
    results = {"success": True, "processed": 0, "failed": 0, "details": [], "total_vectors": 0}
    
    current_append = append
    if not append:
        logger.warning("OVERWRITE mode selected. Deleting existing vector store.")
        for f in [VECTOR_STORE_PATH, TEXT_CHUNKS_PATH, METADATA_PATH, KEYWORD_VECTORIZER_PATH, KEYWORD_VOCAB_PATH]:
            if f.exists():
                f.unlink()
    
    for i, pdf_file in enumerate(pdf_files):
        logger.info(f"\n{'='*60}\nProcessing: {pdf_file.name}\n{'='*60}")
        result = ingestor.build_vector_store(pdf_file, append=(i > 0 or append))
        results["details"].append(result)
        
        if result["success"]:
            results["processed"] += 1
            results["total_vectors"] = result.get("total_vectors", 0)
        else:
            results["failed"] += 1
            logger.error(f"Failed to process {pdf_file.name}: {result.get('error')}")
    
    results["success"] = results["processed"] > 0
    return results

def ingest_faqs(json_path: str = "data/faqs.json", append: bool = True) -> Dict[str, Any]:
    path = Path(json_path)
    if not path.exists():
        return {"success": False, "error": f"FAQ file not found: {json_path}"}
    try:
        import json
        with open(path, "r", encoding="utf-8") as f:
            faqs = json.load(f)
        texts = []
        metadata = []
        for i, item in enumerate(faqs):
            q = str(item.get("question", "")).strip()
            a = str(item.get("answer", "")).strip()
            if len(q) < 5 or len(a) < 15:
                continue
            chunk = f"Q: {q}\nA: {a}"
            if is_junk_text(chunk):
                continue
            texts.append(chunk)
            metadata.append({"source": "faq", "faq_id": i})
        if not texts:
            return {"success": False, "error": "No valid FAQ entries"}
        ingestor = get_ingestor()
        embeddings = ingestor.generate_embeddings(texts)
        if embeddings.size == 0:
            return {"success": False, "error": "Failed to generate embeddings"}
        index, existing_texts, existing_metadata = ingestor._load_existing_index() if append else (None, [], [])
        import faiss
        if index is not None and append:
            if index.d != embeddings.shape[1]:
                return {"success": False, "error": f"Dimension mismatch: {index.d} vs {embeddings.shape[1]}"}
            offset = index.ntotal
            faiss.normalize_L2(embeddings)
            index.add(embeddings)
            for i, meta in enumerate(metadata): meta["chunk_id"] = offset + i
            all_texts = existing_texts + texts
            all_metadata = existing_metadata + metadata
        else:
            dimension = embeddings.shape[1]
            index = faiss.IndexFlatIP(dimension)
            faiss.normalize_L2(embeddings)
            index.add(embeddings)
            for i, meta in enumerate(metadata): meta["chunk_id"] = i
            all_texts = texts
            all_metadata = metadata
        ingestor._save_vector_store(index, all_texts, all_metadata)
        keyword_vectorizer, keyword_vocab = ingestor.train_keyword_vectorizer(all_texts)
        ingestor._save_keyword_components(keyword_vectorizer, keyword_vocab)
        return {"success": True, "chunks_processed": len(texts), "total_vectors": index.ntotal}
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    import argparse
    # Set logging to DEBUG to see which chunks are being rejected
    logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')
    
    parser = argparse.ArgumentParser(description="Ingestion Pipeline")
    parser.add_argument('--pdf', type=str, help="Single PDF file to process")
    parser.add_argument('--data-dir', type=str, default="data", help="Directory containing PDFs")
    parser.add_argument('--faqs', type=str, default="data/faqs.json", help="FAQ JSON file to ingest")
    parser.add_argument('--overwrite', action='store_true', help="Overwrite existing vector store (default is to append)")
    
    args = parser.parse_args()
    should_append = not args.overwrite
    
    if args.pdf:
        result = ingest_pdf(args.pdf, append=should_append)
        print(f"\nResult: {result.get('error', 'Success')}")
    elif args.faqs:
        result = ingest_faqs(args.faqs, append=should_append)
        print(f"\nResult: {result.get('error', 'Success')}")
    else:
        result = ingest_all_pdfs(args.data_dir, append=should_append)
        print(f"\n{'='*60}\nINGESTION COMPLETE\n{'='*60}")
        print(f"✅ Processed: {result['processed']} files")
        print(f"❌ Failed: {result['failed']} files")
        print(f"📊 Total vectors: {result['total_vectors']}")
