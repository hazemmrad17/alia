"""
ALIA Avatar - Video Avatar Integration
Handles avatar video generation via HeyGen or D-ID APIs.
"""
from typing import Optional
from loguru import logger

from app.config import get_settings
from app.models.schemas import AvatarRequest, AvatarResponse

settings = get_settings()

try:
    import httpx
    HAS_HTTPX = True
except ImportError:
    HAS_HTTPX = False


class AvatarVideoGenerator:
    """Generate avatar videos using HeyGen or D-ID."""

    def __init__(self):
        self.heygen_key = settings.HEYGEN_API_KEY
        self.heygen_avatar_id = settings.HEYGEN_AVATAR_ID
        self.provider = "heygen" if self.heygen_key else "none"

    async def generate_video(self, request: AvatarRequest) -> AvatarResponse:
        """Generate avatar video for the given text."""
        if self.provider == "heygen" and self.heygen_key:
            return await self._generate_heygen(request)
        else:
            logger.info("Avatar video generation unavailable (no API key). Returning text-only response.")
            return AvatarResponse(
                video_url=None,
                audio_url=None,
                duration_seconds=0.0,
            )

    async def _generate_heygen(self, request: AvatarRequest) -> AvatarResponse:
        """Generate video using HeyGen API."""
        if not HAS_HTTPX:
            logger.error("httpx not installed")
            return AvatarResponse()

        try:
            async with httpx.AsyncClient(timeout=120) as client:
                # Create video generation task
                response = await client.post(
                    "https://api.heygen.com/v2/video/generate",
                    headers={
                        "X-Api-Key": self.heygen_key,
                        "Content-Type": "application/json",
                    },
                    json={
                        "video_inputs": [{
                            "character": {
                                "type": "avatar",
                                "avatar_id": self.heygen_avatar_id,
                            },
                            "voice": {
                                "type": "text",
                                "input_text": request.text,
                                "voice_id": request.voice_id or settings.ELEVENLABS_VOICE_ID,
                            },
                        }],
                        "test": True,
                        "aspect_ratio": "16:9",
                    },
                )

                if response.status_code == 200:
                    data = response.json()
                    video_id = data.get("data", {}).get("video_id")

                    if video_id:
                        # Poll for completion
                        video_url = await self._poll_heygen_status(client, video_id)
                        return AvatarResponse(
                            video_url=video_url,
                            duration_seconds=0.0,
                        )

                logger.error(f"HeyGen API error: {response.status_code}")
                return AvatarResponse()

        except Exception as e:
            logger.error(f"HeyGen video generation failed: {e}")
            return AvatarResponse()

    async def _poll_heygen_status(self, client: "httpx.AsyncClient", video_id: str, max_attempts: int = 30) -> Optional[str]:
        """Poll HeyGen for video completion."""
        import asyncio

        for _ in range(max_attempts):
            try:
                response = await client.get(
                    f"https://api.heygen.com/v1/video_status.get?video_id={video_id}",
                    headers={"X-Api-Key": self.heygen_key},
                )

                if response.status_code == 200:
                    data = response.json()
                    status = data.get("data", {}).get("status")

                    if status == "completed":
                        return data.get("data", {}).get("video_url")
                    elif status == "failed":
                        logger.error(f"HeyGen video failed: {data}")
                        return None

                await asyncio.sleep(5)

            except Exception as e:
                logger.error(f"Polling error: {e}")
                await asyncio.sleep(5)

        logger.error("HeyGen video generation timed out")
        return None


# Global instance
avatar_generator = AvatarVideoGenerator()
