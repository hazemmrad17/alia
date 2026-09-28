"""FastAPI dependencies that turn a bearer token into a user."""
from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth import store
from app.auth.security import TokenError, decode_access_token

# auto_error=False so a missing header and an invalid one both produce the same
# 401 shape, which the frontend handles in one place.
bearer_scheme = HTTPBearer(auto_error=False)


def user_from_token(token: Optional[str]) -> Dict[str, Any]:
    """Resolve a raw token into an active user record, or raise 401.

    Shared by the HTTP dependency and the WebSocket handshake, which cannot use
    request dependencies.
    """
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentification requise.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not token:
        raise credentials_error

    try:
        payload = decode_access_token(token)
    except TokenError:
        raise credentials_error

    user = store.get_user(str(payload.get("sub") or ""))
    if not user or not user.get("is_active", True):
        raise credentials_error

    return user


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> Dict[str, Any]:
    """The signed-in user, or 401."""
    return user_from_token(credentials.credentials if credentials else None)


def require_roles(*roles: str):
    """Dependency factory: allow only the given roles, else 403."""

    allowed = {role.value if hasattr(role, "value") else str(role) for role in roles}

    async def _guard(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
        if user.get("role") not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Votre rôle ne permet pas cette action.",
            )
        return user

    return _guard
