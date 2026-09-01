"""
ALIA Avatar - Conversation Routes (WebSocket + REST)
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import List
from loguru import logger

from app.conversation.orchestrator import orchestrator
from app.models.schemas import (
    StartSessionRequest,
    ConversationRequest,
)

router = APIRouter()


class ConnectionManager:
    """WebSocket connection manager."""

    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)


manager = ConnectionManager()


@router.websocket("/ws/{session_id}")
async def websocket_conversation(websocket: WebSocket, session_id: str):
    """WebSocket endpoint for real-time conversation."""
    await manager.connect(websocket)
    logger.info(f"WebSocket connected for session {session_id}")

    try:
        while True:
            data = await websocket.receive_text()

            # Process message
            request = ConversationRequest(
                session_id=session_id,
                message=data,
            )

            response = await orchestrator.send_message(request)

            # Send response back
            await websocket.send_text(response.model_dump_json())

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info(f"WebSocket disconnected for session {session_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)


@router.post("/training/start")
async def start_training_session(request: StartSessionRequest):
    """Start a training session with specific parameters."""
    from app.models.schemas import ConversationMode
    request.mode = ConversationMode.TRAINING
    return await orchestrator.start_session(request)


@router.post("/commercial/start")
async def start_commercial_session(request: StartSessionRequest):
    """Start a commercial presentation session."""
    from app.models.schemas import ConversationMode
    request.mode = ConversationMode.COMMERCIAL
    return await orchestrator.start_session(request)
