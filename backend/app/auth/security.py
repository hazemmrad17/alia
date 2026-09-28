"""Password hashing and signed access tokens.

Deliberately dependency-free: passwords use PBKDF2-HMAC-SHA256 with a random
per-user salt, and access tokens are HS256 JWTs built from ``hmac``/``hashlib``.
That keeps the auth layer installable on any machine the pilot runs on without
adding ``passlib``/``python-jose`` to the requirements file. Verification is
always constant-time.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time
from typing import Any, Dict, Optional

from app.config import get_settings

# OWASP's current floor for PBKDF2-HMAC-SHA256.
PBKDF2_ROUNDS = 260_000
_SALT_BYTES = 16


class TokenError(Exception):
    """A token was missing, malformed, forged or expired."""


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64url_decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


# ── Passwords ──────────────────────────────────────────────────────────────


def hash_password(password: str) -> str:
    """Return ``pbkdf2_sha256$rounds$salt$digest`` for the given password."""
    salt = secrets.token_bytes(_SALT_BYTES)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ROUNDS)
    return f"pbkdf2_sha256${PBKDF2_ROUNDS}${_b64url_encode(salt)}${_b64url_encode(digest)}"


def verify_password(password: str, stored: str) -> bool:
    """Constant-time check of a password against a stored hash."""
    try:
        algorithm, rounds, salt, digest = (stored or "").split("$")
    except (ValueError, AttributeError):
        return False

    if algorithm != "pbkdf2_sha256":
        return False

    try:
        expected = _b64url_decode(digest)
        candidate = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), _b64url_decode(salt), int(rounds)
        )
    except (ValueError, TypeError):
        return False

    return hmac.compare_digest(candidate, expected)


# ── Access tokens ──────────────────────────────────────────────────────────


def _sign(message: bytes) -> bytes:
    secret = get_settings().JWT_SECRET.encode("utf-8")
    return hmac.new(secret, message, hashlib.sha256).digest()


def create_access_token(
    *, subject: str, role: str, tenant_id: str, extra: Optional[Dict[str, Any]] = None
) -> str:
    """Sign a short-lived HS256 token carrying the user's id, role and tenant."""
    settings = get_settings()
    now = int(time.time())
    payload: Dict[str, Any] = {
        "sub": subject,
        "role": role,
        "tenant": tenant_id,
        "iat": now,
        "exp": now + settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }
    if extra:
        payload.update(extra)

    header = {"alg": "HS256", "typ": "JWT"}
    segments = [
        _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8")),
        _b64url_encode(json.dumps(payload, separators=(",", ":"), default=str).encode("utf-8")),
    ]
    signing_input = ".".join(segments).encode("ascii")
    segments.append(_b64url_encode(_sign(signing_input)))

    return ".".join(segments)


def decode_access_token(token: str) -> Dict[str, Any]:
    """Verify signature and expiry, then return the payload."""
    parts = (token or "").split(".")
    if len(parts) != 3:
        raise TokenError("Malformed token")

    header_segment, payload_segment, signature_segment = parts
    signing_input = f"{header_segment}.{payload_segment}".encode("ascii")

    try:
        provided = _b64url_decode(signature_segment)
    except Exception:  # noqa: BLE001 - any decode failure is an invalid token
        raise TokenError("Malformed token signature")

    if not hmac.compare_digest(_sign(signing_input), provided):
        raise TokenError("Invalid token signature")

    try:
        payload = json.loads(_b64url_decode(payload_segment))
    except Exception:  # noqa: BLE001
        raise TokenError("Malformed token payload")

    if not isinstance(payload, dict):
        raise TokenError("Malformed token payload")

    try:
        expired = int(payload.get("exp", 0)) <= int(time.time())
    except (TypeError, ValueError):
        raise TokenError("Malformed token payload")

    if expired:
        raise TokenError("Token expired")

    return payload
