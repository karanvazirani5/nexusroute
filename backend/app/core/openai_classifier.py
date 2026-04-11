"""
Tier 2 enrichment — OpenAI batched classifier.

Runs asynchronously against prompt events whose heuristic classifier
confidence is below the escalation threshold, or against a strategic
sample of all events for re-labeling. Batches 20 prompts per call to
keep cost per enriched event in the sub-$0.001 range.

Behavior:
- If ``OPENAI_API_KEY`` is not set, the classifier is a no-op and
  returns ``None``. Callers MUST tolerate None and fall back to the
  heuristic labels. This preserves the project's zero-key fallback
  promise.
- Uses the ``openai`` Python SDK (already installed in the backend
  venv). Default model is ``gpt-4o-mini`` to mirror the cost envelope
  of the original Haiku-based design.
- Response is strict JSON validated against the taxonomy; any field
  that fails validation is dropped rather than corrupting the event.
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass
from typing import Optional

from app.core import taxonomy

log = logging.getLogger(__name__)

TIER2_CLASSIFIER_VERSION = "openai-1.0.0"
DEFAULT_TIER2_MODEL = os.getenv("TIER2_CLASSIFIER_MODEL", "gpt-4o-mini")
BATCH_SIZE = 20
MAX_PROMPT_CHARS = 4000  # truncate long prompts in the classifier payload


@dataclass
class Tier2Labels:
    category_primary: Optional[str] = None
    subcategory: Optional[str] = None
    intent: Optional[str] = None
    goal: Optional[str] = None
    domain: Optional[str] = None
    output_type: Optional[str] = None
    task_structure: Optional[str] = None
    reasoning_intensity: Optional[int] = None
    creativity_score: Optional[int] = None
    precision_requirement: Optional[int] = None
    latency_sensitivity: Optional[int] = None
    cost_sensitivity: Optional[int] = None
    risk_class: Optional[str] = None
    complexity_score: Optional[int] = None
    ambiguity_score: Optional[float] = None
    craft_score: Optional[int] = None
    confidence: Optional[float] = None
    classifier_version: str = TIER2_CLASSIFIER_VERSION


_SYSTEM_PROMPT = f"""You are a careful prompt classifier for a research instrumentation panel.

For each prompt you receive, return a JSON object with these exact fields. \
Use only labels from the allowed lists. Never invent labels.

Allowed labels:
  category_primary: {list(taxonomy.CATEGORY_PRIMARY)}
  subcategory: one of the known subcategories (must rollup to category_primary)
  intent: {list(taxonomy.INTENT)}
  goal: {list(taxonomy.GOAL)}
  domain: {list(taxonomy.DOMAIN)}
  output_type: {list(taxonomy.OUTPUT_TYPE)}
  task_structure: {list(taxonomy.TASK_STRUCTURE)}
  risk_class: {list(taxonomy.RISK_CLASS)}

Numeric fields:
  reasoning_intensity: integer 1-5 (how much chain-of-thought the task actually needs)
  creativity_score: integer 1-5 (creative output vs precise/deterministic)
  precision_requirement: integer 1-5 (how strict the output must be)
  latency_sensitivity: integer 1-5 (how much the user cares about speed)
  cost_sensitivity: integer 1-5 (how much the user cares about cost)
  complexity_score: integer 1-10 (overall task complexity)
  ambiguity_score: float 0-1 (how ambiguous the prompt is)
  craft_score: integer 1-5 (how well-crafted the prompt is)
  confidence: float 0-1 (your confidence in this classification)

Return a JSON object with a single key "results" whose value is an array \
with exactly one object per input prompt, in the same order."""


def is_available() -> bool:
    """True if the Tier 2 classifier can run (OpenAI key + SDK importable)."""
    if not os.getenv("OPENAI_API_KEY"):
        return False
    try:
        import openai  # noqa: F401
    except ImportError:
        return False
    return True


async def classify_batch(
    prompts: list[str],
    *,
    model: str = DEFAULT_TIER2_MODEL,
) -> Optional[list[Tier2Labels]]:
    """Classify up to ``BATCH_SIZE`` prompts in a single OpenAI call.

    Returns a list aligned 1:1 with the input, or ``None`` if the SDK
    is unavailable or the call fails. Individual items may be partially
    populated if OpenAI returned a field that failed taxonomy validation.
    """
    if not prompts:
        return []
    if not is_available():
        return None

    try:
        from openai import AsyncOpenAI
    except ImportError:
        return None

    batch = prompts[:BATCH_SIZE]
    numbered = "\n\n".join(
        f"PROMPT {i + 1}:\n{_truncate(p)}" for i, p in enumerate(batch)
    )

    client = AsyncOpenAI()
    try:
        response = await client.chat.completions.create(
            model=model,
            response_format={"type": "json_object"},
            temperature=0.2,
            max_tokens=2048,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": (
                        f"Classify these {len(batch)} prompts. Return a JSON "
                        f'object of the form {{"results": [...]}} with exactly '
                        f"{len(batch)} objects in the same order.\n\n{numbered}"
                    ),
                },
            ],
        )
    except Exception as exc:  # pragma: no cover - network errors
        log.warning("Tier 2 OpenAI classifier call failed: %s", exc)
        return None

    text = response.choices[0].message.content or ""
    parsed = _parse_json_results(text)
    if parsed is None:
        log.warning("Tier 2 classifier returned invalid JSON: %r", text[:200])
        return None

    # Pad or truncate to match input length so the caller can zip with ids.
    while len(parsed) < len(batch):
        parsed.append({})
    parsed = parsed[: len(batch)]

    return [_validate(item) for item in parsed]


def _truncate(text: str) -> str:
    return text[:MAX_PROMPT_CHARS] + ("…" if len(text) > MAX_PROMPT_CHARS else "")


def _parse_json_results(text: str) -> Optional[list[dict]]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("```", 2)[1]
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
    cleaned = cleaned.strip()
    try:
        obj = json.loads(cleaned)
    except json.JSONDecodeError:
        return None
    # Accept either {"results": [...]} (preferred) or a bare [...] array.
    if isinstance(obj, dict):
        arr = obj.get("results")
        if isinstance(arr, list):
            return [o if isinstance(o, dict) else {} for o in arr]
        # Some models return {"classifications": [...]} or similar.
        for v in obj.values():
            if isinstance(v, list):
                return [o if isinstance(o, dict) else {} for o in v]
        return None
    if isinstance(obj, list):
        return [o if isinstance(o, dict) else {} for o in obj]
    return None


def _validate(raw: dict) -> Tier2Labels:
    def _enum(axis: str, val):
        if isinstance(val, str) and taxonomy.is_valid(axis, val):
            return val
        return None

    def _int(val, lo, hi):
        try:
            n = int(val)
        except (TypeError, ValueError):
            return None
        return n if lo <= n <= hi else None

    def _float(val, lo, hi):
        try:
            n = float(val)
        except (TypeError, ValueError):
            return None
        return n if lo <= n <= hi else None

    return Tier2Labels(
        category_primary=_enum("category_primary", raw.get("category_primary")),
        subcategory=_enum("subcategory", raw.get("subcategory")),
        intent=_enum("intent", raw.get("intent")),
        goal=_enum("goal", raw.get("goal")),
        domain=_enum("domain", raw.get("domain")),
        output_type=_enum("output_type", raw.get("output_type")),
        task_structure=_enum("task_structure", raw.get("task_structure")),
        reasoning_intensity=_int(raw.get("reasoning_intensity"), 1, 5),
        creativity_score=_int(raw.get("creativity_score"), 1, 5),
        precision_requirement=_int(raw.get("precision_requirement"), 1, 5),
        latency_sensitivity=_int(raw.get("latency_sensitivity"), 1, 5),
        cost_sensitivity=_int(raw.get("cost_sensitivity"), 1, 5),
        risk_class=_enum("risk_class", raw.get("risk_class")),
        complexity_score=_int(raw.get("complexity_score"), 1, 10),
        ambiguity_score=_float(raw.get("ambiguity_score"), 0.0, 1.0),
        craft_score=_int(raw.get("craft_score"), 1, 5),
        confidence=_float(raw.get("confidence"), 0.0, 1.0),
    )
