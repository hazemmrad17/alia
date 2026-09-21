"""
ALIA Avatar - Voice pipeline (STT / TTS)

  * STT: Groq Whisper (GROQ_API_KEY - the same key the LLM already uses),
          falling back to OpenAI Whisper (OPENAI_API_KEY) when present.
  * TTS: ElevenLabs (ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID)

No vendor SDK beyond `groq` is required: OpenAI and ElevenLabs are called over
plain REST with httpx (neither SDK is in requirements.txt).

Every provider is optional. When a key is missing the engine reports
``available = False``, raises :class:`VoiceUnavailable`, and callers degrade
to text-only instead of crashing.
"""
import asyncio
from typing import AsyncIterator, Optional, Tuple

import httpx
from loguru import logger

from app.config import get_settings

settings = get_settings()

OPENAI_STT_URL = "https://api.openai.com/v1/audio/transcriptions"
ELEVENLABS_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream"
ELEVENLABS_MODEL = "eleven_multilingual_v2"
ELEVENLABS_OUTPUT_FORMAT = "mp3_44100_128"
AUDIO_MIME = "audio/mpeg"


class VoiceUnavailable(RuntimeError):
    """Raised when the requested voice provider has no credentials configured."""

    def __init__(self, provider: str, env_var: str):
        self.provider = provider
        self.env_var = env_var
        super().__init__(f"{provider} is not configured (set {env_var} in backend/.env)")


# ──────────────────────────────────────────────
# Speech-to-text
# ──────────────────────────────────────────────

class STTEngine:
    """Speech-to-text: Groq Whisper first, OpenAI Whisper as a fallback.

    Groq is preferred because its key is already required for the LLM, so voice
    input needs no extra account; both accept the browser's webm/opus blobs and
    handle French.
    """

    def __init__(self):
        self.groq_key = settings.GROQ_API_KEY
        self.groq_model = settings.GROQ_WHISPER_MODEL
        self.openai_key = settings.OPENAI_API_KEY
        self.openai_model = "whisper-1"
        self._groq_client = None

    # ── capability reporting ──

    @property
    def available(self) -> bool:
        return bool(self.groq_key or self.openai_key)

    @property
    def providers(self) -> Tuple[str, ...]:
        chain = []
        if self.groq_key:
            chain.append("groq")
        if self.openai_key:
            chain.append("openai")
        return tuple(chain)

    @property
    def provider(self) -> str:
        return self.providers[0] if self.providers else "none"

    @property
    def model(self) -> str:
        return self.groq_model if self.groq_key else self.openai_model

    @property
    def env_var(self) -> str:
        return "GROQ_API_KEY" if self.groq_key else "OPENAI_API_KEY"

    # ── providers ──

    def _groq_client_or_none(self):
        if self._groq_client is None and self.groq_key:
            try:
                from groq import Groq

                self._groq_client = Groq(api_key=self.groq_key)
            except Exception as e:  # noqa: BLE001
                logger.error(f"Failed to init Groq client for STT: {e}")
        return self._groq_client

    def _groq_transcribe(self, audio: bytes, filename: str, language: str) -> str:
        """Blocking call - always run it in a thread."""
        client = self._groq_client_or_none()
        if not client:
            raise RuntimeError("Groq client not initialized")

        result = client.audio.transcriptions.create(
            file=(filename, audio),
            model=self.groq_model,
            language=language,
            response_format="json",
        )
        return (getattr(result, "text", "") or "").strip()

    async def _openai_transcribe(self, audio: bytes, filename: str, language: str) -> str:
        files = {"file": (filename, audio, "application/octet-stream")}
        data = {"model": self.openai_model, "language": language, "response_format": "json"}

        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(
                OPENAI_STT_URL,
                headers={"Authorization": f"Bearer {self.openai_key}"},
                files=files,
                data=data,
            )

        if response.status_code != 200:
            raise RuntimeError(f"Whisper error {response.status_code}: {response.text[:300]}")
        return (response.json().get("text") or "").strip()

    async def transcribe(
        self,
        audio: bytes,
        filename: str = "utterance.webm",
        language: str = "fr",
    ) -> str:
        """Transcribe an audio blob. Returns the transcript (may be empty)."""
        if not self.available:
            raise VoiceUnavailable("speech-to-text", "GROQ_API_KEY")

        errors = []

        if self.groq_key:
            try:
                # The Groq SDK is synchronous; keep the event loop free.
                text = await asyncio.to_thread(self._groq_transcribe, audio, filename, language)
                logger.info(f"STT (groq/{self.groq_model}) transcribed {len(audio)} bytes -> {len(text)} chars")
                return text
            except Exception as e:  # noqa: BLE001 - try the next provider
                errors.append(f"groq: {e}")
                logger.warning(f"Groq STT failed: {e}")

        if self.openai_key:
            try:
                text = await self._openai_transcribe(audio, filename, language)
                logger.info(f"STT (openai/{self.openai_model}) transcribed {len(audio)} bytes -> {len(text)} chars")
                return text
            except Exception as e:  # noqa: BLE001
                errors.append(f"openai: {e}")
                logger.error(f"OpenAI STT failed: {e}")

        raise RuntimeError("; ".join(errors) or "No speech-to-text provider available")

    # Kept for callers written against the old SDK-based API.
    async def transcribe_stream(self, audio_chunk: bytes, language: str = "fr") -> Optional[str]:
        try:
            return await self.transcribe(audio_chunk, language=language)
        except Exception as e:  # noqa: BLE001 - degrade to None for callers
            logger.error(f"Stream STT failed: {e}")
            return None


# ──────────────────────────────────────────────
# Text-to-speech
# ──────────────────────────────────────────────

# Microsoft Edge neural voices (edge-tts) — free, no API key, natural French.
# Used as the fallback whenever ElevenLabs is unconfigured, out of quota, or
# the key lacks the text_to_speech permission.
EDGE_VOICE_DEFAULT = "fr-FR-DeniseNeural"

# After an ElevenLabs auth/quota failure, skip it for a while instead of
# paying the round-trip on every sentence (the key may be missing the
# text_to_speech permission — the failure is not transient).
_ELEVENLABS_COOLDOWN_SECONDS = 300
_elevenlabs_down_until = 0.0


def _elevenlabs_cooling_down() -> bool:
    import time

    return time.time() < _elevenlabs_down_until


def _mark_elevenlabs_down() -> None:
    import time

    global _elevenlabs_down_until
    _elevenlabs_down_until = time.time() + _ELEVENLABS_COOLDOWN_SECONDS


def _edge_tts_available() -> bool:
    try:
        import edge_tts  # noqa: F401

        return True
    except Exception:  # noqa: BLE001
        return False


class EdgeTTSEngine:
    """Fallback TTS: Microsoft Edge neural voices via the edge-tts package."""

    provider = "edge"
    model = EDGE_VOICE_DEFAULT
    env_var = "edge-tts (pip, no key needed)"

    def __init__(self):
        self.voice = getattr(settings, "EDGE_TTS_VOICE", None) or EDGE_VOICE_DEFAULT

    @property
    def available(self) -> bool:
        return _edge_tts_available()

    async def stream(self, text: str, voice_id: Optional[str] = None) -> AsyncIterator[bytes]:
        """Yield MP3 chunks from the Edge speech service."""
        if not self.available:
            raise VoiceUnavailable(self.provider, self.env_var)

        import edge_tts

        communicate = edge_tts.Communicate(text, voice_id or self.voice)
        async for chunk in communicate.stream():
            if chunk.get("type") == "audio" and chunk.get("data"):
                yield chunk["data"]

        logger.info(f"Edge TTS streamed {len(text)} chars with {voice_id or self.voice}")

    async def synthesize(self, text: str, voice_id: Optional[str] = None) -> bytes:
        return b"".join([chunk async for chunk in self.stream(text, voice_id)])


class TTSEngine:
    """Text-to-speech: ElevenLabs first, Edge neural voices as fallback."""

    provider = "elevenlabs"
    model = ELEVENLABS_MODEL
    env_var = "ELEVENLABS_API_KEY"

    def __init__(self):
        self.api_key = settings.ELEVENLABS_API_KEY
        self.voice_id = settings.ELEVENLABS_VOICE_ID
        self.fallback = EdgeTTSEngine()

    @property
    def available(self) -> bool:
        """True when ANY engine can speak (ElevenLabs or Edge)."""
        return bool(self.api_key) or self.fallback.available

    @property
    def active_provider(self) -> str:
        return self.provider if self.api_key else self.fallback.provider

    @staticmethod
    def _payload(text: str) -> dict:
        return {
            "text": text,
            "model_id": ELEVENLABS_MODEL,
            "voice_settings": {
                "stability": 0.45,
                "similarity_boost": 0.75,
                "style": 0.0,
                "use_speaker_boost": True,
            },
        }

    async def stream(self, text: str, voice_id: Optional[str] = None) -> AsyncIterator[bytes]:
        """Yield MP3 chunks as ElevenLabs produces them (low first-byte latency).

        With no key (or on an auth/stream failure) the Edge neural voice takes
        over, so the avatar is never silent.
        """
        if not self.api_key or _elevenlabs_cooling_down():
            async for chunk in self.fallback.stream(text):
                yield chunk
            return

        url = ELEVENLABS_TTS_URL.format(voice_id=voice_id or self.voice_id)
        headers = {
            "xi-api-key": self.api_key,
            "Content-Type": "application/json",
            "Accept": AUDIO_MIME,
        }

        try:
            async with httpx.AsyncClient(timeout=120) as client:
                async with client.stream(
                    "POST",
                    url,
                    headers=headers,
                    params={"output_format": ELEVENLABS_OUTPUT_FORMAT},
                    json=self._payload(text),
                ) as response:
                    if response.status_code != 200:
                        body = (await response.aread())[:300]
                        raise RuntimeError(f"ElevenLabs error {response.status_code}: {body!r}")

                    async for chunk in response.aiter_bytes(4096):
                        if chunk:
                            yield chunk
        except Exception as e:  # noqa: BLE001
            # Bad key, missing text_to_speech permission, quota... hand over to
            # the Edge neural voice rather than leaving the avatar mute.
            logger.warning(f"ElevenLabs stream failed ({e}); falling back to Edge")
            _mark_elevenlabs_down()
            async for chunk in self.fallback.stream(text):
                yield chunk
            return

        logger.info(f"TTS streamed {len(text)} chars")

    async def synthesize(self, text: str, voice_id: Optional[str] = None) -> bytes:
        """Return the whole utterance as MP3 bytes, falling back to Edge when
        ElevenLabs is missing, refuses the key, or runs out of quota."""
        if not self.api_key or _elevenlabs_cooling_down():
            return await self.fallback.synthesize(text)
        try:
            return b"".join([chunk async for chunk in self.stream(text, voice_id)])
        except Exception as e:  # noqa: BLE001
            logger.warning(f"ElevenLabs failed ({e}); falling back to Edge neural voice")
            return await self.fallback.synthesize(text)

    # Kept for callers written against the old SDK-based API (used to write a file).
    async def synthesize_stream(self, text: str, voice_id: Optional[str] = None) -> AsyncIterator[bytes]:
        async for chunk in self.stream(text, voice_id):
            yield chunk


# Global instances
stt_engine = STTEngine()
tts_engine = TTSEngine()
