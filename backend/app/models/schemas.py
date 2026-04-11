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
