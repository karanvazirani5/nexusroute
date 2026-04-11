from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import get_db, ModelRecord
from app.models.schemas import ModelInfo, ModelUpdate

router = APIRouter()


def _record_to_info(r: ModelRecord) -> ModelInfo:
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


@router.get("/models", response_model=List[ModelInfo])
async def list_models(
    provider: Optional[str] = Query(None),
    tier: Optional[str] = Query(None),
    active_only: bool = Query(True),
    db: AsyncSession = Depends(get_db),
):
    query = select(ModelRecord).order_by(ModelRecord.provider, ModelRecord.id)
    if active_only:
        query = query.where(ModelRecord.is_active == True)  # noqa: E712
    if provider:
        query = query.where(ModelRecord.provider == provider)
    if tier:
        query = query.where(ModelRecord.tier == tier)

    result = await db.execute(query)
    records = result.scalars().all()
    return [_record_to_info(r) for r in records]


@router.get("/models/providers")
async def list_providers(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ModelRecord.provider, func.count(ModelRecord.id))
        .where(ModelRecord.is_active == True)  # noqa: E712
        .group_by(ModelRecord.provider)
    )
    return {row[0]: row[1] for row in result.all()}


@router.get("/models/best-for/{task}")
async def best_model_for_task(task: str, db: AsyncSession = Depends(get_db)):
    """Returns the best active models for a given task type."""
    from app.core.classifier import classify_prompt
    from app.core.scoring import score_model

    task_profile = classify_prompt(task)
    query = select(ModelRecord).where(ModelRecord.is_active == True)  # noqa: E712
    result = await db.execute(query)
    records = result.scalars().all()

    scored = []
    for r in records:
        info = _record_to_info(r)
        s = score_model(info, task_profile, "quality")
        scored.append({"model": info, "score": s})

    scored.sort(key=lambda x: x["score"].total, reverse=True)
    return scored[:5]


@router.get("/models/stale")
async def list_stale_models(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ModelRecord).where(ModelRecord.is_outdated == True)  # noqa: E712
    )
    records = result.scalars().all()
    return [_record_to_info(r) for r in records]


@router.get("/models/deprecated")
async def list_deprecated_models(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ModelRecord).where(ModelRecord.release_status.in_(["deprecated", "retired"]))
    )
    records = result.scalars().all()
    return [_record_to_info(r) for r in records]


@router.get("/models/{model_id}", response_model=ModelInfo)
async def get_model(model_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ModelRecord).where(ModelRecord.id == model_id))
    record = result.scalars().first()
    if not record:
        raise HTTPException(status_code=404, detail=f"Model '{model_id}' not found")
    return _record_to_info(record)


@router.put("/models/{model_id}", response_model=ModelInfo)
async def update_model(model_id: str, update: ModelUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ModelRecord).where(ModelRecord.id == model_id))
    record = result.scalars().first()
    if not record:
        raise HTTPException(status_code=404, detail=f"Model '{model_id}' not found")

    if update.display_name is not None:
        record.display_name = update.display_name
    if update.is_active is not None:
        record.is_active = update.is_active
    if update.quality_scores is not None:
        record.quality_scores = update.quality_scores
    if update.cost_per_1m_input is not None:
        record.cost_per_1m_input = update.cost_per_1m_input
    if update.cost_per_1m_output is not None:
        record.cost_per_1m_output = update.cost_per_1m_output
    if update.avg_latency_ms is not None:
        record.avg_latency_ms = update.avg_latency_ms
    if update.release_status is not None:
        record.release_status = update.release_status
    if update.deprecation_warning is not None:
        record.deprecation_warning = update.deprecation_warning

    await db.commit()
    await db.refresh(record)
    return _record_to_info(record)
