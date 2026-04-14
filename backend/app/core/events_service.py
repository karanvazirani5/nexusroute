"""
Hot-path event capture service.

Synchronously: redacts the prompt, classifies it with the Tier 1 heuristic
classifier, and writes a single row to ``prompt_events``. Runs in well
under 50ms for typical prompts — no LLM calls, no network, no embeddings.

Tier 2 enrichment (Haiku) and Tier 3 enrichment (Sonnet) are scheduled by
the batch processor and reach back into the same row later.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy import delete

from app.core import intelligence, intent_classifier, redaction, taxonomy
from app.core.intent_classifier import HeuristicLabels
from app.models.database import PanelSession, PanelUser, PromptEvent, RecommendationOutcome
from app.models.schemas import EventCreate, OutcomeUpdate


EVENT_SERVICE_VERSION = "events-1.0.0"


async def ensure_user(
    db: AsyncSession,
    user_id: Optional[str],
    *,
    consent_tier: int = 0,
) -> PanelUser:
    """Fetch or create an anonymous panel user."""
    if user_id:
        row = (
            await db.execute(select(PanelUser).where(PanelUser.user_id == user_id))
        ).scalars().first()
        if row is not None:
            row.last_seen_at = datetime.now(timezone.utc)
            if consent_tier > row.consent_tier:
                row.consent_tier = consent_tier
            await db.flush()
            return row

    user = PanelUser(
        user_id=user_id or None,  # let default_factory assign
        consent_tier=consent_tier,
    )
    db.add(user)
    await db.flush()
    return user


async def ensure_session(
    db: AsyncSession,
    session_id: Optional[str],
    user: PanelUser,
    *,
    client: dict,
    consent_tier: int,
) -> PanelSession:
    """Fetch or create an active panel session."""
    if session_id:
        row = (
            await db.execute(
                select(PanelSession).where(PanelSession.session_id == session_id)
            )
        ).scalars().first()
        if row is not None:
            return row

    session = PanelSession(
        session_id=session_id or None,
        user_id=user.user_id,
        client=client or {},
        consent_tier_at_start=consent_tier,
    )
    db.add(session)
    user.session_count = (user.session_count or 0) + 1
    await db.flush()
    return session


async def capture_event(db: AsyncSession, payload: EventCreate) -> PromptEvent:
    """Capture a single prompt event. Redacts, classifies, and persists."""

    prompt = payload.prompt or ""
    red = redaction.redact(prompt)
    labels: HeuristicLabels = intent_classifier.classify(red.redacted_text)

    user = await ensure_user(db, payload.user_id, consent_tier=payload.consent_tier)
    session = await ensure_session(
        db,
        payload.session_id,
        user,
        client=payload.client.model_dump(exclude_none=True),
        consent_tier=payload.consent_tier,
    )

    routing = payload.routing
    event = PromptEvent(
        session_id=session.session_id,
        user_id=user.user_id,
        # prompt
        prompt_hash=red.prompt_hash,
        prompt_redacted=red.redacted_text,
        prompt_raw=prompt if payload.consent_tier >= 1 else None,
        prompt_length_chars=len(prompt),
        prompt_length_tokens=_estimate_tokens(prompt),
        language=_guess_language(prompt),
        contains_code=intent_classifier.contains_code(prompt),
        contains_url=intent_classifier.contains_url(prompt),
        prompt_structure=labels.prompt_structure,
        redaction_counts=red.redaction_counts,
        # classification
        classifier_version=labels.classifier_version,
        classifier_confidence=labels.confidence,
        category_primary=labels.category_primary,
        subcategory=labels.subcategory,
        intent_label=labels.intent,
        goal_label=labels.goal,
        domain_label=labels.domain,
        output_type=labels.output_type,
        task_structure=labels.task_structure,
        reasoning_intensity=labels.reasoning_intensity,
        creativity_score=labels.creativity_score,
        precision_requirement=labels.precision_requirement,
        latency_sensitivity=labels.latency_sensitivity,
        cost_sensitivity=labels.cost_sensitivity,
        risk_class=labels.risk_class,
        complexity_score=labels.complexity_score,
        ambiguity_score=labels.ambiguity_score,
        craft_score=labels.craft_score,
        enrichment_tier=1,
        # routing
        routing_strategy_version=routing.routing_strategy_version,
        recommended_model=routing.recommended_model,
        candidate_models=[c.model_dump() for c in routing.candidate_models],
        routing_confidence=routing.routing_confidence,
        routing_explanation=routing.routing_explanation,
        tradeoff_profile=routing.tradeoff_profile,
        expected_cost_usd=routing.expected_cost_usd,
        expected_latency_ms=routing.expected_latency_ms,
        # meta
        consent_tier_at_event=payload.consent_tier,
        public_insight_eligible=_is_public_insight_eligible(labels),
        benchmark_eligible=_is_benchmark_eligible(labels),
        insight_worthiness_score=_score_insight_worthiness(labels),
        content_worthiness_score=_score_content_worthiness(labels),
        processing_flags={"redacted": bool(red.any_redaction)},
    )
    db.add(event)
    session.event_count = (session.event_count or 0) + 1
    user.event_count = (user.event_count or 0) + 1
    await db.flush()

    # Fan-out to SSE subscribers (live ticker bar, explorer feed).
    intelligence.broadcast({
        "event_id": event.event_id,
        "created_at": event.created_at.isoformat() if event.created_at else None,
        "category_primary": event.category_primary,
        "subcategory": event.subcategory,
        "preview": (event.prompt_redacted or "")[:120],
        "recommended_model": event.recommended_model,
        "classifier_confidence": event.classifier_confidence,
        "complexity_score": event.complexity_score,
        "reasoning_intensity": event.reasoning_intensity,
        "creativity_score": event.creativity_score,
    })
    return event


async def apply_outcome(db: AsyncSession, update: OutcomeUpdate) -> Optional[PromptEvent]:
    """Apply an outcome update to an existing event. Idempotent."""
    event = (
        await db.execute(
            select(PromptEvent).where(PromptEvent.event_id == update.event_id)
        )
    ).scalars().first()
    if event is None:
        return None

    if update.selected_model is not None:
        event.selected_model = update.selected_model
        if event.recommended_model and update.selected_model:
            event.user_accepted_recommendation = (
                update.selected_model == event.recommended_model
            )
            event.user_overrode_recommendation = (
                update.selected_model != event.recommended_model
            )
    if update.user_accepted_recommendation is not None:
        event.user_accepted_recommendation = update.user_accepted_recommendation
    if update.user_overrode_recommendation is not None:
        event.user_overrode_recommendation = update.user_overrode_recommendation
    if update.override_reason is not None:
        event.override_reason = update.override_reason
    if update.time_to_decision_ms is not None:
        event.time_to_decision_ms = update.time_to_decision_ms
    if update.copied is not None:
        event.copied = update.copied
    if update.exported is not None:
        event.exported = update.exported
    if update.rerouted is not None:
        event.rerouted = update.rerouted
    if update.rerouted_to_model is not None:
        event.rerouted_to_model = update.rerouted_to_model
    if update.abandoned is not None:
        event.abandoned = update.abandoned
    if update.explicit_rating is not None:
        event.explicit_rating = update.explicit_rating

    # Refresh the inferred satisfaction proxy whenever a signal moves.
    event.inferred_satisfaction = _infer_satisfaction(event)
    await db.flush()

    # Derive / update the learning-loop outcome row
    await compute_outcome(db, event)

    return event


# ──────────────────────────────────────────────────────────────────
# Derived helpers
# ──────────────────────────────────────────────────────────────────
def _estimate_tokens(prompt: str) -> int:
    if not prompt:
        return 0
    return int(len(prompt.split()) * 1.3) + max(1, len(prompt) // 400)


def _guess_language(prompt: str) -> Optional[str]:
    if not prompt:
        return None
    try:
        ascii_ratio = sum(1 for c in prompt if ord(c) < 128) / len(prompt)
    except ZeroDivisionError:
        return None
    return "en" if ascii_ratio > 0.85 else "unknown"


def _is_public_insight_eligible(labels: HeuristicLabels) -> bool:
    if labels.risk_class in {
        "privacy_sensitive",
        "health_sensitive",
        "legal_sensitive",
        "financial_sensitive",
        "safety_sensitive",
        "minor_involved",
        "restricted_jurisdiction",
    }:
        return False
    return labels.confidence >= 0.55


def _is_benchmark_eligible(labels: HeuristicLabels) -> bool:
    if labels.category_primary == "meta_ai" and labels.subcategory == "unclassified":
        return False
    return labels.confidence >= 0.7


def _score_insight_worthiness(labels: HeuristicLabels) -> float:
    score = labels.confidence * 0.6
    if labels.category_primary not in {"meta_ai", "conversational_companion"}:
        score += 0.2
    if labels.complexity_score >= 5:
        score += 0.1
    if labels.ambiguity_score <= 0.3:
        score += 0.1
    return max(0.0, min(1.0, score))


def _score_content_worthiness(labels: HeuristicLabels) -> float:
    score = 0.0
    if labels.subcategory not in {"unclassified", "casual_chat"}:
        score += 0.4
    if labels.craft_score >= 4:
        score += 0.2
    if labels.reasoning_intensity >= 4:
        score += 0.2
    if labels.complexity_score >= 6:
        score += 0.2
    return max(0.0, min(1.0, score))


def _infer_satisfaction(event: PromptEvent) -> Optional[float]:
    signals = []
    if event.copied:
        signals.append(1.0)
    if event.exported:
        signals.append(1.0)
    if event.abandoned:
        signals.append(0.0)
    if event.rerouted:
        signals.append(0.3)
    if event.explicit_rating is not None:
        signals.append((event.explicit_rating - 1) / 4.0)
    if event.user_accepted_recommendation is True and not event.abandoned:
        signals.append(0.7)
    if not signals:
        return None
    return sum(signals) / len(signals)


# ──────────────────────────────────────────────────────────────────
# Outcome derivation (Sprint 1.4) + success labeling (Sprint 2.1)
# ──────────────────────────────────────────────────────────────────

# Configurable outcome weights
OUTCOME_WEIGHTS = {
    "helpful": 1.0,
    "not_helpful": -1.0,
    "copied": 0.5,
    "shared": 0.6,
    "compared": 0.2,
    "override_of_top": -0.7,
    "override_chosen": 0.5,
    "abandoned": -0.8,
}


def _derive_outcome_label(event: PromptEvent) -> str:
    """Derive the high-level outcome label from PromptEvent signals."""
    if event.user_accepted_recommendation and not event.abandoned:
        return "accepted"
    if event.user_overrode_recommendation:
        return "overridden"
    if event.abandoned:
        return "abandoned"
    # Infer acceptance from copy/export without explicit override
    if (event.copied or event.exported) and not event.user_overrode_recommendation:
        return "accepted"
    return "no_signal"


def _compute_composite_score(event: PromptEvent) -> Optional[float]:
    """Compute a weighted composite outcome score from all signals."""
    score = 0.0
    has_signal = False

    if event.user_accepted_recommendation and not event.abandoned:
        score += OUTCOME_WEIGHTS["helpful"]
        has_signal = True
    if event.user_overrode_recommendation:
        score += OUTCOME_WEIGHTS["override_of_top"]
        has_signal = True
    if event.copied:
        score += OUTCOME_WEIGHTS["copied"]
        has_signal = True
    if event.exported:
        score += OUTCOME_WEIGHTS["shared"]
        has_signal = True
    if event.abandoned:
        score += OUTCOME_WEIGHTS["abandoned"]
        has_signal = True
    if event.explicit_rating is not None:
        # Map 1-5 to -1.0 to 1.0
        score += (event.explicit_rating - 3) / 2.0
        has_signal = True

    return score if has_signal else None


def compute_success_label(event: PromptEvent) -> Optional[bool]:
    """
    Derive a binary success label for calibration.

    Returns True (success), False (failure), or None (uncertain / insufficient signal).

    Success = user accepted AND not abandoned, OR explicit_rating >= 4,
              OR copied without override.
    Failure = overridden, OR explicit_rating <= 2, OR abandoned.
    """
    # Explicit positive signals
    if event.user_accepted_recommendation and not event.abandoned:
        return True
    if event.explicit_rating is not None and event.explicit_rating >= 4:
        return True
    if event.copied and not event.user_overrode_recommendation:
        return True

    # Explicit negative signals
    if event.user_overrode_recommendation:
        return False
    if event.explicit_rating is not None and event.explicit_rating <= 2:
        return False
    if event.abandoned:
        return False

    # Insufficient signal
    return None


async def compute_outcome(db: AsyncSession, event: PromptEvent) -> RecommendationOutcome:
    """
    Derive and upsert a RecommendationOutcome from the current PromptEvent state.
    Idempotent — always re-derives from full event state.
    """
    outcome_label = _derive_outcome_label(event)
    composite_score = _compute_composite_score(event)
    success = compute_success_label(event)

    # Upsert: delete existing then insert
    await db.execute(
        delete(RecommendationOutcome).where(
            RecommendationOutcome.event_id == event.event_id
        )
    )

    outcome = RecommendationOutcome(
        event_id=event.event_id,
        user_id=event.user_id,
        recommended_model=event.recommended_model,
        selected_model=event.selected_model,
        outcome_label=outcome_label,
        success=success,
        composite_score=round(composite_score, 4) if composite_score is not None else None,
        accepted=(outcome_label == "accepted"),
        overridden=(outcome_label == "overridden"),
        copied=bool(event.copied),
        exported=bool(event.exported),
        rerouted=bool(event.rerouted),
        abandoned=bool(event.abandoned),
        explicit_rating=event.explicit_rating,
        inferred_satisfaction=event.inferred_satisfaction,
        time_to_decision_ms=event.time_to_decision_ms,
        category_primary=event.category_primary,
        subcategory=event.subcategory,
        complexity_score=event.complexity_score,
        routing_confidence=event.routing_confidence,
    )
    db.add(outcome)
    await db.flush()
    return outcome
