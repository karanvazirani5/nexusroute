"""Model changelog API — tracks score changes, additions, deprecations."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import ModelUpdateRecord, ModelRecord, get_db

router = APIRouter()


@router.get("/changelog")
async def list_changelog(
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(
            ModelUpdateRecord.update_id,
            ModelUpdateRecord.model_id,
            ModelRecord.display_name.label("model_name"),
            ModelRecord.provider,
            ModelUpdateRecord.update_type,
            ModelUpdateRecord.description,
            ModelUpdateRecord.old_values,
            ModelUpdateRecord.new_values,
            ModelUpdateRecord.created_at,
        )
        .join(ModelRecord, ModelUpdateRecord.model_id == ModelRecord.id)
        .order_by(ModelUpdateRecord.created_at.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    rows = result.mappings().all()
    return [dict(r) for r in rows]


@router.get("/changelog/{model_id}")
async def model_changelog(
    model_id: str,
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(
            ModelUpdateRecord.update_id,
            ModelUpdateRecord.model_id,
            ModelRecord.display_name.label("model_name"),
            ModelRecord.provider,
            ModelUpdateRecord.update_type,
            ModelUpdateRecord.description,
            ModelUpdateRecord.old_values,
            ModelUpdateRecord.new_values,
            ModelUpdateRecord.created_at,
        )
        .join(ModelRecord, ModelUpdateRecord.model_id == ModelRecord.id)
        .where(ModelUpdateRecord.model_id == model_id)
        .order_by(ModelUpdateRecord.created_at.desc())
    )
    result = await db.execute(stmt)
    rows = result.mappings().all()
    return [dict(r) for r in rows]
