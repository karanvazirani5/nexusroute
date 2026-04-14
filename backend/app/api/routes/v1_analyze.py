"""Public API v1 — model analysis and listing."""

from __future__ import annotations

import time
from collections import defaultdict
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_optional_clerk_user
from app.models.database import ModelRecord, get_db
from app.models.schemas import AnalyzeRequest, AnalyzeResponse, AnalyzeModelResult, ModelInfo

router = APIRouter()


# ── Tiered rate limiting for public API ───────────────────────────

_v1_hits: dict[str, list[float]] = defaultdict(list)
_V1_ANON_LIMIT = 20   # req/min for anonymous
_V1_AUTH_LIMIT = 100   # req/min for authenticated
_V1_WINDOW = 60


async def v1_rate_limit(
    request: Request,
    clerk_user_id: Optional[str] = Depends(get_optional_clerk_user),
):
    """Rate-limit dependency for v1 routes. 20/min anon, 100/min auth."""
    key = clerk_user_id or (request.client.host if request.client else "unknown")
    limit = _V1_AUTH_LIMIT if clerk_user_id else _V1_ANON_LIMIT

    now = time.time()
    _v1_hits[key] = [t for t in _v1_hits[key] if now - t < _V1_WINDOW]
    if len(_v1_hits[key]) >= limit:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded ({limit} req/min). Sign in for higher limits."
        )
    _v1_hits[key].append(now)


def _record_to_info(r: ModelRecord) -> ModelInfo:
    return ModelInfo.model_validate(r)


# ── Endpoints ─────────────────────────────────────────────────────


@router.post("/analyze", response_model=AnalyzeResponse, dependencies=[Depends(v1_rate_limit)])
async def analyze_prompt(
    body: AnalyzeRequest,
    db: AsyncSession = Depends(get_db),
):
    """Analyze a prompt and return ranked model recommendations."""
    from app.core.classifier import classify_prompt
    from app.core.scoring import score_model

    task_profile = classify_prompt(body.prompt)

    query = select(ModelRecord).where(ModelRecord.is_active == True)  # noqa: E712
    result = await db.execute(query)
    records = result.scalars().all()

    max_cost = body.max_cost_per_1m * 100 if body.max_cost_per_1m else None  # convert to cents

    scored = []
    for r in records:
        info = _record_to_info(r)
        s = score_model(info, task_profile, body.optimize_for, max_cost)
        scored.append((info, s))

    scored.sort(key=lambda x: x[1].total, reverse=True)
    top = scored[:5]

    if not top:
        raise HTTPException(status_code=404, detail="No models available")

    primary = top[0]
    recommendations = [
        AnalyzeModelResult(
            model_id=info.id,
            display_name=info.display_name,
            provider=info.provider,
            tier=info.tier,
            score=round(s.total, 2),
            quality_fit=round(s.quality_fit, 2),
            cost_efficiency=round(s.cost_efficiency, 2),
            speed=round(s.speed, 2),
        )
        for info, s in top
    ]

    return AnalyzeResponse(
        task_profile=task_profile,
        recommendations=recommendations,
        primary_model=primary[0].id,
        primary_provider=primary[0].provider,
        explanation=f"Best model for {task_profile.task_type} tasks with {body.optimize_for} optimization",
        confidence=task_profile.confidence,
    )


@router.get("/models", dependencies=[Depends(v1_rate_limit)])
async def list_models_v1(
    provider: Optional[str] = None,
    tier: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """List all active models with optional filtering."""
    query = select(ModelRecord).where(ModelRecord.is_active == True)  # noqa: E712
    if provider:
        query = query.where(ModelRecord.provider == provider)
    if tier:
        query = query.where(ModelRecord.tier == tier)
    result = await db.execute(query)
    records = result.scalars().all()
    return [_record_to_info(r) for r in records]
