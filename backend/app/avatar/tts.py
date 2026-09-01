"""
ALIA Avatar - TTS/STT Integration
Handles text-to-speech (ElevenLabs) and speech-to-text (OpenAI Whisper).
"""
import os
from typing import Optional
from loguru import logger

from app.config import get_settings

settings = get_settings()

# Try importing optional dependencies
try:
    from openai import OpenAI
    openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)
    HAS_OPENAI = True
except ImportError:
    HAS_OPENAI = False

try:
    from elevenlabs.client import ElevenLabs
    eleven_client = ElevenLabs(api_key=settings.ELEVENLABS_API_KEY) if settings.ELEVENLABS_API_KEY else None
    HAS_ELEVENLABS = bool(settings.ELEVENLABS_API_KEY)
except ImportError:
    HAS_ELEVENLABS = False


class TTSEngine:
    """Text-to-Speech using ElevenLabs API."""

    def __init__(self):
        self.voice_id = settings.ELEVENLABS_VOICE_ID

    async def synthesize(self, text: str, voice_id: Optional[str] = None) -> Optional[str]:
        """Convert text to speech and return audio file path."""
        if not HAS_ELEVENLABS or not eleven_client:
            logger.warning("ElevenLabs not available. TTS disabled.")
            return None

        try:
            vid = voice_id or self.voice_id
            audio = eleven_client.generate(
                text=text,
                voice=vid,
                model="eleven_multilingual_v2",
            )

            # Save to file
            output_dir = os.path.join(os.path.dirname(__file__), "..", "data", "audio")
            os.makedirs(output_dir, exist_ok=True)

            output_path = os.path.join(output_dir, f"tts_{hash(text) & 0xFFFFFFFF:08x}.mp3")

            with open(output_path, "wb") as f:
                for chunk in audio:
                    f.write(chunk)

            logger.info(f"TTS audio saved: {output_path}")
            return output_path

        except Exception as e:
            logger.error(f"TTS synthesis failed: {e}")
            return None

    async def synthesize_stream(self, text: str, voice_id: Optional[str] = None):
        """Stream TTS audio for real-time playback."""
        if not HAS_ELEVENLABS or not eleven_client:
            return

        try:
            vid = voice_id or self.voice_id
            audio_stream = eleven_client.generate(
                text=text,
                voice=vid,
                model="eleven_multilingual_v2",
                stream=True,
            )
            for chunk in audio_stream:
                yield chunk
        except Exception as e:
            logger.error(f"TTS streaming failed: {e}")


class STTEngine:
    """Speech-to-Text using OpenAI Whisper."""

    def __init__(self):
        pass

    async def transcribe(self, audio_path: str, language: str = "fr") -> Optional[str]:
        """Transcribe audio file to text."""
        if not HAS_OPENAI:
            logger.warning("OpenAI not available. STT disabled.")
            return None

        try:
            with open(audio_path, "rb") as audio_file:
                response = openai_client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    language=language,
                )
            return response.text

        except Exception as e:
            logger.error(f"STT transcription failed: {e}")
            return None

    async def transcribe_stream(self, audio_chunk: bytes, language: str = "fr") -> Optional[str]:
        """Transcribe streaming audio."""
        if not HAS_OPENAI:
            return None

        try:
            import io
            audio_file = io.BytesIO(audio_chunk)
            audio_file.name = "stream_audio.wav"

            response = openai_client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                language=language,
            )
            return response.text

        except Exception as e:
            logger.error(f"Stream STT failed: {e}")
            return None


# Global instances
tts_engine = TTSEngine()
stt_engine = STTEngine()
