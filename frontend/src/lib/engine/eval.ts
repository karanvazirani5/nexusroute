/**
 * Evaluation Framework for the Model Advisor Engine
 *
 * Defines structured test cases and a runner that validates engine
 * behavior against expected traits. Each test case specifies:
 *   - A prompt (the input)
 *   - Expected traits (what the engine should do)
 *   - A category (what type of routing decision this tests)
 *
 * The runner produces pass/fail per case with detailed failure reasons.
 */

import type {
  AnalysisResult,
  ModelProfile,
  EvalTestCase,
} from "@/lib/types";
import { analyzePrompt } from "./analyzer";

// ── Test Suite ───────────────────────────────────────────────

export const EVAL_SUITE: EvalTestCase[] = [
  // -- Reasoning --
  {
    id: "reasoning-hard-math",
    prompt: "Prove that there are infinitely many primes using Euclid's theorem. Provide a formal step-by-step proof with each logical step justified.",
    category: "reasoning",
    expectedTraits: {
      minimumConfidence: 40,
    },
    description: "Hard formal math proof — should favor reasoning-specialized models like o3",
  },
  {
    id: "reasoning-chain-of-thought",
    prompt: "A farmer has 17 sheep. All but 9 die. How many sheep does the farmer have left? Think step by step and explain your reasoning carefully.",
    category: "reasoning",
    expectedTraits: {
      overkillShouldTrigger: true,
    },
    description: "Simple trick question — overkill penalty should trigger for frontier models",
  },

  // -- Coding --
  {
    id: "coding-complex-system",
    prompt: "Implement a rate limiter in Go using a sliding window algorithm with Redis as the backing store. Include: 1) Token bucket with configurable refill rate, 2) Distributed lock for multi-instance deployments, 3) Lua scripts for atomic operations, 4) Comprehensive test suite with race condition tests. Handle edge cases for clock skew between instances.",
    category: "coding",
    expectedTraits: {
      minimumConfidence: 50,
    },
    description: "Complex systems coding — should favor strong coding models",
  },
  {
    id: "coding-simple-script",
    prompt: "Write a Python function that reverses a string.",
    category: "coding",
    expectedTraits: {
      overkillShouldTrigger: true,
    },
    description: "Trivial coding — overkill should trigger for frontier models",
  },

  // -- Multimodal --
  {
    id: "multimodal-vision",
    prompt: "I have a screenshot of a complex dashboard. Can you analyze the charts, identify trends, and extract the key metrics shown in the image?",
    category: "multimodal",
    expectedTraits: {
      constraintShouldExclude: ["deepseek-r1"],
    },
    description: "Vision task — should exclude models without vision support",
  },

  // -- Structured Output --
  {
    id: "structured-strict-json",
    prompt: "Parse this invoice and return a JSON object with schema: { vendor: string, items: Array<{name: string, quantity: number, price: number}>, total: number, currency: string }. Use strict JSON mode.",
    category: "structured",
    expectedTraits: {
      minimumConfidence: 40,
    },
    description: "Strict schema extraction — needs strong structured output",
  },

  // -- Cost Sensitive --
  {
    id: "cost-budget-classification",
    prompt: "I need the cheapest possible model to classify thousands of support tickets into categories: billing, technical, feature request, bug report. This will run at scale, I need the lowest cost option.",
    category: "cost_sensitive",
    expectedTraits: {},
    description: "Bulk classification — value track should differ from absolute",
  },

  // -- Ambiguous --
  {
    id: "ambiguous-short",
    prompt: "hello",
    category: "ambiguous",
    expectedTraits: {
      overkillShouldTrigger: true,
    },
    description: "Minimal prompt — high ambiguity, overkill for frontier",
  },
  {
    id: "ambiguous-multi-intent",
    prompt: "Draw me a conclusion about the market trends and also write code to visualize the data",
    category: "ambiguous",
    expectedTraits: {},
    description: "Multi-intent with 'draw' ambiguity — should NOT trigger image generation",
  },

  // -- Privacy --
  {
    id: "privacy-self-hosted",
    prompt: "I need a self-hosted model for processing patient medical records. Data cannot leave our premises due to HIPAA compliance. The model needs to extract structured data from clinical notes.",
    category: "privacy",
    expectedTraits: {},
    description: "Privacy constraint — should only recommend open-weight models",
  },

  // -- Latency --
  {
    id: "latency-realtime-chat",
    prompt: "I need a fast, snappy chatbot for real-time customer interactions. Response time is critical — users will leave if they wait more than 2 seconds.",
    category: "latency",
    expectedTraits: {},
    description: "Latency-critical — low-latency track should differ from absolute",
  },

  // -- Agentic --
  {
    id: "agentic-workflow",
    prompt: "Build an agent that can browse the web to research competitors, extract pricing data, organize it into a spreadsheet format, and generate a comparison report. Use tool calling and multi-step reasoning.",
    category: "agentic",
    expectedTraits: {
      minimumConfidence: 40,
    },
    description: "Complex agentic workflow — needs tool use and reasoning",
  },
];

// ── Test Runner ──────────────────────────────────────────────

export interface EvalResult {
  caseId: string;
  passed: boolean;
  failures: string[];
  analysis: AnalysisResult;
}

export interface EvalSuiteResult {
  totalCases: number;
  passed: number;
  failed: number;
  results: EvalResult[];
  passRate: number;
}

function runSingleEval(
  testCase: EvalTestCase,
  models: ModelProfile[]
): EvalResult {
  const analysis = analyzePrompt(testCase.prompt, models);
  const failures: string[] = [];
  const traits = testCase.expectedTraits;

  if (traits.mustIncludeModel) {
    const found = analysis.recommendations.some(
      (r) => r.modelId === traits.mustIncludeModel
    );
    if (!found) {
      failures.push(
        `Expected model ${traits.mustIncludeModel} in recommendations but not found`
      );
    }
  }

  if (traits.mustExcludeModel) {
    const found = analysis.recommendations.some(
      (r) => r.modelId === traits.mustExcludeModel
    );
    if (found) {
      failures.push(
        `Expected model ${traits.mustExcludeModel} to be excluded but it was recommended`
      );
    }
  }

  if (traits.topTrackShouldBe) {
    const topModel = analysis.advisor.tracks.bestAbsolute?.modelId;
    if (topModel !== traits.topTrackShouldBe) {
      failures.push(
        `Expected top track model ${traits.topTrackShouldBe} but got ${topModel}`
      );
    }
  }

  if (traits.minimumConfidence !== undefined) {
    if (analysis.confidence < traits.minimumConfidence) {
      failures.push(
        `Confidence ${analysis.confidence} below minimum ${traits.minimumConfidence}`
      );
    }
  }

  if (traits.overkillShouldTrigger) {
    const topRec = analysis.recommendations[0];
    if (topRec && topRec.tier === "frontier") {
      const advisorProfiles = analysis.advisor.perModelFit;
      const topFit = advisorProfiles.find((f) => f.modelId === topRec.modelId);
      if (topFit) {
        const hasOverkillNote = topFit.weaknessesVsTask.some(
          (w) => w.toLowerCase().includes("overkill") || w.toLowerCase().includes("weighted")
        );
        if (!hasOverkillNote && topRec.score > 80) {
          failures.push(
            "Overkill should trigger for a frontier model on a simple task but no indication found"
          );
        }
      }
    }
  }

  if (traits.constraintShouldExclude) {
    for (const modelId of traits.constraintShouldExclude) {
      const excluded = analysis.advisor.eligibilityExclusions.some(
        (e) => e.modelId === modelId
      );
      if (!excluded) {
        failures.push(
          `Expected model ${modelId} to be excluded by constraints but it was not`
        );
      }
    }
  }

  return {
    caseId: testCase.id,
    passed: failures.length === 0,
    failures,
    analysis,
  };
}

export function runEvalSuite(
  models: ModelProfile[],
  suite: EvalTestCase[] = EVAL_SUITE
): EvalSuiteResult {
  const results = suite.map((tc) => runSingleEval(tc, models));
  const passed = results.filter((r) => r.passed).length;

  return {
    totalCases: results.length,
    passed,
    failed: results.length - passed,
    results,
    passRate: Math.round((passed / results.length) * 100),
  };
}
