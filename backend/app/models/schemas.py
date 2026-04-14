from __future__ import annotations

from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


# ── Task Classification ──

class TaskProfile(BaseModel):
    task_type: str = Field(description="Primary task classification")
    sub_type: Optional[str] = Field(default=None, description="More specific task sub-type")
    complexity: str = Field(description="simple, moderate, complex")
    expected_length: str = Field(description="short, medium, long")
    requires_json: bool = False
    requires_code: bool = False
    requires_reasoning: bool = False
    requires_vision: bool = False
    requires_audio: bool = False
    requires_realtime: bool = False
    requires_image_gen: bool = False
    requires_web_search: bool = False
    requires_tool_use: bool = False
    requires_long_context: bool = False
    requires_privacy: bool = False
    language: Optional[str] = None
    domain: Optional[str] = None
    token_estimate: int = 500
    confidence: float = 0.8


# ── Model Registry ──

class ModelInfo(BaseModel):
    id: str
    provider: str
    display_name: str
    family: str = "unknown"
    tier: str = "mid"
    release_status: str = "ga"
    release_date: Optional[str] = None
    description: Optional[str] = None

    litellm_model: str
    api_identifiers: dict[str, str] = {}

    context_window: int = 128000
    max_output_tokens: int = 8192
    cost_per_1m_input: float = 0.0
    cost_per_1m_output: float = 0.0
    avg_latency_ms: int = 1000

    supports_text: bool = True
    supports_vision: bool = False
    supports_audio_in: bool = False
    supports_audio_out: bool = False
    supports_video: bool = False
    supports_image_gen: bool = False
    supports_image_edit: bool = False
    supports_json_mode: bool = False
    supports_function_calling: bool = False
    supports_structured_output: bool = False
    supports_streaming: bool = True
    supports_reasoning: bool = False
    supports_realtime: bool = False
    supports_computer_use: bool = False
    supports_web_search: bool = False

    open_weight: bool = False
    hosting_options: list[str] = []
    knowledge_cutoff: Optional[str] = None

    score_raw_intelligence: float = 5.0
    score_reasoning_depth: float = 5.0
    score_coding: float = 5.0
    score_tool_use: float = 5.0
    score_multimodal: float = 1.0
    score_image_gen: float = 1.0
    score_audio_voice: float = 1.0
    score_long_context: float = 5.0
    score_structured_output: float = 5.0
    score_latency: float = 5.0
    score_cost_efficiency: float = 5.0
    score_enterprise_readiness: float = 5.0
    score_openness: float = 1.0

    quality_scores: dict[str, float] = {}
    strengths: list[str] = []
    weaknesses: list[str] = []

    best_use_cases: list[str] = []
    worst_use_cases: list[str] = []
    known_strengths: list[str] = []
    known_weaknesses: list[str] = []
    safety_notes: Optional[str] = None
    benchmark_evidence: dict = {}
    source_citations: list[str] = []
    deprecation_notes: Optional[str] = None

    last_verified_at: Optional[datetime] = None
    source_count: int = 0
    is_outdated: bool = False
    outdated_reason: Optional[str] = None
    deprecation_warning: Optional[str] = None

    is_active: bool = True

    # Legacy compat
    max_tokens: int = 4096
    cost_per_1k_input: float = 0.0
    cost_per_1k_output: float = 0.0

    model_config = {"from_attributes": True}


class ModelUpdate(BaseModel):
    display_name: Optional[str] = None
    is_active: Optional[bool] = None
    quality_scores: Optional[dict[str, float]] = None
    cost_per_1m_input: Optional[float] = None
    cost_per_1m_output: Optional[float] = None
    avg_latency_ms: Optional[int] = None
    release_status: Optional[str] = None
    deprecation_warning: Optional[str] = None


# ── Routing ──

class ModelScore(BaseModel):
    model_id: str
    provider: str
    quality_fit: float = 0.0
    cost_efficiency: float = 0.0
    speed: float = 0.0
    reliability: float = 0.0
    format_support: float = 0.0
    reasoning_fit: float = 0.0
    capability_match: float = 0.0
    total: float = 0.0


class RoutingDecision(BaseModel):
    primary_model: str
    primary_provider: str
    fallback_model: Optional[str] = None
    fallback_provider: Optional[str] = None
    scores: list[ModelScore] = []
    explanation: str = ""
    task_profile: TaskProfile
    confidence: float = 0.0
    freshness_score: float = 1.0
    tradeoffs: list[str] = []
    why_alternatives_lost: dict[str, str] = {}


# (Chat execution, history, analytics, and feedback schemas were removed in
# v3.0 when NexusRoute became advisor-only. The routing engine lives on
# purely as a recommendation layer — nothing is ever executed server-side.)


# ──────────────────────────────────────────────────────────────────
# v3.1 Instrumentation layer — Intent Panel
# ──────────────────────────────────────────────────────────────────

class ClientInfo(BaseModel):
    platform: Optional[str] = None
    version: Optional[str] = None
    locale: Optional[str] = None
    tz: Optional[str] = None


class ConsentGrant(BaseModel):
    user_id: Optional[str] = None  # server assigns if missing
    tier: int = Field(default=0, ge=0, le=2)
    scope: list[str] = Field(default_factory=list)
    source: str = "consent_banner"


class ConsentState(BaseModel):
    user_id: str
    tier: int
    scope: list[str] = Field(default_factory=list)
    granted_at: datetime
    revoked_at: Optional[datetime] = None


class SessionStart(BaseModel):
    user_id: Optional[str] = None
    client: ClientInfo = Field(default_factory=ClientInfo)
    consent_tier: int = 0


class SessionOpened(BaseModel):
    session_id: str
    user_id: str
    started_at: datetime
    consent_tier: int


class CandidateModel(BaseModel):
    model_id: str
    score: float
    track: Optional[str] = None  # bestAbsolute / bestValue / bestLowLatency / bestOpenSelfHosted
    rationale_code: Optional[str] = None


class RoutingDecisionCapture(BaseModel):
    recommended_model: Optional[str] = None
    candidate_models: list[CandidateModel] = Field(default_factory=list)
    routing_confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    routing_explanation: Optional[str] = None
    tradeoff_profile: Optional[str] = None
    expected_cost_usd: Optional[float] = None
    expected_latency_ms: Optional[int] = None
    routing_strategy_version: str = "advisor-v3.0.0"


class EventCreate(BaseModel):
    """Incoming event payload from the advisor UI."""

    session_id: str
    user_id: str
    prompt: str  # will be redacted server-side before storage
    client: ClientInfo = Field(default_factory=ClientInfo)
    routing: RoutingDecisionCapture = Field(default_factory=RoutingDecisionCapture)
    consent_tier: int = 0


class EventCreated(BaseModel):
    event_id: str
    session_id: str
    user_id: str
    category_primary: Optional[str]
    subcategory: Optional[str]
    classifier_confidence: float
    enrichment_tier: int


class OutcomeUpdate(BaseModel):
    """Updates to a prompt event after the user makes or reconsiders a choice."""

    event_id: str
    selected_model: Optional[str] = None
    user_accepted_recommendation: Optional[bool] = None
    user_overrode_recommendation: Optional[bool] = None
    override_reason: Optional[str] = None
    time_to_decision_ms: Optional[int] = None
    copied: Optional[bool] = None
    exported: Optional[bool] = None
    rerouted: Optional[bool] = None
    rerouted_to_model: Optional[str] = None
    abandoned: Optional[bool] = None
    explicit_rating: Optional[int] = Field(default=None, ge=1, le=5)


class InsightCategoryShare(BaseModel):
    category_primary: str
    label: str
    events: int
    share: float


class InsightModelLeaderboardRow(BaseModel):
    category_primary: str
    subcategory: Optional[str] = None
    model_id: str
    share: float
    events: int
    override_rate: Optional[float] = None
    inferred_satisfaction: Optional[float] = None


class RouterHealthSnapshot(BaseModel):
    window_days: int
    total_events: int
    events_with_outcome: int
    accuracy_at_1: Optional[float] = None
    override_rate: Optional[float] = None
    avg_routing_confidence: Optional[float] = None
    avg_classifier_confidence: Optional[float] = None
    unclassified_rate: Optional[float] = None
    category_distribution: list[InsightCategoryShare] = Field(default_factory=list)
    cost_per_event_usd: Optional[float] = None


class DashboardSummary(BaseModel):
    as_of: datetime
    total_events: int
    total_sessions: int
    total_users: int
    events_24h: int
    events_7d: int
    router_health: RouterHealthSnapshot
    model_share_by_category: list[InsightModelLeaderboardRow] = Field(default_factory=list)
    top_subcategories: list[InsightCategoryShare] = Field(default_factory=list)
    taxonomy_version: str
    classifier_version: str


class GoldPromptCreate(BaseModel):
    prompt_text: str
    labels: dict = Field(default_factory=dict)
    best_model: Optional[str] = None
    rationale: Optional[str] = None
    labeler: str = "human"


class GoldPromptRead(BaseModel):
    gold_id: str
    prompt_hash: str
    prompt_text: str
    labels: dict
    best_model: Optional[str]
    rationale: Optional[str]
    labeler: str
    labeled_at: datetime
    taxonomy_version: str

    model_config = {"from_attributes": True}


# ── Phase B: Prompt History ──


class PromptHistoryCreate(BaseModel):
    prompt_text: str
    prompt_preview: str = Field(max_length=300)
    winner_model_id: Optional[str] = None
    winner_model_name: Optional[str] = None
    winner_provider: Optional[str] = None
    winner_score: Optional[float] = None
    task_type: Optional[str] = None
    optimization_track: Optional[str] = None
    full_result_json: Optional[dict] = None


class PromptHistoryRead(BaseModel):
    history_id: str
    prompt_text: str
    prompt_preview: str
    winner_model_id: Optional[str]
    winner_model_name: Optional[str]
    winner_provider: Optional[str]
    winner_score: Optional[float]
    task_type: Optional[str]
    optimization_track: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class PromptHistoryDetail(PromptHistoryRead):
    full_result_json: Optional[dict] = None


# ── Phase B: User Preferences ──


class UserPreferencesRead(BaseModel):
    default_track: str = "balanced"
    preferred_providers: list[str] = []
    excluded_providers: list[str] = []
    budget_ceiling_per_1m: Optional[float] = None
    prefer_open_weight: bool = False
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class UserPreferencesUpdate(BaseModel):
    default_track: Optional[str] = None
    preferred_providers: Optional[list[str]] = None
    excluded_providers: Optional[list[str]] = None
    budget_ceiling_per_1m: Optional[float] = None
    prefer_open_weight: Optional[bool] = None


# ── Phase B: Workflow Presets ──


class WorkflowPresetRead(BaseModel):
    preset_id: str
    name: str
    slug: str
    description: Optional[str] = None
    icon: Optional[str] = None
    is_system: bool
    default_track: str
    preferred_providers: list[str] = []
    excluded_providers: list[str] = []
    budget_ceiling_per_1m: Optional[float] = None
    prefer_open_weight: bool = False
    min_reasoning_score: Optional[int] = None
    min_coding_score: Optional[int] = None
    require_function_calling: bool = False
    require_structured_output: bool = False
    require_vision: bool = False
    require_long_context: bool = False

    model_config = {"from_attributes": True}


class WorkflowPresetCreate(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    slug: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    default_track: str = "balanced"
    preferred_providers: list[str] = []
    excluded_providers: list[str] = []
    budget_ceiling_per_1m: Optional[float] = None
    prefer_open_weight: bool = False
    min_reasoning_score: Optional[int] = None
    min_coding_score: Optional[int] = None
    require_function_calling: bool = False
    require_structured_output: bool = False
    require_vision: bool = False
    require_long_context: bool = False


class WorkflowPresetUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    default_track: Optional[str] = None
    preferred_providers: Optional[list[str]] = None
    excluded_providers: Optional[list[str]] = None
    budget_ceiling_per_1m: Optional[float] = None
    prefer_open_weight: Optional[bool] = None
    min_reasoning_score: Optional[int] = None
    min_coding_score: Optional[int] = None
    require_function_calling: Optional[bool] = None
    require_structured_output: Optional[bool] = None
    require_vision: Optional[bool] = None
    require_long_context: Optional[bool] = None


# ── Phase C: Model Changelog ──


class ModelChangelogEntry(BaseModel):
    update_id: str
    model_id: str
    model_name: str
    provider: str
    update_type: str
    description: Optional[str] = None
    old_values: dict = {}
    new_values: dict = {}
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Phase C: Public API ──


class AnalyzeRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=10000)
    optimize_for: str = "balanced"
    max_cost_per_1m: Optional[float] = None


class AnalyzeModelResult(BaseModel):
    model_id: str
    display_name: str
    provider: str
    tier: str
    score: float
    quality_fit: float
    cost_efficiency: float
    speed: float


class AnalyzeResponse(BaseModel):
    task_profile: TaskProfile
    recommendations: list[AnalyzeModelResult]
    primary_model: str
    primary_provider: str
    explanation: str
    confidence: float


# ── Learning loop: Feedback & Outcomes ──


class RecommendationFeedbackCreate(BaseModel):
    event_id: Optional[str] = None
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    feedback_type: str  # thumbs_up / thumbs_down / override
    selected_model: Optional[str] = None
    recommended_model: Optional[str] = None
    override_reason: Optional[str] = None
    override_reason_text: Optional[str] = Field(default=None, max_length=500)
    rating: Optional[int] = Field(default=None, ge=1, le=5)
    time_to_feedback_ms: Optional[int] = None


class RecommendationFeedbackRead(BaseModel):
    feedback_id: str
    event_id: Optional[str]
    user_id: Optional[str]
    session_id: Optional[str]
    feedback_type: str
    selected_model: Optional[str]
    recommended_model: Optional[str]
    override_reason: Optional[str]
    override_reason_text: Optional[str]
    rating: Optional[int]
    time_to_feedback_ms: Optional[int]
    created_at: datetime

    model_config = {"from_attributes": True}


class RecommendationOverrideRead(BaseModel):
    override_id: str
    event_id: Optional[str]
    user_id: Optional[str]
    recommended_model: str
    selected_model: str
    override_reason: Optional[str]
    override_reason_text: Optional[str]
    category_primary: Optional[str]
    subcategory: Optional[str]
    complexity_score: Optional[int]
    routing_confidence: Optional[float]
    created_at: datetime

    model_config = {"from_attributes": True}


class RecommendationOutcomeRead(BaseModel):
    outcome_id: str
    event_id: Optional[str]
    user_id: Optional[str]
    recommended_model: Optional[str]
    selected_model: Optional[str]
    outcome_label: str
    success: Optional[bool]
    composite_score: Optional[float]
    accepted: bool
    overridden: bool
    copied: bool
    exported: bool
    rerouted: bool
    abandoned: bool
    explicit_rating: Optional[int]
    inferred_satisfaction: Optional[float]
    time_to_decision_ms: Optional[int]
    category_primary: Optional[str]
    subcategory: Optional[str]
    routing_confidence: Optional[float]
    created_at: datetime

    model_config = {"from_attributes": True}


class OutcomeWeights(BaseModel):
    """Configurable weights for computing composite outcome scores."""
    helpful: float = 1.0
    not_helpful: float = -1.0
    copied: float = 0.5
    shared: float = 0.6
    compared: float = 0.2
    override_of_top: float = -0.7
    override_chosen: float = 0.5
    abandoned: float = -0.8


class QualityScorecard(BaseModel):
    """Aggregate recommendation quality metrics."""
    total_outcomes: int = 0
    total_feedback: int = 0
    acceptance_rate: Optional[float] = None
    override_rate: Optional[float] = None
    abandon_rate: Optional[float] = None
    avg_composite_score: Optional[float] = None
    avg_satisfaction: Optional[float] = None
    avg_time_to_decision_ms: Optional[float] = None
    feedback_volume: int = 0
    helpful_rate: Optional[float] = None
    category_breakdown: list[dict] = Field(default_factory=list)
    model_breakdown: list[dict] = Field(default_factory=list)


class CalibrationBucketRead(BaseModel):
    bucket_id: str
    bucket_label: str
    bucket_lower: float
    bucket_upper: float
    predicted_confidence: float
    empirical_success_rate: float
    sample_count: int
    calibration_version: str
    last_computed_at: datetime

    model_config = {"from_attributes": True}


class CalibrationRunRead(BaseModel):
    run_id: str
    started_at: datetime
    completed_at: Optional[datetime]
    events_processed: int
    ece_score: Optional[float]
    max_calibration_error: Optional[float]
    calibration_version: str
    status: str

    model_config = {"from_attributes": True}


class OnboardingProgressCreate(BaseModel):
    clerk_user_id: Optional[str] = None
    anonymous_user_id: Optional[str] = None
    current_step: Optional[str] = None
    use_case: Optional[str] = None
    priority: Optional[str] = None
    evaluation_context: Optional[str] = None
    template_used: Optional[str] = None


class OnboardingProgressUpdate(BaseModel):
    current_step: Optional[str] = None
    completed_steps: Optional[list[str]] = None
    use_case: Optional[str] = None
    priority: Optional[str] = None
    evaluation_context: Optional[str] = None
    template_used: Optional[str] = None
    prompts_submitted: Optional[int] = None


class OnboardingProgressRead(BaseModel):
    progress_id: str
    clerk_user_id: Optional[str]
    anonymous_user_id: Optional[str]
    completed_steps: list
    current_step: Optional[str]
    use_case: Optional[str]
    priority: Optional[str]
    evaluation_context: Optional[str]
    template_used: Optional[str]
    prompts_submitted: int
    created_at: datetime

    model_config = {"from_attributes": True}
