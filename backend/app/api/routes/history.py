"""Saved prompt history CRUD for authenticated users."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_clerk_user
from app.models.database import PromptHistory, get_db
from app.models.schemas import PromptHistoryCreate, PromptHistoryRead, PromptHistoryDetail

router = APIRouter()


@router.post("/user/history", response_model=PromptHistoryRead, status_code=201)
async def save_to_history(
    body: PromptHistoryCreate,
    clerk_user_id: str = Depends(require_clerk_user),
    db: AsyncSession = Depends(get_db),
):
    row = PromptHistory(
        clerk_user_id=clerk_user_id,
        prompt_text=body.prompt_text,
        prompt_preview=body.prompt_preview,
        winner_model_id=body.winner_model_id,
        winner_model_name=body.winner_model_name,
        winner_provider=body.winner_provider,
        winner_score=body.winner_score,
        task_type=body.task_type,
        optimization_track=body.optimization_track,
        full_result_json=body.full_result_json,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


@router.get("/user/history", response_model=list[PromptHistoryRead])
async def list_history(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    clerk_user_id: str = Depends(require_clerk_user),
    db: AsyncSession = Depends(get_db),
):
    offset = (page - 1) * per_page
    stmt = (
        select(PromptHistory)
        .where(PromptHistory.clerk_user_id == clerk_user_id)
        .order_by(PromptHistory.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/user/history/{history_id}", response_model=PromptHistoryDetail)
async def get_history_entry(
    history_id: str,
    clerk_user_id: str = Depends(require_clerk_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(PromptHistory).where(
        PromptHistory.history_id == history_id,
        PromptHistory.clerk_user_id == clerk_user_id,
    )
    result = await db.execute(stmt)
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="History entry not found")
    return row


@router.delete("/user/history/{history_id}", status_code=204)
async def delete_history_entry(
    history_id: str,
    clerk_user_id: str = Depends(require_clerk_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(PromptHistory).where(
        PromptHistory.history_id == history_id,
        PromptHistory.clerk_user_id == clerk_user_id,
    )
    result = await db.execute(stmt)
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="History entry not found")
    await db.delete(row)
    await db.commit()
