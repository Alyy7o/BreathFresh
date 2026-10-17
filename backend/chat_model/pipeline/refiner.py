import re
import logging
from typing import Optional, Dict, Any, List
from functools import lru_cache
import os

logger = logging.getLogger(__name__)

# Prefer new google-genai package; fall back gracefully if missing.
try:
    from google import genai  # type: ignore
except ImportError:  # pragma: no cover
    genai = None
    logger.warning("google-genai not installed. Refiner will use fallbacks.")

# Try to initialize the Gemini client
api_key = os.environ.get("GEMINI_API_KEY")
client = None

if not api_key or api_key == "your_api_key_here":
    logger.warning("No valid Gemini API key found in environment. Refiner will use fallbacks.")
elif genai is None:
    client = None
else:
    try:
        client = genai.Client(api_key=api_key)
    except Exception as e:
        logger.warning(f"Could not initialize Gemini Client: {e}. Refiner will use fallbacks.")
        client = None


# =============================================================================
# HIGH-QUALITY FALLBACK RESPONSES
# Used if API call fails or API key is not provided.
# =============================================================================

def _get_fallback_response(intent: str) -> str:
    """High-quality fallback responses when no context is available."""
    fallbacks = {
        "Craving_Urgent": "Take a deep breath right now - breathe in slowly for 4 counts, hold for 4, and exhale for 4. This craving will pass in just a few minutes. Try drinking cold water, going for a quick walk, or calling a supportive friend. You're stronger than this urge, and each craving you resist makes you stronger.",
        
        "Relapse_Support": "It's completely okay to have a slip - this doesn't erase all your progress or make you a failure. What matters most is that you're here right now, recommitting to your quit journey. Take a moment to reflect on what triggered this slip, then forgive yourself and move forward. You've learned something valuable, and each day smoke-free still counts.",
        
        "Coping_Strategies": "Try the 4 D's: Delay (wait 5 minutes), Deep breathe (slow, calming breaths), Drink water (keeps your mouth and hands busy), and Do something else (change your activity or location). These strategies work because they interrupt the craving cycle and give your brain something else to focus on. Pick the one that feels easiest right now and give it a try.",
        
        "Trigger_Management": "Start by identifying your specific triggers - situations, emotions, people, or places that make you want to smoke. Once you know your triggers, you can create a plan to avoid them when possible and cope with them when you can't. Having a strategy ready before you encounter a trigger makes it much easier to stay smoke-free.",
        
        "Motivation": "Remember why you decided to quit - whether it's for your health, your family, saving money, or feeling more in control of your life. Within just 20 minutes of quitting, your heart rate drops; within 24 hours, your risk of heart attack decreases. Every moment you stay smoke-free, your body is healing and you're investing in your future.",
        
        "Encouragement": "What you're doing right now - choosing not to smoke - is one of the most difficult and important things you can do for yourself. You're showing incredible strength and commitment. I'm proud of you, and you should be proud of yourself too. Keep going, one moment at a time.",
        
        "Awareness_Education": "Quitting smoking has immediate and long-term health benefits. Within hours, your body begins to heal - your blood pressure drops, circulation improves, and your lungs start to clear. The journey gets easier over time as your body adjusts to being smoke-free.",
        
        "Plan_Creation": "Creating a quit plan is an excellent first step. Start by setting a specific quit date within the next 2 weeks, tell friends and family for support, and identify your biggest triggers so you can prepare strategies to handle them. Consider whether you want to use nicotine replacement therapy or other cessation aids, and line up support resources like a quitline or counselor.",
        
        "General": "I'm here to support your journey to quit smoking. Whether you're dealing with cravings, need motivation, want to learn coping strategies, or just need to talk, I'm here to help. What's on your mind today?"
    }
    return fallbacks.get(intent, fallbacks["General"])

# =============================================================================
# MODULE-LEVEL FUNCTIONS 
# =============================================================================

def get_refiner(model_name: str = None):
    """
    Returns the Gemini Client if available, else None.
    """
    return client

def refine_response(
    rag_context: str,
    intent: str = "General",
    query: str = ""
) -> str:
    """
    Given the retrieved RAG context, formulate a perfect response using Gemini LLM.
    If no client or API error occurs, falls back gracefully to templates.
    """
    if client is None:
        logger.warning("Gemini Client not initialized. Using fallback.")
        return _get_fallback_response(intent)
        
    prompt = f"""You are the BreathFresh AI Assistant, an empathetic, encouraging, and highly knowledgeable stop-smoking coach.
A user has asked a question with the intent classified as: {intent}

USER QUERY:
"{query}"

SEARCHED KNOWLEDGE BASE CONTEXT (Some of this may be slightly fragmented or irrelevant, use your best judgment):
{rag_context}

INSTRUCTIONS:
1. Provide a conversational, empathetic, and highly supportive response directly addressing the user's query.
2. Incorporate factual information and strategies from the SEARCHED KNOWLEDGE BASE CONTEXT if it is relevant to the question.
3. Keep the response to 2-3 short, modern, easy-to-read paragraphs.
4. Do NOT mention that you searched a knowledge base or used context. Just answer as the expert coach.
5. If the user query is simple conversational chit-chat like "Hello!" or "How are you?", ignore the context and just reply naturally as the BreathFresh Assistant."""

    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt
        )
        return response.text.strip()
    except Exception as e:
        logger.error(f"Error during Gemini refinement: {e}")
        return _get_fallback_response(intent)

def post_process_response(text: str, max_length: int = 500) -> str:
    """
    Basic post-processing cleanup.
    """
    # Just basic cleanup of markdown artifacts if needed
    text = text.replace("**", "")
    return text