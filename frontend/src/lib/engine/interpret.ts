/**
 * Prompt Interpretation Engine
 *
 * Extracts a DemandTensor (continuous axes with weight/minimum/ideal),
 * HardConstraints (boolean gates), and a PromptInterpretation (legacy
 * compatible) from a raw user prompt.
 *
 * Uses structural analysis (code fences, JSON patterns, indentation),
 * statistical length features, and soft lexical priors blended into
 * continuous axes. The LLM-based interpreter (via /api/advisor/interpret)
 * replaces this for higher intent accuracy in production.
 */

import type {
  PromptInterpretation,
  TaskRequirements,
  InterpretedTaskLabel,
  DemandTensor,
  DemandAxis,
  HardConstraints,
  StructuredOutputStrictness,
} from "@/lib/types";

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function tokenizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s+#]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Stem-aware lexicon scoring. Matches both exact words AND
 * common suffixes (e.g. "cheapest" matches "cheap").
 */
function stemAwareLexiconScore(words: Set<string>, lex: LexWeights): number {
  let num = 0;
  let den = 0;
  for (const [lexWord, wt] of Object.entries(lex)) {
    den += wt;
    if (words.has(lexWord)) {
      num += wt;
    } else {
      for (const w of words) {
        if (w.length > lexWord.length && w.startsWith(lexWord)) {
          num += wt * 0.85;
          break;
        }
      }
    }
  }
  return den > 0 ? clamp(num / den, 0, 1) : 0;
}

// ── Structural Detectors ─────────────────────────────────────

function structuralCodeAffinity(prompt: string): number {
  let s = 0;
  if (/```[\s\S]*?```/.test(prompt)) s += 0.45;
  const lines = prompt.split(/\n/);
  const n = Math.max(lines.length, 1);
  const indented = lines.filter((l) => /^\s{4,}\S/.test(l)).length;
  s += clamp((indented / n) * 0.35, 0, 0.35);
  if (
    /\b(def|class|function|import|export|const|let|var|async|await|return)\b/.test(prompt)
  )
    s += 0.2;
  if (/[{}();]/.test(prompt) && /[=<>]=?/.test(prompt)) s += 0.15;
  return clamp(s, 0, 1);
}

function structuralJsonAffinity(prompt: string): number {
  let s = 0;
  if (/\{\s*"[\w-]+"\s*:/.test(prompt)) s += 0.4;
  if (/\bjson\b|jsonschema|schema\.org/i.test(prompt)) s += 0.35;
  if (/"type"\s*:\s*"(object|string|array)"/.test(prompt)) s += 0.35;
  return clamp(s, 0, 1);
}

function estimateTokens(prompt: string): { inTok: number; outTok: number } {
  const wc = prompt.split(/\s+/).filter(Boolean).length;
  const inTok = Math.round(wc * 1.3);
  const long =
    /essay|report|paper|thesis|document|contract|codebase|implement\s+full/i.test(prompt);
  const outTok = long ? 2000 : wc > 400 ? 1200 : 500;
  return { inTok, outTok };
}

// ── Lexicon Priors ───────────────────────────────────────────

type LexWeights = Record<string, number>;

function lexiconScore(words: Set<string>, lex: LexWeights): number {
  let num = 0;
  let den = 0;
  for (const [w, wt] of Object.entries(lex)) {
    den += wt;
    if (words.has(w)) num += wt;
  }
  return den > 0 ? clamp(num / den, 0, 1) : 0;
}

const LEX_CODING: LexWeights = {
  implement: 1, code: 1, algorithm: 1, debug: 0.9,
  refactor: 0.9, api: 0.8, function: 0.8, build: 0.5,
  database: 0.7, distributed: 0.7, protocol: 0.6,
  redis: 0.7, server: 0.5, backend: 0.5,
};

const LEX_REASONING: LexWeights = {
  prove: 1, theorem: 1, therefore: 0.6, formal: 0.7, lemma: 0.9,
  optimize: 0.4, constraint: 0.5, proof: 0.9, syllogism: 1,
  infer: 0.5, deduce: 0.6, mathematical: 0.8, rigor: 0.6,
  step: 0.3, logic: 0.7, reasoning: 0.8,
};

const LEX_AGENT: LexWeights = {
  agent: 1, workflow: 0.8, automate: 0.9, mcp: 0.9, tool: 0.7,
  tools: 0.7, orchestrate: 0.9, pipeline: 0.6, browser: 0.7,
  calling: 0.8, execute: 0.5, sandbox: 0.5,
};

const LEX_MULTIMODAL_IN: LexWeights = {
  screenshot: 1, diagram: 0.8, chart: 0.8, image: 0.5, photo: 0.6,
  figure: 0.6, ocr: 1, pixel: 0.5, video: 0.7, audio: 0.7,
  waveform: 0.8,
};

const LEX_IMAGE_OUT: LexWeights = {
  generate: 0.3, image: 0.4, logo: 0.8, illustration: 0.9,
  render: 0.5, draw: 0.7, inpaint: 1, outpainting: 1, dall: 1,
  flux: 0.8, midjourney: 1, stable: 0.5, diffusion: 0.7,
};

const LEX_ENTERPRISE: LexWeights = {
  enterprise: 1, compliance: 1, hipaa: 1, gdpr: 1, sox: 1,
  audit: 0.8, production: 0.5, sla: 0.8, contractual: 0.9,
  legal: 0.6, regulatory: 0.9,
};

const LEX_PRIVACY: LexWeights = {
  self: 0.3, hosted: 0.5, on: 0.1, premise: 0.4, private: 0.6,
  air: 0.4, gapped: 0.4, local: 0.5, offline: 0.7,
};

const LEX_COST: LexWeights = {
  cheap: 1, budget: 0.9, lowest: 0.8, cost: 0.4, inexpensive: 1,
  free: 0.6, batch: 0.5, bulk: 0.5, scale: 0.3,
};

const LEX_SPEED: LexWeights = {
  fast: 1, quick: 0.9, latency: 0.8, realtime: 1, real: 0.2,
  time: 0.2, urgent: 0.7, snappy: 0.9, interactive: 0.5,
};

const LEX_CREATIVE: LexWeights = {
  story: 0.8, poem: 1, creative: 0.7, fiction: 0.9, brand: 0.5,
  tone: 0.4, voice: 0.4, metaphor: 0.8, brainstorm: 0.7,
};

const LEX_FACT: LexWeights = {
  accurate: 1, correctness: 1, citation: 0.9, sources: 0.8,
  verifiable: 1, medical: 0.6, diagnosis: 0.7, financial: 0.5,
  contract: 0.5,
};

const LEX_SUMMARY: LexWeights = {
  summarize: 1, summary: 0.9, tldr: 1, digest: 0.8, recap: 0.8,
  extract: 0.5, bullets: 0.5,
};

function blend(structural: number, lexical: number, wStruct: number): number {
  return clamp(wStruct * structural + (1 - wStruct) * lexical, 0, 1);
}

// ── Axis Label Generation ────────────────────────────────────

function taskLabelsFromAxes(
  axes: Record<string, number>
): InterpretedTaskLabel[] {
  const entries = Object.entries(axes)
    .filter(([, v]) => v >= 0.32)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const idToLabel: Record<string, string> = {
    coding: "Software / code work",
    reasoning: "Analytical reasoning",
    agentic: "Tool / agent workflow",
    multimodal: "Visual or media understanding",
    image_gen: "Image generation output",
    long_context: "Long-context ingestion",
    structured: "Structured machine-readable output",
    creative: "Creative generation",
    research: "Synthesis & summarization",
    enterprise: "Enterprise / compliance-sensitive",
  };

  return entries.map(([id, weight]) => ({
    id,
    label: idToLabel[id] ?? id,
    weight: Math.round(weight * 100) / 100,
  }));
}

// ── Core Interpretation ──────────────────────────────────────

function computeAxes(prompt: string) {
  const trimmed = prompt.trim();
  const wordsArr = tokenizeWords(trimmed);
  const wordSet = new Set(wordsArr);

  const sCode = structuralCodeAffinity(trimmed);
  const sJson = structuralJsonAffinity(trimmed);
  const { inTok, outTok } = estimateTokens(trimmed);

  const lCode = stemAwareLexiconScore(wordSet, LEX_CODING);
  const lReason = stemAwareLexiconScore(wordSet, LEX_REASONING);
  const lAgent = stemAwareLexiconScore(wordSet, LEX_AGENT);
  const lMm = stemAwareLexiconScore(wordSet, LEX_MULTIMODAL_IN);
  const lImgOut = stemAwareLexiconScore(wordSet, LEX_IMAGE_OUT);
  const lEnt = stemAwareLexiconScore(wordSet, LEX_ENTERPRISE);
  const lPriv = stemAwareLexiconScore(wordSet, LEX_PRIVACY);
  const lCost = stemAwareLexiconScore(wordSet, LEX_COST);
  const lSpeed = stemAwareLexiconScore(wordSet, LEX_SPEED);
  const lCre = stemAwareLexiconScore(wordSet, LEX_CREATIVE);
  const lFact = stemAwareLexiconScore(wordSet, LEX_FACT);
  const lSum = stemAwareLexiconScore(wordSet, LEX_SUMMARY);

  const codingDemand = sCode > 0.05
    ? blend(sCode, lCode, 0.5)
    : blend(0, lCode, 0.1);
  const agentToolDemand = blend(0, lAgent, 0.25) + codingDemand * 0.2;
  const reasoningDepth = clamp(
    blend(lReason, Math.max(lReason, lFact * 0.6), 0.5) +
      (trimmed.length > 1200 ? 0.12 : 0) +
      agentToolDemand * 0.1,
    0, 1
  );
  const multimodalUnderstanding = blend(0, lMm, 0.12);
  const imageGenerationOutput = clamp(
    blend(0, lImgOut, 0.2) +
      (/\b(draw|illustrate|logo)\b/i.test(trimmed) ? 0.35 : 0),
    0, 1
  );
  const longContextDemand = clamp(
    inTok > 8000 ? 0.85 : inTok > 3000 ? 0.55 : inTok > 1500 ? 0.35 : 0.15,
    0, 1
  );
  const structuredOutputDemand = clamp(
    blend(sJson, lSum * 0.2, 0.65) + (lSum > 0.4 ? 0.15 : 0),
    0, 1
  );

  let structuredStrictness: StructuredOutputStrictness = "none";
  if (structuredOutputDemand > 0.55) {
    structuredStrictness =
      sJson > 0.35 || /schema|zod|pydantic|typescript\s+type/i.test(trimmed)
        ? "strict_schema"
        : "loose_json";
  }

  const creativeDemand = blend(0, lCre, 0.3);
  const factualityCritical = clamp(lFact * 0.85 + lEnt * 0.35, 0, 1);
  const enterpriseReliability = clamp(lEnt * 0.9 + factualityCritical * 0.25, 0, 1);
  const latencySensitivity = blend(inTok < 400 ? 0.25 : 0.1, lSpeed, 0.4);
  const costSensitivity = blend(0.08, lCost, 0.2);

  let privacySelfHost = clamp(lPriv * 0.5, 0, 1);
  if (
    /self[\s-]?hosted|on[\s-]?prem(?:ise)?s?|air[\s-]?gapped|local\s+model|no\s+cloud|data\s+sovereignty/i.test(
      trimmed
    )
  ) {
    privacySelfHost = Math.max(privacySelfHost, 0.92);
  }

  const researchSynthesis = clamp(lSum * 0.7 + longContextDemand * 0.25, 0, 1);

  return {
    codingDemand,
    agentToolDemand: clamp(agentToolDemand, 0, 1),
    reasoningDepth,
    multimodalUnderstanding,
    imageGenerationOutput,
    longContextDemand,
    structuredOutputDemand,
    structuredStrictness,
    creativeDemand,
    factualityCritical,
    enterpriseReliability,
    latencySensitivity,
    costSensitivity,
    privacySelfHost,
    researchSynthesis,
    inTok,
    outTok,
    trimmed,
    axisScores: {
      coding: codingDemand,
      reasoning: reasoningDepth,
      agentic: clamp(agentToolDemand, 0, 1),
      multimodal: multimodalUnderstanding,
      image_gen: imageGenerationOutput,
      long_context: longContextDemand,
      structured: structuredOutputDemand,
      creative: creativeDemand,
      research: researchSynthesis,
      enterprise: enterpriseReliability,
    } as Record<string, number>,
  };
}

// ── DemandTensor Construction ────────────────────────────────

function axisToDemand(weight: number): DemandAxis {
  return {
    weight,
    minimum: weight >= 0.7 ? weight * 6 : weight >= 0.4 ? weight * 4 : 0,
    ideal: weight >= 0.6 ? 10 : weight >= 0.3 ? 7.5 : 5,
  };
}

/**
 * Builds the DemandTensor from computed interpretation axes.
 * Each axis gets weight, minimum (hard floor), and ideal (overkill ceiling).
 */
export function buildDemandTensor(interp: PromptInterpretation): DemandTensor {
  const r = interp.reasoningDepth;
  const c = interp.codingDemand;
  const a = interp.agentToolDemand;
  const mm = interp.multimodalUnderstanding;
  const lc = interp.longContextDemand;
  const so = interp.structuredOutputDemand;
  const cr = interp.creativeDemand;
  const fa = interp.factualityCritical;
  const ent = interp.enterpriseReliability;
  const ls = interp.latencySensitivity;
  const cs = interp.costSensitivity;

  return {
    reasoning: { ...axisToDemand(r), minimum: r >= 0.6 ? 6 : r >= 0.3 ? 4 : 0 },
    coding: { ...axisToDemand(c), minimum: c >= 0.6 ? 5 : 0 },
    longContext: {
      weight: lc,
      minimum: lc >= 0.6 ? 5 : 0,
      ideal: lc >= 0.7 ? 10 : 8,
    },
    structuredOutput: {
      ...axisToDemand(so),
      minimum: interp.structuredStrictness === "strict_schema" ? 6 : so >= 0.6 ? 4 : 0,
    },
    multimodal: { ...axisToDemand(mm), minimum: mm >= 0.5 ? 4 : 0 },
    speed: {
      weight: ls,
      minimum: ls >= 0.75 ? 6 : 0,
      ideal: ls >= 0.5 ? 10 : 7,
    },
    costEfficiency: {
      weight: cs,
      minimum: cs >= 0.75 ? 6 : 0,
      ideal: cs >= 0.5 ? 10 : 7,
    },
    creativity: axisToDemand(cr),
    factuality: { ...axisToDemand(fa), minimum: fa >= 0.6 ? 5 : 0 },
    instructionFollowing: axisToDemand(
      clamp(0.35 + so * 0.35 + ent * 0.25, 0, 1)
    ),
    toolUse: { ...axisToDemand(a), minimum: a >= 0.55 ? 5 : 0 },
    safetyEnterprise: {
      ...axisToDemand(ent),
      minimum: ent >= 0.65 ? 6 : 0,
    },
    conversational: axisToDemand(
      clamp(0.25 + cr * 0.35 + (1 - so) * 0.15, 0, 1)
    ),
  };
}

// ── HardConstraints Construction ─────────────────────────────

export function buildHardConstraints(
  interp: PromptInterpretation
): HardConstraints {
  const needVision =
    interp.multimodalUnderstanding >= 0.2 && interp.imageGenerationOutput < 0.4;
  const needImageGen = interp.imageGenerationOutput >= 0.4;
  const needTools = interp.agentToolDemand >= 0.30;
  const needJson =
    interp.structuredStrictness === "strict_schema" ||
    (interp.structuredOutputDemand >= 0.7 &&
      interp.structuredStrictness === "loose_json");
  const needOpen = interp.privacySelfHost >= 0.65;

  const totalTokens = interp.estimatedInputTokens + interp.estimatedOutputTokens;
  const minCtx = Math.ceil(totalTokens * 1.1);

  let maxCost: number | null = null;
  if (interp.costSensitivity >= 0.7) maxCost = 0.025;
  else if (interp.costSensitivity >= 0.35) maxCost = 0.12;

  let maxLatency: number | null = null;
  if (interp.latencySensitivity >= 0.78) maxLatency = 6.5;
  else if (interp.latencySensitivity >= 0.55) maxLatency = 5.0;

  const needAudio =
    /\b(audio|voice|speak|listen|transcribe|tts|speech)\b/i.test("") &&
    interp.multimodalUnderstanding >= 0.4;

  return {
    requiresVision: needVision,
    requiresAudio: needAudio,
    requiresVideo: false,
    requiresImageGeneration: needImageGen,
    requiresFunctionCalling: needTools,
    requiresJsonMode: needJson,
    requiresOpenWeight: needOpen,
    minContextWindow: minCtx,
    maxEstimatedCostUsd: maxCost,
    maxLatencyTier: maxLatency,
    structuredStrictness: interp.structuredStrictness,
  };
}

// ── Public: interpretPrompt ──────────────────────────────────

export function interpretPrompt(prompt: string): PromptInterpretation {
  const a = computeAxes(prompt);
  const ranked = taskLabelsFromAxes(a.axisScores);
  const primaryTasks = ranked.slice(0, 2);
  const secondaryTasks = ranked.slice(2, 4);

  const jobParts: string[] = [];
  if (primaryTasks[0]) jobParts.push(primaryTasks[0].label.toLowerCase());
  if (a.codingDemand > 0.55) jobParts.push("with implementation detail");
  if (a.agentToolDemand > 0.55) jobParts.push("using automated/tool-assisted steps");
  const jobToBeDone =
    jobParts.length > 0
      ? `Get ${jobParts.join(" ")} completed reliably.`
      : "Obtain a correct, usable answer or artifact from the model.";

  const hidden: PromptInterpretation["hiddenIntentHypotheses"] = [];
  if (a.researchSynthesis > 0.35 && a.factualityCritical > 0.25) {
    hidden.push({
      text: "May need faithful compression of high-stakes content.",
      confidence: 0.45,
    });
  }
  if (a.enterpriseReliability > 0.2 && a.privacySelfHost < 0.1) {
    hidden.push({
      text: "May be preparing material suitable for audit or external review.",
      confidence: 0.38,
    });
  }
  if (a.codingDemand > 0.45 && a.agentToolDemand < 0.35) {
    hidden.push({
      text: "May later need test-backed iteration even if the prompt is single-shot.",
      confidence: 0.33,
    });
  }

  const spread =
    Object.values(a.axisScores).sort((x, y) => y - x)[0] -
    Object.values(a.axisScores).sort((x, y) => y - x)[1];
  const ambiguityNotes: string[] = [];
  if (spread < 0.12) {
    ambiguityNotes.push("Several task demands score similarly — interpretation is multi-objective.");
  }
  if (a.trimmed.length < 40) {
    ambiguityNotes.push("Very short prompt — intent is under-specified.");
  }
  if (a.multimodalUnderstanding > 0.25 && a.imageGenerationOutput > 0.25) {
    ambiguityNotes.push(
      "Both visual understanding and image creation signals present — confirm desired output modality."
    );
  }

  const interpretationConfidence = clamp(
    0.42 +
      spread * 0.35 +
      (a.trimmed.length > 80 ? 0.08 : 0) +
      (a.trimmed.length > 200 ? 0.06 : 0) -
      ambiguityNotes.length * 0.06,
    0.25, 0.88
  );

  return {
    jobToBeDone,
    primaryTasks,
    secondaryTasks,
    hiddenIntentHypotheses: hidden,
    reasoningDepth: a.reasoningDepth,
    codingDemand: a.codingDemand,
    agentToolDemand: a.agentToolDemand,
    multimodalUnderstanding: a.multimodalUnderstanding,
    imageGenerationOutput: a.imageGenerationOutput,
    longContextDemand: a.longContextDemand,
    structuredOutputDemand: a.structuredOutputDemand,
    structuredStrictness: a.structuredStrictness,
    creativeDemand: a.creativeDemand,
    factualityCritical: a.factualityCritical,
    enterpriseReliability: a.enterpriseReliability,
    latencySensitivity: a.latencySensitivity,
    costSensitivity: a.costSensitivity,
    privacySelfHost: a.privacySelfHost,
    estimatedInputTokens: a.inTok,
    estimatedOutputTokens: a.outTok,
    interpretationConfidence,
    ambiguityNotes,
    method: "structural_statistical",
  };
}

// ── Legacy Compatibility ─────────────────────────────────────

export function interpretationToRequirements(
  p: PromptInterpretation
): TaskRequirements {
  return {
    reasoning: clamp(p.reasoningDepth + p.factualityCritical * 0.2, 0, 1),
    coding: p.codingDemand,
    longContext: p.longContextDemand,
    structuredOutput: p.structuredOutputDemand,
    multimodal: clamp(p.multimodalUnderstanding + p.imageGenerationOutput * 0.15, 0, 1),
    speed: p.latencySensitivity,
    costEfficiency: p.costSensitivity,
    creativity: p.creativeDemand,
    factuality: clamp(p.factualityCritical + p.enterpriseReliability * 0.15, 0, 1),
    instructionFollowing: clamp(
      0.35 + p.structuredOutputDemand * 0.35 + p.enterpriseReliability * 0.25,
      0, 1
    ),
    toolUse: p.agentToolDemand,
    safetyEnterprise: p.enterpriseReliability,
    conversational: clamp(
      0.25 + p.creativeDemand * 0.35 + (1 - p.structuredOutputDemand) * 0.15,
      0, 1
    ),
    structuredStrictness: p.structuredStrictness,
    imageGenerationOutput: p.imageGenerationOutput,
    privacySelfHost: p.privacySelfHost,
  };
}
