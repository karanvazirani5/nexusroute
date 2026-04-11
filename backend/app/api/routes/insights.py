"""Aggregations + dashboard endpoints powered by the prompt_events table."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import taxonomy
from app.core.intent_classifier import HEURISTIC_CLASSIFIER_VERSION
from app.models.database import (
    PanelSession,
    PanelUser,
    PromptEvent,
    get_db,
)
from app.models.schemas import (
    DashboardSummary,
    InsightCategoryShare,
    InsightModelLeaderboardRow,
    RouterHealthSnapshot,
)

router = APIRouter()


def _cutoff(days: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=days)


async def _count_since(db: AsyncSession, days: int) -> int:
    stmt = select(func.count(PromptEvent.event_id)).where(
        PromptEvent.created_at >= _cutoff(days)
    )
    return int((await db.execute(stmt)).scalar() or 0)


async def _router_health(db: AsyncSession, days: int = 7) -> RouterHealthSnapshot:
    cutoff = _cutoff(days)
    base_filter = PromptEvent.created_at >= cutoff

    total = int((await db.execute(
        select(func.count(PromptEvent.event_id)).where(base_filter)
    )).scalar() or 0)

    outcome_filter = and_(base_filter, PromptEvent.selected_model.isnot(None))
    with_outcome = int((await db.execute(
        select(func.count(PromptEvent.event_id)).where(outcome_filter)
    )).scalar() or 0)

    accept_filter = and_(outcome_filter, PromptEvent.user_accepted_recommendation.is_(True))
    accepted = int((await db.execute(
        select(func.count(PromptEvent.event_id)).where(accept_filter)
    )).scalar() or 0)

    override_filter = and_(outcome_filter, PromptEvent.user_overrode_recommendation.is_(True))
    overrode = int((await db.execute(
        select(func.count(PromptEvent.event_id)).where(override_filter)
    )).scalar() or 0)

    avg_routing = (await db.execute(
        select(func.avg(PromptEvent.routing_confidence)).where(base_filter)
    )).scalar()
    avg_classifier = (await db.execute(
        select(func.avg(PromptEvent.classifier_confidence)).where(base_filter)
    )).scalar()

    unclassified = int((await db.execute(
        select(func.count(PromptEvent.event_id)).where(
            and_(base_filter, PromptEvent.subcategory == "unclassified")
        )
    )).scalar() or 0)

    # Category distribution (top 12 + "other").
    dist_rows = (await db.execute(
        select(PromptEvent.category_primary, func.count(PromptEvent.event_id))
        .where(base_filter)
        .group_by(PromptEvent.category_primary)
        .order_by(func.count(PromptEvent.event_id).desc())
    )).all()

    distribution: list[InsightCategoryShare] = []
    other = 0
    for i, (cat, n) in enumerate(dist_rows):
        if cat is None:
            continue
        if i >= 12:
            other += int(n)
            continue
        label = taxonomy.CATEGORY_PRIMARY_LABELS.get(cat, cat)
        distribution.append(
            InsightCategoryShare(
                category_primary=cat,
                label=label,
                events=int(n),
                share=(int(n) / total) if total else 0.0,
            )
        )
    if other:
        distribution.append(
            InsightCategoryShare(
                category_primary="other",
                label="Other",
                events=other,
                share=other / total if total else 0.0,
            )
        )

    return RouterHealthSnapshot(
        window_days=days,
        total_events=total,
        events_with_outcome=with_outcome,
        accuracy_at_1=(accepted / with_outcome) if with_outcome else None,
        override_rate=(overrode / with_outcome) if with_outcome else None,
        avg_routing_confidence=float(avg_routing) if avg_routing is not None else None,
        avg_classifier_confidence=float(avg_classifier) if avg_classifier is not None else None,
        unclassified_rate=(unclassified / total) if total else None,
        category_distribution=distribution,
    )


async def _model_share_by_category(
    db: AsyncSession, days: int = 30, limit_per_category: int = 3
) -> list[InsightModelLeaderboardRow]:
    cutoff = _cutoff(days)
    override_expr = case(
        (PromptEvent.user_overrode_recommendation.is_(True), 1.0),
        (PromptEvent.user_overrode_recommendation.is_(False), 0.0),
        else_=None,
    )
    rows = (await db.execute(
        select(
            PromptEvent.category_primary,
            PromptEvent.selected_model,
            func.count(PromptEvent.event_id).label("n"),
            func.avg(PromptEvent.inferred_satisfaction).label("sat"),
            func.avg(override_expr).label("override"),
        )
        .where(PromptEvent.created_at >= cutoff)
        .where(PromptEvent.selected_model.isnot(None))
        .where(PromptEvent.category_primary.isnot(None))
        .group_by(PromptEvent.category_primary, PromptEvent.selected_model)
        .order_by(PromptEvent.category_primary, func.count(PromptEvent.event_id).desc())
    )).all()

    # Roll up to per-category totals so we can compute share.
    totals: dict[str, int] = {}
    for cat, _model, n, _sat, _ovr in rows:
        totals[cat] = totals.get(cat, 0) + int(n)

    out: list[InsightModelLeaderboardRow] = []
    seen: dict[str, int] = {}
    for cat, model_id, n, sat, override in rows:
        if seen.get(cat, 0) >= limit_per_category:
            continue
        seen[cat] = seen.get(cat, 0) + 1
        total = totals.get(cat, 0)
        out.append(
            InsightModelLeaderboardRow(
                category_primary=cat,
                model_id=model_id or "unknown",
                share=(int(n) / total) if total else 0.0,
                events=int(n),
                override_rate=float(override) if override is not None else None,
                inferred_satisfaction=float(sat) if sat is not None else None,
            )
        )
    return out


async def _top_subcategories(
    db: AsyncSession, days: int = 30, limit: int = 15
) -> list[InsightCategoryShare]:
    cutoff = _cutoff(days)
    total = int((await db.execute(
        select(func.count(PromptEvent.event_id)).where(PromptEvent.created_at >= cutoff)
    )).scalar() or 0)
    rows = (await db.execute(
        select(PromptEvent.subcategory, func.count(PromptEvent.event_id))
        .where(PromptEvent.created_at >= cutoff)
        .where(PromptEvent.subcategory.isnot(None))
        .group_by(PromptEvent.subcategory)
        .order_by(func.count(PromptEvent.event_id).desc())
        .limit(limit)
    )).all()
    return [
        InsightCategoryShare(
            category_primary=taxonomy.rollup(sub),
            label=sub.replace("_", " ").title(),
            events=int(n),
            share=(int(n) / total) if total else 0.0,
        )
        for sub, n in rows
    ]


@router.get("/panel/insights/dashboard", response_model=DashboardSummary)
async def dashboard(
    window_days: int = Query(7, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
) -> DashboardSummary:
    total_events = int((await db.execute(
        select(func.count(PromptEvent.event_id))
    )).scalar() or 0)
    total_sessions = int((await db.execute(
        select(func.count(PanelSession.session_id))
    )).scalar() or 0)
    total_users = int((await db.execute(
        select(func.count(PanelUser.user_id))
    )).scalar() or 0)
    events_24h = await _count_since(db, 1)
    events_7d = await _count_since(db, 7)

    health = await _router_health(db, days=window_days)
    leaderboard = await _model_share_by_category(db, days=max(window_days, 14))
    top_subs = await _top_subcategories(db, days=max(window_days, 14))

    return DashboardSummary(
        as_of=datetime.now(timezone.utc),
        total_events=total_events,
        total_sessions=total_sessions,
        total_users=total_users,
        events_24h=events_24h,
        events_7d=events_7d,
        router_health=health,
        model_share_by_category=leaderboard,
        top_subcategories=top_subs,
        taxonomy_version=taxonomy.TAXONOMY_VERSION,
        classifier_version=HEURISTIC_CLASSIFIER_VERSION,
    )


@router.get("/panel/insights/categories")
async def list_categories():
    return {
        "version": taxonomy.TAXONOMY_VERSION,
        "categories": taxonomy.all_categories_with_labels(),
        "subcategories": [
            {"id": sub, "parent": parent}
            for sub, parent in taxonomy.SUBCATEGORY_PARENT.items()
        ],
    }


@router.get("/panel/insights/router-health", response_model=RouterHealthSnapshot)
async def router_health(
    window_days: int = Query(7, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
) -> RouterHealthSnapshot:
    return await _router_health(db, days=window_days)
