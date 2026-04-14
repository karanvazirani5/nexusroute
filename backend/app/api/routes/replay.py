"""Recommendation replay tool — re-run the current engine on a historical prompt."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import intent_classifier, scoring
from app.models.database import PromptEvent, RecommendationOutcome, get_db

router = APIRouter()


@router.post("/panel/quality/replay")
async def replay_recommendation(
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    """
    Re-run the current backend classifier + scorer against a stored historical prompt.
    Returns original vs replayed recommendation for then-vs-now comparison.
    """
    event_id = body.get("event_id")
    if not event_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "event_id is required")

    event = (
        await db.execute(
            select(PromptEvent).where(PromptEvent.event_id == event_id)
        )
    ).scalars().first()
    if event is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "event not found")

    # Use redacted prompt only (privacy-safe)
    prompt_text = event.prompt_redacted or ""
    if not prompt_text.strip():
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "No prompt text available for replay (redacted prompt is empty)",
        )

    # Re-classify with current classifier version
    new_labels = intent_classifier.classify(prompt_text)

    # Get the outcome if it exists
    outcome = (
        await db.execute(
            select(RecommendationOutcome).where(
                RecommendationOutcome.event_id == event_id
            )
        )
    ).scalars().first()

    # Build original snapshot
    original = {
        "recommended_model": event.recommended_model,
        "category_primary": event.category_primary,
        "subcategory": event.subcategory,
        "classifier_confidence": event.classifier_confidence,
        "routing_confidence": event.routing_confidence,
        "routing_explanation": event.routing_explanation,
        "complexity_score": event.complexity_score,
        "reasoning_intensity": event.reasoning_intensity,
        "creativity_score": event.creativity_score,
        "classifier_version": event.classifier_version,
        "outcome": {
            "label": outcome.outcome_label if outcome else None,
            "success": outcome.success if outcome else None,
            "composite_score": outcome.composite_score if outcome else None,
            "accepted": outcome.accepted if outcome else None,
            "overridden": outcome.overridden if outcome else None,
        } if outcome else None,
    }

    # Build replayed snapshot with current classifier
    replayed = {
        "category_primary": new_labels.category_primary,
        "subcategory": new_labels.subcategory,
        "classifier_confidence": new_labels.confidence,
        "complexity_score": new_labels.complexity_score,
        "reasoning_intensity": new_labels.reasoning_intensity,
        "creativity_score": new_labels.creativity_score,
        "classifier_version": new_labels.classifier_version,
    }

    # Compute diff
    diff = {
        "category_changed": original["category_primary"] != replayed["category_primary"],
        "subcategory_changed": original["subcategory"] != replayed["subcategory"],
        "confidence_delta": round(
            (replayed["classifier_confidence"] or 0) - (original["classifier_confidence"] or 0), 4
        ),
        "complexity_delta": (replayed["complexity_score"] or 0) - (original["complexity_score"] or 0),
    }

    return {
        "event_id": event_id,
        "prompt_preview": prompt_text[:200],
        "created_at": event.created_at.isoformat() if event.created_at else None,
        "original": original,
        "replayed": replayed,
        "diff": diff,
    }
