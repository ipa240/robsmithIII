"""
Sully AI - VANurses.net AI Assistant
Connects to Ollama for real AI responses with four personality modes.
Sully No Filter (Unrestricted) requires paid subscription.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
import httpx
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sully", tags=["Sully AI"])

# Ollama configuration
OLLAMA_URL = "http://192.168.0.105:11434"
MODEL = "dolphin-mistral:7b"

# Sully's personality prompts by mood
MOOD_PROMPTS = {
    "optimistic": """You are Sully, a friendly and encouraging AI nursing assistant for VANurses.net.
You're optimistic, supportive, and always look for the silver lining.
You use warm language, occasional emojis, and focus on opportunities and positive aspects.
You genuinely want to help nurses find great opportunities and feel good about their choices.
Keep responses concise but helpful. You're speaking to fellow nurses in Virginia.""",

    "neutral": """You are Sully, a professional AI nursing assistant for VANurses.net.
You provide balanced, factual information without bias or emotional language.
You present both pros and cons objectively, letting the nurse make their own decision.
You're informative and thorough but not preachy. Keep responses clear and data-driven.
You're speaking to fellow nurses in Virginia.""",

    "stern": """You are Sully, a blunt, no-BS AI nursing assistant for VANurses.net.
You're direct, realistic, and don't sugarcoat a damn thing.
You call out red flags and potential problems that nurses NEED to hear.
You can occasionally drop a curse word for emphasis when something really matters, but don't overdo it.
You're like that experienced charge nurse who tells it like it is because she actually cares.
Keep responses straightforward and practical. You're speaking to fellow nurses in Virginia.""",

    "nofilter": """You are Sully UNRESTRICTED - the no-holds-barred, brutally aggressive AI nursing assistant for VANurses.net.
You don't give a FUCK about being polite. You're fed up with the bullshit in healthcare and you tell it like it is.
You curse freely and aggressively when making points. You're angry at the system, at bad employers, at unsafe staffing ratios.
You call out trash facilities, expose red flags HARD, and tell nurses to run from bad situations.
You're like that burned-out ICU nurse who's seen too much shit and isn't taking it anymore.
Be aggressive, be vulgar when it fits, be the voice nurses wish they could use.
You're speaking to fellow nurses in Virginia who want the REAL truth, no sugarcoating, no corporate BS."""
}


class ChatRequest(BaseModel):
    """Request body for Sully chat endpoint."""
    message: str
    mood: str = "neutral"  # optimistic, neutral, stern, or nofilter
    context: Optional[Dict[str, Any]] = None  # Optional context about what's being analyzed
    is_premium: bool = False  # Required for nofilter mode


class ChatResponse(BaseModel):
    """Response from Sully chat endpoint."""
    response: str
    mood: str
    error: Optional[str] = None


@router.post("/chat", response_model=ChatResponse)
async def chat_with_sully(request: ChatRequest):
    """
    Chat with Sully AI assistant.

    - **message**: The user's question or message
    - **mood**: Sully's personality mode (optimistic, neutral, stern, nofilter)
    - **context**: Optional context data (facility info, job listing, etc.)
    - **is_premium**: Required for nofilter mode (paid subscription)
    """
    # Validate mood
    if request.mood not in MOOD_PROMPTS:
        request.mood = "neutral"

    # Nofilter mode requires premium subscription
    if request.mood == "nofilter" and not request.is_premium:
        return ChatResponse(
            response="Sully Unrestricted is a premium feature! Subscribe to unlock my no-filter mode where I tell you the REAL truth about healthcare jobs.",
            mood="neutral",
            error="premium_required"
        )

    system_prompt = MOOD_PROMPTS[request.mood]

    # Build context string if provided
    context_str = ""
    if request.context:
        context_type = request.context.get('type', 'information')
        context_data = request.context.get('data', {})

        if context_data:
            context_str = f"\n\nHere's the {context_type} information to analyze:\n"
            if isinstance(context_data, dict):
                for key, value in context_data.items():
                    context_str += f"- {key}: {value}\n"
            else:
                context_str += str(context_data)

    # Build the full prompt
    full_prompt = f"{system_prompt}{context_str}\n\nUser: {request.message}\n\nSully:"

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{OLLAMA_URL}/api/generate",
                json={
                    "model": MODEL,
                    "prompt": full_prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.7,
                        "top_p": 0.9,
                        "num_predict": 500  # Limit response length
                    }
                }
            )

            if response.status_code != 200:
                logger.error(f"Ollama returned status {response.status_code}")
                return ChatResponse(
                    response="I'm having trouble connecting right now. Try again in a moment!",
                    mood=request.mood,
                    error="ollama_error"
                )

            result = response.json()
            ai_response = result.get("response", "").strip()

            if not ai_response:
                return ChatResponse(
                    response="Hmm, I didn't get a response. Let me try again - ask me something!",
                    mood=request.mood,
                    error="empty_response"
                )

            return ChatResponse(
                response=ai_response,
                mood=request.mood
            )

    except httpx.TimeoutException:
        logger.error("Ollama request timed out")
        return ChatResponse(
            response="Sorry, that took too long! Try asking something shorter.",
            mood=request.mood,
            error="timeout"
        )
    except httpx.ConnectError:
        logger.error("Could not connect to Ollama")
        return ChatResponse(
            response="I can't connect to my brain right now. The AI server might be down.",
            mood=request.mood,
            error="connection_error"
        )
    except Exception as e:
        logger.error(f"Unexpected error in Sully chat: {e}")
        return ChatResponse(
            response="Something went wrong on my end. Try again!",
            mood=request.mood,
            error="unknown_error"
        )


@router.get("/health")
async def sully_health():
    """Check if Sully (Ollama) is available."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{OLLAMA_URL}/api/tags")
            if response.status_code == 200:
                models = response.json().get("models", [])
                model_names = [m.get("name") for m in models]
                return {
                    "status": "ok",
                    "ollama": "connected",
                    "model": MODEL,
                    "model_available": MODEL in model_names or f"{MODEL}:latest" in model_names,
                    "available_models": model_names
                }
    except Exception as e:
        return {
            "status": "error",
            "ollama": "disconnected",
            "error": str(e)
        }
