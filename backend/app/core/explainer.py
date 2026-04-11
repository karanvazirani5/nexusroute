from __future__ import annotations

from app.models.schemas import TaskProfile, ModelScore


def explain_routing(
    task: TaskProfile,
    scores: list[ModelScore],
    optimize_for: str,
) -> str:
    if not scores:
        return "No models available for routing."

    primary = scores[0]
    parts = [
        f"Task classified as **{task.task_type}** with **{task.complexity}** complexity.",
        f"Optimizing for **{optimize_for}**.",
        f"Selected **{primary.model_id}** ({primary.provider}) with a total score of {primary.total:.2f}/1.00.",
    ]

    reasons = []
    if primary.quality_fit >= 0.9:
        reasons.append(f"excellent quality fit ({primary.quality_fit:.0%})")
    elif primary.quality_fit >= 0.8:
        reasons.append(f"strong quality fit ({primary.quality_fit:.0%})")

    if primary.cost_efficiency >= 0.8:
        reasons.append(f"very cost-efficient ({primary.cost_efficiency:.0%})")
    if primary.speed >= 0.8:
        reasons.append(f"fast response time ({primary.speed:.0%})")
    if primary.reliability >= 0.9:
        reasons.append(f"high reliability ({primary.reliability:.0%})")
    if primary.reasoning_fit >= 0.9 and task.requires_reasoning:
        reasons.append(f"strong reasoning capability ({primary.reasoning_fit:.0%})")
    if primary.capability_match >= 0.9:
        reasons.append(f"excellent capability match ({primary.capability_match:.0%})")

    if reasons:
        parts.append(f"Key strengths: {', '.join(reasons)}.")

    if task.requires_reasoning:
        parts.append("This task requires deep reasoning capability.")
    if task.requires_vision:
        parts.append("Vision/image understanding is needed for this task.")
    if task.requires_privacy:
        parts.append("Privacy-sensitive: preferring open-weight/self-hostable models.")

    if len(scores) >= 2:
        alt = scores[1]
        diff = primary.total - alt.total
        tradeoff_parts = []
        if alt.cost_efficiency > primary.cost_efficiency:
            tradeoff_parts.append("cheaper")
        if alt.speed > primary.speed:
            tradeoff_parts.append("faster")
        if alt.quality_fit > primary.quality_fit:
            tradeoff_parts.append("slightly higher quality")
        if alt.reasoning_fit > primary.reasoning_fit:
            tradeoff_parts.append("stronger reasoning")

        tradeoff_str = ""
        if tradeoff_parts:
            tradeoff_str = f" ({', '.join(tradeoff_parts)})"

        parts.append(
            f"Runner-up: **{alt.model_id}** (score {alt.total:.2f}){tradeoff_str}, "
            f"trailing by {diff:.2f} points."
        )

    if len(scores) >= 3:
        others = [s.model_id for s in scores[2:5]]
        parts.append(f"Other considered: {', '.join(others)}.")

    return " ".join(parts)
