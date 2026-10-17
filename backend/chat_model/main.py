# main.py
import os
import sys
import logging
import time
from pathlib import Path
# from unittest import result  # <-- Removed this buggy import

# Configure logging for the main application
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('chatbot.log', mode='a', encoding='utf-8')
    ]
)

logger = logging.getLogger(__name__)

# Add project root to Python path
PROJECT_ROOT = Path(__file__).parent
sys.path.insert(0, str(PROJECT_ROOT))

# Import optimized components
try:
    from pipeline.ingest_data import get_ingestor, ingest_all_pdfs, ingest_pdf
    from pipeline.chatbot import get_chatbot, query_chatbot
    from pipeline.intent_classifier import train_intent_classifier, test_classifier_interactive
    from pipeline.utils import get_vector_store
    # We no longer need the refiner, but will import its 'getter' to avoid breaking old code
    from pipeline.refiner import get_refiner 
except ImportError as e:
    logger.error(f"❌ Failed to import pipeline components: {e}")
    print(f"\nError: Could not import required modules. Please ensure:")
    print("1. You're running from the project root directory")
    print("2. The 'pipeline' folder exists with all .py files")
    print("3. All dependencies are installed (pip install -r requirements.txt)")
    sys.exit(1)

# --- Configuration ---
DEFAULT_DATA_DIR = "data"
DEFAULT_TRAINING_CSV = "data/training_data.csv"

class ChatbotManager:
    """Central manager for the smoking cessation chatbot system."""
    
    def __init__(self):
        self.chatbot = None
        self.vector_store = None
        self.ingestor = None
        # self.refiner = None # Refiner is no longer used by chatbot
        self._initialize_components()
    
    def _initialize_components(self):
        """Initialize all components with progress tracking."""
        print("🔄 Initializing system components...")
        
        components = [
            ("Vector Store", self._init_vector_store),
            ("Chatbot", self._init_chatbot),
            ("PDF Ingestor", self._init_ingestor),
            # ("Response Refiner", self._init_refiner) # Disabled, chatbot.py doesn't use it
        ]
        
        for name, init_func in components:
            try:
                start_time = time.time()
                init_func()
                elapsed = time.time() - start_time
                print(f"   ✅ {name} initialized ({elapsed:.2f}s)")
            except Exception as e:
                print(f"   ⚠️ {name} initialization warning: {e}")
        
        print("✅ System initialization complete\n")
    
    def _init_vector_store(self):
        """Initialize vector store."""
        self.vector_store = get_vector_store()
    
    def _init_chatbot(self):
        """Initialize chatbot."""
        self.chatbot = get_chatbot()
    
    def _init_ingestor(self):
        """Initialize PDF ingestor."""
        self.ingestor = get_ingestor()
    
    # def _init_refiner(self):
    #     """Initialize response refiner."""
    #     self.refiner = get_refiner()
    
    def get_system_status(self) -> dict:
        """Get comprehensive system status."""
        status = {
            "vector_store": "Not loaded",
            "chatbot": "Not initialized", 
            "ingestor": "Not initialized",
            # "refiner": "Not initialized",
            "data_directory": "Not found",
            "training_data": "Not found"
        }
        
        # Check vector store
        if self.vector_store:
            store_stats = self.vector_store.get_stats()
            status["vector_store"] = f"Loaded ({store_stats.get('total_vectors', 0)} vectors)" if store_stats["loaded"] else "Empty"
        
        # Check chatbot
        if self.chatbot:
            status["chatbot"] = "Ready"
        
        # Check ingestor
        if self.ingestor:
            status["ingestor"] = "Ready"
        
        # Check refiner
        # if self.refiner:
        #     status["refiner"] = "Ready"
        
        # Check data directory
        data_path = Path(DEFAULT_DATA_DIR)
        if data_path.exists():
            pdf_files = list(data_path.glob("*.pdf"))
            status["data_directory"] = f"Found ({len(pdf_files)} PDFs)"
        else:
            status["data_directory"] = "Missing"
        
        # Check training data
        training_path = Path(DEFAULT_TRAINING_CSV)
        if training_path.exists():
            status["training_data"] = "Available"
        else:
            status["training_data"] = "Missing"
        
        return status

# --- UI Functions ---
def print_banner():
    """Display application banner."""
    banner = """
    ╔══════════════════════════════════════════════════════════╗
    ║                                                          ║
    ║      🚭 GENERATIVE RAG - QUIT SMOKING ASSISTANT 💬      ║
    ║                                                          ║
    ║   Your AI companion for a smoke-free journey!           ║
    ║         (Powered by Local RAG + Transformer)            ║
    ║                                                          ║
    ╚══════════════════════════════════════════════════════════╝
    """
    print(banner)

def print_menu():
    """Display main menu."""
    print("""
    ═══════════════════════════════════════════════════════
                      MAIN MENU
    ═══════════════════════════════════════════════════════
    1️⃣  Ingest PDF Books (Build Knowledge Base)
    2️⃣  Chat with Quit Smoking Assistant  
    3️⃣  Train Intent Classifier (Transformer)
    4️⃣  Test Intent Classifier (Interactive)
    5️⃣  System Status & Diagnostics
    6️⃣  Exit
    """)

def print_status(manager: ChatbotManager):
    """Display system status."""
    print("\n📊 SYSTEM STATUS & DIAGNOSTICS")
    print("═" * 50)
    
    status = manager.get_system_status()
    
    for component, state in status.items():
        icon = "✅" if "Ready" in state or "Found" in state or "Available" in state or "Loaded" in state else "❌"
        print(f"   {icon} {component.replace('_', ' ').title():<20} : {state}")
    
    print("\n💡 Recommendations:")
    if status["vector_store"] == "Empty":
        print("   • Run 'Ingest PDF Books' to build knowledge base")
    if status["training_data"] == "Missing":
        print("   • Add training_data.csv to data/ directory")
    if status["data_directory"] == "Missing":
        print("   • Create data/ directory and add PDF files")
    
    input("\nPress Enter to continue...")

# --- Mode Functions ---
def ingest_mode(manager: ChatbotManager):
    """Ingest PDF books into knowledge base."""
    print("\n📘 PDF INGESTION MODE")
    print("═" * 50)
    
    print("\nChoose ingestion method:")
    print("   1. Ingest all PDFs in data/ directory (OVERWRITE)")
    print("   2. Ingest specific PDF file (APPEND)")
    print("   3. Back to main menu")
    
    choice = input("\n👉 Select option (1-3): ").strip()
    
    if choice == "1":
        _ingest_all_pdfs(manager, append=False) # Changed to OVERWRITE
    elif choice == "2":
        _ingest_single_pdf(manager, append=True) # Changed to APPEND
    elif choice == "3":
        return
    else:
        print("❌ Invalid choice")
        input("Press Enter to continue...")

def _ingest_all_pdfs(manager: ChatbotManager, append: bool):
    """Ingest all PDFs in data directory."""
    
    mode_text = "APPENDING to" if append else "OVERWRITING"
    print(f"\n📂 Scanning {DEFAULT_DATA_DIR}/ for PDF files ({mode_text} mode)...")
    
    result = ingest_all_pdfs(DEFAULT_DATA_DIR, append=append)
    
    if result["success"]:
        print(f"\n✅ SUCCESS: Processed {result['processed']} files")
        print(f"   Total vectors in store: {result['total_vectors']}")
        if result['failed'] > 0:
            print(f"   ⚠️  Failed: {result['failed']} files")
    else:
        print(f"\n❌ FAILED: {result.get('error', 'Unknown error')}")
    
    input("\nPress Enter to continue...")

def _ingest_single_pdf(manager: ChatbotManager, append: bool):
    """Ingest a specific PDF file."""
    pdf_path = input("\n📁 Enter path to PDF file: ").strip()
    
    if not pdf_path:
        print("⚠️ No path provided")
        input("Press Enter to continue...")
        return
    
    pdf_path_obj = Path(pdf_path)
    if not pdf_path_obj.exists():
        print(f"❌ File not found: {pdf_path_obj}")
        input("Press Enter to continue...")
        return
    
    mode_text = "APPENDING to" if append else "OVERWRITING"
    print(f"\n🔄 Processing {pdf_path_obj.name} ({mode_text} mode)...")
    
    try:
        result = ingest_pdf(str(pdf_path_obj), append=append)
        
        if result["success"]:
            print(f"✅ SUCCESS: Added {result['chunks_processed']} chunks")
            print(f"   Total vectors: {result['total_vectors']}")
        else:
            print(f"❌ FAILED: {result.get('error', 'Unknown error')}")
    
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    input("\nPress Enter to continue...")

def chat_mode(manager: ChatbotManager):
    """Interactive chat mode."""
    print("\n💬 CHAT WITH QUIT SMOKING ASSISTANT")
    print("═" * 50)
    
    # Check system readiness
    status = manager.get_system_status()
    if status["vector_store"] == "Empty":
        print("❌ Knowledge base is empty. Please run PDF ingestion first.")
        input("Press Enter to continue...")
        return
    
    print("\n✅ System ready for conversation!")
    print("   Type 'quit', 'exit', or 'menu' to end session")
    print("   Type 'stats' to see conversation statistics")
    print("─" * 50)
    
    conversation_count = 0
    
    while True:
        try:
            user_input = input("\n➡️ You: ").strip()
            
            if not user_input:
                continue
            
            # Handle special commands
            if user_input.lower() in ['quit', 'exit', 'menu']:
                print("\n🤖 Stay strong on your journey! You've got this! 👋")
                break
            elif user_input.lower() == 'stats':
                stats = manager.chatbot.get_stats()
                print(f"\n📊 Conversation Stats:")
                print(f"   Total exchanges: {stats['total_queries_processed']}")
                print(f"   Avg response time: {stats['average_response_time']:.2f}s")
                continue
            
            # Process user query
            conversation_count += 1
            print("🔄 Processing...")
            
            # --- FIXED: Removed duplicate line and use result's time ---
            result = manager.chatbot.process_query(user_input)

            # Display response with metadata
            print(f"\n🤖 Bot: {result['response']}")
            print(f"\nℹ️  [Intent: {result['intent']} | Confidence: {result['confidence']:.1%} | Time: {result['processing_time']:.2f}s]")
            
            if not result['used_retrieval']:
                print("   💡 Using fallback response (no relevant knowledge found)")
            
        except KeyboardInterrupt:
            print("\n\n🛑 Session interrupted. Returning to menu...")
            break
        except Exception as e:
            print(f"\n❌ Error: {e}")
            logger.error(f"Chat error: {e}")
            print("🤖 I'm having trouble right now. Please try again.")
    
    print(f"\n💬 Session summary: {conversation_count} exchanges")
    input("Press Enter to continue...")

# --- THIS FUNCTION IS NOW FIXED ---
def train_classifier_mode(manager: ChatbotManager):
    """Train intent classifier mode."""
    print("\n🎯 TRAIN INTENT CLASSIFIER (TRANSFORMER)")
    print("═" * 50)
    
    csv_path = input(f"Enter training CSV path [default: {DEFAULT_TRAINING_CSV}]: ").strip() or DEFAULT_TRAINING_CSV
    
    training_path = Path(csv_path)
    if not training_path.exists():
        print(f"❌ Training file not found: {training_path}")
        print("💡 Please ensure your training data CSV exists")
        input("Press Enter to continue...")
        return
    
    print(f"\n🔄 Training classifier with {training_path}...")
    
    try:
        # This function now calls the new transformer trainer
        result = train_intent_classifier(str(training_path))
        
        # This logic is now fixed to read the *new* result dictionary
        if result.get("success"):
            print(f"\n✅ TRAINING COMPLETED SUCCESSFULLY!")
            print(f"   Final Test Accuracy: {result.get('test_accuracy', 0):.2%}")
            print(f"   Final Test Loss: {result.get('eval_loss', 'N/A'):.4f}")
            print(f"   Model saved to: {result.get('model_path')}")
        else:
            print(f"❌ TRAINING FAILED: {result.get('error', 'Unknown error')}")
    
    except Exception as e:
        print(f"❌ ERROR: {e}")
        logger.error(f"Training error: {e}", exc_info=True)
    
    input("\nPress Enter to continue...")

def test_classifier_mode(manager: ChatbotManager):
    """Test intent classifier mode."""
    print("\n🧪 TEST INTENT CLASSIFIER (INTERACTIVE)")
    print("═" * 50)
    
    try:
        test_classifier_interactive()
    except Exception as e:
        print(f"❌ Testing failed: {e}")
        print("💡 Please train the classifier first (Option 3)")
        logger.error(f"Classifier test error: {e}")
    
    input("\nPress Enter to continue...")

# --- Main Execution ---
def main():
    """Main application loop."""
    print("🚀 Starting Smoking Cessation Chatbot System...")
    
    # Initialize system manager
    try:
        manager = ChatbotManager()
    except Exception as e:
        logger.error(f"Failed to initialize system: {e}")
        print(f"❌ System initialization failed: {e}")
        sys.exit(1)
    
    # Main loop
    while True:
        os.system("cls" if os.name == "nt" else "clear")
        print_banner()
        print_menu()
        
        try:
            choice = input("👉 Select option (1-6): ").strip()
            
            if choice == "1":
                ingest_mode(manager)
            elif choice == "2":
                chat_mode(manager)
            elif choice == "3":
                train_classifier_mode(manager)
            elif choice == "4":
                test_classifier_mode(manager)
            elif choice == "5":
                print_status(manager)
            elif choice == "6":
                print("\n👋 Thank you for using the Quit Smoking Assistant!")
                print("   Remember: Every smoke-free day is a victory! 🎉")
                break
            else:
                print("\n❌ Invalid choice. Please enter 1-6.")
                input("Press Enter to try again...")
                
        except KeyboardInterrupt:
            print("\n\n🛑 Application interrupted. Goodbye!")
            break
        except Exception as e:
            logger.error(f"Unexpected error in main loop: {e}")
            print(f"\n❌ Unexpected error: {e}")
            input("Press Enter to continue...")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        logger.critical(f"Fatal error: {e}")
        print(f"💥 Fatal error: {e}")
        sys.exit(1)