"""Onboarding progress tracking endpoints."""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import OnboardingProgress, get_db
from app.models.schemas import (
    OnboardingProgressCreate,
    OnboardingProgressRead,
    OnboardingProgressUpdate,
)

router = APIRouter()


@router.post("/panel/onboarding/start", response_model=OnboardingProgressRead, status_code=201)
async def start_onboarding(
    payload: OnboardingProgressCreate,
    db: AsyncSession = Depends(get_db),
):
    progress = OnboardingProgress(
        clerk_user_id=payload.clerk_user_id,
        anonymous_user_id=payload.anonymous_user_id,
        current_step=payload.current_step or "landing",
        use_case=payload.use_case,
        priority=payload.priority,
        evaluation_context=payload.evaluation_context,
        template_used=payload.template_used,
        completed_steps=["started"],
    )
    db.add(progress)
    await db.commit()
    await db.refresh(progress)
    return OnboardingProgressRead.model_validate(progress)


@router.patch("/panel/onboarding/progress", response_model=OnboardingProgressRead)
async def update_progress(
    payload: OnboardingProgressUpdate,
    progress_id: Optional[str] = Query(default=None),
    anonymous_user_id: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    # Find by progress_id or most recent for anonymous_user_id
    if progress_id:
        row = (await db.execute(
            select(OnboardingProgress).where(OnboardingProgress.progress_id == progress_id)
        )).scalars().first()
    elif anonymous_user_id:
        row = (await db.execute(
            select(OnboardingProgress)
            .where(OnboardingProgress.anonymous_user_id == anonymous_user_id)
            .order_by(OnboardingProgress.created_at.desc())
            .limit(1)
        )).scalars().first()
    else:
        row = None

    if row is None:
        # Auto-create
        row = OnboardingProgress(anonymous_user_id=anonymous_user_id, completed_steps=[])
        db.add(row)

    if payload.current_step is not None:
        row.current_step = payload.current_step
    if payload.completed_steps is not None:
        existing = row.completed_steps or []
        row.completed_steps = list(set(existing + payload.completed_steps))
    if payload.use_case is not None:
        row.use_case = payload.use_case
    if payload.priority is not None:
        row.priority = payload.priority
    if payload.evaluation_context is not None:
        row.evaluation_context = payload.evaluation_context
    if payload.template_used is not None:
        row.template_used = payload.template_used
    if payload.prompts_submitted is not None:
        row.prompts_submitted = payload.prompts_submitted

    await db.commit()
    await db.refresh(row)
    return OnboardingProgressRead.model_validate(row)


@router.post("/panel/onboarding/complete", response_model=OnboardingProgressRead)
async def complete_onboarding(
    progress_id: Optional[str] = Query(default=None),
    anonymous_user_id: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    if progress_id:
        row = (await db.execute(
            select(OnboardingProgress).where(OnboardingProgress.progress_id == progress_id)
        )).scalars().first()
    elif anonymous_user_id:
        row = (await db.execute(
            select(OnboardingProgress)
            .where(OnboardingProgress.anonymous_user_id == anonymous_user_id)
            .order_by(OnboardingProgress.created_at.desc())
            .limit(1)
        )).scalars().first()
    else:
        row = None

    if row is None:
        row = OnboardingProgress(anonymous_user_id=anonymous_user_id, completed_steps=[])
        db.add(row)

    existing = row.completed_steps or []
    row.completed_steps = list(set(existing + ["completed"]))
    row.current_step = "completed"
    await db.commit()
    await db.refresh(row)
    return OnboardingProgressRead.model_validate(row)


@router.get("/panel/onboarding/analytics")
async def onboarding_analytics(
    days: int = Query(default=30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    rows = (
        await db.execute(
            select(OnboardingProgress).where(OnboardingProgress.created_at >= cutoff)
        )
    ).scalars().all()

    total = len(rows)
    if total == 0:
        return {
            "total_started": 0,
            "completion_rate": None,
            "skip_rate": None,
            "use_case_distribution": {},
            "priority_distribution": {},
            "context_distribution": {},
            "template_usage": {},
            "funnel": {},
        }

    completed = sum(1 for r in rows if "completed" in (r.completed_steps or []))
    skipped = sum(1 for r in rows if r.current_step == "skipped")

    # Distributions
    use_cases: dict[str, int] = {}
    priorities: dict[str, int] = {}
    contexts: dict[str, int] = {}
    templates: dict[str, int] = {}

    for r in rows:
        if r.use_case:
            use_cases[r.use_case] = use_cases.get(r.use_case, 0) + 1
        if r.priority:
            priorities[r.priority] = priorities.get(r.priority, 0) + 1
        if r.evaluation_context:
            contexts[r.evaluation_context] = contexts.get(r.evaluation_context, 0) + 1
        if r.template_used:
            templates[r.template_used] = templates.get(r.template_used, 0) + 1

    # Funnel
    steps = ["started", "use_case", "priority", "context", "completed"]
    funnel = {}
    for step in steps:
        funnel[step] = sum(1 for r in rows if step in (r.completed_steps or []))

    return {
        "total_started": total,
        "completion_rate": round(completed / total, 3) if total > 0 else None,
        "skip_rate": round(skipped / total, 3) if total > 0 else None,
        "use_case_distribution": use_cases,
        "priority_distribution": priorities,
        "context_distribution": contexts,
        "template_usage": templates,
        "funnel": funnel,
    }
