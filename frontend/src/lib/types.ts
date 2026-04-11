export interface ModelProfile {
  id: string;
  slug: string;
  displayName: string;
  provider: string;
  family: string;
  tier: "frontier" | "mid" | "budget" | "specialized";
  isActive: boolean;
  releaseDate: string;
  description: string;

  specs: ModelSpecs;
  capabilities: ModelCapabilities;
  intelligence: ModelIntelligence;
  benchmarks: ModelBenchmarks;
  researchMeta: ResearchMeta;
  tags: string[];
}

export interface ModelSpecs {
  contextWindow: number;
  maxOutputTokens: number;
  inputPricePer1M: number;
  outputPricePer1M: number;
  supportsVision: boolean;
  supportsAudio: boolean;
  supportsVideo: boolean;
  supportsFunctionCalling: boolean;
  supportsJsonMode: boolean;
  supportsStreaming: boolean;
  knowledgeCutoff: string;
  apiIdentifiers: Record<string, string>;
}

export interface ModelCapabilities {
  reasoning: number;
  coding: number;
  longContext: number;
  structuredOutput: number;
  multimodal: number;
  speed: number;
  costEfficiency: number;
  creativity: number;
  factuality: number;
  instructionFollowing: number;
  toolUse: number;
  safetyEnterprise: number;
  conversational: number;
}

export interface ModelIntelligence {
  bestUseCases: string[];
  worstUseCases: string[];
  knownStrengths: string[];
  knownWeaknesses: string[];
  edgeCaseNotes: string[];
  providerNotes: string;
}

export interface ModelBenchmarks {
  mmluScore?: number;
  humanEvalScore?: number;
  arenaElo?: number;
  gsm8kScore?: number;
  notes: string;
}

export interface ResearchMeta {
  lastEvaluatedDate: string;
  evaluationMethod: string;
  sourceConfidence: number;
  sources: string[];
  needsReEvaluation: boolean;
}

export type CapabilityDimension = keyof ModelCapabilities;

export const CAPABILITY_LABELS: Record<CapabilityDimension, string> = {
  reasoning: "Reasoning",
  coding: "Coding",
  longContext: "Long Context",
  structuredOutput: "Structured Output",
  multimodal: "Multimodal",
  speed: "Speed",
  costEfficiency: "Cost Efficiency",
  creativity: "Creativity",
  factuality: "Factuality",
  instructionFollowing: "Instruction Following",
  toolUse: "Tool Use",
  safetyEnterprise: "Safety & Enterprise",
  conversational: "Conversational",
};

export interface TaskClassification {
  primary: string;
  primaryLabel: string;
  primaryConfidence: number;
  secondary: string | null;
  secondaryLabel: string | null;
  signals: Array<{ strength: "strong" | "moderate" | "weak"; phrase: string }>;
  parentCategory: string;
}

export interface RequirementVector {
  reasoning: number;
  coding: number;
  longContext: number;
  structuredOutput: number;
  multimodal: number;
  speed: number;
  costEfficiency: number;
  creativity: number;
  factuality: number;
  instructionFollowing: number;
  toolUse: number;
  safetyEnterprise: number;
  conversational: number;
}

export interface PromptContext {
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  requiresMultiTurn: boolean;
  businessRisk: "low" | "medium" | "high";
  singleModelSufficient: boolean;
  domain: string | null;
  language: string;
}

export interface KeyRequirement {
  dimension: CapabilityDimension;
  label: string;
  importance: "Critical" | "Important" | "Moderate" | "Low" | "Not needed";
  weight: number;
}

export interface ModelRecommendation {
  modelId: string;
  modelName: string;
  provider: string;
  score: number;
  rank: number;
  reasoning: string[];
  warnings: string[];
  bestFor: string[];
  notIdealFor: string[];
  dimensionalScores: Record<string, number>;
  pricingEstimate: {
    inputCost: string;
    outputCost: string;
  };
  tier: string;
}

export type EvidenceLevel =
  | "official_docs"
  | "benchmark"
  | "observed"
  | "inferred"
  | "unknown";

export type StructuredOutputStrictness = "none" | "loose_json" | "strict_schema";

export interface InterpretedTaskLabel {
  id: string;
  label: string;
  weight: number;
}

export interface PromptInterpretation {
  jobToBeDone: string;
  primaryTasks: InterpretedTaskLabel[];
  secondaryTasks: InterpretedTaskLabel[];
  hiddenIntentHypotheses: Array<{ text: string; confidence: number }>;
  reasoningDepth: number;
  codingDemand: number;
  agentToolDemand: number;
  multimodalUnderstanding: number;
  imageGenerationOutput: number;
  longContextDemand: number;
  structuredOutputDemand: number;
  structuredStrictness: StructuredOutputStrictness;
  creativeDemand: number;
  factualityCritical: number;
  enterpriseReliability: number;
  latencySensitivity: number;
  costSensitivity: number;
  privacySelfHost: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  interpretationConfidence: number;
  ambiguityNotes: string[];
  method: "structural_statistical" | "llm";
}

/** Normalized demand vector aligned to ModelCapabilities keys + gates */
export interface TaskRequirements {
  reasoning: number;
  coding: number;
  longContext: number;
  structuredOutput: number;
  multimodal: number;
  speed: number;
  costEfficiency: number;
  creativity: number;
  factuality: number;
  instructionFollowing: number;
  toolUse: number;
  safetyEnterprise: number;
  conversational: number;
  structuredStrictness: StructuredOutputStrictness;
  imageGenerationOutput: number;
  privacySelfHost: number;
}

export interface EligibilityExclusion {
  modelId: string;
  modelName: string;
  reasons: string[];
}

export interface OperatingModeAdvice {
  reasoningEffort: "default" | "low" | "medium" | "high";
  toolsEnabled: "off" | "if_available" | "required";
  structuredOutputMode: "off" | "json_mode" | "schema_constrained";
  workflow: "single_shot" | "multi_step";
  escalationHint: string;
}

export interface TrackRecommendation {
  trackId: "absolute_quality" | "value" | "low_latency" | "open_self_hosted";
  modelId: string;
  modelName: string;
  provider: string;
  score: number;
  metricDetail: string;
  whyWon: string[];
  whyAlternativesLost: string[];
  tradeoffs: string[];
  switchToAlternativeIf: string[];
  operatingMode: OperatingModeAdvice;
  evidenceWarnings: string[];
}

export interface ModelTaskFit {
  modelId: string;
  modelName: string;
  strengthsVsTask: string[];
  weaknessesVsTask: string[];
}

export interface RankingUncertainty {
  interpretationConfidence: number;
  rankingConfidence: number;
  topScoreGap: number;
  isMarginalWinner: boolean;
  notes: string[];
}

export interface InterpretationProvenance {
  source: "llm" | "structural_statistical";
  /** Remote model id when source is llm */
  remoteModel?: string;
  note?: string;
}

export interface AdvisorAnalysis {
  interpretation: PromptInterpretation;
  interpretationProvenance?: InterpretationProvenance;
  requirements: TaskRequirements;
  eligibilityExclusions: EligibilityExclusion[];
  /** Notes e.g. budget/latency gates relaxed after empty pool */
  eligibilityNotes: string[];
  candidateModelIds: string[];
  perModelFit: ModelTaskFit[];
  tracks: {
    bestAbsolute: TrackRecommendation | null;
    bestValue: TrackRecommendation | null;
    bestLowLatency: TrackRecommendation | null;
    bestOpenSelfHosted: TrackRecommendation | null;
  };
  uncertainty: RankingUncertainty;
}

export interface AnalysisResult {
  id: string;
  prompt: string;
  promptPreview: string;
  /** Legacy — populated for backward compatibility */
  taskClassification: TaskClassification;
  requirementVector: RequirementVector;
  keyRequirements: KeyRequirement[];
  promptContext: PromptContext;
  recommendations: ModelRecommendation[];
  confidence: number;
  budgetAlternative: ModelRecommendation | null;
  openWeightAlternative: ModelRecommendation | null;
  explanationSummary: string;
  timestamp: string;
  advisor: AdvisorAnalysis;
}

// ============================================================
// ADVISOR ENGINE v2 — Constraint-Gated Multi-Objective Decision
// ============================================================

/**
 * A capability score paired with its evidential basis.
 * Every capability claim must carry provenance — no naked numbers.
 */
export interface EvidencedCapability {
  value: number;
  confidence: number;
  evidence: EvidenceLevel;
  detail?: string;
}

/**
 * One axis of the demand tensor. Encodes both importance and acceptable range.
 * `minimum` is the hard floor: models below it may be excluded.
 * `ideal` is the efficiency ceiling: models far above it incur overkill cost.
 */
export interface DemandAxis {
  weight: number;
  minimum: number;
  ideal: number;
}

/**
 * The full demand tensor — the engine's internal representation of what
 * a prompt actually needs across every capability dimension.
 * Axes mirror ModelCapabilities keys so they can be aligned directly.
 */
export type DemandTensor = Record<CapabilityDimension, DemandAxis>;

/**
 * Boolean and threshold constraints extracted from prompt interpretation.
 * These are HARD: failing any one can exclude a model entirely.
 */
export interface HardConstraints {
  requiresVision: boolean;
  requiresAudio: boolean;
  requiresVideo: boolean;
  requiresImageGeneration: boolean;
  requiresFunctionCalling: boolean;
  requiresJsonMode: boolean;
  requiresOpenWeight: boolean;
  minContextWindow: number;
  maxEstimatedCostUsd: number | null;
  maxLatencyTier: number | null;
  structuredStrictness: StructuredOutputStrictness;
}

export type ConstraintSeverity = "hard_fail" | "soft_violation" | "pass";

export interface ConstraintCheck {
  constraint: string;
  severity: ConstraintSeverity;
  reason: string;
}

export interface EligibilityVerdict {
  modelId: string;
  modelName: string;
  eligible: boolean;
  checks: ConstraintCheck[];
  satisfactionScore: number;
}

/**
 * Per-dimension alignment between what the prompt demands and what
 * a model supplies. The core of the scoring engine.
 */
export interface DimensionFit {
  dimension: CapabilityDimension;
  demand: number;
  rawSupply: number;
  effectiveSupply: number;
  fit: number;
  underfitPenalty: number;
  overkillPenalty: number;
  evidenceQuality: number;
}

export type CostTier = "free" | "budget" | "mid" | "premium" | "frontier";

/**
 * Complete scoring profile for one model against the current prompt.
 * Contains both the aggregate scores and the full dimensional breakdown.
 */
export interface ModelFitProfile {
  modelId: string;
  modelName: string;
  provider: string;
  alignmentScore: number;
  rawQualityScore: number;
  valueScore: number;
  latencyAdjustedScore: number;
  dimensionFits: DimensionFit[];
  aggregateEvidenceQuality: number;
  totalUnderfitPenalty: number;
  totalOverkillPenalty: number;
  estimatedCostUsd: number;
  costTier: CostTier;
}

export interface ParetoMembership {
  modelId: string;
  paretoOptimal: boolean;
  dominatedBy: string[];
  dominates: string[];
}

/**
 * Uncertainty that propagates from interpretation ambiguity through
 * evidence gaps to ranking instability. Not a single number — a
 * structured report the consumer can act on.
 */
export interface UncertaintyReport {
  interpretationConfidence: number;
  rankingStability: number;
  topScoreGap: number;
  isMarginalWinner: boolean;
  aggregateEvidenceQuality: number;
  recommendedAction: "trust" | "validate" | "explore_alternatives";
  notes: string[];
}

export interface ExplanationLayer {
  summary: string;
  whyWinnerWon: string[];
  whyOthersLost: Record<string, string[]>;
  tradeoffs: string[];
  whenToSwitch: string[];
}

export interface EvalTestCase {
  id: string;
  prompt: string;
  category: "reasoning" | "coding" | "multimodal" | "structured" | "cost_sensitive" | "ambiguous" | "privacy" | "latency" | "agentic";
  expectedTraits: {
    mustIncludeModel?: string;
    mustExcludeModel?: string;
    topTrackShouldBe?: string;
    minimumConfidence?: number;
    overkillShouldTrigger?: boolean;
    constraintShouldExclude?: string[];
  };
  description: string;
}
