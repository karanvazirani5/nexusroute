"""Tier 2 enrichment worker.

Runs the OpenAI batched classifier (``gpt-4o-mini`` by default) against
every prompt event whose heuristic confidence is below the escalation
threshold (or which has never been touched by Tier 2). Batches 20
prompts per call.

Usage
-----
::

    # One-shot enrichment pass over the last 24 hours.
    python scripts/enrich_events.py --hours 24

    # Force re-enrichment of everything below confidence 0.7.
    python scripts/enrich_events.py --confidence 0.7 --limit 500

If ``OPENAI_API_KEY`` is not set the script exits quietly — the panel
keeps running on heuristic labels only, which preserves the zero-key
fallback promise.
"""

from __future__ import annotations

import argparse
import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Sequence

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv

# Load the backend .env so OPENAI_API_KEY picked up automatically.
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from sqlalchemy import and_, select

from app.core import openai_classifier
from app.core.openai_classifier import Tier2Labels
from app.models.database import PromptEvent, async_session, engine, Base

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("enrich")


async def _ensure_schema() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def _fetch_candidates(
    hours: int, confidence_threshold: float, limit: int
) -> list[PromptEvent]:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    async with async_session() as db:
        stmt = (
            select(PromptEvent)
            .where(
                and_(
                    PromptEvent.created_at >= cutoff,
                    PromptEvent.enrichment_tier < 2,
                )
            )
            .where(
                (PromptEvent.classifier_confidence < confidence_threshold)
                | (PromptEvent.classifier_confidence.is_(None))
            )
            .order_by(PromptEvent.created_at.desc())
            .limit(limit)
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())


async def _apply_labels(event_ids: Sequence[str], labels: Sequence[Tier2Labels]) -> int:
    updated = 0
    async with async_session() as db:
        for event_id, label in zip(event_ids, labels):
            stmt = select(PromptEvent).where(PromptEvent.event_id == event_id)
            event = (await db.execute(stmt)).scalars().first()
            if event is None:
                continue
            if label.category_primary:
                event.category_primary = label.category_primary
            if label.subcategory:
                event.subcategory = label.subcategory
            if label.intent:
                event.intent_label = label.intent
            if label.goal:
                event.goal_label = label.goal
            if label.domain:
                event.domain_label = label.domain
            if label.output_type:
                event.output_type = label.output_type
            if label.task_structure:
                event.task_structure = label.task_structure
            if label.reasoning_intensity is not None:
                event.reasoning_intensity = label.reasoning_intensity
            if label.creativity_score is not None:
                event.creativity_score = label.creativity_score
            if label.precision_requirement is not None:
                event.precision_requirement = label.precision_requirement
            if label.latency_sensitivity is not None:
                event.latency_sensitivity = label.latency_sensitivity
            if label.cost_sensitivity is not None:
                event.cost_sensitivity = label.cost_sensitivity
            if label.risk_class:
                event.risk_class = label.risk_class
            if label.complexity_score is not None:
                event.complexity_score = label.complexity_score
            if label.ambiguity_score is not None:
                event.ambiguity_score = label.ambiguity_score
            if label.craft_score is not None:
                event.craft_score = label.craft_score
            if label.confidence is not None:
                event.classifier_confidence = max(
                    event.classifier_confidence or 0.0, label.confidence
                )
            event.classifier_version = label.classifier_version
            event.enrichment_tier = 2
            updated += 1
        await db.commit()
    return updated


async def enrich(hours: int, confidence_threshold: float, limit: int) -> None:
    if not openai_classifier.is_available():
        log.warning(
            "Tier 2 classifier unavailable (OPENAI_API_KEY missing or openai SDK "
            "not installed); nothing to do."
        )
        return

    await _ensure_schema()
    events = await _fetch_candidates(hours, confidence_threshold, limit)
    if not events:
        log.info("No events need Tier 2 enrichment.")
        return

    log.info(
        "Tier 2 enrichment: %d event(s) → batches of %d (model=%s)",
        len(events),
        openai_classifier.BATCH_SIZE,
        openai_classifier.DEFAULT_TIER2_MODEL,
    )

    total_updated = 0
    for i in range(0, len(events), openai_classifier.BATCH_SIZE):
        batch = events[i : i + openai_classifier.BATCH_SIZE]
        prompts = [e.prompt_redacted or "" for e in batch]
        event_ids = [e.event_id for e in batch]

        labels = await openai_classifier.classify_batch(prompts)
        if labels is None:
            log.warning(
                "Batch %d failed (OpenAI returned None); skipping.",
                i // openai_classifier.BATCH_SIZE,
            )
            continue
        updated = await _apply_labels(event_ids, labels)
        total_updated += updated
        log.info(
            "Batch %d/%d: %d updated",
            (i // openai_classifier.BATCH_SIZE) + 1,
            (len(events) + openai_classifier.BATCH_SIZE - 1) // openai_classifier.BATCH_SIZE,
            updated,
        )

    log.info("Done. %d event(s) re-labeled at Tier 2.", total_updated)


def main() -> None:
    ap = argparse.ArgumentParser(description="Tier 2 enrichment worker (OpenAI)")
    ap.add_argument("--hours", type=int, default=24, help="look-back window")
    ap.add_argument(
        "--confidence",
        type=float,
        default=0.75,
        help="re-enrich events whose heuristic confidence is below this threshold",
    )
    ap.add_argument("--limit", type=int, default=500, help="max events per run")
    args = ap.parse_args()
    asyncio.run(enrich(args.hours, args.confidence, args.limit))


if __name__ == "__main__":
    main()
