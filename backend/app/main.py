"""ALIA Avatar - Main FastAPI Application"""
from fastapi import Depends, FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from loguru import logger
import os

from app.auth.deps import get_current_user
from app.auth.routes import router as auth_router
from app.auth.store import seed_default_users
from app.config import get_settings
from app.api.routes import router as api_router
from app.conversation.routes import router as conversation_router
from app.api.dashboard import router as dashboard_router
from app.api.rewards import router as rewards_router
from app.api.session_detail import router as session_detail_router
from app.api.leaderboard import router as leaderboard_router
from app.api.voice import router as voice_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown events."""
    logger.info(f"🚀 Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    # Creates the starter accounts on first boot, then never runs again.
    seed_default_users()
    # The admin–delegate relationship seeds on first boot too, so the MVP ships
    # with one working pair instead of an empty team screen.
    from app.auth.team import seed_default_assignment

    seed_default_assignment()
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
#
# Auth is mounted first and stays public — it is how a client gets its token.
app.include_router(auth_router, prefix="/api/v1/auth")

# Everything else requires a valid bearer token. The dependency sits on the
# include_router call rather than on each handler so a new endpoint added to
# any of these modules is authenticated by default rather than by remembering.
#
# The conversation router is the exception: it carries the WebSocket, which
# cannot use an HTTP security dependency, so its HTTP routes are protected
# individually and the socket authenticates in the handshake (see
# app/conversation/routes.py).
app.include_router(api_router, prefix="/api/v1", dependencies=[Depends(get_current_user)])
app.include_router(conversation_router, prefix="/api/v1/conversation")
app.include_router(
    dashboard_router, prefix="/api/v1/dashboard", dependencies=[Depends(get_current_user)]
)
app.include_router(voice_router, prefix="/api/v1/voice", dependencies=[Depends(get_current_user)])
app.include_router(rewards_router, prefix="/api/v1", dependencies=[Depends(get_current_user)])
app.include_router(session_detail_router, prefix="/api/v1", dependencies=[Depends(get_current_user)])
app.include_router(leaderboard_router, prefix="/api/v1", dependencies=[Depends(get_current_user)])





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
