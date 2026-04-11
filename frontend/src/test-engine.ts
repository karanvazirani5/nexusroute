/**
 * Quick integration test for the redesigned Model Advisor engine.
 * Run from frontend/: npx tsx --tsconfig tsconfig.json src/test-engine.mts
 */

import { ALL_MODELS } from "@/lib/data/models";
import { interpretPrompt, buildDemandTensor, buildHardConstraints, interpretationToRequirements } from "@/lib/engine/interpret";
import { filterEligibleModels } from "@/lib/engine/eligibility";
import { profileModel, extractParetoFrontier } from "@/lib/engine/scoring";
import { computeTracks, computeUncertainty, synthesizeExplanation } from "@/lib/engine/optimize-tracks";
import { analyzePrompt } from "@/lib/engine/analyzer";
import { runEvalSuite } from "@/lib/engine/eval";

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log(`\n=== MODEL ADVISOR ENGINE TEST ===\n`);
console.log(`Models in registry: ${ALL_MODELS.length}\n`);

// ── Test 1: Interpretation ──────────────────────────────────

console.log("── Test 1: Prompt Interpretation ──");
{
  const interp = interpretPrompt("Implement a distributed rate limiter in Go with Redis backing store and Lua atomic operations");
  assert("codingDemand > 0.15", interp.codingDemand > 0.15, `got ${interp.codingDemand.toFixed(3)}`);
  assert("interpretationConfidence > 0.3", interp.interpretationConfidence > 0.3, `got ${interp.interpretationConfidence.toFixed(3)}`);
  assert("method is structural_statistical", interp.method === "structural_statistical");

  const interp2 = interpretPrompt("hello");
  assert("short prompt has low confidence", interp2.interpretationConfidence < 0.6, `got ${interp2.interpretationConfidence.toFixed(3)}`);
  assert("short prompt has ambiguity notes", interp2.ambiguityNotes.length > 0);

  const interp3 = interpretPrompt("I need a self-hosted model for HIPAA compliance processing patient records locally");
  assert("privacy demand >= 0.65", interp3.privacySelfHost >= 0.65, `got ${interp3.privacySelfHost.toFixed(3)}`);
}

// ── Test 2: DemandTensor ────────────────────────────────────

console.log("\n── Test 2: DemandTensor Construction ──");
{
  const interp = interpretPrompt("Prove Fermat's Last Theorem step by step with formal mathematical rigor");
  const tensor = buildDemandTensor(interp);
  assert("reasoning weight > 0.35", tensor.reasoning.weight > 0.35, `got ${tensor.reasoning.weight.toFixed(3)}`);
  assert("coding weight is low (< 0.3)", tensor.coding.weight < 0.3, `got ${tensor.coding.weight.toFixed(3)}`);
  assert("reasoning has minimum > 0", tensor.reasoning.minimum > 0, `got ${tensor.reasoning.minimum}`);
}

// ── Test 3: HardConstraints ─────────────────────────────────

console.log("\n── Test 3: HardConstraints ──");
{
  const interp = interpretPrompt("Analyze this screenshot and extract all text using OCR");
  const constraints = buildHardConstraints(interp);
  assert("requiresVision is true", constraints.requiresVision === true);

  const interp2 = interpretPrompt("Build an agent that uses tool calling to search the web and orchestrate a pipeline");
  const constraints2 = buildHardConstraints(interp2);
  assert("requiresFunctionCalling for agentic", constraints2.requiresFunctionCalling === true);

  const interp3 = interpretPrompt("Use the cheapest possible model for bulk classification at scale, budget is critical");
  const constraints3 = buildHardConstraints(interp3);
  assert("maxEstimatedCostUsd is set for cost-sensitive", constraints3.maxEstimatedCostUsd !== null);
}

// ── Test 4: Eligibility Filtering ───────────────────────────

console.log("\n── Test 4: Eligibility Filtering ──");
{
  const interp = interpretPrompt("I need a self-hosted model for HIPAA compliance, must be local, no cloud");
  const constraints = buildHardConstraints(interp);
  const { eligible, exclusions } = filterEligibleModels(ALL_MODELS, constraints, interp);

  assert("some models excluded for privacy", exclusions.length > 0, `${exclusions.length} excluded`);
  assert("eligible models exist", eligible.length > 0, `${eligible.length} eligible`);

  const allOpen = eligible.every(m => m.tags.some(t => t.toLowerCase() === "open-weight"));
  assert("all eligible are open-weight", allOpen);

  const interp2 = interpretPrompt("Analyze this screenshot with OCR and extract structured data");
  const constraints2 = buildHardConstraints(interp2);
  const { exclusions: excl2 } = filterEligibleModels(ALL_MODELS, constraints2, interp2);
  const nonVisionExcluded = excl2.some(e => e.reasons.some(r => r.toLowerCase().includes("vision")));
  assert("non-vision models excluded for vision task", nonVisionExcluded);
}

// ── Test 5: Scoring Engine ──────────────────────────────────

console.log("\n── Test 5: Scoring Engine ──");
{
  const interp = interpretPrompt("Write a simple hello world in Python");
  const tensor = buildDemandTensor(interp);

  const frontier = ALL_MODELS.find(m => m.id === "gpt-5.4")!;
  const budget = ALL_MODELS.find(m => m.id === "gpt-5.4-nano")!;

  const frontierProfile = profileModel(frontier, tensor, interp.estimatedInputTokens, interp.estimatedOutputTokens, 0);
  const budgetProfile = profileModel(budget, tensor, interp.estimatedInputTokens, interp.estimatedOutputTokens, 0);

  assert("frontier has overkill penalty > 0 on simple task", frontierProfile.totalOverkillPenalty > 0, `got ${frontierProfile.totalOverkillPenalty}`);
  assert("budget has value score >= frontier value score", budgetProfile.valueScore >= frontierProfile.valueScore,
    `budget=${budgetProfile.valueScore.toFixed(2)} frontier=${frontierProfile.valueScore.toFixed(2)}`);

  const interp2 = interpretPrompt("Build a complex distributed system with consensus protocol implementation, formal verification, and comprehensive test suite");
  const tensor2 = buildDemandTensor(interp2);
  const fp2 = profileModel(frontier, tensor2, interp2.estimatedInputTokens, interp2.estimatedOutputTokens, 0);
  const bp2 = profileModel(budget, tensor2, interp2.estimatedInputTokens, interp2.estimatedOutputTokens, 0);
  assert("frontier alignment is competitive on complex task", fp2.alignmentScore > 85,
    `frontier=${fp2.alignmentScore} budget=${bp2.alignmentScore}`);
}

// ── Test 6: Pareto Frontier ─────────────────────────────────

console.log("\n── Test 6: Pareto Frontier ──");
{
  const interp = interpretPrompt("General purpose coding assistant for everyday tasks");
  const tensor = buildDemandTensor(interp);
  const profiles = ALL_MODELS.filter(m => m.isActive).slice(0, 10).map(m =>
    profileModel(m, tensor, interp.estimatedInputTokens, interp.estimatedOutputTokens, 0)
  );

  const pareto = extractParetoFrontier(profiles, [
    p => p.alignmentScore,
    p => -p.estimatedCostUsd,
    p => p.latencyAdjustedScore,
  ]);

  const paretoOptimal = pareto.filter(p => p.paretoOptimal);
  assert("Pareto set is non-empty", paretoOptimal.length >= 1, `got ${paretoOptimal.length}`);
  assert("dominated models have dominatedBy entries",
    pareto.filter(p => !p.paretoOptimal).every(p => p.dominatedBy.length > 0));
  assert("Pareto analysis covers all input models", pareto.length === profiles.length);
}

// ── Test 7: Full Pipeline (analyzePrompt) ───────────────────

console.log("\n── Test 7: Full Pipeline ──");
{
  const result = analyzePrompt("Build a REST API with authentication, rate limiting, and PostgreSQL. Include comprehensive tests.", ALL_MODELS);

  assert("result has id", typeof result.id === "string" && result.id.length > 0);
  assert("result has recommendations", result.recommendations.length > 0, `got ${result.recommendations.length}`);
  assert("result has bestAbsolute track", result.advisor.tracks.bestAbsolute !== null);
  assert("result has bestValue track", result.advisor.tracks.bestValue !== null);
  assert("result has uncertainty", result.advisor.uncertainty !== undefined);
  assert("result has explanation summary", result.explanationSummary.length > 0);
  assert("result has eligibility exclusions", result.advisor.eligibilityExclusions !== undefined);
  assert("confidence is a number", typeof result.confidence === "number");

  const abs = result.advisor.tracks.bestAbsolute;
  const val = result.advisor.tracks.bestValue;
  if (abs && val && abs.modelId !== val.modelId) {
    assert("budget alternative populated when tracks differ", result.budgetAlternative !== null);
  }

  console.log(`\n  Top recommendation: ${result.recommendations[0]?.modelName} (score ${result.recommendations[0]?.score})`);
  console.log(`  Value pick: ${val?.modelName ?? "same as absolute"}`);
  console.log(`  Confidence: ${result.confidence}%`);
  console.log(`  Explanation: ${result.explanationSummary.slice(0, 150)}...`);
}

// ── Test 8: Overkill Detection ──────────────────────────────

console.log("\n── Test 8: Overkill Detection ──");
{
  const simpleResult = analyzePrompt("hello", ALL_MODELS);
  const complexResult = analyzePrompt(
    "Design and implement a distributed consensus algorithm (Raft) from scratch in Rust with formal TLA+ specification, property-based testing, network partition simulation, and production-ready error handling. Include a benchmark suite comparing against etcd's Raft implementation.",
    ALL_MODELS
  );

  const simpleTop = simpleResult.recommendations[0];
  const complexTop = complexResult.recommendations[0];

  assert("simple prompt doesn't default to most expensive", simpleTop?.tier !== "frontier" || simpleTop?.score < 80,
    `got ${simpleTop?.modelName} tier=${simpleTop?.tier} score=${simpleTop?.score}`);
  assert("complex prompt has higher confidence than simple", complexResult.confidence > simpleResult.confidence,
    `complex=${complexResult.confidence} simple=${simpleResult.confidence}`);

  console.log(`\n  Simple "hello" → ${simpleTop?.modelName} (${simpleTop?.score})`);
  console.log(`  Complex Raft → ${complexTop?.modelName} (${complexTop?.score})`);
}

// ── Test 9: Privacy Constraint ──────────────────────────────

console.log("\n── Test 9: Privacy Constraint ──");
{
  const result = analyzePrompt(
    "I need to process sensitive medical records with a self-hosted model. HIPAA compliance is required. No data can leave our premises.",
    ALL_MODELS
  );

  const openTrack = result.advisor.tracks.bestOpenSelfHosted;
  assert("open/self-hosted track is populated", openTrack !== null);
  if (openTrack) {
    const model = ALL_MODELS.find(m => m.id === openTrack.modelId);
    const isOpen = model?.tags.some(t => t.toLowerCase() === "open-weight");
    assert("open track winner is actually open-weight", isOpen === true, `model=${openTrack.modelName}`);
  }
}

// ── Test 10: Eval Suite ─────────────────────────────────────

console.log("\n── Test 10: Eval Suite ──");
{
  const evalResults = runEvalSuite(ALL_MODELS);
  console.log(`  Eval pass rate: ${evalResults.passRate}% (${evalResults.passed}/${evalResults.totalCases})`);

  for (const r of evalResults.results) {
    if (!r.passed) {
      console.log(`  ❌ ${r.caseId}: ${r.failures.join("; ")}`);
    } else {
      console.log(`  ✅ ${r.caseId}`);
    }
  }

  assert("eval pass rate >= 60%", evalResults.passRate >= 60, `got ${evalResults.passRate}%`);
}

// ── Summary ─────────────────────────────────────────────────

console.log(`\n${"=".repeat(50)}`);
console.log(`RESULTS: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
console.log(`${"=".repeat(50)}\n`);

if (failed > 0) {
  process.exit(1);
}
