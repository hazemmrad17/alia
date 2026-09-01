"""
ALIA Avatar - Core API Routes
"""
from fastapi import APIRouter, HTTPException
from typing import List, Optional
from loguru import logger

from app.models.schemas import (
    StartSessionRequest,
    StartSessionResponse,
    ConversationRequest,
    ConversationResponse,
    SessionStats,
    ProductKnowledge,
)
from app.conversation.orchestrator import orchestrator

router = APIRouter(tags=["alia"])


@router.post("/session/start", response_model=StartSessionResponse)
async def start_session(request: StartSessionRequest):
    """Start a new ALIA conversation session."""
    try:
        response = await orchestrator.start_session(request)
        return response
    except Exception as e:
        logger.error(f"Failed to start session: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chat", response_model=ConversationResponse)
async def chat(request: ConversationRequest):
    """Send a message to ALIA and receive a response."""
    try:
        response = await orchestrator.send_message(request)
        return response
    except Exception as e:
        logger.error(f"Chat failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/session/{session_id}")
async def get_session(session_id: str):
    """Get session details."""
    session = orchestrator.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session.model_dump()


@router.get("/session/{session_id}/history")
async def get_session_history(session_id: str):
    """Get conversation history for a session."""
    history = orchestrator.get_session_history(session_id)
    return {"session_id": session_id, "messages": history}


@router.get("/sessions")
async def list_sessions():
    """List all sessions."""
    sessions = orchestrator.get_all_sessions()
    return {
        "total": len(sessions),
        "sessions": [s.model_dump() for s in sessions],
    }


@router.get("/products")
async def list_products():
    """List all available products from the catalog."""
    # This will be populated from parsed product data
    return {
        "products": [
            {"name": "LV Fersang", "category": "Fer / Énergie", "gamme": "FERBIOTIC"},
            {"name": "LV Tétra B", "category": "Vitamines B", "gamme": "VITONIC"},
            {"name": "PULMAX antitussif", "category": "Toux - Sirop", "gamme": "PHYTOTHERA"},
            {"name": "Oligovit Vitamine C", "category": "Vitamine C", "gamme": "OLIGOVIT"},
            {"name": "Vitonic Allaitement", "category": "Allaitement", "gamme": "VITONIC"},
            {"name": "Pédiakids Crème Change", "category": "Dermatologie", "gamme": "PEDIAKIDS"},
            {"name": "CALMOSS", "category": "Calme", "gamme": "CALMOSS"},
            {"name": "OMEVIE", "category": "Omega-3", "gamme": "OMEVIE"},
            {"name": "MINCILIGNE", "category": "Perte de poids", "gamme": "MINCILIGNE"},
            {"name": "HYDRA", "category": "Hydratation", "gamme": "HYDRA"},
        ],
    }


@router.get("/levels")
async def list_levels():
    """List available ALIA competence levels."""
    return {
        "levels": [
            {
                "id": "debutant",
                "name": "Débutant",
                "description": "Scripted, basic product knowledge, 1 objection handling",
                "min_score": 7.0,
                "requirements": ["Structure respected 90%", "1 engagement per 2 visits", "No compliance errors"],
            },
            {
                "id": "junior",
                "name": "Junior",
                "description": "Interactive, 2-4 questions, 2 objections, 5-10 products",
                "min_score": 8.0,
                "requirements": ["A-C-R-V objections 70%", "Engagement 60%", "CRM complete 80%"],
            },
            {
                "id": "confirme",
                "name": "Confirmé",
                "description": "Autonomous, adapts to style, 3 objections, 15-30 products",
                "min_score": 9.0,
                "requirements": ["Difficult visits 70%", "Long cycle 60%", "Clean language 95%"],
            },
            {
                "id": "expert",
                "name": "Expert",
                "description": "Top performer, difficult visits, coaching ability",
                "min_score": 9.5,
                "requirements": ["Coaching quality 80%", "Portfolio mastery 90%"],
            },
        ],
    }


@router.get("/formats")
async def list_visit_formats():
    """List available visit formats."""
    return {
        "formats": [
            {
                "id": "flash",
                "name": "Flash",
                "duration": "20-60 seconds",
                "description": "Quick visit: Permission → 1 value → 1 benefit → 1 commitment",
                "steps": ["introduction", "argumentation", "conclusion"],
            },
            {
                "id": "standard",
                "name": "Standard",
                "duration": "2-4 minutes",
                "description": "Standard visit: Permission → 2 questions → Synthèse → Arguments → Closing",
                "steps": ["introduction", "sondage", "synthese", "objections", "argumentation", "conclusion"],
            },
            {
                "id": "approfondie",
                "name": "Approfondie",
                "duration": "5-8 minutes",
                "description": "Deep visit: Rich discovery → Segmentation → Evidence → Test plan",
                "steps": ["introduction", "sondage", "synthese", "objections", "argumentation", "conclusion"],
            },
        ],
    }
