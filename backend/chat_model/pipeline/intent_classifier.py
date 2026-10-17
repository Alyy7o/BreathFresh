import os
import pickle
import numpy as np
from pathlib import Path
from typing import Tuple, List, Dict, Optional, Any
import logging
import time
import json
import pandas as pd


logger = logging.getLogger(__name__)

# --- NEW IMPORTS ---
try:
    import torch
    from transformers import (
        AutoTokenizer, 
        AutoModelForSequenceClassification,
        TrainingArguments,
        Trainer
    )
    from datasets import load_dataset, Features, Value, Dataset
    # --- THIS IS THE FIX ---
    import evaluate # Use the new 'evaluate' library
    # --- END FIX ---
except ImportError as e:
    logger.error(f"Missing required libraries. Please run: pip install transformers torch datasets accelerate evaluate")
    exit(1)

# --- LOCAL PATH CONFIGURATION ---
MODEL_DIR = Path("models")
MODEL_PATH = MODEL_DIR / "intent_classifier_model" # This is now a DIRECTORY
LABEL_MAP_PATH = MODEL_DIR / "intent_label_map.json"
DEFAULT_CSV_PATH = "data/training_data.csv"
BASE_MODEL_NAME = "distilbert-base-uncased"
MODEL_DIR.mkdir(exist_ok=True)


class IntentClassifier:
    """
    Fine-tuned Transformer-based intent classifier.
    """
    
    def __init__(self):
        self.model = None
        self.tokenizer = None
        self.label_map = None
        self.id_to_label = None
        # This will correctly select CPU
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.is_trained = MODEL_PATH.exists()

    def _load_model(self):
        """Load the fine-tuned model from disk for prediction."""
        if self.model:
            return True
        
        if not self.is_trained:
            logger.error(f"Model not found at {MODEL_PATH}. Please run training first.")
            return False
            
        try:
            logger.info(f"🚀 Loading fine-tuned intent model from {MODEL_PATH}...")
            start_time = time.time()
            self.model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH).to(self.device)
            self.tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
            
            with open(LABEL_MAP_PATH, 'r') as f:
                self.label_map = json.load(f)
            # Create reverse mapping
            self.id_to_label = {v: k for k, v in self.label_map.items()}
            
            load_time = time.time() - start_time
            logger.info(f"✅ Intent model loaded in {load_time:.2f}s")
            return True
        except Exception as e:
            logger.error(f"Failed to load fine-tuned model: {e}", exc_info=True)
            return False

    def train(self, csv_path: str = DEFAULT_CSV_PATH) -> Dict[str, Any]:
        """Fine-tune a new intent classifier."""
        logger.info("--- Starting Transformer Fine-Tuning ---")
        
        if not torch.cuda.is_available():
            logger.warning("="*50)
            logger.warning("⚠️ WARNING: No GPU detected. Training will be VERY SLOW.")
            logger.warning("Training on CPU may take 1-2 hours. Please be patient.")
            logger.warning("="*50)
            time.sleep(3) # Give user time to see the warning

        try:
            # 1. Load the dataset "dumbly" first
            logger.info(f"Loading data from {csv_path} using pandas...")
            df = pd.read_csv(csv_path)
            original_count = len(df)
            
            # 2. Drop all rows that have ANY missing data in 'text' or 'intent'
            df.dropna(subset=['text', 'intent'], inplace=True)
            new_count = len(df)
            
            if original_count != new_count:
                logger.warning(f"Filtered out {original_count - new_count} rows with missing text or intent.")
            
            # 3. Convert the 100% clean pandas DataFrame into a 'datasets' object
            logger.info("Converting clean DataFrame to Hugging Face Dataset...")
            dataset = Dataset.from_pandas(df)

            # 4. Create label mappings
            unique_labels = sorted(list(set(dataset['intent'])))
            label_map = {label: i for i, label in enumerate(unique_labels)}
            id_to_label = {i: label for i, label in enumerate(unique_labels)}
            num_labels = len(unique_labels)

            logger.info(f"Found {num_labels} intents: {', '.join(unique_labels)}")
            
            # 5. Load Tokenizer
            tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL_NAME)
            
            # 6. Preprocessing function
            def preprocess_function(examples):
                examples['label'] = [label_map[label] for label in examples['intent']]
                return tokenizer(examples['text'], truncation=True, max_length=128, padding="max_length")

            # 7. Tokenize dataset
            logger.info("Tokenizing dataset...")
            tokenized_dataset = dataset.map(preprocess_function, batched=True)
            
            # 8. Split into train/test
            tokenized_splits = tokenized_dataset.train_test_split(test_size=0.2, shuffle=True, seed=42)
            train_dataset = tokenized_splits['train']
            eval_dataset = tokenized_splits['test']

            # 9. Load Base Model
            logger.info(f"Loading base model '{BASE_MODEL_NAME}' for classification...")
            model = AutoModelForSequenceClassification.from_pretrained(
                BASE_MODEL_NAME, 
                num_labels=num_labels,
                id2label=id_to_label,
                label2id=label_map
            )

            # 10. Define Training Arguments
            training_args = TrainingArguments(
                output_dir=str(MODEL_DIR / "training_checkpoints"),
                logging_dir=str(MODEL_DIR / "training_logs"),
                num_train_epochs=3,
                per_device_train_batch_size=16,
                per_device_eval_batch_size=16,
                warmup_steps=50,
                weight_decay=0.01,
                logging_steps=10,
                eval_strategy="epoch",
                save_strategy="epoch",
                load_best_model_at_end=True,
                save_total_limit=1,
            )

            # --- THIS IS THE FIX ---
            logger.info("Setting up accuracy metric...")
            # Load the accuracy metric from 'evaluate'
            metric = evaluate.load("accuracy")

            def compute_metrics(eval_pred):
                logits, labels = eval_pred
                predictions = np.argmax(logits, axis=-1)
                return metric.compute(predictions=predictions, references=labels)
            # --- END FIX ---

            # 11. Create Trainer
            trainer = Trainer(
                model=model,
                args=training_args,
                train_dataset=train_dataset,
                eval_dataset=eval_dataset,
                compute_metrics=compute_metrics,  # Pass the function here
            )

            # 12. Train!
            logger.info("🚀 Starting model training...")
            trainer.train()
            logger.info("✅ Training complete.")

            # 13. Evaluate
            logger.info("📊 Evaluating model...")
            eval_results = trainer.evaluate()
            logger.info(f"Evaluation Results: {eval_results}")
            
            # 14. Save the final model and tokenizer
            logger.info(f"Saving final model to {MODEL_PATH}...")
            trainer.save_model(str(MODEL_PATH))
            tokenizer.save_pretrained(str(MODEL_PATH))
            
            # 15. Save the label map
            with open(LABEL_MAP_PATH, 'w') as f:
                json.dump(label_map, f)
                
            self.is_trained = True

            return {
                "success": True,
                # Pass the accuracy from the eval results
                "test_accuracy": eval_results.get("eval_accuracy", 0), 
                "eval_loss": eval_results.get("eval_loss", 0),
                "model_path": str(MODEL_PATH)
            }

        except Exception as e:
            logger.error(f"Training failed: {e}", exc_info=True)
            return {"success": False, "error": str(e)}

    def predict(self, query: str, min_confidence: float = 0.3) -> Tuple[str, float]:
        """Predict intent with the fine-tuned model."""
        
        if not self.model:
            if not self._load_model():
                logger.warning("Model not loaded, using keyword fallback.")
                return _fast_keyword_fallback(query)

        if not query or not isinstance(query, str):
            return "General", 0.0
        
        try:
            inputs = self.tokenizer(
                query, 
                return_tensors="pt", 
                truncation=True, 
                max_length=128,
                padding=True
            ).to(self.device)
            
            with torch.no_grad():
                outputs = self.model(**inputs)
            
            probabilities = torch.softmax(outputs.logits, dim=-1)[0]
            
            confidence, predicted_index = torch.max(probabilities, dim=0)
            confidence = confidence.item()
            predicted_index = predicted_index.item()
            
            predicted_intent = self.id_to_label[predicted_index]
            
            if confidence < min_confidence:
                logger.debug(f"Low confidence ({confidence:.2f}) for query: '{query}'")
                return _fast_keyword_fallback(query, default_intent="General")
            
            return predicted_intent, float(confidence)
            
        except Exception as e:
            logger.error(f"Prediction error for '{query}': {e}")
            return _fast_keyword_fallback(query, default_intent="General")
    
    def predict_top_k(self, query: str, top_k: int = 3) -> List[Tuple[str, float]]:
        if not self.model:
            if not self._load_model():
                return [("General", 0.0)]
        
        try:
            inputs = self.tokenizer(
                query, return_tensors="pt", truncation=True, max_length=128
            ).to(self.device)
            
            with torch.no_grad():
                outputs = self.model(**inputs)
            
            probabilities = torch.softmax(outputs.logits, dim=-1)[0]
            
            top_probs, top_indices = torch.topk(probabilities, top_k)
            
            top_probs = top_probs.cpu().numpy()
            top_indices = top_indices.cpu().numpy()
            
            return [
                (self.id_to_label[idx], float(prob))
                for idx, prob in zip(top_indices, top_probs)
            ]
        except Exception as e:
            logger.error(f"Top-K prediction error: {e}")
            return [("General", 0.0)]

# Global instance and helper functions
_classifier_instance = None

def get_classifier() -> IntentClassifier:
    """Get or create classifier instance."""
    global _classifier_instance
    if _classifier_instance is None:
        _classifier_instance = IntentClassifier()
    return _classifier_instance 

def predict_intent(query: str, min_confidence: float = 0.3) -> Tuple[str, float]:
    """Public interface for intent prediction."""
    classifier = get_classifier()
    return classifier.predict(query, min_confidence)

def _fast_keyword_fallback(query: str, default_intent: str = "General") -> Tuple[str, float]:
    query_lower = query.lower()
    if any(k in query_lower for k in ['now', 'right now', 'immediate', 'urgent', 'strong craving']):
        return "Craving_Urgent", 0.7
    if any(k in query_lower for k in ['craving', 'urge', 'want smoke', 'need cigarette']):
        return "Craving_Urgent", 0.65
    if any(k in query_lower for k in ['relapse', 'slipped', 'smoked again', 'failed', 'messed up', 'guilty']):
        return "Relapse_Support", 0.7
    if any(k in query_lower for k in ['how to', 'what should', 'what can', 'method', 'strategy', 'technique', 'cope']):
        return "Coping_Strategies", 0.6
    if any(k in query_lower for k in ['why', 'reason', 'benefit', 'motivation', 'worth it']):
        return "Motivation", 0.6
    if any(k in query_lower for k in ['hello', 'hi', 'hey', 'thanks', 'thank you', 'bye']):
        return "General", 0.8
    return default_intent, 0.5

def get_top_intents(query: str, top_k: int = 3) -> List[Tuple[str, float]]:
    classifier = get_classifier()
    return classifier.predict_top_k(query, top_k)

def train_intent_classifier(csv_path: str = DEFAULT_CSV_PATH) -> Dict[str, Any]:
    """Public training interface."""
    classifier = IntentClassifier()
    results = classifier.train(csv_path)
    
    if results.get("success"):
        # Reset global instance to force re-load of the new model
        global _classifier_instance
        _classifier_instance = None 
    
    return results

def test_classifier_interactive():
    """Enhanced interactive testing."""
    print("\n--- Interactive Transformer Classifier Test ---")
    classifier = get_classifier()
    
    if not classifier.is_trained:
        # Check if the model *can* be loaded, even if not trained this session
        if not classifier._load_model():
            print("❌ Model not found. Please run training first.")
            return
    
    print("Type queries to test (or 'exit'/'quit' to stop):\n")
    
    while True:
        try:
            query = input("➡️ Query: ").strip()
            if query.lower() in ['exit', 'quit', 'q']:
                break
            if not query:
                continue
            
            start_time = time.time()
            intent, confidence = predict_intent(query)
            pred_time = time.time() - start_time
            
            print(f"  🎯 Intent: {intent} (Confidence: {confidence:.2%})")
            print(f"  ⏱️  Time: {pred_time*1000:.2f} ms")
            
            top_intents = get_top_intents(query, 3)
            if len(top_intents) > 1:
                print("  📋 Top predictions:")
                for i, (intent_name, conf) in enumerate(top_intents, 1):
                    print(f"     {i}. {intent_name}: {conf:.2%}")
            print("-" * 40)
            
        except KeyboardInterrupt:
            print("\n\n👋 Exiting...")
            break
        except Exception as e:
            print(f"  ❌ Error: {e}")

if __name__ == "__main__":
    import argparse
    logging.basicConfig(level=logging.INFO)
    parser = argparse.ArgumentParser(description="Intent Classifier Management (Transformer)")
    parser.add_argument('mode', nargs='?', choices=['train', 'test'], default='test',
                       help="Mode: 'train' to fine-tune, 'test' for interactive testing")
    parser.add_argument('--data', default=DEFAULT_CSV_PATH, help="Path to training CSV")
    
    args = parser.parse_args()
    
    if args.mode == 'train':
        results = train_intent_classifier(args.data)
        if results.get("success"):
            print("\n✅ Training completed successfully!")
            print(f"   Accuracy: {results.get('test_accuracy', 0):.2%}")
            test_classifier_interactive()
        else:
            print(f"❌ Training failed: {results.get('error', 'Unknown error')}")
    else:
        test_classifier_interactive()