"""
ALIA Avatar - Voice routes

The full spoken turn:
    browser mic audio -> Whisper STT -> conversation orchestrator
    (RAG + LLM + visit FSM) -> ElevenLabs TTS -> browser playback

    GET  /api/v1/voice/status      what is configured (drives the UI)
    POST /api/v1/voice/transcribe  audio file -> transcript
    POST /api/v1/voice/speak       text -> streamed MP3 (greeting / replay)
    POST /api/v1/voice/turn        audio file -> transcript + reply + MP3

Both providers are optional: when a key is missing these endpoints answer 503
with a machine-readable `code` and the `env` variable to set, so the client can
say exactly what is missing instead of failing silently.
"""
import base64
from typing import Dict, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from loguru import logger
from pydantic import BaseModel

from app.avatar.tts import AUDIO_MIME, VoiceUnavailable, stt_engine, tts_engine
from app.conversation.orchestrator import orchestrator
from app.models.schemas import (
    CompetenceLevel,
    ConversationMode,
    ConversationRequest,
    DoctorProfile,
    DoctorStyle,
    VisitFormat,
    VisitStep,
)

router = APIRouter(tags=["voice"])


# ──────────────────────────────────────────────
# Schemas
# ──────────────────────────────────────────────

class ProviderStatus(BaseModel):
    available: bool
    provider: str
    model: str
    env: str


class VoiceStatusResponse(BaseModel):
    stt: ProviderStatus
    tts: ProviderStatus
    # Free neural-voice fallback used when ElevenLabs is unavailable.
    tts_fallback: Optional[ProviderStatus] = None
    voice_id: Optional[str] = None


class SpeakRequest(BaseModel):
    text: str
    voice_id: Optional[str] = None


class TranscribeResponse(BaseModel):
    text: str
    language: str


class VoiceTurnResponse(BaseModel):
    session_id: str
    transcript: str
    reply: str
    current_step: VisitStep
    score_update: Optional[Dict[str, float]] = None
    audio_base64: Optional[str] = None
    audio_mime: str = AUDIO_MIME
    tts_error: Optional[str] = None


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def _unavailable(exc: VoiceUnavailable) -> HTTPException:
    return HTTPException(
        status_code=503,
        detail={
            "code": "voice_unavailable",
            "provider": exc.provider,
            "env": exc.env_var,
            "message": str(exc),
        },
    )


def _conversation_request(
    transcript: str,
    session_id: Optional[str],
    mode: str,
    level: str,
    visit_format: str,
    style: Optional[str],
) -> ConversationRequest:
    """Build a conversation request from the voice metadata sent by the client."""
    payload = {
        "session_id": session_id or None,
        "message": transcript,
        "mode": mode,
        "level": level,
        "visit_format": visit_format,
    }
    if style:
        payload["doctor_profile"] = DoctorProfile(style=DoctorStyle(style))

    try:
        return ConversationRequest(**payload)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=f"Invalid voice session parameters: {e}") from e


# ──────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────

@router.get("/status", response_model=VoiceStatusResponse)
async def voice_status() -> VoiceStatusResponse:
    """Report which voice providers are configured. The UI uses this to decide
    whether the mic button is usable and whether replies can be spoken."""
    return VoiceStatusResponse(
        stt=ProviderStatus(
            available=stt_engine.available,
            provider=stt_engine.provider,
            model=stt_engine.model,
            env=stt_engine.env_var,
        ),
        tts=ProviderStatus(
            # `available` is true when ANY engine can speak: ElevenLabs or the
            # free Edge neural voices used as fallback.
            available=tts_engine.available,
            provider=tts_engine.provider,
            model=tts_engine.model,
            env=tts_engine.env_var,
        ),
        tts_fallback=ProviderStatus(
            available=tts_engine.fallback.available,
            provider=tts_engine.fallback.provider,
            model=tts_engine.fallback.voice,
            env=tts_engine.fallback.env_var,
        ),
        voice_id=tts_engine.voice_id if tts_engine.api_key else None,
    )


@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe(
    file: UploadFile = File(...),
    language: str = Form("fr"),
) -> TranscribeResponse:
    """Transcribe a recorded audio blob (webm/ogg/wav/mp3)."""
    audio = await file.read()
    if not audio:
        raise HTTPException(status_code=400, detail="Empty audio payload")

    try:
        text = await stt_engine.transcribe(audio, filename=file.filename or "audio.webm", language=language)
    except VoiceUnavailable as e:
        raise _unavailable(e) from e
    except Exception as e:  # noqa: BLE001 - surface upstream errors as 502
        logger.error(f"Transcription failed: {e}")
        raise HTTPException(status_code=502, detail=f"Transcription failed: {e}") from e

    return TranscribeResponse(text=text, language=language)


@router.post("/speak")
async def speak(request: SpeakRequest) -> StreamingResponse:
    """Stream MP3 for arbitrary text (used for the greeting and replays)."""
    text = (request.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Nothing to speak")

    try:
        stream = tts_engine.stream(text, request.voice_id)
        first = await anext(stream)  # fail fast before we commit to a 200

        async def body():
            yield first
            async for chunk in stream:
                yield chunk

    except VoiceUnavailable as e:
        raise _unavailable(e) from e
    except StopAsyncIteration:
        raise HTTPException(status_code=502, detail="TTS returned no audio") from None
    except Exception as e:  # noqa: BLE001
        logger.error(f"TTS failed: {e}")
        raise HTTPException(status_code=502, detail=f"TTS failed: {e}") from e

    return StreamingResponse(
        body(),
        media_type=AUDIO_MIME,
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
    )


@router.post("/turn", response_model=VoiceTurnResponse)
async def voice_turn(
    file: UploadFile = File(...),
    session_id: Optional[str] = Form(None),
    language: str = Form("fr"),
    mode: str = Form(ConversationMode.TRAINING.value),
    level: str = Form(CompetenceLevel.JUNIOR.value),
    visit_format: str = Form(VisitFormat.STANDARD.value),
    style: Optional[str] = Form(None),
) -> VoiceTurnResponse:
    """One complete spoken exchange.

    The client records a single utterance and posts it here; it gets back the
    transcript, ALIA's reply, and the reply as base64 MP3 ready to play. Using
    one round trip keeps the audio path usable even when the WebSocket is down
    (the WS carries the same exchange for lower latency).
    """
    audio = await file.read()
    if not audio:
        raise HTTPException(status_code=400, detail="Empty audio payload")

    # 1. Speech -> text
    try:
        transcript = await stt_engine.transcribe(audio, filename=file.filename or "audio.webm", language=language)
    except VoiceUnavailable as e:
        raise _unavailable(e) from e
    except Exception as e:  # noqa: BLE001
        logger.error(f"Transcription failed: {e}")
        raise HTTPException(status_code=502, detail=f"Transcription failed: {e}") from e

    if not transcript:
        raise HTTPException(status_code=422, detail="No speech detected in the recording")

    # 2. Text -> ALIA's reply (RAG + LLM + visit FSM, same path as typed chat)
    request = _conversation_request(transcript, session_id, mode, level, visit_format, style)
    response = await orchestrator.send_message(request)

    # 3. Reply -> speech (optional: without a key the turn still returns text)
    audio_base64 = None
    tts_error = None
    if tts_engine.available:
        try:
            mp3 = await tts_engine.synthesize(response.message)
            audio_base64 = base64.b64encode(mp3).decode("ascii")
        except Exception as e:  # noqa: BLE001 - never lose the text reply
            logger.error(f"TTS failed for session {response.session_id}: {e}")
            tts_error = str(e)
    else:
        tts_error = f"TTS disabled (set {tts_engine.env_var})"

    return VoiceTurnResponse(
        session_id=response.session_id,
        transcript=transcript,
        reply=response.message,
        current_step=response.current_step,
        score_update=response.score_update,
        audio_base64=audio_base64,
        tts_error=tts_error,
    )
