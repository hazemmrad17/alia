"""ALIA Avatar Configuration"""
import os

from pydantic_settings import BaseSettings
from typing import List, Optional
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
    
    # Authentication
    # Override JWT_SECRET in .env before anything is exposed publicly — tokens
    # signed with a known secret can be forged by anyone.
    JWT_SECRET: str = "alia-dev-secret-change-me"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 720
    # Every account belongs to a tenant. One client today (VITAL); the column
    # exists now so lab #2 is a config change instead of a migration.
    DEFAULT_TENANT_ID: str = "vital"
    # Starter accounts, created only when data/users.json does not exist yet.
    AUTH_SEED_USERS: bool = True
    AUTH_SEED_ADMIN_EMAIL: str = "admin@vital.tn"
    AUTH_SEED_ADMIN_PASSWORD: str = "Alia@2026"
    AUTH_SEED_DOCTOR_EMAIL: str = "doctor@vital.tn"
    AUTH_SEED_DOCTOR_PASSWORD: str = "Alia@2026"
    AUTH_SEED_DELEGATE_EMAIL: str = "delegate@vital.tn"
    AUTH_SEED_DELEGATE_PASSWORD: str = "Alia@2026"

    # ── Deprecated settings ──────────────────────────────────────────────
    # The lab-side "manager" role was replaced by "doctor" — the persona who
    # receives ALIA's product presentation (docs/11-user-story-doctor.md).
    # These two names are declared only so an existing .env still boots:
    # ``extra="forbid"`` would otherwise refuse to start the whole app over a
    # setting nobody reads any more. Drop them once every .env is clean.
    AUTH_SEED_MANAGER_EMAIL: Optional[str] = None
    AUTH_SEED_MANAGER_PASSWORD: Optional[str] = None

    # ChromaDB
    CHROMA_HOST: str = "localhost"
    CHROMA_PORT: int = 8100
    CHROMA_COLLECTION: str = "alia_products"
    
    # Logging
    LOG_LEVEL: str = "INFO"

    @property
    def DATABASE_URL(self) -> str:
        return f"{self.DB_DIALECT}://{self.DB_USERNAME}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_DATABASE}"

    # ── Storage ──────────────────────────────────────────────────────────
    # Every JSON store (accounts, teams, session reports) lives under one
    # directory. It defaults to ``backend/data`` and is overridable so a test
    # run can point at a scratch directory instead of the seeded demo data.
    DATA_DIR: Optional[str] = None

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


def data_dir() -> str:
    """Absolute path to the JSON store directory.

    Read through the settings on every call rather than caching here: the
    settings object itself is cached, and tests rewrite the value before the
    app is imported.
    """
    configured = get_settings().DATA_DIR

    return os.path.abspath(configured or os.path.join(os.path.dirname(__file__), "..", "data"))
