import time
from typing import Optional, Dict, Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

from pipeline.chatbot import get_chatbot
from pipeline.plan_generator import generate_7day_plan
from pipeline.groq_client import get_groq_client


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


app = FastAPI(title="BreathFresh Chat API", version="2.0.0")

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
        "provider": "groq",
        "groq_configured": get_groq_client() is not None,
        "stats": stats,
    }


@app.post("/api/chat", response_model=ChatMessageResponse)
def chat(req: ChatMessageRequest) -> ChatMessageResponse:
    if not req.message or not req.message.strip():
        raise HTTPException(status_code=400, detail="message must be a non-empty string")

    chatbot = get_chatbot()
    result = chatbot.process_query(req.message, model_params=req.model_params)

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
    try:
        return generate_7day_plan(req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/health")
def health() -> Dict[str, str]:
    return {"status": "healthy", "provider": "groq"}
