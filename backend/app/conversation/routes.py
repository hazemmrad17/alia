"""
ALIA Avatar - Conversation Routes (WebSocket + REST)

The WebSocket carries the spoken exchange. Protocol:

  Client -> server (text frames)
    "bonjour docteur"                      legacy: plain text message
    {"type":"text",  "message": "...", ...session params}
    {"type":"audio", "data":"<base64>", "mime":"audio/webm", "language":"fr", ...params}
    {"type":"ping"}

  Server -> client (JSON text frames)
    {...ConversationResponse}              legacy reply, for plain-text messages
    {"type":"status", "state":"transcribing"|"thinking"|"speaking"}
    {"type":"transcript", "text": "..."}
    {"type":"reply", "message":"...", "current_step":"...", "score_update":{...}, "session_id":"..."}
    {"type":"audio", "data":"<base64 mp3>", "seq": 0}
    {"type":"audio_end", "chunks": 3, "mime": "audio/mpeg", "tts_error": null}
    {"type":"error", "scope":"stt"|"tts"|"conversation", "code": "...", "env": "...", "message": "..."}

Session params (optional on every message): mode, level, visit_format, style.
"""
import base64
import json
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from loguru import logger

from app.avatar.tts import AUDIO_MIME, VoiceUnavailable, stt_engine, tts_engine
from app.conversation.orchestrator import orchestrator
from app.models.schemas import (
    ConversationMode,
    ConversationRequest,
    DoctorProfile,
    DoctorStyle,
    StartSessionRequest,
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
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)


manager = ConnectionManager()


def _session_kwargs(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Pull the optional session parameters out of an inbound frame."""
    kwargs: Dict[str, Any] = {}
    if payload.get("mode"):
        kwargs["mode"] = ConversationMode(payload["mode"])
    if payload.get("level"):
        kwargs["level"] = payload["level"]
    if payload.get("visit_format"):
        kwargs["visit_format"] = payload["visit_format"]
    if payload.get("style"):
        kwargs["doctor_profile"] = DoctorProfile(style=DoctorStyle(payload["style"]))
    return kwargs


async def _send_json(websocket: WebSocket, frame: Dict[str, Any]) -> None:
    await websocket.send_text(json.dumps(frame, default=str))


async def _handle_text_turn_streamed(websocket: WebSocket, message: str, session_id: str, payload: Dict[str, Any]) -> None:
    """Typed-message turn, streamed token by token.

    Frame sequence: {status thinking} → {token ...}× → {reply_end} →
    optionally the TTS audio block for the finished reply.
    """
    await _send_json(websocket, {"type": "status", "state": "thinking"})
    pieces: List[str] = []
    try:
        request = ConversationRequest(session_id=session_id, message=message, **_session_kwargs(payload))
        async for token in orchestrator.send_message_stream(request):
            pieces.append(token)
            await _send_json(websocket, {"type": "token", "value": token})
    except Exception as e:  # noqa: BLE001
        logger.error(f"Conversation failed: {e}")
        if pieces:
            await _send_json(websocket, {"type": "reply_end", "interrupted": True})
            return
        await _send_json(websocket, {"type": "error", "scope": "conversation", "code": "chat_failed", "message": str(e)})
        return

    await _send_json(websocket, {"type": "reply_end", "interrupted": False})

    # Optional speech for the completed reply.
    if tts_engine.available and payload.get("speak", False):
        await _stream_tts(websocket, "".join(pieces))


async def _handle_text_turn(websocket: WebSocket, message: str, session_id: str, payload: Dict[str, Any]) -> None:
    """Legacy behaviour: reply with the ConversationResponse JSON, but also
    speak it when TTS is configured."""
    request = ConversationRequest(session_id=session_id, message=message, **_session_kwargs(payload))
    response = await orchestrator.send_message(request)

    # Clients written against the original protocol expect the bare response.
    await websocket.send_text(response.model_dump_json())

    if tts_engine.available and payload.get("speak", False):
        await _stream_tts(websocket, response.message)


async def _stream_tts(websocket: WebSocket, text: str) -> None:
    """Stream a reply as base64 MP3 frames, then close the audio block."""
    await _send_json(websocket, {"type": "status", "state": "speaking"})
    seq = 0
    try:
        async for chunk in tts_engine.stream(text):
            await _send_json(
                websocket,
                {"type": "audio", "data": base64.b64encode(chunk).decode("ascii"), "seq": seq},
            )
            seq += 1
        await _send_json(websocket, {"type": "audio_end", "chunks": seq, "mime": AUDIO_MIME, "tts_error": None})
    except VoiceUnavailable as e:
        await _send_json(
            websocket,
            {"type": "error", "scope": "tts", "code": "voice_unavailable", "env": e.env_var, "message": str(e)},
        )
        await _send_json(websocket, {"type": "audio_end", "chunks": seq, "tts_error": str(e)})
    except Exception as e:  # noqa: BLE001 - text reply already delivered
        logger.error(f"TTS streaming failed on session: {e}")
        await _send_json(websocket, {"type": "error", "scope": "tts", "code": "tts_failed", "message": str(e)})
        await _send_json(websocket, {"type": "audio_end", "chunks": seq, "tts_error": str(e)})


async def _handle_audio_turn(websocket: WebSocket, payload: Dict[str, Any], session_id: str) -> None:
    """One spoken exchange: audio in, transcript + reply + audio out."""
    encoded = payload.get("data") or ""
    try:
        audio = base64.b64decode(encoded)
    except Exception as e:  # noqa: BLE001
        await _send_json(websocket, {"type": "error", "scope": "stt", "code": "bad_audio", "message": str(e)})
        return

    if not audio:
        await _send_json(websocket, {"type": "error", "scope": "stt", "code": "empty_audio", "message": "Empty audio payload"})
        return

    # 1. Speech -> text
    await _send_json(websocket, {"type": "status", "state": "transcribing"})
    try:
        transcript = await stt_engine.transcribe(
            audio,
            filename=payload.get("filename") or "utterance.webm",
            language=payload.get("language") or "fr",
        )
    except VoiceUnavailable as e:
        await _send_json(
            websocket,
            {"type": "error", "scope": "stt", "code": "voice_unavailable", "env": e.env_var, "message": str(e)},
        )
        return
    except Exception as e:  # noqa: BLE001
        logger.error(f"STT failed: {e}")
        await _send_json(websocket, {"type": "error", "scope": "stt", "code": "stt_failed", "message": str(e)})
        return

    if not transcript:
        await _send_json(websocket, {"type": "error", "scope": "stt", "code": "no_speech", "message": "No speech detected"})
        return

    await _send_json(websocket, {"type": "transcript", "text": transcript})

    # 2. Text -> ALIA's reply, streamed token by token
    await _send_json(websocket, {"type": "status", "state": "thinking"})
    try:
        request = ConversationRequest(session_id=session_id, message=transcript, **_session_kwargs(payload))
        pieces: List[str] = []
        async for token in orchestrator.send_message_stream(request):
            pieces.append(token)
            await _send_json(websocket, {"type": "token", "value": token})
    except Exception as e:  # noqa: BLE001
        logger.error(f"Conversation failed: {e}")
        if pieces:
            # Partial reply already streamed - close it gracefully.
            await _send_json(websocket, {"type": "reply_end", "interrupted": True})
            return
        await _send_json(websocket, {"type": "error", "scope": "conversation", "code": "chat_failed", "message": str(e)})
        return

    await _send_json(
        websocket,
        {
            "type": "reply_end",
            "interrupted": False,
            "current_step": session_ref.current_step.value
            if hasattr((session_ref := orchestrator.sessions.get(session_id)), "current_step")
            else None,
        },
    )

    # 3. Reply -> speech (optional)
    # `response` never exists on this path (the reply was streamed token by
    # token), so speaking it used to raise NameError: the socket died right
    # after every spoken turn and the reply was never heard.
    if tts_engine.available:
        await _stream_tts(websocket, "".join(pieces))
    else:
        error = f"TTS disabled (set {tts_engine.env_var})"
        await _send_json(websocket, {"type": "audio_end", "chunks": 0, "tts_error": error})


@router.websocket("/ws/{session_id}")
async def websocket_conversation(websocket: WebSocket, session_id: str):
    """Real-time conversation: typed messages and spoken turns."""
    await manager.connect(websocket)
    logger.info(f"WebSocket connected for session {session_id}")

    try:
        while True:
            raw = await websocket.receive_text()

            # Structured frames are JSON objects; anything else is a plain message.
            payload: Dict[str, Any] = {}
            kind = "text"
            message = raw
            if raw.lstrip().startswith("{"):
                try:
                    parsed = json.loads(raw)
                    if isinstance(parsed, dict):
                        payload = parsed
                        kind = str(parsed.get("type") or "text")
                        message = str(parsed.get("message") or "")
                except json.JSONDecodeError:
                    pass  # treat as plain text

            if kind == "ping":
                await _send_json(websocket, {"type": "pong"})
            elif kind == "audio":
                await _handle_audio_turn(websocket, payload, session_id)
            else:
                if not message.strip():
                    continue
                if payload.get("stream", True):
                    await _handle_text_turn_streamed(websocket, message, session_id, payload)
                else:
                    await _handle_text_turn(websocket, message, session_id, payload)

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
