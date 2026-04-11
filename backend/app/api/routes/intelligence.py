"""Intelligence routes — powers the upgraded dashboard + explorer."""

from __future__ import annotations

import csv
import io
from typing import Optional

from fastapi import APIRouter, Depends, Query, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import intelligence
from app.models.database import get_db

router = APIRouter()


@router.get("/panel/intel/words")
async def words_endpoint(
    days: int = Query(30, ge=1, le=365),
    category: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    return {"words": await intelligence.top_words(db, days=days, category=category, limit=limit)}


@router.get("/panel/intel/ngrams")
async def ngrams_endpoint(
    n: int = Query(2, ge=2, le=4),
    days: int = Query(30, ge=1, le=365),
    category: Optional[str] = None,
    limit: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    return {"n": n, "ngrams": await intelligence.top_ngrams(db, n=n, days=days, category=category, limit=limit)}


@router.get("/panel/intel/templates")
async def templates_endpoint(
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(15, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    return {"templates": await intelligence.prompt_templates(db, days=days, limit=limit)}


@router.get("/panel/intel/heatmap")
async def heatmap_endpoint(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    return await intelligence.time_of_day_heatmap(db, days=days)


@router.get("/panel/intel/scatter")
async def scatter_endpoint(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    return {"points": await intelligence.complexity_satisfaction_scatter(db, days=days)}


@router.get("/panel/intel/constellation")
async def constellation_endpoint(
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(500, ge=1, le=2000),
    db: AsyncSession = Depends(get_db),
):
    return {"points": await intelligence.reasoning_creativity_constellation(db, days=days, limit=limit)}


@router.get("/panel/intel/flow")
async def flow_endpoint(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    return await intelligence.category_model_flow(db, days=days)


@router.get("/panel/intel/confusion")
async def confusion_endpoint(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    return {"cells": await intelligence.classifier_confusion(db, days=days)}


@router.get("/panel/intel/trends")
async def trends_endpoint(
    days: int = Query(14, ge=1, le=180),
    db: AsyncSession = Depends(get_db),
):
    return {"trends": await intelligence.category_trends(db, days=days)}


@router.get("/panel/intel/model-leaderboard")
async def model_leaderboard_endpoint(
    days: int = Query(14, ge=1, le=180),
    db: AsyncSession = Depends(get_db),
):
    return {"models": await intelligence.model_leaderboard(db, days=days)}


@router.get("/panel/intel/insights")
async def insights_endpoint(
    days: int = Query(14, ge=1, le=180),
    db: AsyncSession = Depends(get_db),
):
    return {"cards": await intelligence.generate_insight_cards(db, days=days)}


@router.get("/panel/intel/latest")
async def latest_endpoint(
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    return {"events": await intelligence.latest_events(db, limit=limit)}


@router.get("/panel/events/search")
async def search_endpoint(
    q: Optional[str] = None,
    category: Optional[str] = None,
    subcategory: Optional[str] = None,
    model: Optional[str] = None,
    min_confidence: Optional[float] = Query(None, ge=0, le=1),
    outcome: Optional[str] = Query(None, pattern="^(accepted|overrode|pending)$"),
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    return await intelligence.search_events(
        db,
        q=q,
        category=category,
        subcategory=subcategory,
        model=model,
        min_confidence=min_confidence,
        outcome=outcome,
        days=days,
        limit=limit,
        offset=offset,
    )


@router.get("/panel/events/export.csv")
async def export_csv(
    q: Optional[str] = None,
    category: Optional[str] = None,
    days: int = Query(90, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    data = await intelligence.search_events(
        db, q=q, category=category, days=days, limit=5000
    )
    buf = io.StringIO()
    writer = csv.writer(buf)
    headers = [
        "event_id", "created_at", "category_primary", "subcategory",
        "intent_label", "goal_label", "domain_label", "output_type",
        "task_structure", "reasoning_intensity", "creativity_score",
        "precision_requirement", "latency_sensitivity", "cost_sensitivity",
        "risk_class", "complexity_score", "ambiguity_score", "craft_score",
        "classifier_confidence", "classifier_version", "enrichment_tier",
        "recommended_model", "selected_model",
        "user_accepted_recommendation", "user_overrode_recommendation",
        "override_reason", "copied", "abandoned", "time_to_decision_ms",
        "inferred_satisfaction", "prompt_length_chars",
        "prompt_length_tokens", "prompt_redacted",
    ]
    writer.writerow(headers)
    for row in data["rows"]:
        writer.writerow([row.get(h, "") for h in headers])
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=panel_events.csv"},
    )


@router.get("/panel/intel/timeseries")
async def timeseries_endpoint(
    days: int = Query(30, ge=1, le=365),
    bucket: str = Query("auto", pattern="^(auto|hour|day)$"),
    db: AsyncSession = Depends(get_db),
):
    return await intelligence.timeseries(db, days=days, bucket=bucket)


@router.get("/panel/intel/distributions")
async def distributions_endpoint(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    return await intelligence.distributions(db, days=days)


@router.get("/panel/intel/mix")
async def mix_endpoint(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    return await intelligence.mix_breakdowns(db, days=days)


@router.get("/panel/intel/rising-phrases")
async def rising_phrases_endpoint(
    days: int = Query(14, ge=1, le=180),
    top_n: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    return {"phrases": await intelligence.rising_phrases(db, days=days, top_n=top_n)}


@router.get("/panel/intel/model-strengths")
async def model_strengths_endpoint(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    return {"models": await intelligence.model_strengths(db, days=days)}


@router.get("/panel/intel/sessions")
async def session_analytics_endpoint(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    return await intelligence.session_analytics(db, days=days)


@router.get("/panel/intel/narrative")
async def narrative_endpoint(
    days: int = Query(14, ge=1, le=180),
    db: AsyncSession = Depends(get_db),
):
    return await intelligence.generate_narrative(db, days=days)


@router.get("/panel/intel/co-occurrence")
async def co_occurrence_endpoint(
    days: int = Query(30, ge=1, le=365),
    top_n: int = Query(25, ge=5, le=60),
    db: AsyncSession = Depends(get_db),
):
    return await intelligence.co_occurrence_network(db, days=days, top_n=top_n)


@router.get("/panel/intel/cost-analytics")
async def cost_analytics_endpoint(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    return await intelligence.cost_analytics(db, days=days)


@router.get("/panel/intel/funnel")
async def funnel_endpoint(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    return await intelligence.funnel_analysis(db, days=days)


@router.get("/panel/intel/time-to-decision")
async def time_to_decision_endpoint(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    return await intelligence.time_to_decision_analytics(db, days=days)


@router.get("/panel/events/{event_id}")
async def get_single_event_endpoint(
    event_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await intelligence.get_single_event(db, event_id)
    if result is None:
        from fastapi import HTTPException
        raise HTTPException(404, "event not found")
    return result


@router.get("/panel/intel/stream")
async def sse_stream():
    return StreamingResponse(
        intelligence.stream_events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
