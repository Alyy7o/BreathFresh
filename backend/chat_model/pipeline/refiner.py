"""Fallback response templates (LLM calls now go through Groq)."""

from __future__ import annotations


def _get_fallback_response(intent: str) -> str:
    fallbacks = {
        "Craving_Urgent": "Take a deep breath right now - breathe in slowly for 4 counts, hold for 4, and exhale for 4. This craving will pass in just a few minutes. Try drinking cold water, going for a quick walk, or calling a supportive friend. You're stronger than this urge, and each craving you resist makes you stronger.",
        "Relapse_Support": "It's completely okay to have a slip - this doesn't erase all your progress or make you a failure. What matters most is that you're here right now, recommitting to your quit journey. Take a moment to reflect on what triggered this slip, then forgive yourself and move forward.",
        "Coping_Strategies": "Try the 4 D's: Delay (wait 5 minutes), Deep breathe, Drink water, and Do something else. These interrupt the craving cycle and give your brain something else to focus on.",
        "Trigger_Management": "Identify your specific triggers - situations, emotions, people, or places that make you want to smoke - then prepare a coping plan before you face them.",
        "Motivation": "Remember why you decided to quit - health, family, money, or control. Every smoke-free moment is your body healing and your future getting stronger.",
        "Encouragement": "Choosing not to smoke is one of the hardest and most important things you can do for yourself. Keep going, one moment at a time.",
        "Awareness_Education": "Quitting has immediate benefits - blood pressure drops, circulation improves, and your lungs begin to clear. The journey gets easier with time.",
        "Plan_Creation": "Set a quit date, tell supportive people, map your top triggers, and prepare coping tools before hard moments hit.",
        "General": "I'm here to support your smoke-free journey. Whether you're dealing with cravings, need motivation, or want coping ideas, tell me what's going on.",
        "Faq_Assisted": "I'm here to support your smoke-free journey. Share what you're feeling and I'll help with a practical next step.",
    }
    return fallbacks.get(intent, fallbacks["General"])


def get_refiner(model_name: str = None):
    return None


def refine_response(rag_context: str, intent: str = "General", query: str = "") -> str:
    return _get_fallback_response(intent)


def post_process_response(text: str, max_length: int = 500) -> str:
    return (text or "").replace("**", "")
