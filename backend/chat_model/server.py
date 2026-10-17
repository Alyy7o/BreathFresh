import time
from typing import Optional, Dict, Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()
from pipeline.chatbot import get_chatbot
from pipeline.utils import get_vector_store
from pipeline.plan_generator import generate_7day_plan

 


class ChatMessageRequest(BaseModel):
    message: str
    user_id: str | None = None
    conversation_id: str | None = None
    model_params: Optional[Dict[str, Any]] = None


class ChatMessageResponse(BaseModel):
    success: bool
    response: str
    intent: str
    confidence: float
    used_retrieval: bool
    used_refinement: bool
    processing_time: float
    chunks_retrieved: int
    error: Optional[str] = None


 


app = FastAPI(title="QuitGuard Chat API", version="1.0.0")

# Enable permissive CORS for development; tighten in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/status")
def api_status() -> Dict[str, Any]:
    chatbot = get_chatbot()
    stats = chatbot.get_stats()
    return {
        "status": "ok",
        "stats": stats,
    }


@app.post("/api/chat", response_model=ChatMessageResponse)
def chat(req: ChatMessageRequest) -> ChatMessageResponse:
    if not req.message or not req.message.strip():
        raise HTTPException(status_code=400, detail="message must be a non-empty string")

    chatbot = get_chatbot()
    result = chatbot.process_query(req.message, model_params=req.model_params)

    # Ensure keys are present and types are JSON-serializable
    return ChatMessageResponse(
        success=bool(result.get("success", True)),
        response=str(result.get("response", "")),
        intent=str(result.get("intent", "General")),
        confidence=float(result.get("confidence", 0.0)),
        used_retrieval=bool(result.get("used_retrieval", False)),
        used_refinement=bool(result.get("used_refinement", False)),
        processing_time=float(result.get("processing_time", 0.0)),
        chunks_retrieved=int(result.get("chunks_retrieved", 0)),
        error=(result.get("error") if result.get("error") is None else str(result.get("error"))),
    )


@app.post("/api/generate-plan")
def generate_plan(req: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generate a 7-day quit plan based on user baseline and preference.
    """
    try:
        result = generate_7day_plan(req)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/reload_vectors")
def reload_vectors() -> Dict[str, Any]:
    store = get_vector_store()
    ok = store.reload()
    return {"reloaded": ok}


# Optional: simple health check
@app.get("/api/health")
def health() -> Dict[str, str]:
    return {"status": "healthy"}


# Removed SQLite init; persistence is handled by Supabase via the frontend


# Removed /api/chats endpoint; chat history is queried directly from Supabase