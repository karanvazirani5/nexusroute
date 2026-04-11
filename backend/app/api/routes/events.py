"""Event capture endpoints for the instrumentation panel."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import events_service
from app.models.database import ConsentRecord, PanelSession, PanelUser, get_db
from app.models.schemas import (
    ConsentGrant,
    ConsentState,
    EventCreate,
    EventCreated,
    OutcomeUpdate,
    SessionOpened,
    SessionStart,
)

router = APIRouter()


@router.post("/panel/sessions", response_model=SessionOpened)
async def open_session(payload: SessionStart, db: AsyncSession = Depends(get_db)) -> SessionOpened:
    user = await events_service.ensure_user(
        db, payload.user_id, consent_tier=payload.consent_tier
    )
    session = await events_service.ensure_session(
        db,
        session_id=None,
        user=user,
        client=payload.client.model_dump(exclude_none=True),
        consent_tier=payload.consent_tier,
    )
    await db.commit()
    return SessionOpened(
        session_id=session.session_id,
        user_id=user.user_id,
        started_at=session.started_at,
        consent_tier=user.consent_tier or 0,
    )


@router.post("/panel/consents", response_model=ConsentState)
async def grant_consent(
    payload: ConsentGrant, db: AsyncSession = Depends(get_db)
) -> ConsentState:
    if payload.tier not in (0, 1, 2):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "tier must be 0, 1, or 2")

    user = await events_service.ensure_user(
        db, payload.user_id, consent_tier=payload.tier
    )
    record = ConsentRecord(
        user_id=user.user_id,
        tier=payload.tier,
        scope=payload.scope,
        source=payload.source,
    )
    db.add(record)
    user.consent_tier = max(user.consent_tier or 0, payload.tier)
    await db.commit()

    return ConsentState(
        user_id=user.user_id,
        tier=user.consent_tier or 0,
        scope=payload.scope,
        granted_at=record.granted_at,
    )


@router.delete("/panel/consents/{user_id}", response_model=ConsentState)
async def revoke_consent(user_id: str, db: AsyncSession = Depends(get_db)) -> ConsentState:
    user = (
        await db.execute(select(PanelUser).where(PanelUser.user_id == user_id))
    ).scalars().first()
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "unknown user")
    user.consent_tier = 0
    # Mark active grants as revoked; keep the ledger for audit.
    actives = (
        await db.execute(
            select(ConsentRecord)
            .where(ConsentRecord.user_id == user_id)
            .where(ConsentRecord.revoked_at.is_(None))
        )
    ).scalars().all()
    from datetime import datetime, timezone

    for c in actives:
        c.revoked_at = datetime.now(timezone.utc)
    await db.commit()
    return ConsentState(
        user_id=user.user_id,
        tier=0,
        scope=[],
        granted_at=user.created_at,
        revoked_at=datetime.now(timezone.utc),
    )


@router.post(
    "/panel/events",
    response_model=EventCreated,
    status_code=status.HTTP_201_CREATED,
)
async def create_event(
    payload: EventCreate, db: AsyncSession = Depends(get_db)
) -> EventCreated:
    if not payload.prompt or not payload.prompt.strip():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "prompt is required")
    if len(payload.prompt) > 200_000:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            "prompt exceeds 200k character limit",
        )
    event = await events_service.capture_event(db, payload)
    await db.commit()
    return EventCreated(
        event_id=event.event_id,
        session_id=event.session_id,
        user_id=event.user_id,
        category_primary=event.category_primary,
        subcategory=event.subcategory,
        classifier_confidence=event.classifier_confidence or 0.0,
        enrichment_tier=event.enrichment_tier or 1,
    )


@router.patch("/panel/events/{event_id}", response_model=EventCreated)
async def update_event_outcome(
    event_id: str, update: OutcomeUpdate, db: AsyncSession = Depends(get_db)
) -> EventCreated:
    if update.event_id and update.event_id != event_id:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "path event_id does not match body event_id"
        )
    update.event_id = event_id
    event = await events_service.apply_outcome(db, update)
    if event is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "event not found")
    await db.commit()
    return EventCreated(
        event_id=event.event_id,
        session_id=event.session_id,
        user_id=event.user_id,
        category_primary=event.category_primary,
        subcategory=event.subcategory,
        classifier_confidence=event.classifier_confidence or 0.0,
        enrichment_tier=event.enrichment_tier or 1,
    )
