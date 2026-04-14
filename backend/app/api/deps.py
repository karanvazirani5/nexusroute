"""
Clerk JWT verification dependencies for FastAPI.

Two dependencies:
  - get_optional_clerk_user → returns clerk user_id or None (zero-key fallback)
  - require_clerk_user → returns clerk user_id or raises 401
"""

from __future__ import annotations

import time
from typing import Optional

import httpx
import jwt
from fastapi import HTTPException, Request

from app.config import get_settings

# ── JWKS cache ────────────────────────────────────────────────────

_jwks_cache: dict[str, object] = {}
_jwks_fetched_at: float = 0.0
_JWKS_TTL = 3600  # 1 hour


async def _get_jwks() -> dict[str, object]:
    global _jwks_cache, _jwks_fetched_at
    now = time.time()
    if _jwks_cache and (now - _jwks_fetched_at) < _JWKS_TTL:
        return _jwks_cache

    settings = get_settings()
    if not settings.clerk_jwks_url:
        return {}

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(settings.clerk_jwks_url)
        resp.raise_for_status()
        data = resp.json()

    _jwks_cache = {k["kid"]: k for k in data.get("keys", [])}
    _jwks_fetched_at = now
    return _jwks_cache


def _decode_token(token: str) -> Optional[str]:
    """Decode a Clerk JWT and return the `sub` (user ID) claim, or None."""
    try:
        unverified = jwt.get_unverified_header(token)
    except jwt.DecodeError:
        return None

    kid = unverified.get("kid")
    if not kid:
        return None

    # We need the JWKS but can't await here — callers must use the async deps.
    # This is a sync helper used by the async dependency.
    return kid  # placeholder — actual decoding in async dep


async def _verify_token(token: str) -> Optional[str]:
    """Verify a Clerk JWT and return the user ID, or None on failure."""
    try:
        unverified_header = jwt.get_unverified_header(token)
    except jwt.DecodeError:
        return None

    kid = unverified_header.get("kid")
    if not kid:
        return None

    jwks = await _get_jwks()
    jwk_data = jwks.get(kid)
    if not jwk_data:
        # Key not found — maybe rotated. Force refresh once.
        global _jwks_fetched_at
        _jwks_fetched_at = 0
        jwks = await _get_jwks()
        jwk_data = jwks.get(kid)
        if not jwk_data:
            return None

    try:
        public_key = jwt.algorithms.RSAAlgorithm.from_jwk(jwk_data)
        payload = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            options={"verify_aud": False},
        )
        return payload.get("sub")
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None


# ── FastAPI dependencies ──────────────────────────────────────────


async def get_optional_clerk_user(request: Request) -> Optional[str]:
    """
    Returns the Clerk user ID if a valid Bearer token is present,
    otherwise returns None (anonymous / zero-key fallback).
    """
    auth_header = request.headers.get("authorization", "")
    if not auth_header.lower().startswith("bearer "):
        return None
    token = auth_header[7:]
    return await _verify_token(token)


async def require_clerk_user(request: Request) -> str:
    """
    Returns the Clerk user ID or raises HTTP 401.
    Use on endpoints that strictly require authentication.
    """
    user_id = await get_optional_clerk_user(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user_id
