"""Workflow preset CRUD — system presets + user custom presets."""

from __future__ import annotations

import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_optional_clerk_user, require_clerk_user
from app.models.database import WorkflowPreset, get_db
from app.models.schemas import WorkflowPresetRead, WorkflowPresetCreate, WorkflowPresetUpdate

router = APIRouter()


def _slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


@router.get("/presets", response_model=list[WorkflowPresetRead])
async def list_presets(
    clerk_user_id: Optional[str] = Depends(get_optional_clerk_user),
    db: AsyncSession = Depends(get_db),
):
    """List all system presets + the current user's custom presets."""
    conditions = [WorkflowPreset.is_system == True]
    if clerk_user_id:
        conditions.append(WorkflowPreset.clerk_user_id == clerk_user_id)

    stmt = select(WorkflowPreset).where(or_(*conditions)).order_by(
        WorkflowPreset.is_system.desc(),
        WorkflowPreset.name,
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/user/presets", response_model=WorkflowPresetRead, status_code=201)
async def create_preset(
    body: WorkflowPresetCreate,
    clerk_user_id: str = Depends(require_clerk_user),
    db: AsyncSession = Depends(get_db),
):
    row = WorkflowPreset(
        clerk_user_id=clerk_user_id,
        name=body.name,
        slug=body.slug or _slugify(body.name),
        description=body.description,
        icon=body.icon,
        is_system=False,
        default_track=body.default_track,
        preferred_providers=body.preferred_providers,
        excluded_providers=body.excluded_providers,
        budget_ceiling_per_1m=body.budget_ceiling_per_1m,
        prefer_open_weight=body.prefer_open_weight,
        min_reasoning_score=body.min_reasoning_score,
        min_coding_score=body.min_coding_score,
        require_function_calling=body.require_function_calling,
        require_structured_output=body.require_structured_output,
        require_vision=body.require_vision,
        require_long_context=body.require_long_context,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


@router.patch("/user/presets/{preset_id}", response_model=WorkflowPresetRead)
async def update_preset(
    preset_id: str,
    body: WorkflowPresetUpdate,
    clerk_user_id: str = Depends(require_clerk_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(WorkflowPreset).where(
        WorkflowPreset.preset_id == preset_id,
        WorkflowPreset.clerk_user_id == clerk_user_id,
        WorkflowPreset.is_system == False,
    )
    result = await db.execute(stmt)
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Preset not found or not owned by you")

    updates = body.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(row, field, value)

    await db.commit()
    await db.refresh(row)
    return row


@router.delete("/user/presets/{preset_id}", status_code=204)
async def delete_preset(
    preset_id: str,
    clerk_user_id: str = Depends(require_clerk_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(WorkflowPreset).where(
        WorkflowPreset.preset_id == preset_id,
        WorkflowPreset.clerk_user_id == clerk_user_id,
        WorkflowPreset.is_system == False,
    )
    result = await db.execute(stmt)
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Preset not found or cannot be deleted")
    await db.delete(row)
    await db.commit()
