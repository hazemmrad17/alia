"""ALIA Avatar Configuration"""
from pydantic_settings import BaseSettings
from typing import List
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # App
    APP_NAME: str = "ALIA-Avatar"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    # Both hostnames: the dev app is opened on localhost:3000 as well as
    # 127.0.0.1:3000, and an origin mismatch silently blocks the voice uploads.
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    
    # Database
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_DATABASE: str = "alia_avatar"
    DB_USERNAME: str = "postgres"
    DB_PASSWORD: str = "postgres"
    DB_DIALECT: str = "postgresql"
    
    # LLM Provider: "groq" or "anthropic"
    LLM_PROVIDER: str = "groq"
    
    # Groq (OpenAI-compatible, free tier)
    GROQ_API_KEY: str = ""
    # Must be a model the key actually exposes - see GET /api/v1/voice/status
    # and the fallback list in app/ai/llm_engine.py.
    GROQ_MODEL: str = "openai/gpt-oss-120b"
    GROQ_BASE_URL: str = "https://api.groq.com/openai/v1"
    # Speech-to-text model (Groq serves Whisper, so voice input needs no extra key)
    GROQ_WHISPER_MODEL: str = "whisper-large-v3"
    
    # Anthropic (Claude)
    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_MODEL: str = "claude-3-5-sonnet-20241022"
    
    # OpenAI (optional fallback)
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o"
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-small"
    
    # ElevenLabs TTS (optional)
    ELEVENLABS_API_KEY: str = ""
    ELEVENLABS_VOICE_ID: str = "21m00Tcm4TlvDq8ikWAM"
    
    # HeyGen Avatar
    HEYGEN_API_KEY: str = ""
    HEYGEN_AVATAR_ID: str = ""
    
    # ChromaDB
    CHROMA_HOST: str = "localhost"
    CHROMA_PORT: int = 8100
    CHROMA_COLLECTION: str = "alia_products"
    
    # Logging
    LOG_LEVEL: str = "INFO"

    @property
    def DATABASE_URL(self) -> str:
        return f"{self.DB_DIALECT}://{self.DB_USERNAME}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_DATABASE}"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
