from __future__ import annotations

from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import ModelRecord
from app.models.schemas import (
    TaskProfile,
    ModelInfo,
    ModelScore,
    RoutingDecision,
)
from app.core.classifier import classify_prompt
from app.core.scoring import score_model
from app.core.explainer import explain_routing


async def route_request(
    prompt: str,
    optimize_for: str,
    max_cost_cents: float | None,
    preferred_providers: list[str] | None,
    require_json: bool,
    db: AsyncSession,
) -> RoutingDecision:
    task = classify_prompt(prompt)

    if require_json:
        task.requires_json = True
        if task.task_type == "general":
            task.task_type = "structured_json"

    models = await _get_active_models(db, preferred_providers)

    if task.requires_privacy:
        open_models = [m for m in models if m.open_weight]
        if open_models:
            models = open_models

    scored: list[ModelScore] = []
    for model in models:
        if _hard_exclude(model, task):
            continue
        s = score_model(model, task, optimize_for, max_cost_cents)
        scored.append(s)

    scored.sort(key=lambda x: x.total, reverse=True)

    if not scored:
        return RoutingDecision(
            primary_model="gpt-5.4-nano",
            primary_provider="openai",
            scores=[],
            explanation="No models matched constraints. Falling back to default.",
            task_profile=task,
            confidence=0.0,
            freshness_score=1.0,
        )

    explanation = explain_routing(task, scored, optimize_for)
    confidence = _compute_confidence(scored, task)
    freshness = _compute_freshness(models)
    tradeoffs = _compute_tradeoffs(scored)
    why_lost = _compute_why_lost(scored)

    fallback_model = scored[1].model_id if len(scored) > 1 else None
    fallback_provider = scored[1].provider if len(scored) > 1 else None

    return RoutingDecision(
        primary_model=scored[0].model_id,
        primary_provider=scored[0].provider,
        fallback_model=fallback_model,
        fallback_provider=fallback_provider,
        scores=scored,
        explanation=explanation,
        task_profile=task,
        confidence=confidence,
        freshness_score=freshness,
        tradeoffs=tradeoffs,
        why_alternatives_lost=why_lost,
    )


def _hard_exclude(model: ModelInfo, task: TaskProfile) -> bool:
    if model.release_status == "retired":
        return True
    if task.requires_vision and not model.supports_vision:
        return True
    if task.requires_audio and not (model.supports_audio_in or model.supports_audio_out):
        return True
    if task.requires_realtime and not model.supports_realtime:
        return True
    if task.requires_image_gen and not model.supports_image_gen:
        return True
    if task.token_estimate > model.context_window * 0.95:
        return True
    return False


def _compute_confidence(scored: list[ModelScore], task: TaskProfile) -> float:
    if len(scored) < 2:
        return task.confidence * 0.6
    gap = scored[0].total - scored[1].total
    gap_factor = min(gap / 0.15, 1.0)
    return round(gap_factor * 0.5 + task.confidence * 0.5, 2)


def _compute_freshness(models: list[ModelInfo]) -> float:
    if not models:
        return 0.0
    now = datetime.now(timezone.utc)
    fresh_count = 0
    for m in models:
        if m.last_verified_at:
            verified = m.last_verified_at
            if verified.tzinfo is None:
                verified = verified.replace(tzinfo=timezone.utc)
            days_old = (now - verified).days
            if days_old < 30:
                fresh_count += 1
        elif not m.is_outdated:
            fresh_count += 1
    return round(fresh_count / len(models), 2)


def _compute_tradeoffs(scored: list[ModelScore]) -> list[str]:
    if len(scored) < 2:
        return []
    tradeoffs = []
    top = scored[0]
    runner = scored[1]
    if runner.cost_efficiency > top.cost_efficiency + 0.1:
        tradeoffs.append(f"{runner.model_id} is more cost-efficient ({runner.cost_efficiency:.0%} vs {top.cost_efficiency:.0%})")
    if runner.speed > top.speed + 0.1:
        tradeoffs.append(f"{runner.model_id} is faster ({runner.speed:.0%} vs {top.speed:.0%})")
    if runner.reasoning_fit > top.reasoning_fit + 0.1:
        tradeoffs.append(f"{runner.model_id} has better reasoning fit ({runner.reasoning_fit:.0%} vs {top.reasoning_fit:.0%})")
    return tradeoffs


def _compute_why_lost(scored: list[ModelScore]) -> dict[str, str]:
    if len(scored) < 2:
        return {}
    top = scored[0]
    reasons = {}
    for s in scored[1:5]:
        diffs = []
        if top.quality_fit > s.quality_fit + 0.05:
            diffs.append("lower quality fit")
        if top.speed > s.speed + 0.05:
            diffs.append("slower")
        if top.cost_efficiency > s.cost_efficiency + 0.05:
            diffs.append("less cost-efficient")
        if top.reasoning_fit > s.reasoning_fit + 0.05:
            diffs.append("weaker reasoning")
        if top.capability_match > s.capability_match + 0.05:
            diffs.append("missing capabilities")
        reasons[s.model_id] = ", ".join(diffs) if diffs else f"total score {s.total:.2f} vs {top.total:.2f}"
    return reasons


async def _get_active_models(
    db: AsyncSession,
    preferred_providers: list[str] | None = None,
) -> list[ModelInfo]:
    query = select(ModelRecord).where(ModelRecord.is_active == True)  # noqa: E712
    if preferred_providers:
        query = query.where(ModelRecord.provider.in_(preferred_providers))

    result = await db.execute(query)
    records = result.scalars().all()

    return [_record_to_model_info(r) for r in records]


def _record_to_model_info(r: ModelRecord) -> ModelInfo:
    return ModelInfo(
        id=r.id,
        provider=r.provider,
        display_name=r.display_name,
        family=r.family or "unknown",
        tier=r.tier or "mid",
        release_status=r.release_status or "ga",
        release_date=r.release_date,
        description=r.description,
        litellm_model=r.litellm_model,
        api_identifiers=r.api_identifiers or {},
        context_window=r.context_window or 128000,
        max_output_tokens=r.max_output_tokens or 8192,
        cost_per_1m_input=r.cost_per_1m_input or 0.0,
        cost_per_1m_output=r.cost_per_1m_output or 0.0,
        avg_latency_ms=r.avg_latency_ms or 1000,
        supports_text=r.supports_text if r.supports_text is not None else True,
        supports_vision=r.supports_vision if r.supports_vision is not None else False,
        supports_audio_in=r.supports_audio_in if r.supports_audio_in is not None else False,
        supports_audio_out=r.supports_audio_out if r.supports_audio_out is not None else False,
        supports_video=r.supports_video if r.supports_video is not None else False,
        supports_image_gen=r.supports_image_gen if r.supports_image_gen is not None else False,
        supports_image_edit=r.supports_image_edit if r.supports_image_edit is not None else False,
        supports_json_mode=r.supports_json_mode if r.supports_json_mode is not None else False,
        supports_function_calling=r.supports_function_calling if r.supports_function_calling is not None else False,
        supports_structured_output=r.supports_structured_output if r.supports_structured_output is not None else False,
        supports_streaming=r.supports_streaming if r.supports_streaming is not None else True,
        supports_reasoning=r.supports_reasoning if r.supports_reasoning is not None else False,
        supports_realtime=r.supports_realtime if r.supports_realtime is not None else False,
        supports_computer_use=r.supports_computer_use if r.supports_computer_use is not None else False,
        supports_web_search=r.supports_web_search if r.supports_web_search is not None else False,
        open_weight=r.open_weight if r.open_weight is not None else False,
        hosting_options=r.hosting_options or [],
        knowledge_cutoff=r.knowledge_cutoff,
        score_raw_intelligence=r.score_raw_intelligence or 5.0,
        score_reasoning_depth=r.score_reasoning_depth or 5.0,
        score_coding=r.score_coding or 5.0,
        score_tool_use=r.score_tool_use or 5.0,
        score_multimodal=r.score_multimodal or 1.0,
        score_image_gen=r.score_image_gen or 1.0,
        score_audio_voice=r.score_audio_voice or 1.0,
        score_long_context=r.score_long_context or 5.0,
        score_structured_output=r.score_structured_output or 5.0,
        score_latency=r.score_latency or 5.0,
        score_cost_efficiency=r.score_cost_efficiency or 5.0,
        score_enterprise_readiness=r.score_enterprise_readiness or 5.0,
        score_openness=r.score_openness or 1.0,
        quality_scores=r.quality_scores or {},
        strengths=r.strengths or [],
        weaknesses=r.weaknesses or [],
        best_use_cases=r.best_use_cases or [],
        worst_use_cases=r.worst_use_cases or [],
        known_strengths=r.known_strengths or [],
        known_weaknesses=r.known_weaknesses or [],
        safety_notes=r.safety_notes,
        benchmark_evidence=r.benchmark_evidence or {},
        source_citations=r.source_citations or [],
        deprecation_notes=r.deprecation_notes,
        last_verified_at=r.last_verified_at,
        source_count=r.source_count or 0,
        is_outdated=r.is_outdated if r.is_outdated is not None else False,
        deprecation_warning=r.deprecation_warning,
        is_active=r.is_active if r.is_active is not None else True,
        max_tokens=r.max_tokens or 4096,
        cost_per_1k_input=r.cost_per_1k_input or 0.0,
        cost_per_1k_output=r.cost_per_1k_output or 0.0,
    )
