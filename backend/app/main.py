"""ALIA Avatar - Main FastAPI Application"""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from loguru import logger
import os

from app.config import get_settings
from app.api.routes import router as api_router
from app.conversation.routes import router as conversation_router
from app.api.dashboard import router as dashboard_router
from app.api.voice import router as voice_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown events."""
    logger.info(f"🚀 Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    # Initialize vector store, database connections, etc.
    yield
    logger.info("🛑 Shutting down ALIA Avatar")


app = FastAPI(
    title=settings.APP_NAME,
    description="Intelligent Conversational Avatar for Pharmaceutical Sales Training",
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

def _allowed_origins() -> list:
    """Configured origins plus their localhost/127.0.0.1 twins.

    The dev app is opened on both hostnames, and an origin mismatch makes the
    voice uploads fail silently, so accept both spellings of every entry.
    """
    origins = set(settings.CORS_ORIGINS)
    for origin in list(origins):
        if "//localhost" in origin:
            origins.add(origin.replace("//localhost", "//127.0.0.1"))
        elif "//127.0.0.1" in origin:
            origins.add(origin.replace("//127.0.0.1", "//localhost"))
    return sorted(origins)


# CORS — allow_origins for the configured list, plus any localhost/127.0.0.1
# port so the Next.js dev server (which drifts to a random port when 3000 is
# taken) is never blocked by a preflight.
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins(),
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(api_router, prefix="/api/v1")
app.include_router(conversation_router, prefix="/api/v1/conversation")
app.include_router(dashboard_router, prefix="/api/v1/dashboard")
app.include_router(voice_router, prefix="/api/v1/voice")


@app.get("/")
async def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "modes": ["training", "commercial"],
        "levels": ["debutant", "junior", "confirme", "expert"],
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}
