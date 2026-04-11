/**
 * Multi-Track Optimization Engine
 *
 * Replaces single-winner selection with multi-objective Pareto analysis.
 * Four named tracks, each with an independent objective function:
 *
 *   1. Absolute Quality  — maximize alignment score (overkill tolerated)
 *   2. Value              — maximize quality/cost Pareto frontier
 *   3. Low Latency        — maximize latency-weighted quality (if latency-sensitive)
 *   4. Open/Self-Hosted   — maximize quality among open-weight (if privacy-sensitive)
 *
 * Each track produces:
 *   - A winner with structured explanation
 *   - Why alternatives lost (per-model, dimension-specific)
 *   - Tradeoffs between top candidates
 *   - Switch hints (when to choose a different track)
 *   - Pareto membership (is the winner actually Pareto-optimal?)
 *   - Operating mode advice (reasoning effort, tool usage, etc.)
 *
 * Uncertainty propagation:
 *   - interpretation confidence
 *   - ranking stability under tensor perturbation
 *   - evidence quality aggregate
 *   - marginal winner detection
 */

import type {
  ModelProfile,
  PromptInterpretation,
  TaskRequirements,
  DemandTensor,
  ModelFitProfile,
  TrackRecommendation,
  OperatingModeAdvice,
  ModelTaskFit,
  CapabilityDimension,
  ParetoMembership,
  UncertaintyReport,
  ExplanationLayer,
  EligibilityVerdict,
} from "@/lib/types";
import {
  profileModel,
  extractParetoFrontier,
  rankingStability,
} from "./scoring";
import { aggregateEvidenceQuality } from "./provenance";

const DIMS: CapabilityDimension[] = [
  "reasoning", "coding", "longContext", "structuredOutput", "multimodal",
  "speed", "costEfficiency", "creativity", "factuality",
  "instructionFollowing", "toolUse", "safetyEnterprise", "conversational",
];

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

// ── Operating Mode Advice ────────────────────────────────────

function buildOperatingMode(
  model: ModelProfile,
  interp: PromptInterpretation,
  req: TaskRequirements
): OperatingModeAdvice {
  const reasoningEffort: OperatingModeAdvice["reasoningEffort"] =
    req.reasoning > 0.72 && model.capabilities.reasoning >= 8
      ? "high"
      : req.reasoning > 0.55
        ? "medium"
        : "low";

  let toolsEnabled: OperatingModeAdvice["toolsEnabled"] = "off";
  if (interp.agentToolDemand >= 0.55) toolsEnabled = "required";
  else if (interp.agentToolDemand >= 0.35 || req.toolUse >= 0.45)
    toolsEnabled = "if_available";

  let structuredOutputMode: OperatingModeAdvice["structuredOutputMode"] = "off";
  if (req.structuredStrictness === "strict_schema")
    structuredOutputMode = "schema_constrained";
  else if (req.structuredOutput >= 0.45 || req.structuredStrictness === "loose_json")
    structuredOutputMode = "json_mode";

  const workflow: OperatingModeAdvice["workflow"] =
    interp.agentToolDemand >= 0.5 || (req.longContext > 0.65 && req.factuality > 0.65)
      ? "multi_step"
      : "single_shot";

  let escalationHint =
    "Escalate to a larger model if outputs fail spot checks or drift on long runs.";
  if (model.tier === "frontier") {
    escalationHint =
      "If cost or latency hurts, step down to a mid-tier model after validating on a slice.";
  }

  return { reasoningEffort, toolsEnabled, structuredOutputMode, workflow, escalationHint };
}

// ── Track Recommendation Builder ─────────────────────────────

function buildTrackRec(
  trackId: TrackRecommendation["trackId"],
  winner: ModelProfile,
  score: number,
  metricDetail: string,
  interp: PromptInterpretation,
  req: TaskRequirements,
  whyWon: string[],
  whyLost: string[],
  tradeoffs: string[],
  switchHints: string[],
  evidenceWarnings: string[]
): TrackRecommendation {
  return {
    trackId,
    modelId: winner.id,
    modelName: winner.displayName,
    provider: winner.provider,
    score,
    metricDetail,
    whyWon,
    whyAlternativesLost: whyLost,
    tradeoffs,
    switchToAlternativeIf: switchHints,
    operatingMode: buildOperatingMode(winner, interp, req),
    evidenceWarnings,
  };
}

// ── Explanation Generation ───────────────────────────────────

function explainWhyWon(
  profile: ModelFitProfile,
  tensor: DemandTensor
): string[] {
  const lines = [
    `Alignment score ${profile.alignmentScore}/100 (demand↔supply fit, not weighted average).`,
  ];

  const strongDims = profile.dimensionFits
    .filter((f) => f.demand >= 0.35 && f.fit >= 0.75)
    .sort((a, b) => b.demand * b.fit - a.demand * a.fit)
    .slice(0, 3);

  for (const f of strongDims) {
    lines.push(
      `Strong on ${f.dimension}: supply ${f.rawSupply}/10 meets demand weight ${f.demand.toFixed(2)} (fit ${f.fit.toFixed(2)}).`
    );
  }

  if (profile.totalOverkillPenalty < 0.05) {
    lines.push("Minimal overkill — capabilities well-matched to task complexity.");
  }

  if (profile.aggregateEvidenceQuality >= 0.8) {
    lines.push("High evidence quality across scored dimensions.");
  }

  return lines;
}

function explainWhyLost(
  winner: ModelFitProfile,
  loser: ModelFitProfile,
  tensor: DemandTensor
): string[] {
  const gap = winner.alignmentScore - loser.alignmentScore;
  const lines = [
    `Trails winner by ${gap.toFixed(1)} alignment points.`,
  ];

  const weakDims = loser.dimensionFits
    .filter((f) => f.underfitPenalty > 0.05 && f.demand >= 0.3)
    .sort((a, b) => b.underfitPenalty - a.underfitPenalty)
    .slice(0, 2);

  for (const f of weakDims) {
    lines.push(
      `Underfit on ${f.dimension}: supply ${f.rawSupply}/10 vs demand ${f.demand.toFixed(2)} (penalty ${f.underfitPenalty.toFixed(3)}).`
    );
  }

  if (loser.totalOverkillPenalty > winner.totalOverkillPenalty + 0.03) {
    lines.push("Higher overkill penalty — paying for unused capability.");
  }

  if (loser.aggregateEvidenceQuality < winner.aggregateEvidenceQuality - 0.1) {
    lines.push("Lower evidence quality reduces effective capability scores.");
  }

  if (gap < 4) {
    lines.push("Margin is small — consider both if you have secondary preferences.");
  }

  return lines;
}

function buildTradeoffs(
  winnerModel: ModelProfile,
  altModel: ModelProfile | null,
  req: TaskRequirements
): string[] {
  const out: string[] = [];
  if (!altModel) return out;
  const pa = (winnerModel.specs.inputPricePer1M ?? 0) + (winnerModel.specs.outputPricePer1M ?? 0) * 0.25;
  const pb = (altModel.specs.inputPricePer1M ?? 0) + (altModel.specs.outputPricePer1M ?? 0) * 0.25;
  if (pb < pa * 0.65)
    out.push(`${altModel.displayName} is materially cheaper at list pricing.`);
  if (altModel.capabilities.speed > winnerModel.capabilities.speed + 1)
    out.push(`${altModel.displayName} is faster on the registry speed tier.`);
  if (req.toolUse > 0.5 && altModel.capabilities.toolUse > winnerModel.capabilities.toolUse)
    out.push(`${altModel.displayName} rates higher on tool-use reliability.`);
  return out;
}

function evidenceWarnings(m: ModelProfile): string[] {
  const w: string[] = [];
  if (m.researchMeta.needsReEvaluation)
    w.push("Registry flags pending re-evaluation — capability scores may be stale.");
  if (m.researchMeta.sourceConfidence < 0.8)
    w.push(`Source confidence ${m.researchMeta.sourceConfidence.toFixed(2)} — rankings are tentative.`);
  return w;
}

// ── Per-Model Fit Summary ────────────────────────────────────

function buildModelFit(profile: ModelFitProfile, tensor: DemandTensor): ModelTaskFit {
  const strengths = profile.dimensionFits
    .filter((f) => f.demand >= 0.4 && f.rawSupply >= 8)
    .sort((a, b) => b.demand * b.fit - a.demand * a.fit)
    .slice(0, 4)
    .map((f) => `${f.dimension} ${f.rawSupply}/10 aligns with demand ${f.demand.toFixed(2)}`);

  const weaknesses = profile.dimensionFits
    .filter((f) => f.demand > 0.35 && f.rawSupply < 7)
    .sort((a, b) => b.underfitPenalty - a.underfitPenalty)
    .slice(0, 4)
    .map(
      (f) => `${f.dimension}: need ~${(f.demand * 10).toFixed(1)} weighted but capability ${f.rawSupply}/10`
    );

  return {
    modelId: profile.modelId,
    modelName: profile.modelName,
    strengthsVsTask:
      strengths.length > 0
        ? strengths
        : ["No dominant dimension win — balanced profile vs this rubric."],
    weaknessesVsTask:
      weaknesses.length > 0
        ? weaknesses
        : ["No critical weak dimensions vs stated task load."],
  };
}

// ── Main: computeTracks ──────────────────────────────────────

export interface TracksResult {
  tracks: {
    bestAbsolute: TrackRecommendation | null;
    bestValue: TrackRecommendation | null;
    bestLowLatency: TrackRecommendation | null;
    bestOpenSelfHosted: TrackRecommendation | null;
  };
  perModelFit: ModelTaskFit[];
  profiles: ModelFitProfile[];
  pareto: ParetoMembership[];
}

export function computeTracks(
  eligible: ModelProfile[],
  req: TaskRequirements,
  interp: PromptInterpretation,
  tensor: DemandTensor
): TracksResult {
  if (!eligible.length) {
    return {
      tracks: { bestAbsolute: null, bestValue: null, bestLowLatency: null, bestOpenSelfHosted: null },
      perModelFit: [],
      profiles: [],
      pareto: [],
    };
  }

  const latencyWeight = clamp01(interp.latencySensitivity * 0.85 + 0.15);
  const profiles = eligible.map((m) =>
    profileModel(m, tensor, interp.estimatedInputTokens, interp.estimatedOutputTokens, latencyWeight)
  );

  const pareto = extractParetoFrontier(profiles, [
    (p) => p.alignmentScore,
    (p) => -p.estimatedCostUsd,
    (p) => {
      const m = eligible.find((x) => x.id === p.modelId);
      return m ? m.capabilities.speed : 0;
    },
  ]);

  const sortedByAlignment = [...profiles].sort((a, b) => b.alignmentScore - a.alignmentScore);
  const sortedByValue = [...profiles].sort((a, b) => b.valueScore - a.valueScore);
  const sortedByLatency = [...profiles].sort((a, b) => b.latencyAdjustedScore - a.latencyAdjustedScore);

  const openPool = profiles.filter((p) => {
    const m = eligible.find((x) => x.id === p.modelId);
    return m && m.tags.some((t) => t.toLowerCase() === "open-weight");
  });
  openPool.sort((a, b) => b.alignmentScore - a.alignmentScore);

  const resolve = (id: string) => eligible.find((m) => m.id === id)!;

  const bestAbs = sortedByAlignment[0];
  const bestAbsModel = resolve(bestAbs.modelId);
  const runnerAbs = sortedByAlignment[1] ?? null;

  const bestVal = sortedByValue[0];
  const bestValModel = resolve(bestVal.modelId);

  const bestLat = sortedByLatency[0];
  const bestLatModel = resolve(bestLat.modelId);

  const bestOpen = openPool[0] ?? null;

  const tracks: TracksResult["tracks"] = {
    bestAbsolute: buildTrackRec(
      "absolute_quality",
      bestAbsModel,
      bestAbs.alignmentScore,
      `Alignment ${bestAbs.alignmentScore}/100 | Raw quality ${bestAbs.rawQualityScore}/100 | Overkill penalty ${bestAbs.totalOverkillPenalty.toFixed(3)}`,
      interp,
      req,
      explainWhyWon(bestAbs, tensor),
      runnerAbs ? explainWhyLost(bestAbs, runnerAbs, tensor) : ["No other eligible model."],
      buildTradeoffs(bestAbsModel, runnerAbs ? resolve(runnerAbs.modelId) : null, req),
      runnerAbs ? [`${resolve(runnerAbs.modelId).displayName} is competitive if you need lower cost.`] : [],
      evidenceWarnings(bestAbsModel)
    ),

    bestValue: buildTrackRec(
      "value",
      bestValModel,
      Math.round(bestVal.valueScore * 100) / 100,
      `Value index ${bestVal.valueScore.toFixed(2)} (alignment ${bestVal.alignmentScore}/100, est. $${bestVal.estimatedCostUsd.toFixed(4)}/req)`,
      interp,
      req,
      [
        `Best quality per dollar for this prompt (~$${bestVal.estimatedCostUsd.toFixed(4)}).`,
        `Alignment score ${bestVal.alignmentScore}/100 vs top ${bestAbs.alignmentScore}/100.`,
      ],
      bestVal.modelId === bestAbs.modelId
        ? ["Same as absolute winner — task is already Pareto-friendly on cost."]
        : [`${bestAbsModel.displayName} scores ${bestAbs.alignmentScore} but costs more.`],
      buildTradeoffs(bestValModel, bestAbsModel, req),
      [`If output quality misses spec, switch to ${bestAbsModel.displayName}.`],
      evidenceWarnings(bestValModel)
    ),

    bestLowLatency:
      interp.latencySensitivity >= 0.35
        ? buildTrackRec(
            "low_latency",
            bestLatModel,
            Math.round(bestLat.latencyAdjustedScore * 10) / 10,
            `Latency-weighted ${Math.round(bestLat.latencyAdjustedScore * 10) / 10} (speed weight ${latencyWeight.toFixed(2)})`,
            interp,
            req,
            [
              `Balances latency priority with speed tier ${bestLatModel.capabilities.speed}/10.`,
              `Alignment component ${bestLat.alignmentScore}/100.`,
            ],
            bestLat.modelId === bestAbs.modelId
              ? ["Same model wins both — no faster alternative without quality loss."]
              : [`${bestAbsModel.displayName} has higher alignment (${bestAbs.alignmentScore}) but slower.`],
            buildTradeoffs(bestLatModel, bestAbsModel, req),
            ["Switch to absolute winner if answers are too shallow or error-prone."],
            evidenceWarnings(bestLatModel)
          )
        : null,

    bestOpenSelfHosted:
      interp.privacySelfHost >= 0.35 && bestOpen
        ? buildTrackRec(
            "open_self_hosted",
            resolve(bestOpen.modelId),
            bestOpen.alignmentScore,
            `Best open-weight alignment ${bestOpen.alignmentScore}/100`,
            interp,
            req,
            ["Highest alignment score among open-weight models in registry."],
            openPool.length < eligible.length
              ? ["Closed API models excluded by privacy/self-host preference."]
              : ["All candidates were open-weight."],
            buildTradeoffs(resolve(bestOpen.modelId), bestAbsModel, req),
            ["If hosting ops or VRAM limits bite, revisit closed APIs with a data-processing agreement."],
            evidenceWarnings(resolve(bestOpen.modelId))
          )
        : null,
  };

  const perModelFit = profiles.slice(0, 8).map((p) => buildModelFit(p, tensor));

  return { tracks, perModelFit, profiles, pareto };
}

// ── Uncertainty Quantification ───────────────────────────────

export function computeUncertainty(
  interp: PromptInterpretation,
  eligible: ModelProfile[],
  profiles: ModelFitProfile[],
  tensor: DemandTensor
): UncertaintyReport {
  const sorted = [...profiles].sort((a, b) => b.alignmentScore - a.alignmentScore);
  const topScore = sorted[0]?.alignmentScore ?? 0;
  const secondScore = sorted[1]?.alignmentScore ?? null;
  const topGap = secondScore !== null ? topScore - secondScore : topScore;
  const isMarginal = secondScore !== null && topGap < 4;

  const perturbMag = 1 - interp.interpretationConfidence;
  const stability = eligible.length >= 2
    ? rankingStability(
        eligible,
        tensor,
        interp.estimatedInputTokens,
        interp.estimatedOutputTokens,
        perturbMag
      )
    : 1;

  const avgEvidence =
    profiles.length > 0
      ? profiles.reduce((s, p) => s + p.aggregateEvidenceQuality, 0) / profiles.length
      : 0;

  const rankingConfidence = clamp01(
    0.35 +
      (secondScore !== null ? Math.min(topGap / 18, 0.45) : 0.2) +
      interp.interpretationConfidence * 0.25
  );

  let recommendedAction: UncertaintyReport["recommendedAction"] = "trust";
  if (isMarginal || stability < 0.5 || interp.interpretationConfidence < 0.45) {
    recommendedAction = "validate";
  }
  if (stability < 0.3 && interp.interpretationConfidence < 0.4) {
    recommendedAction = "explore_alternatives";
  }

  const notes: string[] = [];
  if (isMarginal) {
    notes.push("Top models are within noise margin — prefer A/B validation on real prompts.");
  }
  if (stability < 0.6) {
    notes.push(`Ranking stability ${(stability * 100).toFixed(0)}% under interpretation noise — results may shift.`);
  }
  if (avgEvidence < 0.65) {
    notes.push("Average evidence quality is moderate — treat capability comparisons as estimates.");
  }
  if (interp.method === "structural_statistical") {
    notes.push("Structural/statistical interpreter — LLM-based interpreter recommended for production.");
  }

  return {
    interpretationConfidence: interp.interpretationConfidence,
    rankingStability: stability,
    topScoreGap: Math.round(topGap * 10) / 10,
    isMarginalWinner: isMarginal,
    aggregateEvidenceQuality: Math.round(avgEvidence * 100) / 100,
    recommendedAction,
    notes,
  };
}

// ── Explanation Synthesis ────────────────────────────────────

export function synthesizeExplanation(
  profiles: ModelFitProfile[],
  tensor: DemandTensor,
  tracks: TracksResult["tracks"],
  uncertainty: UncertaintyReport,
  eligible: ModelProfile[]
): ExplanationLayer {
  const abs = tracks.bestAbsolute;
  const sorted = [...profiles].sort((a, b) => b.alignmentScore - a.alignmentScore);

  let summary: string;
  if (!abs) {
    summary = "No eligible models after constraint gates — relax constraints or extend registry.";
  } else {
    summary = `**${abs.modelName}** leads with ${abs.score}/100 alignment.`;
    if (uncertainty.isMarginalWinner) {
      summary += " Top candidates are **close** — validate on your data.";
    }
    if (tracks.bestValue && tracks.bestValue.modelId !== abs.modelId) {
      summary += ` **Value pick:** ${tracks.bestValue.modelName}.`;
    }
  }

  const whyWinnerWon = abs?.whyWon ?? [];

  const whyOthersLost: Record<string, string[]> = {};
  if (sorted.length >= 2 && sorted[0]) {
    const winner = sorted[0];
    for (const loser of sorted.slice(1, 5)) {
      whyOthersLost[loser.modelId] = explainWhyLost(winner, loser, tensor);
    }
  }

  const tradeoffs = abs
    ? buildTradeoffs(
        eligible.find((m) => m.id === abs.modelId)!,
        sorted[1] ? eligible.find((m) => m.id === sorted[1].modelId) ?? null : null,
        {} as TaskRequirements
      )
    : [];

  const whenToSwitch: string[] = [];
  if (tracks.bestValue && abs && tracks.bestValue.modelId !== abs.modelId) {
    whenToSwitch.push(`Switch to ${tracks.bestValue.modelName} if cost is the primary concern.`);
  }
  if (tracks.bestLowLatency && abs && tracks.bestLowLatency.modelId !== abs.modelId) {
    whenToSwitch.push(`Switch to ${tracks.bestLowLatency.modelName} if latency is critical.`);
  }
  if (tracks.bestOpenSelfHosted && abs && tracks.bestOpenSelfHosted.modelId !== abs.modelId) {
    whenToSwitch.push(`Switch to ${tracks.bestOpenSelfHosted.modelName} for self-hosted deployment.`);
  }

  return { summary, whyWinnerWon, whyOthersLost, tradeoffs, whenToSwitch };
}
