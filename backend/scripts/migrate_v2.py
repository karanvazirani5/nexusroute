"""
Migration script: v1 (legacy 10-model registry) → v2 (intelligence registry with 24+ models).

Usage:
    python -m scripts.migrate_v2          # from backend/
    python scripts/migrate_v2.py          # standalone

What it does:
    1. Backs up the existing SQLite database (if present).
    2. Drops ALL tables and recreates them from the current ORM definitions.
    3. Seeds the models table from the updated model_registry.json.
    4. Prints a summary of removed / added models.

This is safe to run repeatedly — each run produces a fresh database from seed data.
"""

import asyncio
import json
import os
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.models.database import Base, ModelRecord, engine, async_session


REGISTRY_PATH = Path(__file__).resolve().parent.parent / "app" / "data" / "model_registry.json"
DB_PATH = Path(__file__).resolve().parent.parent / "models.db"


LEGACY_MODEL_IDS = [
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4-turbo",
    "claude-3.5-sonnet",
    "claude-3-haiku",
    "gemini-1.5-pro",
    "gemini-1.5-flash",
    "mistral-large-2",
    "llama-3.1-70b",
    "command-r-plus",
]


def backup_db() -> "str | None":
    if not DB_PATH.exists():
        return None
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup = DB_PATH.with_name(f"models_backup_{ts}.db")
    shutil.copy2(DB_PATH, backup)
    return str(backup)


def load_registry() -> list[dict]:
    with open(REGISTRY_PATH, "r") as f:
        data = json.load(f)
    return data if isinstance(data, list) else data.get("models", [])


async def recreate_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)


async def seed_models(models_data: list[dict]):
    async with async_session() as session:
        for m in models_data:
            record = ModelRecord(
                id=m["id"],
                provider=m.get("provider", "unknown"),
                display_name=m.get("display_name", m["id"]),
                family=m.get("family", "unknown"),
                tier=m.get("tier", "mid"),
                release_status=m.get("release_status", "ga"),
                release_date=m.get("release_date"),
                description=m.get("description"),
                litellm_model=m.get("litellm_model", m["id"]),
                api_identifiers=m.get("api_identifiers", {}),
                context_window=m.get("context_window", 128000),
                max_output_tokens=m.get("max_output_tokens", 8192),
                cost_per_1m_input=m.get("cost_per_1m_input", 0.0),
                cost_per_1m_output=m.get("cost_per_1m_output", 0.0),
                avg_latency_ms=m.get("avg_latency_ms", 1000),
                supports_vision=m.get("supports_vision", False),
                supports_audio_in=m.get("supports_audio_in", False),
                supports_audio_out=m.get("supports_audio_out", False),
                supports_video=m.get("supports_video", False),
                supports_image_gen=m.get("supports_image_gen", False),
                supports_image_edit=m.get("supports_image_edit", False),
                supports_json_mode=m.get("supports_json_mode", False),
                supports_function_calling=m.get("supports_function_calling", False),
                supports_structured_output=m.get("supports_structured_output", False),
                supports_streaming=m.get("supports_streaming", True),
                supports_reasoning=m.get("supports_reasoning", False),
                supports_realtime=m.get("supports_realtime", False),
                supports_computer_use=m.get("supports_computer_use", False),
                supports_web_search=m.get("supports_web_search", False),
                open_weight=m.get("open_weight", False),
                hosting_options=m.get("hosting_options", []),
                knowledge_cutoff=m.get("knowledge_cutoff"),
                score_raw_intelligence=m.get("score_raw_intelligence", 5.0),
                score_reasoning_depth=m.get("score_reasoning_depth", 5.0),
                score_coding=m.get("score_coding", 5.0),
                score_tool_use=m.get("score_tool_use", 5.0),
                score_multimodal=m.get("score_multimodal", 1.0),
                score_image_gen=m.get("score_image_gen", 1.0),
                score_audio_voice=m.get("score_audio_voice", 1.0),
                score_long_context=m.get("score_long_context", 5.0),
                score_structured_output=m.get("score_structured_output", 5.0),
                score_latency=m.get("score_latency", 5.0),
                score_cost_efficiency=m.get("score_cost_efficiency", 5.0),
                score_enterprise_readiness=m.get("score_enterprise_readiness", 5.0),
                score_openness=m.get("score_openness", 1.0),
                quality_scores=m.get("quality_scores", {}),
                strengths=m.get("strengths", []),
                weaknesses=m.get("weaknesses", []),
                best_use_cases=m.get("best_use_cases", []),
                worst_use_cases=m.get("worst_use_cases", []),
                known_strengths=m.get("known_strengths", []),
                known_weaknesses=m.get("known_weaknesses", []),
                safety_notes=m.get("safety_notes"),
                benchmark_evidence=m.get("benchmark_evidence", {}),
                source_citations=m.get("source_citations", []),
                deprecation_notes=m.get("deprecation_notes"),
                last_verified_at=datetime.now(timezone.utc),
                source_count=m.get("source_count", 0),
                is_outdated=m.get("is_outdated", False),
                outdated_reason=m.get("outdated_reason"),
                deprecation_warning=m.get("deprecation_warning"),
                is_active=m.get("is_active", True),
                max_tokens=m.get("max_tokens", m.get("context_window", 128000)),
                cost_per_1k_input=m.get("cost_per_1k_input", m.get("cost_per_1m_input", 0.0) / 1000),
                cost_per_1k_output=m.get("cost_per_1k_output", m.get("cost_per_1m_output", 0.0) / 1000),
            )
            session.add(record)
        await session.commit()


async def main():
    print("=" * 60)
    print("  Model Intelligence Registry Migration — v1 → v2")
    print("=" * 60)

    backup = backup_db()
    if backup:
        print(f"\n[1/4] Backed up existing database → {backup}")
    else:
        print("\n[1/4] No existing database found — fresh install.")

    registry = load_registry()
    new_ids = {m["id"] for m in registry}
    removed = [mid for mid in LEGACY_MODEL_IDS if mid not in new_ids]
    added = [mid for mid in new_ids if mid not in LEGACY_MODEL_IDS]

    print(f"[2/4] Dropping all tables and recreating schema...")
    await recreate_tables()
    print("       Tables created: models, research_notes, benchmark_results,")
    print("                       routing_rules, request_logs, model_snapshots")

    print(f"[3/4] Seeding {len(registry)} models from model_registry.json...")
    await seed_models(registry)

    print(f"\n[4/4] Migration complete.\n")

    print("  REMOVED legacy models:")
    for mid in removed:
        print(f"    ✗ {mid}")
    if not removed:
        print("    (none)")

    print(f"\n  ADDED new models ({len(added)}):")
    for mid in sorted(added):
        print(f"    ✓ {mid}")

    print(f"\n  Total models in registry: {len(registry)}")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
