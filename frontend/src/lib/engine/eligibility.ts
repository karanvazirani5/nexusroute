/**
 * Constraint Satisfaction Layer
 *
 * Replaces binary pass/fail filtering with structured constraint checks.
 * Each model gets a list of ConstraintCheck results with severity levels:
 *   - hard_fail:       Model CANNOT serve this prompt (modality missing, context too small)
 *   - soft_violation:  Model CAN serve but violates a preference (cost ceiling, speed tier)
 *   - pass:            Constraint satisfied
 *
 * A model is eligible if it has zero hard_fail checks.
 * Soft violations are surfaced in explanations and can influence tie-breaking.
 */

import type {
  ModelProfile,
  HardConstraints,
  PromptInterpretation,
  ConstraintCheck,
  ConstraintSeverity,
  EligibilityVerdict,
  EligibilityExclusion,
} from "@/lib/types";

function check(
  constraint: string,
  severity: ConstraintSeverity,
  reason: string
): ConstraintCheck {
  return { constraint, severity, reason };
}

function modelSupportsImageGeneration(m: ModelProfile): boolean {
  return m.tags.some(
    (t) => t.toLowerCase().includes("image-gen") || t.toLowerCase() === "image-generation"
  );
}

function modelIsOpenWeight(m: ModelProfile): boolean {
  return m.tags.some(
    (t) => t.toLowerCase() === "open-weight" || t.toLowerCase() === "openweight"
  );
}

function estimatedRequestCostUsd(
  m: ModelProfile,
  inTok: number,
  outTok: number
): number {
  return (
    (inTok / 1e6) * (m.specs.inputPricePer1M ?? 0) +
    (outTok / 1e6) * (m.specs.outputPricePer1M ?? 0)
  );
}

/**
 * Evaluate all hard and soft constraints for a single model.
 * Returns a structured verdict with per-constraint detail.
 */
export function evaluateConstraints(
  model: ModelProfile,
  constraints: HardConstraints,
  interp: PromptInterpretation
): EligibilityVerdict {
  const checks: ConstraintCheck[] = [];

  if (!model.isActive) {
    checks.push(check("active", "hard_fail", "Model is inactive in registry"));
  }

  if (model.tags.some((t) => t.toLowerCase() === "deprecated")) {
    checks.push(check("deprecated", "hard_fail", "Model tagged as deprecated"));
  }

  if (constraints.requiresVision && !model.specs.supportsVision) {
    checks.push(
      check("vision", "hard_fail", "Vision required; model lacks image input support")
    );
  }

  if (constraints.requiresAudio && !model.specs.supportsAudio) {
    checks.push(
      check("audio", "hard_fail", "Audio processing required; not supported")
    );
  }

  if (constraints.requiresVideo && !model.specs.supportsVideo) {
    checks.push(
      check("video", "hard_fail", "Video processing required; not supported")
    );
  }

  if (constraints.requiresImageGeneration && !modelSupportsImageGeneration(model)) {
    checks.push(
      check("image_gen", "hard_fail", "Image generation required; capability not present")
    );
  }

  if (constraints.requiresFunctionCalling && !model.specs.supportsFunctionCalling) {
    checks.push(
      check("function_calling", "hard_fail", "Tool/agent use requires function calling; not supported")
    );
  }

  const minCtx = constraints.minContextWindow;
  if (minCtx > model.specs.contextWindow * 0.92) {
    checks.push(
      check(
        "context_window",
        "hard_fail",
        `Estimated ${minCtx} tokens exceed safe window (~${Math.round(model.specs.contextWindow * 0.92)})`
      )
    );
  }

  if (constraints.requiresOpenWeight && !modelIsOpenWeight(model)) {
    checks.push(
      check("privacy_open_weight", "hard_fail", "Self-host/privacy constraint; model is not open-weight")
    );
  }

  if (
    constraints.requiresJsonMode &&
    !model.specs.supportsJsonMode &&
    model.capabilities.structuredOutput < 5.5
  ) {
    checks.push(
      check(
        "structured_output",
        "hard_fail",
        "Strict structured output required; JSON mode not supported and structured output capability below threshold"
      )
    );
  }

  if (
    interp.enterpriseReliability >= 0.72 &&
    (model.researchMeta.needsReEvaluation || model.researchMeta.sourceConfidence < 0.75)
  ) {
    checks.push(
      check(
        "enterprise_evidence",
        "hard_fail",
        "Enterprise-grade reliability requested; registry evidence stale or low-confidence"
      )
    );
  }

  // ── Soft violations (preferences, not hard requirements) ──

  if (constraints.maxEstimatedCostUsd !== null) {
    const cost = estimatedRequestCostUsd(
      model,
      interp.estimatedInputTokens,
      interp.estimatedOutputTokens
    );
    if (cost > constraints.maxEstimatedCostUsd) {
      checks.push(
        check(
          "cost_ceiling",
          "soft_violation",
          `Estimated cost $${cost.toFixed(4)} exceeds budget ceiling $${constraints.maxEstimatedCostUsd}`
        )
      );
    }
  }

  if (constraints.maxLatencyTier !== null) {
    if (model.capabilities.speed < constraints.maxLatencyTier) {
      checks.push(
        check(
          "latency_tier",
          "soft_violation",
          `Speed tier ${model.capabilities.speed}/10 below latency preference (${constraints.maxLatencyTier})`
        )
      );
    }
  }

  if (
    constraints.structuredStrictness === "strict_schema" &&
    model.specs.supportsJsonMode &&
    model.capabilities.structuredOutput < 7
  ) {
    checks.push(
      check(
        "structured_quality",
        "soft_violation",
        "JSON mode supported but structured output quality below ideal for strict schema work"
      )
    );
  }

  const hasHardFail = checks.some((c) => c.severity === "hard_fail");
  const softCount = checks.filter((c) => c.severity === "soft_violation").length;
  const satisfaction = hasHardFail
    ? 0
    : Math.max(0, 1 - softCount * 0.15);

  return {
    modelId: model.id,
    modelName: model.displayName,
    eligible: !hasHardFail,
    checks,
    satisfactionScore: Math.round(satisfaction * 100) / 100,
  };
}

// ── Batch Filtering ──────────────────────────────────────────

export interface FilterResult {
  eligible: ModelProfile[];
  verdicts: EligibilityVerdict[];
  exclusions: EligibilityExclusion[];
}

/**
 * Filter a model pool through constraint satisfaction.
 * Returns eligible models, full verdicts, and legacy-compatible exclusions.
 *
 * When includeSoftViolations is true, models with only soft violations
 * are included in the eligible set (but their violations are still tracked).
 */
export function filterEligibleModels(
  models: ModelProfile[],
  constraints: HardConstraints,
  interp: PromptInterpretation,
  options: { includeSoftViolations?: boolean } = {}
): FilterResult {
  const includeSoft = options.includeSoftViolations ?? true;

  const verdicts: EligibilityVerdict[] = [];
  const eligible: ModelProfile[] = [];
  const exclusions: EligibilityExclusion[] = [];

  for (const m of models) {
    const verdict = evaluateConstraints(m, constraints, interp);
    verdicts.push(verdict);

    const hasHardFail = verdict.checks.some((c) => c.severity === "hard_fail");
    const hasSoftOnly = !hasHardFail && verdict.checks.some((c) => c.severity === "soft_violation");

    if (hasHardFail) {
      exclusions.push({
        modelId: m.id,
        modelName: m.displayName,
        reasons: verdict.checks
          .filter((c) => c.severity === "hard_fail")
          .map((c) => c.reason),
      });
    } else if (hasSoftOnly && !includeSoft) {
      exclusions.push({
        modelId: m.id,
        modelName: m.displayName,
        reasons: verdict.checks
          .filter((c) => c.severity === "soft_violation")
          .map((c) => `[soft] ${c.reason}`),
      });
    } else {
      eligible.push(m);
    }
  }

  return { eligible, verdicts, exclusions };
}
