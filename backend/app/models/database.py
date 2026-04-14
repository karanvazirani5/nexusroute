from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    Column,
    DateTime as _DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    JSON,
)
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings

# Always use timezone-aware datetimes. Postgres needs ``timezone=True``
# on DateTime columns; SQLite ignores the flag harmlessly.
DateTime = _DateTime(timezone=True)


def _uuid() -> str:
    return str(uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class ModelRecord(Base):
    __tablename__ = "models"

    id = Column(String, primary_key=True)
    provider = Column(String, nullable=False, index=True)
    display_name = Column(String, nullable=False)
    family = Column(String, nullable=False, default="unknown")
    tier = Column(String, nullable=False, default="mid")  # frontier / mid / budget / specialized
    release_status = Column(String, nullable=False, default="ga")  # preview / ga / deprecated / retired
    release_date = Column(String, nullable=True)
    description = Column(Text, nullable=True)

    # API identifiers
    litellm_model = Column(String, nullable=False)
    api_identifiers = Column(JSON, default=dict)

    # Specs
    context_window = Column(Integer, default=128000)
    max_output_tokens = Column(Integer, default=8192)
    cost_per_1m_input = Column(Float, default=0.0)
    cost_per_1m_output = Column(Float, default=0.0)
    avg_latency_ms = Column(Integer, default=1000)

    # Modalities
    supports_text = Column(Boolean, default=True)
    supports_vision = Column(Boolean, default=False)
    supports_audio_in = Column(Boolean, default=False)
    supports_audio_out = Column(Boolean, default=False)
    supports_video = Column(Boolean, default=False)
    supports_image_gen = Column(Boolean, default=False)
    supports_image_edit = Column(Boolean, default=False)

    # Capabilities
    supports_json_mode = Column(Boolean, default=False)
    supports_function_calling = Column(Boolean, default=False)
    supports_structured_output = Column(Boolean, default=False)
    supports_streaming = Column(Boolean, default=True)
    supports_reasoning = Column(Boolean, default=False)
    supports_realtime = Column(Boolean, default=False)
    supports_computer_use = Column(Boolean, default=False)
    supports_web_search = Column(Boolean, default=False)

    # Classification
    open_weight = Column(Boolean, default=False)
    hosting_options = Column(JSON, default=list)  # ["api", "cloud", "self-hosted", "edge"]
    knowledge_cutoff = Column(String, nullable=True)

    # Scoring (0-10 scale)
    score_raw_intelligence = Column(Float, default=5.0)
    score_reasoning_depth = Column(Float, default=5.0)
    score_coding = Column(Float, default=5.0)
    score_tool_use = Column(Float, default=5.0)
    score_multimodal = Column(Float, default=1.0)
    score_image_gen = Column(Float, default=1.0)
    score_audio_voice = Column(Float, default=1.0)
    score_long_context = Column(Float, default=5.0)
    score_structured_output = Column(Float, default=5.0)
    score_latency = Column(Float, default=5.0)
    score_cost_efficiency = Column(Float, default=5.0)
    score_enterprise_readiness = Column(Float, default=5.0)
    score_openness = Column(Float, default=1.0)

    # Legacy compatibility scores
    quality_scores = Column(JSON, default=dict)
    strengths = Column(JSON, default=list)
    weaknesses = Column(JSON, default=list)

    # Research notes
    best_use_cases = Column(JSON, default=list)
    worst_use_cases = Column(JSON, default=list)
    known_strengths = Column(JSON, default=list)
    known_weaknesses = Column(JSON, default=list)
    safety_notes = Column(Text, nullable=True)
    benchmark_evidence = Column(JSON, default=dict)
    source_citations = Column(JSON, default=list)
    deprecation_notes = Column(Text, nullable=True)

    # Freshness tracking
    last_verified_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    source_count = Column(Integer, default=0)
    is_outdated = Column(Boolean, default=False)
    outdated_reason = Column(Text, nullable=True)
    deprecation_warning = Column(Text, nullable=True)

    # Status
    is_active = Column(Boolean, default=True)
    max_tokens = Column(Integer, default=4096)  # legacy compat
    cost_per_1k_input = Column(Float, default=0.0)  # legacy compat
    cost_per_1k_output = Column(Float, default=0.0)  # legacy compat

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


# ──────────────────────────────────────────────────────────────────
# Instrumentation layer (v3.1) — Intent Panel
#
# These tables capture per-interaction signal from the advisor so the
# product can double as a research panel. Nothing stored here is
# user-identifiable; PII redaction runs synchronously before the prompt
# ever reaches `PromptEvent.prompt_redacted`, and raw prompts only land
# if the user has granted Tier 1 consent.
# ──────────────────────────────────────────────────────────────────


class PanelUser(Base):
    """An anonymous user of the instrumentation panel."""

    __tablename__ = "panel_users"

    user_id = Column(String, primary_key=True, default=_uuid)
    created_at = Column(DateTime, default=_now, index=True)
    last_seen_at = Column(DateTime, default=_now, onupdate=_now)

    # Derived persona cluster (filled by a background job, not at write time).
    persona_label = Column(String, nullable=True)

    # Denormalized convenience for analytics joins.
    consent_tier = Column(Integer, default=0)  # 0 = essential only, 1 = research, 2 = licensing
    session_count = Column(Integer, default=0)
    event_count = Column(Integer, default=0)


class PanelSession(Base):
    """A bounded sequence of prompt events from one user."""

    __tablename__ = "panel_sessions"

    session_id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("panel_users.user_id"), nullable=False, index=True)
    started_at = Column(DateTime, default=_now, index=True)
    ended_at = Column(DateTime, nullable=True)
    client = Column(JSON, default=dict)  # {platform, locale, tz, version}
    event_count = Column(Integer, default=0)
    consent_tier_at_start = Column(Integer, default=0)


class ConsentRecord(Base):
    """Per-tier consent ledger. Consent is additive and revocable."""

    __tablename__ = "panel_consents"

    consent_id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("panel_users.user_id"), nullable=False, index=True)
    tier = Column(Integer, nullable=False)  # 0 / 1 / 2
    scope = Column(JSON, default=list)
    granted_at = Column(DateTime, default=_now)
    revoked_at = Column(DateTime, nullable=True)
    source = Column(String, default="consent_banner")


class PromptEvent(Base):
    """One structured observation per prompt submitted to the advisor.

    This is the canonical table for all instrumentation. Every public
    insight, dashboard, and benchmark derives from aggregations over
    this table. Schema additions are allowed; schema mutations are not
    (bump ``classifier_version`` / ``routing_strategy_version`` instead).
    """

    __tablename__ = "prompt_events"

    # --- Identity ----------------------------------------------------
    event_id = Column(String, primary_key=True, default=_uuid)
    session_id = Column(String, ForeignKey("panel_sessions.session_id"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("panel_users.user_id"), nullable=False, index=True)
    created_at = Column(DateTime, default=_now, index=True)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    # --- Prompt content (always redacted; raw only if Tier 1) --------
    prompt_hash = Column(String, nullable=False, index=True)
    prompt_redacted = Column(Text, nullable=False)
    prompt_raw = Column(Text, nullable=True)  # Tier 1 consent only
    prompt_length_chars = Column(Integer, default=0)
    prompt_length_tokens = Column(Integer, default=0)
    language = Column(String, nullable=True)

    # --- Structural features ----------------------------------------
    contains_code = Column(Boolean, default=False)
    contains_url = Column(Boolean, default=False)
    prompt_structure = Column(String, nullable=True)  # question / command / specification / conversation / template
    redaction_counts = Column(JSON, default=dict)

    # --- Classification (Tier 1 heuristic + Tier 2 Haiku merged) -----
    classifier_version = Column(String, default="heuristic-1.0.0")
    classifier_confidence = Column(Float, default=0.0)
    category_primary = Column(String, nullable=True, index=True)
    category_secondary = Column(JSON, default=list)
    subcategory = Column(String, nullable=True, index=True)
    intent_label = Column(String, nullable=True)
    goal_label = Column(String, nullable=True)
    domain_label = Column(String, nullable=True, index=True)
    output_type = Column(String, nullable=True)
    task_structure = Column(String, nullable=True)
    reasoning_intensity = Column(Integer, nullable=True)
    creativity_score = Column(Integer, nullable=True)
    precision_requirement = Column(Integer, nullable=True)
    latency_sensitivity = Column(Integer, nullable=True)
    cost_sensitivity = Column(Integer, nullable=True)
    risk_class = Column(String, nullable=True)
    complexity_score = Column(Integer, nullable=True)
    ambiguity_score = Column(Float, nullable=True)
    craft_score = Column(Integer, nullable=True)
    enrichment_tier = Column(Integer, default=1)  # 1 = heuristic, 2 = haiku, 3 = sonnet

    # --- Routing decision -------------------------------------------
    routing_strategy_version = Column(String, default="advisor-v3.0.0")
    recommended_model = Column(String, nullable=True, index=True)
    candidate_models = Column(JSON, default=list)  # [{model, score, track}]
    routing_confidence = Column(Float, nullable=True)
    routing_explanation = Column(Text, nullable=True)
    tradeoff_profile = Column(String, nullable=True)  # quality_first / balanced / speed_first / cost_first
    expected_cost_usd = Column(Float, nullable=True)
    expected_latency_ms = Column(Integer, nullable=True)

    # --- User decision (filled by outcome updates) ------------------
    selected_model = Column(String, nullable=True, index=True)
    user_accepted_recommendation = Column(Boolean, nullable=True)
    user_overrode_recommendation = Column(Boolean, nullable=True)
    override_reason = Column(String, nullable=True)
    time_to_decision_ms = Column(Integer, nullable=True)

    # --- Outcome signals --------------------------------------------
    copied = Column(Boolean, default=False)
    exported = Column(Boolean, default=False)
    rerouted = Column(Boolean, default=False)
    rerouted_to_model = Column(String, nullable=True)
    abandoned = Column(Boolean, default=False)
    explicit_rating = Column(Integer, nullable=True)  # 1..5
    inferred_satisfaction = Column(Float, nullable=True)  # 0..1

    # --- Meta scoring ------------------------------------------------
    insight_worthiness_score = Column(Float, default=0.0)
    content_worthiness_score = Column(Float, default=0.0)
    benchmark_eligible = Column(Boolean, default=False)
    public_insight_eligible = Column(Boolean, default=False)
    consent_tier_at_event = Column(Integer, default=0)

    # --- Provenance --------------------------------------------------
    processing_flags = Column(JSON, default=dict)


Index(
    "ix_prompt_events_category_model_time",
    PromptEvent.category_primary,
    PromptEvent.selected_model,
    PromptEvent.created_at,
)
Index(
    "ix_prompt_events_subcategory_time",
    PromptEvent.subcategory,
    PromptEvent.created_at,
)


class GoldPrompt(Base):
    """Hand-labeled ground-truth prompts used for classifier regression tests."""

    __tablename__ = "gold_prompts"

    gold_id = Column(String, primary_key=True, default=_uuid)
    prompt_hash = Column(String, nullable=False, unique=True, index=True)
    prompt_text = Column(Text, nullable=False)
    labels = Column(JSON, default=dict)  # all taxonomy axes
    best_model = Column(String, nullable=True)
    rationale = Column(Text, nullable=True)
    labeler = Column(String, default="human")
    labeled_at = Column(DateTime, default=_now)
    taxonomy_version = Column(String, default="1.0.0")


# ──────────────────────────────────────────────────────────────────
# Phase B — User identity & retention layer
#
# These tables store data for authenticated users (Clerk). Anonymous
# visitors never touch these tables — the advisor works fully without
# sign-in.
# ──────────────────────────────────────────────────────────────────


class PromptHistory(Base):
    """Saved prompt analyses for authenticated users."""

    __tablename__ = "prompt_history"

    history_id = Column(String, primary_key=True, default=_uuid)
    clerk_user_id = Column(String, nullable=False, index=True)
    prompt_text = Column(Text, nullable=False)
    prompt_preview = Column(String(300), nullable=False)
    winner_model_id = Column(String, nullable=True)
    winner_model_name = Column(String, nullable=True)
    winner_provider = Column(String, nullable=True)
    winner_score = Column(Float, nullable=True)
    task_type = Column(String, nullable=True)
    optimization_track = Column(String, nullable=True)
    full_result_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=_now, index=True)


Index(
    "ix_prompt_history_user_created",
    PromptHistory.clerk_user_id,
    PromptHistory.created_at.desc(),
)


class UserPreferences(Base):
    """Per-user routing preferences. One row per authenticated user."""

    __tablename__ = "user_preferences"

    clerk_user_id = Column(String, primary_key=True)
    default_track = Column(String, default="balanced")  # quality / balanced / speed / cost
    preferred_providers = Column(JSON, default=list)
    excluded_providers = Column(JSON, default=list)
    budget_ceiling_per_1m = Column(Float, nullable=True)
    prefer_open_weight = Column(Boolean, default=False)
    updated_at = Column(DateTime, default=_now, onupdate=_now)
    created_at = Column(DateTime, default=_now)


class WorkflowPreset(Base):
    """Reusable constraint profiles for common workflows."""

    __tablename__ = "workflow_presets"

    preset_id = Column(String, primary_key=True, default=_uuid)
    clerk_user_id = Column(String, nullable=True, index=True)  # null = system preset
    name = Column(String, nullable=False)
    slug = Column(String, nullable=False, index=True)
    description = Column(Text, nullable=True)
    icon = Column(String, nullable=True)
    is_system = Column(Boolean, default=False)

    # Constraint profile
    default_track = Column(String, default="balanced")
    preferred_providers = Column(JSON, default=list)
    excluded_providers = Column(JSON, default=list)
    budget_ceiling_per_1m = Column(Float, nullable=True)
    prefer_open_weight = Column(Boolean, default=False)

    # Routing hints
    min_reasoning_score = Column(Integer, nullable=True)
    min_coding_score = Column(Integer, nullable=True)
    require_function_calling = Column(Boolean, default=False)
    require_structured_output = Column(Boolean, default=False)
    require_vision = Column(Boolean, default=False)
    require_long_context = Column(Boolean, default=False)

    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)


class ModelUpdateRecord(Base):
    """Changelog entry for model score changes, additions, and deprecations."""

    __tablename__ = "model_updates"

    update_id = Column(String, primary_key=True, default=_uuid)
    model_id = Column(String, ForeignKey("models.id"), nullable=False, index=True)
    update_type = Column(String, nullable=False)  # added / scores_updated / deprecated / reactivated
    description = Column(Text, nullable=True)
    old_values = Column(JSON, default=dict)
    new_values = Column(JSON, default=dict)
    created_at = Column(DateTime, default=_now, index=True)


# ──────────────────────────────────────────────────────────────────
# Learning loop — outcome-based feedback & calibration
# ──────────────────────────────────────────────────────────────────


class RecommendationFeedback(Base):
    """Explicit user feedback on a recommendation (thumbs, override, free-text)."""

    __tablename__ = "recommendation_feedback"

    feedback_id = Column(String, primary_key=True, default=_uuid)
    event_id = Column(String, ForeignKey("prompt_events.event_id"), nullable=True, index=True)
    user_id = Column(String, nullable=True, index=True)
    session_id = Column(String, nullable=True)
    feedback_type = Column(String, nullable=False)  # thumbs_up / thumbs_down / override
    selected_model = Column(String, nullable=True)
    recommended_model = Column(String, nullable=True)
    override_reason = Column(String, nullable=True)
    override_reason_text = Column(Text, nullable=True)
    rating = Column(Integer, nullable=True)  # 1-5
    time_to_feedback_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=_now, index=True)


class RecommendationOverride(Base):
    """Structured override: user chose a different model than the top recommendation."""

    __tablename__ = "recommendation_overrides"

    override_id = Column(String, primary_key=True, default=_uuid)
    event_id = Column(String, ForeignKey("prompt_events.event_id"), nullable=True, unique=True, index=True)
    user_id = Column(String, nullable=True, index=True)
    recommended_model = Column(String, nullable=False)
    selected_model = Column(String, nullable=False)
    override_reason = Column(String, nullable=True)
    override_reason_text = Column(Text, nullable=True)
    category_primary = Column(String, nullable=True, index=True)
    subcategory = Column(String, nullable=True)
    complexity_score = Column(Integer, nullable=True)
    routing_confidence = Column(Float, nullable=True)
    created_at = Column(DateTime, default=_now, index=True)


class RecommendationOutcome(Base):
    """Derived outcome signal for a recommendation — combines behavioural proxies."""

    __tablename__ = "recommendation_outcomes"

    outcome_id = Column(String, primary_key=True, default=_uuid)
    event_id = Column(String, ForeignKey("prompt_events.event_id"), nullable=True, unique=True, index=True)
    user_id = Column(String, nullable=True, index=True)
    recommended_model = Column(String, nullable=True)
    selected_model = Column(String, nullable=True)
    outcome_label = Column(String, nullable=False, default="no_signal")  # accepted / overridden / abandoned / no_signal
    success = Column(Boolean, nullable=True)  # filled by calibration pipeline
    composite_score = Column(Float, nullable=True)
    accepted = Column(Boolean, default=False)
    overridden = Column(Boolean, default=False)
    copied = Column(Boolean, default=False)
    exported = Column(Boolean, default=False)
    rerouted = Column(Boolean, default=False)
    abandoned = Column(Boolean, default=False)
    explicit_rating = Column(Integer, nullable=True)
    inferred_satisfaction = Column(Float, nullable=True)
    time_to_decision_ms = Column(Integer, nullable=True)
    category_primary = Column(String, nullable=True, index=True)
    subcategory = Column(String, nullable=True)
    complexity_score = Column(Integer, nullable=True)
    routing_confidence = Column(Float, nullable=True)
    created_at = Column(DateTime, default=_now, index=True)
    updated_at = Column(DateTime, default=_now, onupdate=_now)


Index(
    "ix_outcomes_category_model_time",
    RecommendationOutcome.category_primary,
    RecommendationOutcome.recommended_model,
    RecommendationOutcome.created_at,
)


class CalibrationBucket(Base):
    """Empirical calibration: maps raw confidence buckets to observed success rates."""

    __tablename__ = "calibration_buckets"

    bucket_id = Column(String, primary_key=True, default=_uuid)
    bucket_label = Column(String, nullable=False)  # e.g. "0.5-0.6"
    bucket_lower = Column(Float, nullable=False)
    bucket_upper = Column(Float, nullable=False)
    predicted_confidence = Column(Float, nullable=False)  # avg routing_confidence in bucket
    empirical_success_rate = Column(Float, nullable=False)
    sample_count = Column(Integer, nullable=False, default=0)
    calibration_version = Column(String, default="1.0.0")
    last_computed_at = Column(DateTime, default=_now)


class CalibrationRun(Base):
    """Record of a calibration batch run for auditing and version comparison."""

    __tablename__ = "calibration_runs"

    run_id = Column(String, primary_key=True, default=_uuid)
    started_at = Column(DateTime, default=_now)
    completed_at = Column(DateTime, nullable=True)
    events_processed = Column(Integer, default=0)
    ece_score = Column(Float, nullable=True)  # Expected Calibration Error
    max_calibration_error = Column(Float, nullable=True)
    calibration_version = Column(String, default="1.0.0")
    status = Column(String, default="running")  # running / completed / failed
    config = Column(JSON, default=dict)


class OnboardingProgress(Base):
    """Tracks onboarding funnel for anonymous and authenticated users."""

    __tablename__ = "onboarding_progress"

    progress_id = Column(String, primary_key=True, default=_uuid)
    clerk_user_id = Column(String, nullable=True, index=True)
    anonymous_user_id = Column(String, nullable=True, index=True)
    completed_steps = Column(JSON, default=list)
    current_step = Column(String, nullable=True)
    use_case = Column(String, nullable=True)
    priority = Column(String, nullable=True)
    evaluation_context = Column(String, nullable=True)  # personal / prototype / production
    template_used = Column(String, nullable=True)
    first_prompt_at = Column(DateTime, nullable=True)
    prompts_submitted = Column(Integer, default=0)
    nudges_shown = Column(JSON, default=list)
    nudges_dismissed = Column(JSON, default=list)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)


class ContentView(Base):
    """Tracks page views and CTA click-throughs for use-case content pages."""

    __tablename__ = "content_views"

    view_id = Column(String, primary_key=True, default=_uuid)
    slug = Column(String, nullable=False, index=True)
    event_type = Column(String, nullable=False, default="view")  # view / click_through
    source = Column(String, nullable=True)
    user_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=_now, index=True)


engine = create_async_engine(get_settings().database_url, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db() -> AsyncSession:
    async with async_session() as session:
        yield session
