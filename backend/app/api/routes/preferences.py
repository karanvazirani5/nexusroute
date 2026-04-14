"""User preferences CRUD for authenticated users."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_clerk_user
from app.models.database import UserPreferences, get_db
from app.models.schemas import UserPreferencesRead, UserPreferencesUpdate

router = APIRouter()


@router.get("/user/preferences", response_model=UserPreferencesRead)
async def get_preferences(
    clerk_user_id: str = Depends(require_clerk_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(UserPreferences).where(UserPreferences.clerk_user_id == clerk_user_id)
    result = await db.execute(stmt)
    row = result.scalar_one_or_none()
    if not row:
        # Create default preferences
        row = UserPreferences(clerk_user_id=clerk_user_id)
        db.add(row)
        await db.commit()
        await db.refresh(row)
    return row


@router.patch("/user/preferences", response_model=UserPreferencesRead)
async def update_preferences(
    body: UserPreferencesUpdate,
    clerk_user_id: str = Depends(require_clerk_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(UserPreferences).where(UserPreferences.clerk_user_id == clerk_user_id)
    result = await db.execute(stmt)
    row = result.scalar_one_or_none()
    if not row:
        row = UserPreferences(clerk_user_id=clerk_user_id)
        db.add(row)

    updates = body.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(row, field, value)

    await db.commit()
    await db.refresh(row)
    return row
