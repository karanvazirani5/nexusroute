/**
 * Model Advisor Pipeline Orchestrator
 *
 * Wires the full decision pipeline:
 *
 *   1. INTERPRET    → PromptInterpretation + DemandTensor + HardConstraints
 *   2. FILTER       → Constraint satisfaction → eligible model pool
 *   3. SCORE        → Per-model alignment profiles (demand↔supply fit)
 *   4. OPTIMIZE     → Multi-track Pareto-based selection
 *   5. UNCERTAINTY   → Propagated confidence + ranking stability
 *   6. EXPLAIN      → Structured why-won / why-lost / tradeoffs / switch hints
 *
 * Outputs a backward-compatible AnalysisResult for the UI layer.
 */

import type {
  AnalysisResult,
  ModelProfile,
  RequirementVector,
  ModelRecommendation,
  TaskClassification,
  PromptContext,
  CapabilityDimension,
  KeyRequirement,
  PromptInterpretation,
  InterpretationProvenance,
  AdvisorAnalysis,
  RankingUncertainty,
} from "@/lib/types";
import { CAPABILITY_LABELS } from "@/lib/types";
import {
  interpretPrompt,
  interpretationToRequirements,
  buildDemandTensor,
  buildHardConstraints,
} from "./interpret";
import { filterEligibleModels } from "./eligibility";
import { computeTracks, computeUncertainty, synthesizeExplanation } from "./optimize-tracks";
import { profileModel } from "./scoring";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// ── Legacy Adapters ──────────────────────────────────────────

function requirementsToVector(r: import("@/lib/types").TaskRequirements): RequirementVector {
  return {
    reasoning: r.reasoning,
    coding: r.coding,
    longContext: r.longContext,
    structuredOutput: r.structuredOutput,
    multimodal: r.multimodal,
    speed: r.speed,
    costEfficiency: r.costEfficiency,
    creativity: r.creativity,
    factuality: r.factuality,
    instructionFollowing: r.instructionFollowing,
    toolUse: r.toolUse,
    safetyEnterprise: r.safetyEnterprise,
    conversational: r.conversational,
  };
}

function syntheticTaskClassification(
  interp: PromptInterpretation
): TaskClassification {
  const p = interp.primaryTasks[0];
  const s = interp.secondaryTasks[0];
  return {
    primary: p?.id ?? "general",
    primaryLabel: p?.label ?? "General task",
    primaryConfidence: Math.round(interp.interpretationConfidence * 100),
    secondary: s?.id ?? null,
    secondaryLabel: s?.label ?? null,
    signals: [],
    parentCategory: "Interpreted",
  };
}

function buildPromptContext(interp: PromptInterpretation): PromptContext {
  return {
    estimatedInputTokens: interp.estimatedInputTokens,
    estimatedOutputTokens: interp.estimatedOutputTokens,
    requiresMultiTurn: interp.agentToolDemand > 0.45 || interp.creativeDemand > 0.65,
    businessRisk:
      interp.enterpriseReliability > 0.55
        ? "high"
        : interp.enterpriseReliability > 0.25
          ? "medium"
          : "low",
    singleModelSufficient: interp.agentToolDemand < 0.5,
    domain: null,
    language: "en",
  };
}

function extractKeyRequirements(vector: RequirementVector): KeyRequirement[] {
  const entries = Object.entries(vector) as [CapabilityDimension, number][];
  return entries
    .filter(([, weight]) => weight > 0.1)
    .sort((a, b) => b[1] - a[1])
    .map(([dim, weight]) => {
      let importance: KeyRequirement["importance"];
      if (weight >= 0.9) importance = "Critical";
      else if (weight >= 0.7) importance = "Important";
      else if (weight >= 0.5) importance = "Moderate";
      else if (weight >= 0.2) importance = "Low";
      else importance = "Not needed";
      return { dimension: dim, label: CAPABILITY_LABELS[dim], importance, weight };
    });
}

function toLegacyRecommendation(
  m: ModelProfile,
  score: number,
  rank: number,
  reqVec: RequirementVector,
  reasoning: string[],
  warnings: string[]
): ModelRecommendation {
  const dimensionalScores: Record<string, number> = {};
  for (const key of Object.keys(reqVec) as CapabilityDimension[]) {
    const w = reqVec[key];
    dimensionalScores[key] = Math.round(w * (m.capabilities[key] / 10) * 100) / 100;
  }
  return {
    modelId: m.id,
    modelName: m.displayName,
    provider: m.provider,
    score,
    rank,
    reasoning,
    warnings,
    bestFor: m.intelligence.bestUseCases.slice(0, 4),
    notIdealFor: m.intelligence.worstUseCases.slice(0, 3),
    dimensionalScores,
    pricingEstimate: {
      inputCost: `${m.specs.inputPricePer1M} / 1M in`,
      outputCost: `${m.specs.outputPricePer1M} / 1M out`,
    },
    tier: m.tier,
  };
}

// ── Core Pipeline ────────────────────────────────────────────

/** User/preset overrides that adjust the routing pipeline. */
export interface RoutingOverrides {
  excludedProviders?: string[];
  preferredProviders?: string[];
  /** When set, only models from these providers + open-weight models are considered. */
  allowedProviders?: string[];
  budgetCeiling?: number;
  preferOpenWeight?: boolean;
  defaultTrack?: string;
}

export function analyzeWithInterpretation(
  prompt: string,
  models: ModelProfile[],
  interpretation: PromptInterpretation,
  interpretationProvenance?: InterpretationProvenance,
  overrides?: RoutingOverrides
): AnalysisResult {
  const requirements = interpretationToRequirements(interpretation);
  const tensor = buildDemandTensor(interpretation);
  const constraints = buildHardConstraints(interpretation);

  // Apply user/preset overrides
  let filteredModels = models;
  if (overrides?.allowedProviders?.length) {
    const allowed = new Set(overrides.allowedProviders.map(p => p.toLowerCase()));
    filteredModels = filteredModels.filter(
      m => allowed.has(m.provider.toLowerCase()) || m.tags.some(t => t.toLowerCase() === "open-weight" || t.toLowerCase() === "openweight")
    );
  }
  if (overrides?.excludedProviders?.length) {
    const excluded = new Set(overrides.excludedProviders.map(p => p.toLowerCase()));
    filteredModels = filteredModels.filter(m => !excluded.has(m.provider.toLowerCase()));
  }
  if (overrides?.budgetCeiling != null) {
    constraints.maxEstimatedCostUsd = overrides.budgetCeiling;
  }
  if (overrides?.preferOpenWeight) {
    constraints.requiresOpenWeight = true;
  }

  let eligibilityNotes: string[] = [];
  let { eligible, exclusions } = filterEligibleModels(
    filteredModels,
    constraints,
    interpretation
  );

  if (eligible.length === 0) {
    eligibilityNotes.push(
      "No models passed strict eligibility. Retrying with soft violations included."
    );
    const relaxedConstraints = { ...constraints, maxEstimatedCostUsd: null, maxLatencyTier: null };
    const second = filterEligibleModels(models, relaxedConstraints, interpretation);
    eligible = second.eligible;
    exclusions = second.exclusions;
  }

  const { tracks, perModelFit, profiles, pareto } = computeTracks(
    eligible,
    requirements,
    interpretation,
    tensor
  );

  const uncertainty = computeUncertainty(interpretation, eligible, profiles, tensor);
  const explanation = synthesizeExplanation(profiles, tensor, tracks, uncertainty, eligible);

  if (eligibilityNotes.length) {
    uncertainty.notes.push(...eligibilityNotes);
  }

  const reqVec = requirementsToVector(requirements);
  const sortedProfiles = [...profiles].sort((a, b) => b.alignmentScore - a.alignmentScore);

  const recommendations: ModelRecommendation[] = sortedProfiles
    .slice(0, 5)
    .map((p, i) => {
      const m = eligible.find((x) => x.id === p.modelId)!;
      return toLegacyRecommendation(
        m,
        p.alignmentScore,
        i + 1,
        reqVec,
        i === 0 && tracks.bestAbsolute
          ? tracks.bestAbsolute.whyWon
          : [`Alignment score ${p.alignmentScore}/100`],
        i === 0 && tracks.bestAbsolute
          ? tracks.bestAbsolute.evidenceWarnings
          : []
      );
    });

  const legacyUncertainty: RankingUncertainty = {
    interpretationConfidence: uncertainty.interpretationConfidence,
    rankingConfidence: Math.max(0, Math.min(1,
      0.35 +
        (uncertainty.topScoreGap > 0 ? Math.min(uncertainty.topScoreGap / 18, 0.45) : 0.2) +
        uncertainty.interpretationConfidence * 0.25
    )),
    topScoreGap: uncertainty.topScoreGap,
    isMarginalWinner: uncertainty.isMarginalWinner,
    notes: uncertainty.notes,
  };

  const advisor: AdvisorAnalysis = {
    interpretation,
    interpretationProvenance:
      interpretationProvenance ??
      ({ source: "structural_statistical", note: "Client-only structural interpreter" } satisfies InterpretationProvenance),
    requirements,
    eligibilityExclusions: exclusions,
    eligibilityNotes,
    candidateModelIds: eligible.map((m) => m.id),
    perModelFit,
    tracks: {
      bestAbsolute: tracks.bestAbsolute,
      bestValue: tracks.bestValue,
      bestLowLatency: tracks.bestLowLatency,
      bestOpenSelfHosted: tracks.bestOpenSelfHosted,
    },
    uncertainty: legacyUncertainty,
  };

  const taskClassification = syntheticTaskClassification(interpretation);
  const promptContext = buildPromptContext(interpretation);
  const keyRequirements = extractKeyRequirements(reqVec);

  const resolveModel = (id: string) =>
    eligible.find((m) => m.id === id) ?? models.find((m) => m.id === id);

  const budgetAlt =
    tracks.bestValue &&
    tracks.bestAbsolute &&
    tracks.bestValue.modelId !== tracks.bestAbsolute.modelId
      ? (() => {
          const m = resolveModel(tracks.bestValue!.modelId);
          return m
            ? toLegacyRecommendation(
                m,
                tracks.bestValue!.score,
                0,
                reqVec,
                tracks.bestValue!.whyWon,
                tracks.bestValue!.evidenceWarnings
              )
            : null;
        })()
      : null;

  const openAlt =
    tracks.bestOpenSelfHosted &&
    tracks.bestAbsolute &&
    tracks.bestOpenSelfHosted.modelId !== tracks.bestAbsolute.modelId
      ? (() => {
          const m = resolveModel(tracks.bestOpenSelfHosted!.modelId);
          return m
            ? toLegacyRecommendation(
                m,
                tracks.bestOpenSelfHosted!.score,
                0,
                reqVec,
                tracks.bestOpenSelfHosted!.whyWon,
                tracks.bestOpenSelfHosted!.evidenceWarnings
              )
            : null;
        })()
      : null;

  return {
    id: generateId(),
    prompt,
    promptPreview: prompt.length > 200 ? prompt.substring(0, 200) + "..." : prompt,
    taskClassification,
    requirementVector: reqVec,
    keyRequirements,
    promptContext,
    recommendations,
    confidence: Math.round(legacyUncertainty.rankingConfidence * 100),
    budgetAlternative: budgetAlt,
    openWeightAlternative: openAlt,
    explanationSummary: explanation.summary,
    timestamp: new Date().toISOString(),
    advisor,
  };
}

export function analyzePrompt(
  prompt: string,
  models: ModelProfile[],
  overrides?: RoutingOverrides
): AnalysisResult {
  return analyzeWithInterpretation(
    prompt,
    models,
    interpretPrompt(prompt),
    { source: "structural_statistical", note: "Offline — no /api/advisor/interpret call" },
    overrides
  );
}

/**
 * Server route interprets the prompt (LLM when OPENAI_API_KEY is set, else structural),
 * then runs eligibility + multi-track optimization in the browser.
 */
export async function analyzePromptRemote(
  prompt: string,
  models: ModelProfile[],
  overrides?: RoutingOverrides
): Promise<AnalysisResult> {
  const trimmed = prompt.trim();
  if (!trimmed) throw new Error("Empty prompt");

  const res = await fetch("/api/advisor/interpret", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: trimmed }),
  });
  const data = (await res.json()) as {
    error?: string;
    interpretation?: PromptInterpretation;
    provenance?: InterpretationProvenance;
  };
  if (!res.ok || !data.interpretation) {
    throw new Error(data.error || "Interpret request failed");
  }
  return analyzeWithInterpretation(trimmed, models, data.interpretation, data.provenance, overrides);
}
