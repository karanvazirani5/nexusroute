"""Recommendation quality & learning loop endpoints."""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, func, select, case, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import (
    CalibrationBucket,
    CalibrationRun,
    PromptEvent,
    RecommendationFeedback,
    RecommendationOutcome,
    RecommendationOverride,
    get_db,
)
from app.models.schemas import (
    CalibrationBucketRead,
    CalibrationRunRead,
    QualityScorecard,
    RecommendationFeedbackCreate,
    RecommendationFeedbackRead,
    RecommendationOverrideRead,
)

router = APIRouter()


# ── Sprint 1.1 — Feedback submission ─────────────────────────────


@router.post(
    "/panel/feedback",
    response_model=RecommendationFeedbackRead,
    status_code=status.HTTP_201_CREATED,
)
async def submit_feedback(
    payload: RecommendationFeedbackCreate,
    db: AsyncSession = Depends(get_db),
) -> RecommendationFeedbackRead:
    fb = RecommendationFeedback(
        event_id=payload.event_id,
        user_id=payload.user_id,
        session_id=payload.session_id,
        feedback_type=payload.feedback_type,
        selected_model=payload.selected_model,
        recommended_model=payload.recommended_model,
        override_reason=payload.override_reason,
        override_reason_text=payload.override_reason_text,
        rating=payload.rating,
        time_to_feedback_ms=payload.time_to_feedback_ms,
    )
    db.add(fb)

    # If this is an override (selected != recommended), also write to overrides table
    if (
        payload.feedback_type == "override"
        and payload.selected_model
        and payload.recommended_model
        and payload.selected_model != payload.recommended_model
    ):
        # Fetch category context from PromptEvent if available
        category_primary = None
        subcategory = None
        complexity_score = None
        routing_confidence = None
        if payload.event_id:
            evt = (
                await db.execute(
                    select(PromptEvent).where(
                        PromptEvent.event_id == payload.event_id
                    )
                )
            ).scalars().first()
            if evt:
                category_primary = evt.category_primary
                subcategory = evt.subcategory
                complexity_score = evt.complexity_score
                routing_confidence = evt.routing_confidence

        # Upsert: delete existing then insert
        await db.execute(
            delete(RecommendationOverride).where(
                RecommendationOverride.event_id == payload.event_id
            )
        )
        ovr = RecommendationOverride(
            event_id=payload.event_id,
            user_id=payload.user_id,
            recommended_model=payload.recommended_model,
            selected_model=payload.selected_model,
            override_reason=payload.override_reason,
            override_reason_text=payload.override_reason_text,
            category_primary=category_primary,
            subcategory=subcategory,
            complexity_score=complexity_score,
            routing_confidence=routing_confidence,
        )
        db.add(ovr)

    await db.commit()
    await db.refresh(fb)
    return RecommendationFeedbackRead.model_validate(fb)


# ── Sprint 1.5 — Quality admin endpoints ────────────────────────


@router.get("/panel/quality/feedback", response_model=list[RecommendationFeedbackRead])
async def list_feedback(
    feedback_type: Optional[str] = None,
    override_reason: Optional[str] = None,
    model: Optional[str] = None,
    days: int = Query(default=30, ge=1, le=365),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    q = select(RecommendationFeedback).where(RecommendationFeedback.created_at >= cutoff)
    if feedback_type:
        q = q.where(RecommendationFeedback.feedback_type == feedback_type)
    if override_reason:
        q = q.where(RecommendationFeedback.override_reason == override_reason)
    if model:
        q = q.where(
            (RecommendationFeedback.selected_model == model)
            | (RecommendationFeedback.recommended_model == model)
        )
    q = q.order_by(RecommendationFeedback.created_at.desc()).limit(limit).offset(offset)
    rows = (await db.execute(q)).scalars().all()
    return [RecommendationFeedbackRead.model_validate(r) for r in rows]


@router.get("/panel/quality/overrides", response_model=list[RecommendationOverrideRead])
async def list_overrides(
    model: Optional[str] = None,
    category: Optional[str] = None,
    days: int = Query(default=30, ge=1, le=365),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    q = select(RecommendationOverride).where(RecommendationOverride.created_at >= cutoff)
    if model:
        q = q.where(
            (RecommendationOverride.recommended_model == model)
            | (RecommendationOverride.selected_model == model)
        )
    if category:
        q = q.where(RecommendationOverride.category_primary == category)
    q = q.order_by(RecommendationOverride.created_at.desc()).limit(limit).offset(offset)
    rows = (await db.execute(q)).scalars().all()
    return [RecommendationOverrideRead.model_validate(r) for r in rows]


@router.get("/panel/quality/outcomes/summary", response_model=QualityScorecard)
async def outcomes_summary(
    days: int = Query(default=30, ge=1, le=365),
    category: Optional[str] = None,
    model: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    base = select(RecommendationOutcome).where(RecommendationOutcome.created_at >= cutoff)
    if category:
        base = base.where(RecommendationOutcome.category_primary == category)
    if model:
        base = base.where(RecommendationOutcome.recommended_model == model)

    rows = (await db.execute(base)).scalars().all()
    total = len(rows)
    if total == 0:
        return QualityScorecard()

    accepted_count = sum(1 for r in rows if r.accepted)
    overridden_count = sum(1 for r in rows if r.overridden)
    abandoned_count = sum(1 for r in rows if r.abandoned)
    composites = [r.composite_score for r in rows if r.composite_score is not None]
    satisfactions = [r.inferred_satisfaction for r in rows if r.inferred_satisfaction is not None]
    ttd = [r.time_to_decision_ms for r in rows if r.time_to_decision_ms is not None]

    # Feedback volume
    fb_cutoff = select(func.count()).select_from(RecommendationFeedback).where(
        RecommendationFeedback.created_at >= cutoff
    )
    fb_count = (await db.execute(fb_cutoff)).scalar() or 0

    # Helpful rate from feedback
    helpful_q = select(func.count()).select_from(RecommendationFeedback).where(
        and_(
            RecommendationFeedback.created_at >= cutoff,
            RecommendationFeedback.feedback_type == "thumbs_up",
        )
    )
    helpful_count = (await db.execute(helpful_q)).scalar() or 0
    helpful_rate = helpful_count / fb_count if fb_count > 0 else None

    # Category breakdown
    cat_groups: dict[str, list] = {}
    for r in rows:
        cat = r.category_primary or "unknown"
        cat_groups.setdefault(cat, []).append(r)
    category_breakdown = []
    for cat, cat_rows in sorted(cat_groups.items(), key=lambda x: -len(x[1]))[:10]:
        n = len(cat_rows)
        category_breakdown.append({
            "category": cat,
            "count": n,
            "acceptance_rate": sum(1 for r in cat_rows if r.accepted) / n,
            "override_rate": sum(1 for r in cat_rows if r.overridden) / n,
        })

    # Model breakdown
    model_groups: dict[str, list] = {}
    for r in rows:
        m = r.recommended_model or "unknown"
        model_groups.setdefault(m, []).append(r)
    model_breakdown = []
    for m, m_rows in sorted(model_groups.items(), key=lambda x: -len(x[1]))[:10]:
        n = len(m_rows)
        model_breakdown.append({
            "model": m,
            "count": n,
            "acceptance_rate": sum(1 for r in m_rows if r.accepted) / n,
            "override_rate": sum(1 for r in m_rows if r.overridden) / n,
        })

    return QualityScorecard(
        total_outcomes=total,
        total_feedback=fb_count,
        acceptance_rate=accepted_count / total,
        override_rate=overridden_count / total,
        abandon_rate=abandoned_count / total,
        avg_composite_score=sum(composites) / len(composites) if composites else None,
        avg_satisfaction=sum(satisfactions) / len(satisfactions) if satisfactions else None,
        avg_time_to_decision_ms=sum(ttd) / len(ttd) if ttd else None,
        feedback_volume=fb_count,
        helpful_rate=helpful_rate,
        category_breakdown=category_breakdown,
        model_breakdown=model_breakdown,
    )


# ── Sprint 3.1 — Quality scorecard ──────────────────────────────


@router.get("/panel/quality/scorecard")
async def quality_scorecard(
    days: int = Query(default=30, ge=1, le=365),
    category: Optional[str] = None,
    model: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Alias to outcomes/summary with richer breakdown."""
    return await outcomes_summary(days=days, category=category, model=model, db=db)


# ── Sprint 3.2 — Bad segment detector ───────────────────────────


@router.get("/panel/quality/bad-segments")
async def bad_segments(
    min_samples: int = Query(default=10, ge=3),
    days: int = Query(default=30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    rows = (
        await db.execute(
            select(RecommendationOutcome).where(
                RecommendationOutcome.created_at >= cutoff
            )
        )
    ).scalars().all()

    # Group by (category, recommended_model)
    groups: dict[tuple[str, str], list] = {}
    for r in rows:
        key = (r.category_primary or "unknown", r.recommended_model or "unknown")
        groups.setdefault(key, []).append(r)

    alerts = []
    for (cat, mdl), g in groups.items():
        n = len(g)
        if n < min_samples:
            continue
        override_rate = sum(1 for r in g if r.overridden) / n
        success_count = sum(1 for r in g if r.success is True)
        failure_count = sum(1 for r in g if r.success is False)
        labeled = success_count + failure_count
        success_rate = success_count / labeled if labeled > 0 else None
        abandon_rate = sum(1 for r in g if r.abandoned) / n

        severity = None
        reasons = []
        if override_rate > 0.4:
            reasons.append(f"override_rate={override_rate:.0%}")
            severity = "critical"
        if success_rate is not None and success_rate < 0.5:
            reasons.append(f"success_rate={success_rate:.0%}")
            severity = severity or "critical"
        if abandon_rate > 0.3:
            reasons.append(f"abandon_rate={abandon_rate:.0%}")
            severity = severity or "warning"

        if severity:
            alerts.append({
                "category": cat,
                "model": mdl,
                "sample_count": n,
                "override_rate": round(override_rate, 3),
                "success_rate": round(success_rate, 3) if success_rate is not None else None,
                "abandon_rate": round(abandon_rate, 3),
                "severity": severity,
                "reasons": reasons,
            })

    # Detect winner→chosen switching patterns
    switch_counts: dict[tuple[str, str], int] = {}
    for r in rows:
        if r.overridden and r.recommended_model and r.selected_model:
            key = (r.recommended_model, r.selected_model)
            switch_counts[key] = switch_counts.get(key, 0) + 1
    for (rec, sel), count in switch_counts.items():
        if count >= 3:
            alerts.append({
                "category": "switching_pattern",
                "model": f"{rec} → {sel}",
                "sample_count": count,
                "override_rate": None,
                "success_rate": None,
                "abandon_rate": None,
                "severity": "info",
                "reasons": [f"Users chose {sel} over {rec} {count} times"],
            })

    alerts.sort(key=lambda a: {"critical": 0, "warning": 1, "info": 2}.get(a["severity"], 3))
    return alerts


# ── Sprint 3.4 — Per-model quality breakdown ────────────────────


@router.get("/panel/quality/model/{model_id}")
async def model_quality(
    model_id: str,
    days: int = Query(default=60, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    # All outcomes where this model was recommended
    recommended_rows = (
        await db.execute(
            select(RecommendationOutcome).where(
                and_(
                    RecommendationOutcome.recommended_model == model_id,
                    RecommendationOutcome.created_at >= cutoff,
                )
            )
        )
    ).scalars().all()
    # All outcomes where this model was selected (overridden TO)
    selected_rows = (
        await db.execute(
            select(RecommendationOutcome).where(
                and_(
                    RecommendationOutcome.selected_model == model_id,
                    RecommendationOutcome.created_at >= cutoff,
                )
            )
        )
    ).scalars().all()

    times_recommended = len(recommended_rows)
    times_selected = len(selected_rows)
    acceptance_rate = (
        sum(1 for r in recommended_rows if r.accepted) / times_recommended
        if times_recommended > 0 else None
    )
    override_from_rate = (
        sum(1 for r in recommended_rows if r.overridden) / times_recommended
        if times_recommended > 0 else None
    )
    override_to_count = sum(
        1 for r in selected_rows
        if r.recommended_model and r.recommended_model != model_id
    )
    sats = [r.inferred_satisfaction for r in recommended_rows if r.inferred_satisfaction is not None]
    avg_satisfaction = sum(sats) / len(sats) if sats else None

    # Top override reasons
    reason_counts: dict[str, int] = {}
    for r in recommended_rows:
        if r.overridden:
            # Look up from overrides table
            ovr = (
                await db.execute(
                    select(RecommendationOverride).where(
                        RecommendationOverride.event_id == r.event_id
                    )
                )
            ).scalars().first()
            if ovr and ovr.override_reason:
                reason_counts[ovr.override_reason] = reason_counts.get(ovr.override_reason, 0) + 1

    # Top categories
    cat_perf: dict[str, dict] = {}
    for r in recommended_rows:
        cat = r.category_primary or "unknown"
        entry = cat_perf.setdefault(cat, {"total": 0, "accepted": 0})
        entry["total"] += 1
        if r.accepted:
            entry["accepted"] += 1

    best_cats = sorted(
        [{"category": c, "acceptance_rate": d["accepted"] / d["total"], "count": d["total"]}
         for c, d in cat_perf.items() if d["total"] >= 2],
        key=lambda x: -x["acceptance_rate"],
    )[:5]
    worst_cats = sorted(
        [{"category": c, "acceptance_rate": d["accepted"] / d["total"], "count": d["total"]}
         for c, d in cat_perf.items() if d["total"] >= 2],
        key=lambda x: x["acceptance_rate"],
    )[:5]

    return {
        "model_id": model_id,
        "times_recommended": times_recommended,
        "times_selected": times_selected,
        "acceptance_rate": round(acceptance_rate, 3) if acceptance_rate is not None else None,
        "override_from_rate": round(override_from_rate, 3) if override_from_rate is not None else None,
        "override_to_count": override_to_count,
        "avg_satisfaction": round(avg_satisfaction, 3) if avg_satisfaction is not None else None,
        "top_override_reasons": sorted(reason_counts.items(), key=lambda x: -x[1])[:5],
        "best_categories": best_cats,
        "worst_categories": worst_cats,
    }


# ── Sprint 3.5 — Track-level analytics ──────────────────────────


@router.get("/panel/quality/tracks")
async def track_analytics(
    days: int = Query(default=30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    """Track-level performance: analyse outcomes by optimization track."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    # We derive track info from PromptEvent candidate_models JSON
    events = (
        await db.execute(
            select(PromptEvent).where(PromptEvent.created_at >= cutoff)
        )
    ).scalars().all()

    outcomes_by_event: dict[str, RecommendationOutcome] = {}
    outcome_rows = (
        await db.execute(
            select(RecommendationOutcome).where(
                RecommendationOutcome.created_at >= cutoff
            )
        )
    ).scalars().all()
    for o in outcome_rows:
        if o.event_id:
            outcomes_by_event[o.event_id] = o

    track_stats: dict[str, dict] = {}
    for evt in events:
        candidates = evt.candidate_models or []
        tracks_seen = set()
        for c in candidates:
            track = c.get("track") if isinstance(c, dict) else None
            if track and track not in tracks_seen:
                tracks_seen.add(track)
                s = track_stats.setdefault(track, {
                    "total": 0, "accepted": 0, "overridden": 0,
                    "satisfaction_sum": 0.0, "satisfaction_count": 0,
                })
                s["total"] += 1
                outcome = outcomes_by_event.get(evt.event_id)
                if outcome:
                    if outcome.accepted:
                        s["accepted"] += 1
                    if outcome.overridden:
                        s["overridden"] += 1
                    if outcome.inferred_satisfaction is not None:
                        s["satisfaction_sum"] += outcome.inferred_satisfaction
                        s["satisfaction_count"] += 1

    result = []
    for track, s in sorted(track_stats.items()):
        n = s["total"]
        result.append({
            "track": track,
            "total_recommendations": n,
            "acceptance_rate": round(s["accepted"] / n, 3) if n > 0 else None,
            "override_rate": round(s["overridden"] / n, 3) if n > 0 else None,
            "avg_satisfaction": (
                round(s["satisfaction_sum"] / s["satisfaction_count"], 3)
                if s["satisfaction_count"] > 0 else None
            ),
        })
    return result


# ── Sprint 2.2 — Calibration endpoints ──────────────────────────


@router.post("/panel/quality/calibration/run", response_model=CalibrationRunRead)
async def run_calibration(
    num_buckets: int = Query(default=10, ge=5, le=20),
    min_samples: int = Query(default=5, ge=1),
    db: AsyncSession = Depends(get_db),
):
    """Run empirical confidence calibration over labeled outcomes."""
    run = CalibrationRun(status="running", config={"num_buckets": num_buckets, "min_samples": min_samples})
    db.add(run)
    await db.flush()

    # Get all outcomes with success labels and routing confidence
    rows = (
        await db.execute(
            select(RecommendationOutcome).where(
                and_(
                    RecommendationOutcome.success.isnot(None),
                    RecommendationOutcome.routing_confidence.isnot(None),
                )
            )
        )
    ).scalars().all()

    if not rows:
        run.status = "completed"
        run.completed_at = datetime.now(timezone.utc)
        run.events_processed = 0
        run.ece_score = None
        await db.commit()
        await db.refresh(run)
        return CalibrationRunRead.model_validate(run)

    # Clear old buckets for this version
    version = "1.0.0"
    await db.execute(
        delete(CalibrationBucket).where(CalibrationBucket.calibration_version == version)
    )

    # Bucket by routing_confidence
    bucket_width = 1.0 / num_buckets
    ece_sum = 0.0
    total_labeled = len(rows)

    for i in range(num_buckets):
        lower = i * bucket_width
        upper = (i + 1) * bucket_width
        bucket_rows = [r for r in rows if lower <= (r.routing_confidence or 0) < upper]
        if i == num_buckets - 1:
            bucket_rows = [r for r in rows if lower <= (r.routing_confidence or 0) <= upper]

        if len(bucket_rows) < min_samples:
            continue

        avg_conf = sum(r.routing_confidence for r in bucket_rows) / len(bucket_rows)
        success_rate = sum(1 for r in bucket_rows if r.success) / len(bucket_rows)

        bucket = CalibrationBucket(
            bucket_label=f"{lower:.1f}-{upper:.1f}",
            bucket_lower=lower,
            bucket_upper=upper,
            predicted_confidence=round(avg_conf, 4),
            empirical_success_rate=round(success_rate, 4),
            sample_count=len(bucket_rows),
            calibration_version=version,
        )
        db.add(bucket)

        ece_sum += len(bucket_rows) * abs(avg_conf - success_rate)

    ece = ece_sum / total_labeled if total_labeled > 0 else None

    run.status = "completed"
    run.completed_at = datetime.now(timezone.utc)
    run.events_processed = total_labeled
    run.ece_score = round(ece, 4) if ece is not None else None
    run.calibration_version = version
    await db.commit()
    await db.refresh(run)
    return CalibrationRunRead.model_validate(run)


@router.get("/panel/quality/calibration/latest")
async def calibration_latest(db: AsyncSession = Depends(get_db)):
    """Return latest calibration buckets and run metadata."""
    run = (
        await db.execute(
            select(CalibrationRun)
            .where(CalibrationRun.status == "completed")
            .order_by(CalibrationRun.completed_at.desc())
            .limit(1)
        )
    ).scalars().first()

    if run is None:
        return {"run": None, "buckets": []}

    buckets = (
        await db.execute(
            select(CalibrationBucket)
            .where(CalibrationBucket.calibration_version == run.calibration_version)
            .order_by(CalibrationBucket.bucket_lower)
        )
    ).scalars().all()

    return {
        "run": CalibrationRunRead.model_validate(run),
        "buckets": [CalibrationBucketRead.model_validate(b) for b in buckets],
    }


@router.get("/panel/quality/calibration/adjust")
async def calibration_adjust(
    raw: float = Query(ge=0.0, le=1.0),
    db: AsyncSession = Depends(get_db),
):
    """Map a raw confidence value to calibrated confidence via linear interpolation."""
    buckets = (
        await db.execute(
            select(CalibrationBucket).order_by(CalibrationBucket.bucket_lower)
        )
    ).scalars().all()

    if not buckets:
        return {"raw": raw, "calibrated": raw, "has_calibration": False}

    # Linear interpolation between bucket midpoints
    midpoints = []
    for b in buckets:
        mid = (b.bucket_lower + b.bucket_upper) / 2
        midpoints.append((mid, b.empirical_success_rate, b.sample_count))

    # Clamp to range
    if raw <= midpoints[0][0]:
        calibrated = midpoints[0][1]
    elif raw >= midpoints[-1][0]:
        calibrated = midpoints[-1][1]
    else:
        # Find bracketing pair
        for i in range(len(midpoints) - 1):
            if midpoints[i][0] <= raw <= midpoints[i + 1][0]:
                t = (raw - midpoints[i][0]) / (midpoints[i + 1][0] - midpoints[i][0])
                calibrated = midpoints[i][1] + t * (midpoints[i + 1][1] - midpoints[i][1])
                break
        else:
            calibrated = raw

    return {"raw": raw, "calibrated": round(calibrated, 4), "has_calibration": True}


@router.get("/panel/quality/calibration/curve")
async def calibration_curve(db: AsyncSession = Depends(get_db)):
    """Return the full calibration curve for client-side caching."""
    buckets = (
        await db.execute(
            select(CalibrationBucket).order_by(CalibrationBucket.bucket_lower)
        )
    ).scalars().all()

    if not buckets:
        return {"curve": [], "has_calibration": False}

    curve = []
    for b in buckets:
        curve.append({
            "midpoint": round((b.bucket_lower + b.bucket_upper) / 2, 3),
            "empirical": b.empirical_success_rate,
            "sample_count": b.sample_count,
        })
    return {"curve": curve, "has_calibration": True}
