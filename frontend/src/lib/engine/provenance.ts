/**
 * Provenance & Evidence Engine
 *
 * Maps raw model metadata into per-capability evidence assessments.
 * Nothing is hardcoded per dimension — evidence type and confidence
 * are derived from the model's own researchMeta, benchmarks, and tags.
 */

import type {
  ModelProfile,
  CapabilityDimension,
  EvidenceLevel,
  EvidencedCapability,
} from "@/lib/types";

const BENCHMARK_BACKED_DIMS: Partial<
  Record<CapabilityDimension, (m: ModelProfile) => string | undefined>
> = {
  reasoning: (m) =>
    m.benchmarks.mmluScore != null || m.benchmarks.gsm8kScore != null
      ? `MMLU ${m.benchmarks.mmluScore ?? "?"}%, GSM8K ${m.benchmarks.gsm8kScore ?? "?"}`
      : undefined,
  coding: (m) =>
    m.benchmarks.humanEvalScore != null
      ? `HumanEval ${m.benchmarks.humanEvalScore}%`
      : undefined,
};

const SPEC_BACKED_DIMS: Partial<
  Record<CapabilityDimension, (m: ModelProfile) => boolean>
> = {
  multimodal: (m) => m.specs.supportsVision || m.specs.supportsAudio || m.specs.supportsVideo,
  structuredOutput: (m) => m.specs.supportsJsonMode,
  toolUse: (m) => m.specs.supportsFunctionCalling,
  longContext: (m) => m.specs.contextWindow > 0,
  speed: () => true,
  costEfficiency: () => true,
};

function capabilityEvidenceFromModel(
  model: ModelProfile,
  dim: CapabilityDimension
): { evidence: EvidenceLevel; detail?: string } {
  const benchFn = BENCHMARK_BACKED_DIMS[dim];
  if (benchFn) {
    const detail = benchFn(model);
    if (detail) return { evidence: "benchmark", detail };
  }

  const specFn = SPEC_BACKED_DIMS[dim];
  if (specFn && specFn(model)) {
    if (dim === "speed" || dim === "costEfficiency") {
      return { evidence: "inferred", detail: "Derived from pricing/latency metadata" };
    }
    return { evidence: "observed", detail: "Verified via API spec flags" };
  }

  if (model.researchMeta.sources.length >= 2 && model.researchMeta.sourceConfidence >= 0.8) {
    return { evidence: "observed", detail: `${model.researchMeta.sources.length} sources` };
  }

  if (model.researchMeta.sourceConfidence >= 0.6) {
    return { evidence: "inferred" };
  }

  return { evidence: "unknown" };
}

const EVIDENCE_DISCOUNT: Record<EvidenceLevel, number> = {
  official_docs: 0.0,
  benchmark: 0.02,
  observed: 0.06,
  inferred: 0.14,
  unknown: 0.28,
};

function stalePenalty(model: ModelProfile): number {
  const days =
    (Date.now() - new Date(model.researchMeta.lastEvaluatedDate).getTime()) /
    (86400_000);
  if (days > 180) return 0.18;
  if (days > 120) return 0.10;
  if (days > 60) return 0.04;
  return 0;
}

/**
 * Trust multiplier applied to the model's entire capability vector.
 * Combines source confidence, staleness, and re-evaluation flags.
 */
export function modelTrustMultiplier(model: ModelProfile): number {
  const meta = model.researchMeta;
  let t = meta.sourceConfidence;
  if (meta.needsReEvaluation) t *= 0.78;
  t -= stalePenalty(model);
  return Math.max(0.30, Math.min(1, t));
}

/**
 * Returns the evidence-weighted effective capability for a single dimension.
 * This is the number that enters the scoring engine — never the raw value.
 */
export function evidencedCapability(
  model: ModelProfile,
  dim: CapabilityDimension
): EvidencedCapability {
  const raw = model.capabilities[dim];
  const { evidence, detail } = capabilityEvidenceFromModel(model, dim);
  const discount = EVIDENCE_DISCOUNT[evidence];
  const stale = stalePenalty(model);
  const trust = modelTrustMultiplier(model);

  const confidence = Math.max(0, Math.min(1, 1 - discount - stale));
  const effective = raw * trust * (1 - discount);

  return {
    value: Math.max(0, Math.min(10, effective)),
    confidence,
    evidence,
    detail,
  };
}

/**
 * Aggregate evidence quality across all dimensions for a model.
 * Used in uncertainty propagation.
 */
export function aggregateEvidenceQuality(model: ModelProfile): number {
  const dims: CapabilityDimension[] = [
    "reasoning", "coding", "longContext", "structuredOutput", "multimodal",
    "speed", "costEfficiency", "creativity", "factuality",
    "instructionFollowing", "toolUse", "safetyEnterprise", "conversational",
  ];
  let sum = 0;
  for (const d of dims) {
    sum += evidencedCapability(model, d).confidence;
  }
  return sum / dims.length;
}
