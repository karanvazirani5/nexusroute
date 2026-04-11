/**
 * Constraint-Gated Multi-Objective Scoring Engine
 *
 * Core innovation: demand–supply ALIGNMENT scoring, not weighted averages.
 *
 * Traditional approach:
 *   score = Σ(weight × capability) / Σ(weight)
 *   → linear, no overkill detection, no evidence weighting
 *
 * This engine:
 *   1. Converts raw capabilities to evidence-weighted effective capabilities
 *   2. Computes per-dimension FIT (not contribution) with:
 *      - Super-linear underfit penalty  (deficit^1.5 × demand importance)
 *      - Cost-proportional overkill penalty (excess × cost tier when demand is low)
 *   3. Aggregates via demand-weighted alignment, not simple average
 *   4. Extracts Pareto frontier across (quality, cost, latency) objectives
 *   5. Measures ranking stability under interpretation perturbation
 */

import type {
  ModelProfile,
  CapabilityDimension,
  DemandTensor,
  DemandAxis,
  DimensionFit,
  ModelFitProfile,
  CostTier,
  ParetoMembership,
} from "@/lib/types";
import { evidencedCapability, aggregateEvidenceQuality } from "./provenance";

const ALL_DIMS: CapabilityDimension[] = [
  "reasoning", "coding", "longContext", "structuredOutput", "multimodal",
  "speed", "costEfficiency", "creativity", "factuality",
  "instructionFollowing", "toolUse", "safetyEnterprise", "conversational",
];

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Total demand weight below this threshold triggers the global overkill
 * penalty. A trivial prompt ("hello") has total weight ~0.5; a substantial
 * coding prompt has ~2.5+. Set low enough to not penalize real tasks.
 */
const TRIVIAL_DEMAND_CEILING = 1.5;

// ── Cost Tier Classification ─────────────────────────────────

const COST_TIER_OVERKILL_MULTIPLIER: Record<CostTier, number> = {
  free: 0.0,
  budget: 0.08,
  mid: 0.18,
  premium: 0.32,
  frontier: 0.45,
};

export function classifyCostTier(model: ModelProfile): CostTier {
  const blended =
    (model.specs.inputPricePer1M ?? 0) +
    (model.specs.outputPricePer1M ?? 0) * 0.35;
  if (blended <= 0) return "free";
  if (blended < 0.5) return "budget";
  if (blended < 3.0) return "mid";
  if (blended < 10.0) return "premium";
  return "frontier";
}

function estimatedCostUsd(
  model: ModelProfile,
  inTok: number,
  outTok: number
): number {
  return (
    (inTok / 1e6) * (model.specs.inputPricePer1M ?? 0) +
    (outTok / 1e6) * (model.specs.outputPricePer1M ?? 0)
  );
}

// ── Per-Dimension Fit ────────────────────────────────────────

/**
 * Computes how well a model's capability on one dimension aligns with
 * what the prompt demands on that dimension. Returns a DimensionFit
 * with separate underfit and overkill penalties.
 *
 * The fit is NOT a weighted average — it is an alignment measure:
 * - Perfect match (supply ≈ demand ideal range): fit → 1.0
 * - Underfit (supply < demand minimum): super-linear penalty
 * - Overkill (supply >> demand ideal, demand is low): cost-proportional penalty
 */
export function computeDimensionFit(
  dim: CapabilityDimension,
  axis: DemandAxis,
  model: ModelProfile,
  costTier: CostTier
): DimensionFit {
  const ev = evidencedCapability(model, dim);
  const rawSupply = model.capabilities[dim];
  const effectiveSupply = ev.value;

  const supplyNorm = effectiveSupply / 10;
  const demandWeight = axis.weight;
  const demandMin = axis.minimum / 10;
  const demandIdeal = axis.ideal / 10;

  let underfitPenalty = 0;
  let overkillPenalty = 0;

  if (supplyNorm < demandMin && demandWeight > 0.1) {
    const deficit = demandMin - supplyNorm;
    underfitPenalty = demandWeight * Math.pow(deficit, 1.5) * 2.2;
  } else if (supplyNorm < demandWeight && demandWeight > 0.15) {
    const softDeficit = demandWeight - supplyNorm;
    if (softDeficit > 0) {
      underfitPenalty = demandWeight * Math.pow(softDeficit, 1.3) * 0.8;
    }
  }

  if (demandWeight < 0.25 && supplyNorm > demandIdeal + 0.15) {
    const excess = supplyNorm - demandIdeal;
    const overkillRate = COST_TIER_OVERKILL_MULTIPLIER[costTier];
    overkillPenalty = excess * overkillRate * (1 - demandWeight);
  }

  const baseFit = demandWeight > 0.05
    ? Math.min(supplyNorm / Math.max(demandWeight, 0.01), 1.0)
    : 1.0;

  const fit = clamp(baseFit - underfitPenalty - overkillPenalty, 0, 1);

  return {
    dimension: dim,
    demand: demandWeight,
    rawSupply,
    effectiveSupply,
    fit,
    underfitPenalty: Math.round(underfitPenalty * 1000) / 1000,
    overkillPenalty: Math.round(overkillPenalty * 1000) / 1000,
    evidenceQuality: ev.confidence,
  };
}

// ── Aggregate Alignment Score ────────────────────────────────

/**
 * The alignment score measures how well a model's capability profile
 * matches the prompt's demand tensor. It is NOT a weighted average of
 * capability scores. It is a demand-weighted aggregate of per-dimension
 * FIT values, where fit already encodes underfit and overkill penalties.
 *
 * Returns 0–100.
 */
export function computeAlignmentScore(
  model: ModelProfile,
  tensor: DemandTensor,
  costTier: CostTier
): { score: number; fits: DimensionFit[] } {
  const fits: DimensionFit[] = [];
  let weightedFitSum = 0;
  let totalWeight = 0;

  for (const dim of ALL_DIMS) {
    const axis = tensor[dim];
    if (axis.weight < 0.03) continue;

    const fit = computeDimensionFit(dim, axis, model, costTier);
    fits.push(fit);

    weightedFitSum += axis.weight * fit.fit;
    totalWeight += axis.weight;
  }

  let raw = totalWeight > 0 ? (weightedFitSum / totalWeight) * 100 : 50;

  /**
   * Global overkill penalty: when total demand is very low (trivial prompt),
   * expensive models should not score the same as cheap ones. This prevents
   * flagship-defaulting on "hello" or "what is 2+2?".
   *
   * The penalty is proportional to cost tier and inversely proportional to
   * total demand weight — the less the prompt asks for, the more wasteful
   * an expensive model is.
   */
  const totalDemandWeight = ALL_DIMS.reduce((s, d) => s + tensor[d].weight, 0);
  if (totalDemandWeight < TRIVIAL_DEMAND_CEILING) {
    const demandScarcity = 1 - totalDemandWeight / TRIVIAL_DEMAND_CEILING;
    const costPenalty = COST_TIER_OVERKILL_MULTIPLIER[costTier] * demandScarcity * 55;
    raw = Math.max(0, raw - costPenalty);
  }

  return { score: Math.round(raw * 10) / 10, fits };
}

/**
 * Raw quality score — ignores overkill, measures pure capability coverage
 * against the demand tensor. Used as a secondary signal for the absolute
 * quality track where overkill is acceptable.
 */
export function computeRawQualityScore(
  model: ModelProfile,
  tensor: DemandTensor
): number {
  let num = 0;
  let den = 0;
  for (const dim of ALL_DIMS) {
    const axis = tensor[dim];
    if (axis.weight < 0.03) continue;
    const ev = evidencedCapability(model, dim);
    num += axis.weight * (ev.value / 10);
    den += axis.weight;
  }
  return den > 0 ? Math.round((num / den) * 1000) / 10 : 50;
}

// ── Value Score ──────────────────────────────────────────────

/**
 * Quality per dollar. Uses a nonlinear cost transform so that
 * free/very-cheap models don't get infinite value scores.
 */
export function computeValueScore(
  alignmentScore: number,
  estimatedCost: number
): number {
  const costFactor = 1 + estimatedCost * 400;
  return Math.round((alignmentScore / Math.pow(costFactor, 0.45)) * 100) / 100;
}

// ── Full Model Fit Profile ───────────────────────────────────

export function profileModel(
  model: ModelProfile,
  tensor: DemandTensor,
  inTok: number,
  outTok: number,
  latencyWeight: number
): ModelFitProfile {
  const costTier = classifyCostTier(model);
  const cost = estimatedCostUsd(model, inTok, outTok);
  const { score: alignmentScore, fits } = computeAlignmentScore(model, tensor, costTier);
  const rawQuality = computeRawQualityScore(model, tensor);
  const value = computeValueScore(alignmentScore, cost);

  const speedNorm = model.capabilities.speed / 10;
  const latAdj = alignmentScore * (1 - latencyWeight) + speedNorm * 100 * latencyWeight;

  const totalUnderfit = fits.reduce((s, f) => s + f.underfitPenalty, 0);
  let totalOverkill = fits.reduce((s, f) => s + f.overkillPenalty, 0);

  const totalDemand = ALL_DIMS.reduce((s, d) => s + tensor[d].weight, 0);
  if (totalDemand < TRIVIAL_DEMAND_CEILING) {
    const scarcity = 1 - totalDemand / TRIVIAL_DEMAND_CEILING;
    totalOverkill += COST_TIER_OVERKILL_MULTIPLIER[costTier] * scarcity;
  }

  const evidenceAgg = aggregateEvidenceQuality(model);

  return {
    modelId: model.id,
    modelName: model.displayName,
    provider: model.provider,
    alignmentScore,
    rawQualityScore: rawQuality,
    valueScore: value,
    latencyAdjustedScore: Math.round(latAdj * 10) / 10,
    dimensionFits: fits,
    aggregateEvidenceQuality: Math.round(evidenceAgg * 100) / 100,
    totalUnderfitPenalty: Math.round(totalUnderfit * 1000) / 1000,
    totalOverkillPenalty: Math.round(totalOverkill * 1000) / 1000,
    estimatedCostUsd: Math.round(cost * 10000) / 10000,
    costTier,
  };
}

// ── Pareto Frontier ──────────────────────────────────────────

type ObjectiveFn = (p: ModelFitProfile) => number;

function dominates(a: number[], b: number[]): boolean {
  let anyStrict = false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] < b[i]) return false;
    if (a[i] > b[i]) anyStrict = true;
  }
  return anyStrict;
}

/**
 * Extracts the Pareto-optimal set from a list of model profiles
 * given a set of objective functions (all maximized).
 */
export function extractParetoFrontier(
  profiles: ModelFitProfile[],
  objectives: ObjectiveFn[]
): ParetoMembership[] {
  const vectors = profiles.map((p) => objectives.map((fn) => fn(p)));
  const result: ParetoMembership[] = profiles.map((p) => ({
    modelId: p.modelId,
    paretoOptimal: true,
    dominatedBy: [],
    dominates: [],
  }));

  for (let i = 0; i < profiles.length; i++) {
    for (let j = 0; j < profiles.length; j++) {
      if (i === j) continue;
      if (dominates(vectors[j], vectors[i])) {
        result[i].paretoOptimal = false;
        result[i].dominatedBy.push(profiles[j].modelId);
        result[j].dominates.push(profiles[i].modelId);
      }
    }
  }

  return result;
}

// ── Ranking Stability Under Perturbation ─────────────────────

/**
 * Measures how stable the top-k ranking is when the demand tensor
 * is perturbed by noise proportional to interpretation uncertainty.
 * Returns 0–1 where 1 = perfectly stable rankings.
 */
export function rankingStability(
  models: ModelProfile[],
  tensor: DemandTensor,
  inTok: number,
  outTok: number,
  perturbMagnitude: number,
  iterations: number = 8
): number {
  if (models.length < 2) return 1;

  const baseline = models
    .map((m) => profileModel(m, tensor, inTok, outTok, 0))
    .sort((a, b) => b.alignmentScore - a.alignmentScore)
    .slice(0, 5)
    .map((p) => p.modelId);

  let agreements = 0;
  let seed = 42;
  const pseudoRandom = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed / 0x7fffffff) * 2 - 1;
  };

  for (let iter = 0; iter < iterations; iter++) {
    const perturbed = {} as DemandTensor;
    for (const dim of ALL_DIMS) {
      const axis = tensor[dim];
      const noise = pseudoRandom() * perturbMagnitude;
      perturbed[dim] = {
        weight: clamp(axis.weight + noise * 0.15, 0, 1),
        minimum: axis.minimum,
        ideal: axis.ideal,
      };
    }

    const perturbedRank = models
      .map((m) => profileModel(m, perturbed, inTok, outTok, 0))
      .sort((a, b) => b.alignmentScore - a.alignmentScore)
      .slice(0, 5)
      .map((p) => p.modelId);

    let overlap = 0;
    for (let k = 0; k < Math.min(baseline.length, perturbedRank.length); k++) {
      if (baseline[k] === perturbedRank[k]) overlap++;
    }
    agreements += overlap / Math.max(baseline.length, 1);
  }

  return Math.round((agreements / iterations) * 100) / 100;
}
