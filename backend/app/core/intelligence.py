"""
Intelligence aggregation engine.

Everything in this module turns the raw ``prompt_events`` stream into the
kind of derived signal that goes into the "intelligence terminal" view:
word frequencies, n-grams, template archetypes, time-of-day heatmaps,
category→model flows, classifier confusion, auto-generated insight cards,
and the live event broadcast queue.

All functions are pure Postgres/SQLite aggregations + in-memory counting.
No LLM calls, no network. Safe to run every request.
"""

from __future__ import annotations

import asyncio
import json
import re
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import AsyncIterator, Iterable, Optional

from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import taxonomy
from app.models.database import PromptEvent

# ──────────────────────────────────────────────────────────────────
# Stop-word list + tokenizer
# ──────────────────────────────────────────────────────────────────
STOP_WORDS = frozenset({
    "a", "an", "the", "and", "or", "but", "if", "then", "else", "so",
    "for", "on", "in", "at", "by", "of", "to", "from", "with", "without",
    "into", "onto", "about", "as", "is", "are", "was", "were", "be",
    "been", "being", "am", "i", "you", "he", "she", "it", "we", "they",
    "me", "my", "mine", "your", "yours", "his", "her", "its", "our",
    "ours", "their", "theirs", "this", "that", "these", "those", "here",
    "there", "can", "could", "will", "would", "should", "shall", "may",
    "might", "must", "do", "does", "did", "doing", "done", "have", "has",
    "had", "having", "not", "no", "yes", "up", "down", "out", "over",
    "under", "again", "further", "too", "very", "just", "like", "more",
    "most", "some", "any", "all", "each", "every", "other", "another",
    "such", "what", "which", "who", "whom", "whose", "where", "when",
    "why", "how", "also", "than", "through", "between", "among",
    "please", "give", "get", "make", "made", "use", "using", "used",
    "new", "old", "good", "bad", "big", "small", "need", "want", "let",
    "one", "two", "three", "first", "last", "best", "top", "bottom",
    "show", "tell", "say", "said", "known", "things", "stuff",
    "redacted_email", "redacted_phone", "redacted_name", "redacted_url",
    "redacted_ip", "redacted_api", "redacted_key", "redacted_jwt",
    "redacted_ssn", "redacted_cc", "redacted_iban", "redacted_passport",
    "redacted_token", "redacted_aws",
})

_WORD_RE = re.compile(r"[a-zA-Z][a-zA-Z\-']{1,}")
_REDACTED_RE = re.compile(r"\[redacted_\w+\]", re.IGNORECASE)


def tokenize(text: str) -> list[str]:
    """Lowercase word tokens with redaction markers stripped."""
    cleaned = _REDACTED_RE.sub(" ", text or "")
    return [m.group(0).lower() for m in _WORD_RE.finditer(cleaned)]


def filter_stop(tokens: Iterable[str]) -> list[str]:
    return [t for t in tokens if t not in STOP_WORDS and len(t) > 2]


# ──────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────
def _cutoff(days: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=days)


async def _fetch_events(
    db: AsyncSession,
    days: int = 30,
    category: Optional[str] = None,
    limit: int = 5000,
) -> list[PromptEvent]:
    stmt = (
        select(PromptEvent)
        .where(PromptEvent.created_at >= _cutoff(days))
        .order_by(PromptEvent.created_at.desc())
        .limit(limit)
    )
    if category:
        stmt = stmt.where(PromptEvent.category_primary == category)
    return list((await db.execute(stmt)).scalars().all())


# ──────────────────────────────────────────────────────────────────
# Word frequency + n-gram extraction
# ──────────────────────────────────────────────────────────────────
async def top_words(
    db: AsyncSession,
    *,
    days: int = 30,
    category: Optional[str] = None,
    limit: int = 50,
) -> list[dict]:
    events = await _fetch_events(db, days=days, category=category)
    counter: Counter[str] = Counter()
    per_category: dict[str, Counter[str]] = defaultdict(Counter)
    for e in events:
        tokens = filter_stop(tokenize(e.prompt_redacted or ""))
        counter.update(tokens)
        if e.category_primary:
            per_category[e.category_primary].update(tokens)

    max_count = counter.most_common(1)[0][1] if counter else 1
    out = []
    for word, n in counter.most_common(limit):
        top_cat = None
        best = 0
        for cat, cat_counter in per_category.items():
            if cat_counter[word] > best:
                best = cat_counter[word]
                top_cat = cat
        out.append({
            "word": word,
            "count": n,
            "weight": n / max_count,
            "top_category": top_cat,
            "top_category_label": taxonomy.CATEGORY_PRIMARY_LABELS.get(top_cat or "", "") if top_cat else None,
        })
    return out


async def top_ngrams(
    db: AsyncSession,
    *,
    n: int = 2,
    days: int = 30,
    category: Optional[str] = None,
    limit: int = 25,
) -> list[dict]:
    if n < 2 or n > 4:
        n = 2
    events = await _fetch_events(db, days=days, category=category)
    counter: Counter[tuple[str, ...]] = Counter()
    total = 0
    for e in events:
        tokens = [t for t in tokenize(e.prompt_redacted or "") if t not in STOP_WORDS or t in {"how", "what", "why", "like"}]
        if len(tokens) < n:
            continue
        total += 1
        for i in range(len(tokens) - n + 1):
            gram = tuple(tokens[i : i + n])
            # Skip if every token is a stop word.
            if all(t in STOP_WORDS for t in gram):
                continue
            counter[gram] += 1

    # Adaptive floor: for small panels (<50 events) accept singletons
    # so the explorer still shows *something*, otherwise require n ≥ 2.
    floor = 1 if total < 50 else 2
    out = []
    for gram, c in counter.most_common(limit):
        if c < floor:
            break
        out.append({
            "phrase": " ".join(gram),
            "count": c,
            "size": n,
        })
    return out


async def prompt_templates(
    db: AsyncSession,
    *,
    days: int = 30,
    limit: int = 15,
) -> list[dict]:
    """Detect recurring prompt templates like 'write a ___ about ___'."""
    events = await _fetch_events(db, days=days)
    templates: Counter[str] = Counter()
    exemplars: dict[str, str] = {}

    # Normalize: take the first 6 tokens, replace rare content words with
    # a blank so structural shapes collapse together.
    for e in events:
        tokens = tokenize(e.prompt_redacted or "")[:8]
        if len(tokens) < 3:
            continue
        normalized: list[str] = []
        for i, t in enumerate(tokens):
            if i < 2 or t in STOP_WORDS or len(t) <= 4:
                normalized.append(t)
            else:
                normalized.append("___")
        key = " ".join(normalized)
        templates[key] += 1
        exemplars.setdefault(key, e.prompt_redacted or "")

    # Adaptive floor so small panels still surface *some* templates.
    floor = 1 if sum(templates.values()) < 100 else 2
    out = []
    for tmpl, n in templates.most_common(limit * 3):
        if n < floor:
            break
        if "___" not in tmpl:
            continue
        out.append({
            "template": tmpl,
            "count": n,
            "exemplar": exemplars.get(tmpl, "")[:120],
        })
        if len(out) >= limit:
            break
    return out


# ──────────────────────────────────────────────────────────────────
# Heatmaps and distributions
# ──────────────────────────────────────────────────────────────────
async def time_of_day_heatmap(
    db: AsyncSession,
    *,
    days: int = 30,
) -> dict:
    events = await _fetch_events(db, days=days, limit=10000)
    grid: dict[tuple[int, str], int] = defaultdict(int)
    cat_totals: Counter[str] = Counter()
    total = 0
    for e in events:
        hour = e.created_at.hour
        cat = e.category_primary or "unknown"
        grid[(hour, cat)] += 1
        cat_totals[cat] += 1
        total += 1

    top_cats = [c for c, _ in cat_totals.most_common(8)]
    rows = []
    for hour in range(24):
        row = {"hour": hour}
        for cat in top_cats:
            row[cat] = grid.get((hour, cat), 0)
        rows.append(row)
    return {
        "categories": [
            {"id": c, "label": taxonomy.CATEGORY_PRIMARY_LABELS.get(c, c)}
            for c in top_cats
        ],
        "rows": rows,
        "total_events": total,
    }


async def complexity_satisfaction_scatter(
    db: AsyncSession,
    *,
    days: int = 30,
) -> list[dict]:
    events = await _fetch_events(db, days=days, limit=5000)
    out = []
    for e in events:
        if e.inferred_satisfaction is None or e.complexity_score is None:
            continue
        out.append({
            "event_id": e.event_id,
            "complexity": e.complexity_score,
            "satisfaction": e.inferred_satisfaction,
            "model": e.selected_model or e.recommended_model or "unknown",
            "category": e.category_primary or "unknown",
            "preview": (e.prompt_redacted or "")[:80],
        })
    return out


async def reasoning_creativity_constellation(
    db: AsyncSession,
    *,
    days: int = 30,
    limit: int = 500,
) -> list[dict]:
    """2D projection of prompts on a reasoning × creativity plane.

    These two axes are chosen because they are orthogonal in the taxonomy
    and give the clearest visual separation between coding (high reason,
    low creative), creative writing (low reason, high creative), and the
    middle band of transformation/analysis tasks.
    """
    events = await _fetch_events(db, days=days, limit=limit)
    import random

    rnd = random.Random(42)
    out = []
    for e in events:
        if e.reasoning_intensity is None or e.creativity_score is None:
            continue
        # Small jitter so integer coordinates don't stack.
        jx = (rnd.random() - 0.5) * 0.5
        jy = (rnd.random() - 0.5) * 0.5
        out.append({
            "event_id": e.event_id,
            "x": e.reasoning_intensity + jx,
            "y": e.creativity_score + jy,
            "z": e.complexity_score or 3,
            "category": e.category_primary or "unknown",
            "subcategory": e.subcategory,
            "model": e.selected_model or e.recommended_model,
            "preview": (e.prompt_redacted or "")[:80],
            "confidence": e.classifier_confidence or 0,
        })
    return out


async def category_model_flow(
    db: AsyncSession, *, days: int = 30
) -> dict:
    """Flow data for a Sankey-style chart: category → recommended → selected."""
    events = await _fetch_events(db, days=days, limit=5000)
    cat_to_model: Counter[tuple[str, str]] = Counter()
    model_to_outcome: Counter[tuple[str, str]] = Counter()
    for e in events:
        if e.category_primary and e.recommended_model:
            cat_to_model[(e.category_primary, e.recommended_model)] += 1
        if e.recommended_model and e.selected_model:
            outcome = "accepted" if e.user_accepted_recommendation else (
                "overrode" if e.user_overrode_recommendation else "pending"
            )
            model_to_outcome[(e.recommended_model, outcome)] += 1

    cat_links = [
        {"source": c, "target": m, "value": v}
        for (c, m), v in cat_to_model.most_common(30)
    ]
    outcome_links = [
        {"source": m, "target": o, "value": v}
        for (m, o), v in model_to_outcome.most_common(30)
    ]
    return {"category_to_model": cat_links, "model_to_outcome": outcome_links}


async def classifier_confusion(
    db: AsyncSession, *, days: int = 30
) -> list[dict]:
    """Override-based confusion: where users pick something else, what
    does the heuristic think the task is?"""
    events = await _fetch_events(db, days=days, limit=5000)
    confusion: Counter[tuple[str, str]] = Counter()
    for e in events:
        if not (e.user_overrode_recommendation and e.category_primary):
            continue
        confusion[(e.category_primary, e.override_reason or "unspecified")] += 1

    return [
        {
            "category": c,
            "category_label": taxonomy.CATEGORY_PRIMARY_LABELS.get(c, c),
            "reason": r,
            "count": n,
        }
        for (c, r), n in confusion.most_common(30)
    ]


async def category_trends(
    db: AsyncSession, *, days: int = 14
) -> list[dict]:
    """Category share delta: current window vs prior equal window."""
    now = datetime.now(timezone.utc)
    cur_start = now - timedelta(days=days)
    prev_start = now - timedelta(days=days * 2)

    cur_rows = (await db.execute(
        select(PromptEvent.category_primary, func.count(PromptEvent.event_id))
        .where(PromptEvent.created_at >= cur_start)
        .group_by(PromptEvent.category_primary)
    )).all()
    prev_rows = (await db.execute(
        select(PromptEvent.category_primary, func.count(PromptEvent.event_id))
        .where(and_(PromptEvent.created_at >= prev_start, PromptEvent.created_at < cur_start))
        .group_by(PromptEvent.category_primary)
    )).all()

    cur = {c: int(n) for c, n in cur_rows if c}
    prev = {c: int(n) for c, n in prev_rows if c}

    cur_total = sum(cur.values()) or 1
    prev_total = sum(prev.values()) or 1

    out = []
    for cat in set(cur) | set(prev):
        cur_share = cur.get(cat, 0) / cur_total
        prev_share = prev.get(cat, 0) / prev_total
        delta = cur_share - prev_share
        out.append({
            "category": cat,
            "label": taxonomy.CATEGORY_PRIMARY_LABELS.get(cat, cat),
            "current_events": cur.get(cat, 0),
            "prior_events": prev.get(cat, 0),
            "current_share": cur_share,
            "prior_share": prev_share,
            "delta": delta,
            "direction": "up" if delta > 0.015 else "down" if delta < -0.015 else "flat",
        })
    out.sort(key=lambda r: abs(r["delta"]), reverse=True)
    return out


async def model_leaderboard(
    db: AsyncSession, *, days: int = 14
) -> list[dict]:
    cutoff = _cutoff(days)
    override_expr = case(
        (PromptEvent.user_overrode_recommendation.is_(True), 1.0),
        (PromptEvent.user_overrode_recommendation.is_(False), 0.0),
        else_=None,
    )
    rows = (await db.execute(
        select(
            PromptEvent.selected_model.label("model"),
            func.count(PromptEvent.event_id).label("n"),
            func.avg(PromptEvent.inferred_satisfaction).label("sat"),
            func.avg(override_expr).label("ovr"),
            func.avg(PromptEvent.routing_confidence).label("conf"),
        )
        .where(PromptEvent.created_at >= cutoff)
        .where(PromptEvent.selected_model.isnot(None))
        .group_by(PromptEvent.selected_model)
        .order_by(func.count(PromptEvent.event_id).desc())
    )).all()

    total = sum(int(r[1]) for r in rows) or 1
    return [
        {
            "model_id": r[0],
            "events": int(r[1]),
            "share": int(r[1]) / total,
            "avg_satisfaction": float(r[2]) if r[2] is not None else None,
            "avg_override_rate": float(r[3]) if r[3] is not None else None,
            "avg_routing_confidence": float(r[4]) if r[4] is not None else None,
        }
        for r in rows
    ]


# ──────────────────────────────────────────────────────────────────
# Auto-generated insight cards
# ──────────────────────────────────────────────────────────────────
@dataclass
class InsightCard:
    id: str
    headline: str
    finding: str
    sample_size: int
    window_days: int
    confidence: float
    chart_hint: str
    emoji: str
    color: str


async def generate_insight_cards(
    db: AsyncSession, *, days: int = 14
) -> list[dict]:
    cards: list[InsightCard] = []
    trends = await category_trends(db, days=days)
    leader = await model_leaderboard(db, days=days)

    # Fastest growing category
    rising = [t for t in trends if t["direction"] == "up" and t["current_events"] >= 3]
    if rising:
        top = rising[0]
        cards.append(InsightCard(
            id="rising_category",
            headline=f"{top['label']} is trending up",
            finding=f"Share grew from {top['prior_share']:.0%} to {top['current_share']:.0%} in the last {days}d (Δ +{top['delta']:.0%}, n={top['current_events']}).",
            sample_size=top['current_events'],
            window_days=days,
            confidence=min(1.0, top['current_events'] / 20),
            chart_hint="trend_line",
            emoji="🔥",
            color="emerald",
        ))

    # Fastest declining
    falling = [t for t in trends if t["direction"] == "down" and t["prior_events"] >= 3]
    if falling:
        top = falling[0]
        cards.append(InsightCard(
            id="falling_category",
            headline=f"{top['label']} is cooling off",
            finding=f"Share dropped from {top['prior_share']:.0%} to {top['current_share']:.0%} in the last {days}d (Δ {top['delta']:+.0%}).",
            sample_size=top['prior_events'],
            window_days=days,
            confidence=min(1.0, top['prior_events'] / 20),
            chart_hint="trend_line",
            emoji="❄️",
            color="blue",
        ))

    # Model dominance
    if leader:
        top_model = leader[0]
        cards.append(InsightCard(
            id="model_leader",
            headline=f"{top_model['model_id']} leads the panel",
            finding=f"{top_model['model_id']} took {top_model['share']:.0%} of selections ({top_model['events']} events) with inferred satisfaction {top_model['avg_satisfaction']:.2f}" if top_model['avg_satisfaction'] else f"{top_model['model_id']} took {top_model['share']:.0%} of all selections ({top_model['events']} events).",
            sample_size=top_model['events'],
            window_days=days,
            confidence=min(1.0, top_model['events'] / 15),
            chart_hint="bar",
            emoji="👑",
            color="violet",
        ))

    # Override hot-spot
    confusion = await classifier_confusion(db, days=days)
    if confusion:
        top_conf = confusion[0]
        cards.append(InsightCard(
            id="override_hotspot",
            headline=f"Users override most in {top_conf['category_label']}",
            finding=f"{top_conf['count']} override(s), top reason: '{top_conf['reason']}'. Signal that the router's {top_conf['category_label']} strategy needs a second look.",
            sample_size=top_conf['count'],
            window_days=days,
            confidence=min(1.0, top_conf['count'] / 10),
            chart_hint="bar",
            emoji="⚠️",
            color="amber",
        ))

    # Unclassified pressure (emerging use case signal)
    unclassified = (await db.execute(
        select(func.count(PromptEvent.event_id))
        .where(PromptEvent.created_at >= _cutoff(days))
        .where(PromptEvent.subcategory == "unclassified")
    )).scalar() or 0
    total = (await db.execute(
        select(func.count(PromptEvent.event_id))
        .where(PromptEvent.created_at >= _cutoff(days))
    )).scalar() or 0
    if total and unclassified / total > 0.05:
        cards.append(InsightCard(
            id="emerging_use_cases",
            headline="Emerging use cases detected",
            finding=f"{unclassified} of {total} prompts ({unclassified / total:.0%}) fell outside known subcategories. Likely an emerging pattern the taxonomy doesn't cover yet.",
            sample_size=unclassified,
            window_days=days,
            confidence=min(1.0, unclassified / 5),
            chart_hint="scatter",
            emoji="🛰️",
            color="cyan",
        ))

    return [c.__dict__ for c in cards]


# ──────────────────────────────────────────────────────────────────
# Live event broadcast (SSE)
# ──────────────────────────────────────────────────────────────────
_subscribers: set[asyncio.Queue] = set()


def subscribe() -> asyncio.Queue:
    queue: asyncio.Queue = asyncio.Queue(maxsize=100)
    _subscribers.add(queue)
    return queue


def unsubscribe(queue: asyncio.Queue) -> None:
    _subscribers.discard(queue)


def broadcast(event: dict) -> None:
    """Fan-out a newly captured event to every SSE subscriber."""
    dead = []
    for q in list(_subscribers):
        try:
            q.put_nowait(event)
        except asyncio.QueueFull:
            dead.append(q)
    for q in dead:
        _subscribers.discard(q)


async def stream_events() -> AsyncIterator[str]:
    """Async generator producing SSE messages for a single subscriber."""
    queue = subscribe()
    try:
        # Kick off with a hello so the frontend confirms the connection.
        yield f"event: hello\ndata: {json.dumps({'subscribers': len(_subscribers)})}\n\n"
        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=15.0)
                yield f"event: prompt\ndata: {json.dumps(event, default=str)}\n\n"
            except asyncio.TimeoutError:
                # Keep-alive comment so proxies don't close the connection.
                yield ": keep-alive\n\n"
    finally:
        unsubscribe(queue)


# ──────────────────────────────────────────────────────────────────
# Raw-data explorer: full search + filter
# ──────────────────────────────────────────────────────────────────
async def search_events(
    db: AsyncSession,
    *,
    q: Optional[str] = None,
    category: Optional[str] = None,
    subcategory: Optional[str] = None,
    model: Optional[str] = None,
    min_confidence: Optional[float] = None,
    outcome: Optional[str] = None,  # accepted / overrode / pending
    days: int = 30,
    limit: int = 200,
    offset: int = 0,
) -> dict:
    stmt = select(PromptEvent).where(PromptEvent.created_at >= _cutoff(days))
    count_stmt = select(func.count(PromptEvent.event_id)).where(
        PromptEvent.created_at >= _cutoff(days)
    )

    if q:
        like = f"%{q.lower()}%"
        cond = func.lower(PromptEvent.prompt_redacted).like(like)
        stmt = stmt.where(cond)
        count_stmt = count_stmt.where(cond)
    if category:
        stmt = stmt.where(PromptEvent.category_primary == category)
        count_stmt = count_stmt.where(PromptEvent.category_primary == category)
    if subcategory:
        stmt = stmt.where(PromptEvent.subcategory == subcategory)
        count_stmt = count_stmt.where(PromptEvent.subcategory == subcategory)
    if model:
        stmt = stmt.where(
            or_(
                PromptEvent.selected_model == model,
                PromptEvent.recommended_model == model,
            )
        )
        count_stmt = count_stmt.where(
            or_(
                PromptEvent.selected_model == model,
                PromptEvent.recommended_model == model,
            )
        )
    if min_confidence is not None:
        stmt = stmt.where(PromptEvent.classifier_confidence >= min_confidence)
        count_stmt = count_stmt.where(
            PromptEvent.classifier_confidence >= min_confidence
        )
    if outcome == "accepted":
        stmt = stmt.where(PromptEvent.user_accepted_recommendation.is_(True))
        count_stmt = count_stmt.where(
            PromptEvent.user_accepted_recommendation.is_(True)
        )
    elif outcome == "overrode":
        stmt = stmt.where(PromptEvent.user_overrode_recommendation.is_(True))
        count_stmt = count_stmt.where(
            PromptEvent.user_overrode_recommendation.is_(True)
        )

    total = int((await db.execute(count_stmt)).scalar() or 0)

    stmt = stmt.order_by(PromptEvent.created_at.desc()).limit(limit).offset(offset)
    rows = list((await db.execute(stmt)).scalars().all())

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "rows": [_event_to_dict(e) for e in rows],
    }


def _event_to_dict(e: PromptEvent) -> dict:
    return {
        "event_id": e.event_id,
        "created_at": e.created_at.isoformat() if e.created_at else None,
        "prompt_redacted": e.prompt_redacted,
        "prompt_length_chars": e.prompt_length_chars,
        "prompt_length_tokens": e.prompt_length_tokens,
        "language": e.language,
        "contains_code": e.contains_code,
        "contains_url": e.contains_url,
        "category_primary": e.category_primary,
        "subcategory": e.subcategory,
        "intent_label": e.intent_label,
        "goal_label": e.goal_label,
        "domain_label": e.domain_label,
        "output_type": e.output_type,
        "task_structure": e.task_structure,
        "reasoning_intensity": e.reasoning_intensity,
        "creativity_score": e.creativity_score,
        "precision_requirement": e.precision_requirement,
        "latency_sensitivity": e.latency_sensitivity,
        "cost_sensitivity": e.cost_sensitivity,
        "risk_class": e.risk_class,
        "complexity_score": e.complexity_score,
        "ambiguity_score": e.ambiguity_score,
        "craft_score": e.craft_score,
        "classifier_confidence": e.classifier_confidence,
        "classifier_version": e.classifier_version,
        "enrichment_tier": e.enrichment_tier,
        "recommended_model": e.recommended_model,
        "selected_model": e.selected_model,
        "user_accepted_recommendation": e.user_accepted_recommendation,
        "user_overrode_recommendation": e.user_overrode_recommendation,
        "override_reason": e.override_reason,
        "copied": e.copied,
        "exported": e.exported,
        "rerouted": e.rerouted,
        "abandoned": e.abandoned,
        "time_to_decision_ms": e.time_to_decision_ms,
        "inferred_satisfaction": e.inferred_satisfaction,
        "insight_worthiness_score": e.insight_worthiness_score,
        "redaction_counts": e.redaction_counts,
    }


async def latest_events(
    db: AsyncSession, *, limit: int = 20
) -> list[dict]:
    stmt = (
        select(PromptEvent)
        .order_by(PromptEvent.created_at.desc())
        .limit(limit)
    )
    rows = list((await db.execute(stmt)).scalars().all())
    return [
        {
            "event_id": e.event_id,
            "created_at": e.created_at.isoformat() if e.created_at else None,
            "category_primary": e.category_primary,
            "subcategory": e.subcategory,
            "preview": (e.prompt_redacted or "")[:100],
            "recommended_model": e.recommended_model,
            "selected_model": e.selected_model,
            "classifier_confidence": e.classifier_confidence,
            "complexity_score": e.complexity_score,
            "inferred_satisfaction": e.inferred_satisfaction,
        }
        for e in rows
    ]


# ──────────────────────────────────────────────────────────────────
# Expanded intelligence — extract MORE signal per prompt
# ──────────────────────────────────────────────────────────────────
async def timeseries(
    db: AsyncSession,
    *,
    days: int = 30,
    bucket: str = "auto",
) -> dict:
    """Event rate over time. Buckets by hour if days <= 3, day otherwise."""
    events = await _fetch_events(db, days=days, limit=20000)
    if bucket == "auto":
        bucket = "hour" if days <= 3 else "day"

    def key(dt: datetime) -> str:
        if bucket == "hour":
            return dt.strftime("%Y-%m-%dT%H:00")
        return dt.strftime("%Y-%m-%d")

    buckets: Counter[str] = Counter()
    by_cat: dict[str, Counter[str]] = defaultdict(Counter)
    for e in events:
        if not e.created_at:
            continue
        k = key(e.created_at.replace(tzinfo=timezone.utc) if e.created_at.tzinfo is None else e.created_at)
        buckets[k] += 1
        if e.category_primary:
            by_cat[e.category_primary][k] += 1

    # Fill the entire window so empty buckets are zero, not missing.
    now = datetime.now(timezone.utc)
    step = timedelta(hours=1) if bucket == "hour" else timedelta(days=1)
    steps = days * 24 if bucket == "hour" else days
    keys: list[str] = []
    cursor = now - step * (steps - 1)
    for _ in range(steps):
        keys.append(key(cursor))
        cursor += step

    series_total = [{"t": k, "events": buckets.get(k, 0)} for k in keys]

    top_cats = [c for c, _ in Counter({c: sum(v.values()) for c, v in by_cat.items()}).most_common(6)]
    series_by_cat = {
        cat: [{"t": k, "events": by_cat[cat].get(k, 0)} for k in keys]
        for cat in top_cats
    }

    return {
        "bucket": bucket,
        "keys": keys,
        "total": series_total,
        "by_category": series_by_cat,
        "categories": [
            {"id": c, "label": taxonomy.CATEGORY_PRIMARY_LABELS.get(c, c)}
            for c in top_cats
        ],
    }


async def distributions(
    db: AsyncSession, *, days: int = 30
) -> dict:
    """Histograms across every numeric taxonomy axis + prompt length."""
    events = await _fetch_events(db, days=days, limit=20000)

    def histo(vals: list[float], lo: float, hi: float, bins: int) -> list[dict]:
        if not vals:
            return [{"bin": lo + i * (hi - lo) / bins, "count": 0} for i in range(bins)]
        counts = [0] * bins
        width = (hi - lo) / bins
        for v in vals:
            if v is None:
                continue
            idx = min(bins - 1, max(0, int((v - lo) / width)))
            counts[idx] += 1
        return [
            {"bin": round(lo + i * width, 2), "count": counts[i]}
            for i in range(bins)
        ]

    def collect(attr: str) -> list[float]:
        return [getattr(e, attr) for e in events if getattr(e, attr) is not None]

    return {
        "sample_size": len(events),
        "complexity": histo(collect("complexity_score"), 1, 10, 10),
        "reasoning_intensity": histo(collect("reasoning_intensity"), 1, 5, 5),
        "creativity": histo(collect("creativity_score"), 1, 5, 5),
        "precision": histo(collect("precision_requirement"), 1, 5, 5),
        "craft": histo(collect("craft_score"), 1, 5, 5),
        "ambiguity": histo(collect("ambiguity_score"), 0, 1, 10),
        "prompt_length_tokens": histo(
            [float(e.prompt_length_tokens or 0) for e in events],
            0,
            500,
            10,
        ),
        "classifier_confidence": histo(
            [float(e.classifier_confidence or 0) for e in events], 0, 1, 10
        ),
    }


async def mix_breakdowns(db: AsyncSession, *, days: int = 30) -> dict:
    """Pie-chart-ready breakdowns for the non-numeric taxonomy axes."""
    events = await _fetch_events(db, days=days, limit=20000)

    def counter(attr: str) -> list[dict]:
        c: Counter[str] = Counter()
        for e in events:
            v = getattr(e, attr)
            if v:
                c[v] += 1
        total = sum(c.values()) or 1
        return [
            {"id": k, "label": k.replace("_", " "), "count": n, "share": n / total}
            for k, n in c.most_common(12)
        ]

    return {
        "task_structure": counter("task_structure"),
        "output_type": counter("output_type"),
        "risk_class": counter("risk_class"),
        "domain": counter("domain_label"),
        "intent": counter("intent_label"),
        "goal": counter("goal_label"),
        "prompt_structure": counter("prompt_structure"),
    }


async def rising_phrases(
    db: AsyncSession, *, days: int = 14, top_n: int = 10
) -> list[dict]:
    """Bigrams with the biggest week-over-week growth."""
    now = datetime.now(timezone.utc)
    cur_cutoff = now - timedelta(days=days)
    prev_cutoff = now - timedelta(days=days * 2)

    cur_events = await _fetch_events(db, days=days, limit=20000)
    prev_stmt = (
        select(PromptEvent)
        .where(PromptEvent.created_at >= prev_cutoff)
        .where(PromptEvent.created_at < cur_cutoff)
        .limit(20000)
    )
    prev_events = list((await db.execute(prev_stmt)).scalars().all())

    def count_bigrams(events: list[PromptEvent]) -> Counter:
        c: Counter[tuple[str, str]] = Counter()
        for e in events:
            toks = [
                t
                for t in tokenize(e.prompt_redacted or "")
                if t not in STOP_WORDS or t in {"how", "what", "why"}
            ]
            for i in range(len(toks) - 1):
                g = (toks[i], toks[i + 1])
                if all(t in STOP_WORDS for t in g):
                    continue
                c[g] += 1
        return c

    cur = count_bigrams(cur_events)
    prev = count_bigrams(prev_events)
    cur_total = sum(cur.values()) or 1
    prev_total = sum(prev.values()) or 1

    out = []
    for gram in set(cur) | set(prev):
        cur_rate = cur.get(gram, 0) / cur_total
        prev_rate = prev.get(gram, 0) / prev_total
        delta = cur_rate - prev_rate
        if cur.get(gram, 0) < 1:
            continue
        out.append({
            "phrase": " ".join(gram),
            "current": cur.get(gram, 0),
            "prior": prev.get(gram, 0),
            "delta_rate": delta,
            "score": (cur.get(gram, 0) + 1) * (delta + 0.001),
        })
    out.sort(key=lambda r: r["score"], reverse=True)
    return out[:top_n]


async def model_strengths(db: AsyncSession, *, days: int = 30) -> list[dict]:
    """Per-model strengths card: what each model is chosen for in practice."""
    events = await _fetch_events(db, days=days, limit=20000)
    by_model: dict[str, dict] = defaultdict(lambda: {
        "events": 0,
        "categories": Counter(),
        "subcategories": Counter(),
        "avg_reasoning": 0.0,
        "avg_creativity": 0.0,
        "avg_complexity": 0.0,
        "avg_satisfaction": [],
        "override_count": 0,
        "selected_count": 0,
    })

    for e in events:
        model = e.selected_model or e.recommended_model
        if not model:
            continue
        slot = by_model[model]
        slot["events"] += 1
        if e.category_primary:
            slot["categories"][e.category_primary] += 1
        if e.subcategory:
            slot["subcategories"][e.subcategory] += 1
        slot["avg_reasoning"] += e.reasoning_intensity or 0
        slot["avg_creativity"] += e.creativity_score or 0
        slot["avg_complexity"] += e.complexity_score or 0
        if e.inferred_satisfaction is not None:
            slot["avg_satisfaction"].append(e.inferred_satisfaction)
        if e.user_overrode_recommendation:
            slot["override_count"] += 1
        if e.selected_model == model:
            slot["selected_count"] += 1

    out = []
    for model, slot in by_model.items():
        n = max(1, slot["events"])
        sat = slot["avg_satisfaction"]
        out.append({
            "model_id": model,
            "events": slot["events"],
            "top_categories": [
                {
                    "category": c,
                    "label": taxonomy.CATEGORY_PRIMARY_LABELS.get(c, c),
                    "count": k,
                }
                for c, k in slot["categories"].most_common(3)
            ],
            "top_subcategories": [
                {"subcategory": s, "count": k}
                for s, k in slot["subcategories"].most_common(3)
            ],
            "avg_reasoning": slot["avg_reasoning"] / n,
            "avg_creativity": slot["avg_creativity"] / n,
            "avg_complexity": slot["avg_complexity"] / n,
            "avg_satisfaction": sum(sat) / len(sat) if sat else None,
            "override_rate": slot["override_count"] / n,
            "selected_rate": slot["selected_count"] / n,
        })
    out.sort(key=lambda r: r["events"], reverse=True)
    return out


async def session_analytics(db: AsyncSession, *, days: int = 30) -> dict:
    """How users actually use the panel across sessions."""
    from app.models.database import PanelSession

    events = await _fetch_events(db, days=days, limit=20000)
    sessions = list((await db.execute(
        select(PanelSession).where(PanelSession.started_at >= _cutoff(days))
    )).scalars().all())

    per_session: Counter[str] = Counter()
    cats_per_session: dict[str, set] = defaultdict(set)
    for e in events:
        if e.session_id:
            per_session[e.session_id] += 1
            if e.category_primary:
                cats_per_session[e.session_id].add(e.category_primary)

    lengths = list(per_session.values()) or [0]
    diversity = [len(c) for c in cats_per_session.values()] or [0]

    durations = []
    for s in sessions:
        start = s.started_at
        end = s.ended_at
        if start and end:
            durations.append((end - start).total_seconds())

    return {
        "sessions": len(sessions),
        "events": sum(lengths),
        "avg_events_per_session": sum(lengths) / max(1, len(lengths)),
        "p90_events_per_session": sorted(lengths)[int(0.9 * (len(lengths) - 1))] if lengths else 0,
        "avg_categories_per_session": sum(diversity) / max(1, len(diversity)),
        "avg_duration_seconds": sum(durations) / max(1, len(durations)) if durations else 0,
    }


async def generate_narrative(db: AsyncSession, *, days: int = 14) -> dict:
    """
    Human-readable prose summary of what the panel looks like right now.
    Deterministic rules only — no LLM — so the sentence can cite sample size
    and is always defensible.
    """
    trends = await category_trends(db, days=days)
    leader = await model_leaderboard(db, days=days)
    insights = await generate_insight_cards(db, days=days)
    distros = await distributions(db, days=days)
    confusion = await classifier_confusion(db, days=days)

    total = distros["sample_size"]
    if total == 0:
        return {
            "headline": "The panel is quiet",
            "paragraph": "No events yet. Submit a prompt on the advisor and the panel will light up instantly — no reload, no delay.",
            "keywords": [],
            "sample_size": 0,
            "window_days": days,
        }

    rising = [t for t in trends if t["direction"] == "up" and t["current_events"] >= 1]
    top_rising = rising[0] if rising else None
    top_model = leader[0] if leader else None
    top_override = confusion[0] if confusion else None

    headline_parts = []
    if top_rising:
        headline_parts.append(f"{top_rising['label']} is surging")
    if top_model:
        headline_parts.append(f"{top_model['model_id']} leads the panel")
    if not headline_parts:
        headline_parts.append("Panel is warming up")
    headline = " · ".join(headline_parts[:2])

    # Weighted complexity avg as a flavor note.
    cplx_vals = [
        i + 1
        for i, b in enumerate(distros["complexity"])
        for _ in range(b["count"])
    ]
    avg_cplx = sum(cplx_vals) / max(1, len(cplx_vals))

    parts = []
    parts.append(
        f"In the last {days} days, the panel observed {total} prompts across "
        f"{len([t for t in trends if t['current_events'] > 0])} active categories."
    )
    if top_rising:
        parts.append(
            f"{top_rising['label']} grew to {top_rising['current_share']:.0%} share "
            f"({top_rising['delta']:+.0%} WoW, n={top_rising['current_events']})."
        )
    if top_model:
        parts.append(
            f"{top_model['model_id']} took {top_model['share']:.0%} of selections "
            f"({top_model['events']} events)."
        )
    if top_override:
        parts.append(
            f"Users overrode the router most on {top_override['category_label']} — "
            f"top reason '{top_override['reason']}' — a routing calibration signal."
        )
    parts.append(
        f"Average prompt complexity is {avg_cplx:.1f}/10."
    )

    return {
        "headline": headline,
        "paragraph": " ".join(parts),
        "keywords": [
            t["label"] for t in trends[:3]
        ],
        "sample_size": total,
        "window_days": days,
        "insight_count": len(insights),
    }


async def co_occurrence_network(
    db: AsyncSession, *, days: int = 30, top_n: int = 25
) -> dict:
    """Which top words co-occur in the same prompt? Edges weighted by count."""
    events = await _fetch_events(db, days=days, limit=5000)
    word_counter: Counter[str] = Counter()
    token_bag: list[set[str]] = []
    for e in events:
        toks = set(filter_stop(tokenize(e.prompt_redacted or "")))
        if toks:
            word_counter.update(toks)
            token_bag.append(toks)

    top_words = [w for w, _ in word_counter.most_common(top_n)]
    top_set = set(top_words)
    edges: Counter[tuple[str, str]] = Counter()
    for bag in token_bag:
        common = list(bag & top_set)
        common.sort()
        for i in range(len(common)):
            for j in range(i + 1, len(common)):
                edges[(common[i], common[j])] += 1

    return {
        "nodes": [
            {"id": w, "count": word_counter[w]} for w in top_words
        ],
        "edges": [
            {"source": a, "target": b, "weight": w}
            for (a, b), w in edges.most_common(60)
        ],
    }


# ──────────────────────────────────────────────────────────────────
# HIGH-VALUE ANALYTICS — previously untapped stored data
# ──────────────────────────────────────────────────────────────────

async def cost_analytics(db: AsyncSession, *, days: int = 30) -> dict:
    """Aggregate the expected_cost_usd column — stored on every event but
    never surfaced until now. Shows total cost, cost by model, cost by
    category, and a daily cost timeseries."""
    events = await _fetch_events(db, days=days, limit=20000)

    total_cost = 0.0
    by_model: dict[str, float] = defaultdict(float)
    by_category: dict[str, float] = defaultdict(float)
    daily: dict[str, float] = defaultdict(float)
    n_with_cost = 0

    for e in events:
        cost = e.expected_cost_usd
        if cost is None or cost <= 0:
            continue
        n_with_cost += 1
        total_cost += cost
        model = e.selected_model or e.recommended_model or "unknown"
        by_model[model] += cost
        cat = e.category_primary or "unknown"
        by_category[cat] += cost
        if e.created_at:
            day = e.created_at.strftime("%Y-%m-%d")
            daily[day] += cost

    return {
        "total_cost_usd": total_cost,
        "events_with_cost": n_with_cost,
        "avg_cost_per_event": total_cost / max(1, n_with_cost),
        "by_model": [
            {"model_id": m, "cost_usd": c}
            for m, c in sorted(by_model.items(), key=lambda x: x[1], reverse=True)
        ],
        "by_category": [
            {"category": c, "label": taxonomy.CATEGORY_PRIMARY_LABELS.get(c, c), "cost_usd": v}
            for c, v in sorted(by_category.items(), key=lambda x: x[1], reverse=True)
        ],
        "daily": [
            {"date": d, "cost_usd": c}
            for d, c in sorted(daily.items())
        ],
    }


async def funnel_analysis(db: AsyncSession, *, days: int = 30) -> dict:
    """Conversion funnel: recommended → selected → copied/exported.

    This is the core metric that tells you whether the router actually
    influences user behavior and whether users act on recommendations.
    """
    events = await _fetch_events(db, days=days, limit=20000)

    total = len(events)
    with_recommendation = sum(1 for e in events if e.recommended_model)
    with_selection = sum(1 for e in events if e.selected_model)
    accepted = sum(1 for e in events if e.user_accepted_recommendation)
    overrode = sum(1 for e in events if e.user_overrode_recommendation)
    copied = sum(1 for e in events if e.copied)
    exported = sum(1 for e in events if e.exported)
    abandoned = sum(1 for e in events if e.abandoned)
    rerouted = sum(1 for e in events if e.rerouted)

    def rate(num: int, denom: int) -> float | None:
        return num / denom if denom > 0 else None

    # Per-category funnel
    by_cat: dict[str, dict[str, int]] = defaultdict(lambda: {
        "total": 0, "selected": 0, "accepted": 0, "overrode": 0,
        "copied": 0, "abandoned": 0,
    })
    for e in events:
        cat = e.category_primary or "unknown"
        by_cat[cat]["total"] += 1
        if e.selected_model:
            by_cat[cat]["selected"] += 1
        if e.user_accepted_recommendation:
            by_cat[cat]["accepted"] += 1
        if e.user_overrode_recommendation:
            by_cat[cat]["overrode"] += 1
        if e.copied:
            by_cat[cat]["copied"] += 1
        if e.abandoned:
            by_cat[cat]["abandoned"] += 1

    return {
        "total": total,
        "stages": [
            {"stage": "Prompted", "count": total, "rate": 1.0},
            {"stage": "Recommended", "count": with_recommendation, "rate": rate(with_recommendation, total)},
            {"stage": "Selected model", "count": with_selection, "rate": rate(with_selection, total)},
            {"stage": "Accepted rec", "count": accepted, "rate": rate(accepted, total)},
            {"stage": "Overrode rec", "count": overrode, "rate": rate(overrode, total)},
            {"stage": "Copied result", "count": copied, "rate": rate(copied, total)},
            {"stage": "Exported", "count": exported, "rate": rate(exported, total)},
            {"stage": "Abandoned", "count": abandoned, "rate": rate(abandoned, total)},
            {"stage": "Rerouted", "count": rerouted, "rate": rate(rerouted, total)},
        ],
        "by_category": [
            {
                "category": c,
                "label": taxonomy.CATEGORY_PRIMARY_LABELS.get(c, c),
                **v,
                "conversion_rate": v["copied"] / max(1, v["total"]),
            }
            for c, v in sorted(by_cat.items(), key=lambda x: x[1]["total"], reverse=True)
            if v["total"] > 0
        ],
    }


async def time_to_decision_analytics(
    db: AsyncSession, *, days: int = 30
) -> dict:
    """How long users take to make a model choice after seeing the
    recommendation. The time_to_decision_ms column is stored on every
    outcome update but was never aggregated."""
    events = await _fetch_events(db, days=days, limit=20000)

    times: list[int] = []
    by_cat: dict[str, list[int]] = defaultdict(list)
    by_complexity: dict[int, list[int]] = defaultdict(list)

    for e in events:
        t = e.time_to_decision_ms
        if t is None or t <= 0 or t > 600_000:  # cap at 10 min
            continue
        times.append(t)
        cat = e.category_primary or "unknown"
        by_cat[cat].append(t)
        cplx = e.complexity_score or 3
        by_complexity[cplx].append(t)

    def percentiles(vals: list[int]) -> dict:
        if not vals:
            return {"p50": None, "p90": None, "p99": None, "mean": None, "count": 0}
        s = sorted(vals)
        n = len(s)
        return {
            "p50": s[n // 2],
            "p90": s[int(n * 0.9)],
            "p99": s[int(n * 0.99)],
            "mean": sum(s) // n,
            "count": n,
        }

    return {
        "overall": percentiles(times),
        "by_category": [
            {
                "category": c,
                "label": taxonomy.CATEGORY_PRIMARY_LABELS.get(c, c),
                **percentiles(v),
            }
            for c, v in sorted(by_cat.items(), key=lambda x: len(x[1]), reverse=True)
        ],
        "by_complexity": [
            {"complexity": c, **percentiles(v)}
            for c, v in sorted(by_complexity.items())
        ],
    }


async def get_single_event(db: AsyncSession, event_id: str) -> dict | None:
    """Fetch a single event by ID with all fields. Previously impossible."""
    stmt = select(PromptEvent).where(PromptEvent.event_id == event_id)
    event = (await db.execute(stmt)).scalars().first()
    if event is None:
        return None
    return _event_to_dict(event)
