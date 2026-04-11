"""Gold-set labeling endpoints.

The gold prompt set is the single highest-leverage artifact for classifier
quality. It is hand-labeled by the founder (see PRODUCT_BLUEPRINT Section
8) and used as a regression test for every classifier version bump.
"""

from __future__ import annotations

import hashlib

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import intent_classifier, taxonomy
from app.models.database import GoldPrompt, get_db
from app.models.schemas import GoldPromptCreate, GoldPromptRead

router = APIRouter()


@router.post("/panel/gold", response_model=GoldPromptRead)
async def create_gold_prompt(
    payload: GoldPromptCreate, db: AsyncSession = Depends(get_db)
) -> GoldPromptRead:
    text = payload.prompt_text.strip()
    if not text:
        raise HTTPException(400, "prompt_text is required")
    prompt_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()

    existing = (
        await db.execute(select(GoldPrompt).where(GoldPrompt.prompt_hash == prompt_hash))
    ).scalars().first()
    if existing:
        # Idempotent: update labels if provided.
        if payload.labels:
            existing.labels = payload.labels
        if payload.best_model is not None:
            existing.best_model = payload.best_model
        if payload.rationale is not None:
            existing.rationale = payload.rationale
        await db.commit()
        await db.refresh(existing)
        return GoldPromptRead.model_validate(existing)

    row = GoldPrompt(
        prompt_hash=prompt_hash,
        prompt_text=text,
        labels=payload.labels or {},
        best_model=payload.best_model,
        rationale=payload.rationale,
        labeler=payload.labeler,
        taxonomy_version=taxonomy.TAXONOMY_VERSION,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return GoldPromptRead.model_validate(row)


@router.get("/panel/gold", response_model=list[GoldPromptRead])
async def list_gold_prompts(
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
) -> list[GoldPromptRead]:
    rows = (
        await db.execute(
            select(GoldPrompt).order_by(GoldPrompt.labeled_at.desc()).limit(limit)
        )
    ).scalars().all()
    return [GoldPromptRead.model_validate(r) for r in rows]


@router.get("/panel/gold/regression")
async def run_gold_regression(db: AsyncSession = Depends(get_db)) -> dict:
    """Run the current heuristic classifier against every gold prompt and
    report per-axis accuracy. This is the regression gate invoked before
    every classifier version bump.
    """
    rows = (await db.execute(select(GoldPrompt))).scalars().all()
    if not rows:
        return {"sample_size": 0, "accuracy": {}, "classifier_version": intent_classifier.HEURISTIC_CLASSIFIER_VERSION}

    axes = [
        "category_primary",
        "subcategory",
        "intent",
        "goal",
        "domain",
        "output_type",
        "task_structure",
        "risk_class",
    ]
    totals = {axis: 0 for axis in axes}
    hits = {axis: 0 for axis in axes}

    for r in rows:
        labels = intent_classifier.classify(r.prompt_text)
        gold = r.labels or {}
        for axis in axes:
            gold_value = gold.get(axis)
            if gold_value is None:
                continue
            totals[axis] += 1
            if getattr(labels, axis, None) == gold_value:
                hits[axis] += 1

    accuracy = {
        axis: (hits[axis] / totals[axis]) if totals[axis] else None
        for axis in axes
    }
    return {
        "sample_size": len(rows),
        "axes_with_ground_truth": {axis: totals[axis] for axis in axes},
        "accuracy": accuracy,
        "classifier_version": intent_classifier.HEURISTIC_CLASSIFIER_VERSION,
        "taxonomy_version": taxonomy.TAXONOMY_VERSION,
    }
