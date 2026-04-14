"""Content performance tracking endpoints for use-case pages."""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import ContentView, get_db

router = APIRouter()


@router.post("/panel/content/view", status_code=201)
async def track_view(
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    slug = body.get("slug")
    if not slug:
        return {"error": "slug is required"}
    view = ContentView(
        slug=slug,
        event_type="view",
        source=body.get("source"),
        user_id=body.get("user_id"),
    )
    db.add(view)
    await db.commit()
    return {"status": "ok"}


@router.post("/panel/content/click-through", status_code=201)
async def track_click_through(
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    slug = body.get("slug")
    if not slug:
        return {"error": "slug is required"}
    view = ContentView(
        slug=slug,
        event_type="click_through",
        source=body.get("source"),
        user_id=body.get("user_id"),
    )
    db.add(view)
    await db.commit()
    return {"status": "ok"}


@router.get("/panel/content/analytics")
async def content_analytics(
    days: int = Query(default=30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    rows = (
        await db.execute(
            select(ContentView).where(ContentView.created_at >= cutoff)
        )
    ).scalars().all()

    # Group by slug
    by_slug: dict[str, dict] = {}
    for r in rows:
        entry = by_slug.setdefault(r.slug, {"views": 0, "click_throughs": 0})
        if r.event_type == "view":
            entry["views"] += 1
        elif r.event_type == "click_through":
            entry["click_throughs"] += 1

    pages = []
    for slug, data in sorted(by_slug.items(), key=lambda x: -x[1]["views"]):
        ctr = data["click_throughs"] / data["views"] if data["views"] > 0 else 0
        pages.append({
            "slug": slug,
            "views": data["views"],
            "click_throughs": data["click_throughs"],
            "ctr": round(ctr, 4),
        })

    return {
        "total_views": sum(d["views"] for d in by_slug.values()),
        "total_click_throughs": sum(d["click_throughs"] for d in by_slug.values()),
        "pages": pages,
    }
