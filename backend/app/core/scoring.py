from __future__ import annotations

from math import log1p

from app.models.schemas import ModelInfo, ModelScore, TaskProfile

# Weights for the seven scored dimensions (sum to 1.0 per preset).
OPTIMIZATION_WEIGHTS: dict[str, dict[str, float]] = {
    "balanced": {
        "quality_fit": 0.22,
        "cost_efficiency": 0.12,
        "speed": 0.12,
        "reliability": 0.12,
        "format_support": 0.10,
        "reasoning_fit": 0.16,
        "capability_match": 0.16,
    },
    "quality": {
        "quality_fit": 0.42,
        "cost_efficiency": 0.05,
        "speed": 0.08,
        "reliability": 0.15,
        "format_support": 0.10,
        "reasoning_fit": 0.12,
        "capability_match": 0.08,
    },
    "speed": {
        "quality_fit": 0.14,
        "cost_efficiency": 0.08,
        "speed": 0.38,
        "reliability": 0.12,
        "format_support": 0.08,
        "reasoning_fit": 0.10,
        "capability_match": 0.10,
    },
    "cost": {
        "quality_fit": 0.14,
        "cost_efficiency": 0.38,
        "speed": 0.10,
        "reliability": 0.08,
        "format_support": 0.08,
        "reasoning_fit": 0.10,
        "capability_match": 0.12,
    },
    "reasoning": {
        "quality_fit": 0.24,
        "cost_efficiency": 0.06,
        "speed": 0.08,
        "reliability": 0.12,
        "format_support": 0.08,
        "reasoning_fit": 0.32,
        "capability_match": 0.10,
    },
    "coding": {
        "quality_fit": 0.28,
        "cost_efficiency": 0.10,
        "speed": 0.12,
        "reliability": 0.12,
        "format_support": 0.22,
        "reasoning_fit": 0.10,
        "capability_match": 0.06,
    },
    "agentic": {
        "quality_fit": 0.18,
        "cost_efficiency": 0.08,
        "speed": 0.10,
        "reliability": 0.12,
        "format_support": 0.12,
        "reasoning_fit": 0.18,
        "capability_match": 0.22,
    },
    "multimodal": {
        "quality_fit": 0.16,
        "cost_efficiency": 0.08,
        "speed": 0.10,
        "reliability": 0.10,
        "format_support": 0.10,
        "reasoning_fit": 0.12,
        "capability_match": 0.34,
    },
    "enterprise": {
        "quality_fit": 0.20,
        "cost_efficiency": 0.08,
        "speed": 0.10,
        "reliability": 0.32,
        "format_support": 0.12,
        "reasoning_fit": 0.10,
        "capability_match": 0.08,
    },
    "budget": {
        "quality_fit": 0.12,
        "cost_efficiency": 0.45,
        "speed": 0.10,
        "reliability": 0.08,
        "format_support": 0.08,
        "reasoning_fit": 0.09,
        "capability_match": 0.08,
    },
}

# April 2026 provider reliability bonuses (added on top of a normalized base).
PROVIDER_RELIABILITY_BONUS: dict[str, float] = {
    "openai": 0.10,
    "anthropic": 0.10,
    "google": 0.08,
    "mistral": 0.07,
    "xai": 0.05,
    "deepseek": 0.03,
    "meta": 0.05,
    "alibaba": 0.03,
    "togetherai": 0.04,
}

_DEPRECATED_PENALTY = 0.15
_CAPABILITY_MISS_PENALTY = 0.42  # per unmet hard requirement (subtractive from 1.0 cap)


def _norm10(x: float, default: float = 5.0) -> float:
    v = x if x is not None else default
    return max(0.0, min(1.0, float(v) / 10.0))


def _token_split(task: TaskProfile) -> tuple[float, float]:
    """Estimated input vs output tokens from task.token_estimate."""
    te = max(1, int(task.token_estimate))
    # Slightly more output weight for generative tasks; tune via complexity.
    if task.complexity == "simple":
        in_frac, out_frac = 0.45, 0.55
    elif task.complexity == "complex":
        in_frac, out_frac = 0.35, 0.65
    else:
        in_frac, out_frac = 0.38, 0.62
    return te * in_frac, te * out_frac


def _estimated_cost_usd(model: ModelInfo, task: TaskProfile) -> float:
    est_in, est_out = _token_split(task)
    cin = max(0.0, float(model.cost_per_1m_input))
    cout = max(0.0, float(model.cost_per_1m_output))
    # Legacy fallback if per-1m not populated
    if cin == 0.0 and cout == 0.0 and (model.cost_per_1k_input or model.cost_per_1k_output):
        return (est_in / 1000.0) * float(model.cost_per_1k_input) + (est_out / 1000.0) * float(
            model.cost_per_1k_output
        )
    return (est_in / 1_000_000.0) * cin + (est_out / 1_000_000.0) * cout


def _length_latency_multiplier(expected_length: str) -> float:
    return {"short": 1.0, "medium": 1.45, "long": 2.2}.get(expected_length, 1.35)


def _task_quality_vector(task: TaskProfile) -> dict[str, float]:
    """Relative emphasis on model score dimensions for this task (sums ~1)."""
    tt = (task.task_type or "").lower()
    st = (task.sub_type or "").lower()

    w_intel = 0.35
    w_reason = 0.15
    w_code = 0.12
    w_tool = 0.10
    w_mm = 0.08
    w_ctx = 0.12
    w_struct = 0.08

    if "code" in tt or "coding" in tt or "code" in st:
        w_code, w_tool, w_struct = 0.28, 0.22, 0.18
        w_intel, w_reason = 0.22, 0.10
    if "reason" in tt or "math" in tt or "logic" in tt or task.requires_reasoning:
        w_reason, w_intel = 0.28, 0.32
    if "agent" in tt or task.requires_tool_use:
        w_tool, w_reason = 0.30, 0.18
    if task.requires_vision or task.requires_audio or "multimodal" in tt:
        w_mm = 0.35
        w_intel -= 0.1
    if task.requires_long_context or "long" in tt:
        w_ctx = 0.30

    raw = {
        "intel": max(0.05, w_intel),
        "reason": max(0.05, w_reason),
        "code": max(0.05, w_code),
        "tool": max(0.05, w_tool),
        "mm": max(0.05, w_mm),
        "ctx": max(0.05, w_ctx),
        "struct": max(0.05, w_struct),
    }
    s = sum(raw.values())
    return {k: v / s for k, v in raw.items()}


def _score_quality_fit(model: ModelInfo, task: TaskProfile) -> float:
    w = _task_quality_vector(task)
    blended = (
        w["intel"] * _norm10(model.score_raw_intelligence)
        + w["reason"] * _norm10(model.score_reasoning_depth)
        + w["code"] * _norm10(model.score_coding)
        + w["tool"] * _norm10(model.score_tool_use)
        + w["mm"] * _norm10(model.score_multimodal, default=1.0)
        + w["ctx"] * _norm10(model.score_long_context)
        + w["struct"] * _norm10(model.score_structured_output)
    )

    qs = model.quality_scores.get(task.task_type)
    if qs is not None:
        blended = 0.65 * blended + 0.35 * max(0.0, min(1.0, float(qs) / 100.0))

    if task.task_type in model.strengths:
        blended = min(1.0, blended + 0.04)
    if task.task_type in model.weaknesses:
        blended = max(0.0, blended - 0.08)

    if task.complexity == "complex" and _norm10(model.score_raw_intelligence) < 0.55:
        blended = max(0.0, blended - 0.06)
    elif task.complexity == "simple":
        blended = min(1.0, blended + 0.02)

    task_conf = max(0.2, min(1.0, float(task.confidence)))
    return max(0.0, min(1.0, 0.15 + 0.85 * blended * task_conf))


def _score_cost_efficiency(
    model: ModelInfo, task: TaskProfile, max_cost_cents: float | None
) -> float:
    profile_cost = _norm10(model.score_cost_efficiency)
    usd = _estimated_cost_usd(model, task)

    if max_cost_cents is not None and usd * 100.0 > float(max_cost_cents):
        return 0.0

    # Softer decay for dollar cost; cheap models cluster near 1.0
    if usd <= 0.0:
        empirical = 1.0
    else:
        empirical = max(0.0, min(1.0, 1.0 - log1p(usd * 200.0) / log1p(50.0)))

    out = 0.45 * profile_cost + 0.55 * empirical
    return max(0.0, min(1.0, out))


def _score_speed(model: ModelInfo, task: TaskProfile) -> float:
    latency_score = _norm10(model.score_latency)
    lat = max(1, int(model.avg_latency_ms))
    mult = _length_latency_multiplier(task.expected_length)
    effective = float(lat) * mult

    if effective <= 400:
        empirical = 1.0
    elif effective <= 800:
        empirical = 0.88
    elif effective <= 1500:
        empirical = 0.72
    elif effective <= 3000:
        empirical = 0.52
    elif effective <= 6000:
        empirical = 0.32
    else:
        empirical = max(0.08, 0.32 - (effective - 6000) / 25000.0)

    out = 0.4 * latency_score + 0.6 * empirical

    if task.expected_length == "long":
        out = max(0.0, out - 0.05)
    return max(0.0, min(1.0, out))


def _score_reliability(model: ModelInfo, task: TaskProfile) -> float:
    base = 0.62
    prov = model.provider.lower().strip() if model.provider else ""
    bonus = PROVIDER_RELIABILITY_BONUS.get(prov, 0.02)
    enterprise = _norm10(model.score_enterprise_readiness)

    out = base + bonus + 0.22 * enterprise
    if task.requires_privacy and model.open_weight:
        out = min(1.0, out + 0.04)
    return max(0.0, min(1.0, out))


def _score_format_support(model: ModelInfo, task: TaskProfile) -> float:
    struct = _norm10(model.score_structured_output)
    code_dim = _norm10(model.score_coding)

    if task.requires_json:
        if model.supports_json_mode or model.supports_structured_output:
            json_part = 0.92 + 0.08 * struct
        else:
            json_part = 0.22
    else:
        json_part = 0.78 + 0.22 * struct

    if task.requires_code:
        code_part = 0.35 + 0.65 * code_dim
        if model.supports_structured_output:
            code_part = min(1.0, code_part + 0.05)
    else:
        code_part = 0.85 + 0.10 * code_dim

    # Function calling helps structured / tool-adjacent outputs
    if task.requires_tool_use and model.supports_function_calling:
        code_part = min(1.0, code_part + 0.04)

    out = 0.5 * json_part + 0.5 * code_part
    return max(0.0, min(1.0, out))


def _score_reasoning_fit(model: ModelInfo, task: TaskProfile) -> float:
    depth = _norm10(model.score_reasoning_depth)

    if not task.requires_reasoning:
        # Any model is fine; still reward depth slightly for complex tasks
        if task.complexity == "complex":
            return max(0.75, min(1.0, 0.78 + 0.22 * depth))
        return max(0.82, min(1.0, 0.85 + 0.15 * depth))

    if not model.supports_reasoning:
        return max(0.0, min(1.0, 0.12 + 0.25 * depth))

    return max(0.0, min(1.0, 0.35 + 0.65 * depth))


def _meets_long_context(model: ModelInfo, task: TaskProfile) -> bool:
    need = max(int(task.token_estimate), 4096) * 15 // 10
    return int(model.context_window) >= need


def _score_capability_match(model: ModelInfo, task: TaskProfile) -> float:
    """Hard requirement checks: heavy penalty when required capability is missing."""
    score = 1.0

    def penalize(miss: bool) -> None:
        nonlocal score
        if miss:
            score = max(0.05, score - _CAPABILITY_MISS_PENALTY)

    penalize(task.requires_vision and not model.supports_vision)
    penalize(task.requires_reasoning and not model.supports_reasoning)
    penalize(task.requires_audio and not (model.supports_audio_in or model.supports_audio_out))
    penalize(task.requires_realtime and not model.supports_realtime)
    penalize(task.requires_image_gen and not model.supports_image_gen)
    penalize(task.requires_web_search and not model.supports_web_search)
    penalize(task.requires_tool_use and not model.supports_function_calling)
    penalize(task.requires_long_context and not _meets_long_context(model, task))

    if task.requires_privacy:
        openness = _norm10(model.score_openness, default=1.0)
        if not model.open_weight:
            score = max(0.05, score - _CAPABILITY_MISS_PENALTY * 0.65)
        else:
            score = min(1.0, score + 0.06 * openness)

    # Soft capability alignment (always-on, mild)
    soft = (
        _norm10(model.score_multimodal, default=1.0) * 0.25
        + _norm10(model.score_tool_use) * 0.25
        + _norm10(model.score_long_context) * 0.25
        + (_norm10(model.score_audio_voice, default=1.0) if task.requires_audio else 0.75) * 0.25
    )
    if not task.requires_audio:
        soft = (
            _norm10(model.score_multimodal, default=1.0) * 0.34
            + _norm10(model.score_tool_use) * 0.33
            + _norm10(model.score_long_context) * 0.33
        )

    blended = 0.55 * score + 0.45 * soft
    return max(0.0, min(1.0, blended))


def score_model(
    model: ModelInfo,
    task: TaskProfile,
    optimize_for: str = "balanced",
    max_cost_cents: float | None = None,
) -> ModelScore:
    weights = OPTIMIZATION_WEIGHTS.get(optimize_for, OPTIMIZATION_WEIGHTS["balanced"])

    quality_fit = _score_quality_fit(model, task)
    cost_efficiency = _score_cost_efficiency(model, task, max_cost_cents)
    speed = _score_speed(model, task)
    reliability = _score_reliability(model, task)
    format_support = _score_format_support(model, task)
    reasoning_fit = _score_reasoning_fit(model, task)
    capability_match = _score_capability_match(model, task)

    total = (
        quality_fit * weights["quality_fit"]
        + cost_efficiency * weights["cost_efficiency"]
        + speed * weights["speed"]
        + reliability * weights["reliability"]
        + format_support * weights["format_support"]
        + reasoning_fit * weights["reasoning_fit"]
        + capability_match * weights["capability_match"]
    )

    rs = (model.release_status or "").lower()
    if rs == "deprecated":
        total = max(0.0, total - _DEPRECATED_PENALTY)

    return ModelScore(
        model_id=model.id,
        provider=model.provider,
        quality_fit=round(quality_fit, 2),
        cost_efficiency=round(cost_efficiency, 2),
        speed=round(speed, 2),
        reliability=round(reliability, 2),
        format_support=round(format_support, 2),
        reasoning_fit=round(reasoning_fit, 2),
        capability_match=round(capability_match, 2),
        total=round(total, 2),
    )
