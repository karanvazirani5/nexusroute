/**
 * LLM Interpretation Schema + Merge
 *
 * Defines the JSON contract for the LLM-based prompt interpreter
 * and merges partial LLM output with the structural/statistical
 * interpreter to fill gaps and ensure completeness.
 */

import { z } from "zod";
import type { PromptInterpretation, StructuredOutputStrictness } from "@/lib/types";
import { interpretPrompt } from "./interpret";

const strictnessSchema = z.preprocess((val) => {
  if (typeof val !== "string") return "none";
  const lower = val.toLowerCase().replace(/[^a-z_]/g, "_");
  if (lower === "none" || lower === "loose_json" || lower === "strict_schema") return lower;
  if (lower.includes("strict") || lower.includes("schema")) return "strict_schema";
  if (lower.includes("json") || lower.includes("loose")) return "loose_json";
  return "none";
}, z.enum(["none", "loose_json", "strict_schema"]));

// Coerce anything vaguely string-shaped into a non-empty string. LLMs
// sometimes return numeric ids (0, 1, 2) or stringifiable objects.
const flexString = z.preprocess((val) => {
  if (val == null) return undefined;
  if (typeof val === "string") return val.trim() || undefined;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  return undefined;
}, z.string().min(1));

// Coerce numeric-ish values into the 0–1 range. Handles percentages ("80%" or
// 80) by dividing into unit interval, strings into numbers.
const unitInterval = z.preprocess((val) => {
  if (val == null) return undefined;
  if (typeof val === "number") return val > 1 && val <= 100 ? val / 100 : val;
  if (typeof val === "string") {
    const n = Number(val.replace(/[^0-9.\-]/g, ""));
    if (Number.isFinite(n)) return n > 1 && n <= 100 ? n / 100 : n;
  }
  return undefined;
}, z.number().min(0).max(1));

// Integers that tolerate stringified numbers and negative/NaN inputs.
const nonNegativeInt = z.preprocess((val) => {
  if (val == null) return undefined;
  const n = typeof val === "number" ? val : Number(val);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n);
}, z.number().int().nonnegative());

const taskLabelSchema = z.preprocess(
  (val) => {
    // Allow bare strings in the primaryTasks array ("coding", "debugging").
    if (typeof val === "string") return { id: val, label: val };
    return val;
  },
  z.object({
    id: flexString,
    label: flexString.optional(),
    weight: unitInterval.optional(),
  }).transform((o) => ({
    id: o.id,
    label: o.label ?? o.id,
    weight: o.weight,
  }))
);

const hiddenHypothesisSchema = z.preprocess(
  (val) => {
    if (typeof val === "string") return { text: val };
    return val;
  },
  z.object({
    text: flexString,
    confidence: unitInterval.optional(),
  })
);

export const llmInterpretationPayloadSchema = z.object({
  jobToBeDone: flexString.optional(),
  primaryTasks: z.array(taskLabelSchema).optional(),
  secondaryTasks: z.array(taskLabelSchema).optional(),
  hiddenIntentHypotheses: z.array(hiddenHypothesisSchema).optional(),
  reasoningDepth: unitInterval.optional(),
  codingDemand: unitInterval.optional(),
  agentToolDemand: unitInterval.optional(),
  multimodalUnderstanding: unitInterval.optional(),
  imageGenerationOutput: unitInterval.optional(),
  longContextDemand: unitInterval.optional(),
  structuredOutputDemand: unitInterval.optional(),
  structuredStrictness: strictnessSchema.optional(),
  creativeDemand: unitInterval.optional(),
  factualityCritical: unitInterval.optional(),
  enterpriseReliability: unitInterval.optional(),
  latencySensitivity: unitInterval.optional(),
  costSensitivity: unitInterval.optional(),
  privacySelfHost: unitInterval.optional(),
  estimatedInputTokens: nonNegativeInt.optional(),
  estimatedOutputTokens: nonNegativeInt.optional(),
  interpretationConfidence: unitInterval.optional(),
  ambiguityNotes: z.array(flexString).optional(),
}).passthrough(); // tolerate extra fields the LLM might add

export type LLMInterpretationPayload = z.infer<typeof llmInterpretationPayloadSchema>;

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function normalizeTaskLabels(
  labels: LLMInterpretationPayload["primaryTasks"],
  fallback: PromptInterpretation["primaryTasks"]
): PromptInterpretation["primaryTasks"] {
  if (!labels?.length) return fallback;
  return labels.map((t) => ({
    id: t.id,
    label: t.label,
    weight: clamp01(t.weight ?? 0.65),
  }));
}

/**
 * Validates LLM JSON and merges with local structural interpreter.
 * The LLM can override any axis; missing fields fall back to structural.
 */
export function mergeLLMInterpretation(
  prompt: string,
  raw: unknown
): { interpretation: PromptInterpretation; parseWarnings: string[] } {
  const local = interpretPrompt(prompt);
  const parseWarnings: string[] = [];

  const parsed = llmInterpretationPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    parseWarnings.push(
      `LLM JSON failed schema: ${parsed.error.message.slice(0, 200)}`
    );
    return { interpretation: local, parseWarnings };
  }

  const L = parsed.data;

  const interpretation: PromptInterpretation = {
    jobToBeDone: L.jobToBeDone?.trim() || local.jobToBeDone,
    primaryTasks: normalizeTaskLabels(L.primaryTasks, local.primaryTasks),
    secondaryTasks: normalizeTaskLabels(L.secondaryTasks, local.secondaryTasks),
    hiddenIntentHypotheses:
      L.hiddenIntentHypotheses !== undefined
        ? L.hiddenIntentHypotheses.map((h) => ({
            text: h.text,
            confidence: clamp01(h.confidence ?? 0.4),
          }))
        : local.hiddenIntentHypotheses,
    reasoningDepth: clamp01(L.reasoningDepth ?? local.reasoningDepth),
    codingDemand: clamp01(L.codingDemand ?? local.codingDemand),
    agentToolDemand: clamp01(L.agentToolDemand ?? local.agentToolDemand),
    multimodalUnderstanding: clamp01(L.multimodalUnderstanding ?? local.multimodalUnderstanding),
    imageGenerationOutput: clamp01(L.imageGenerationOutput ?? local.imageGenerationOutput),
    longContextDemand: clamp01(L.longContextDemand ?? local.longContextDemand),
    structuredOutputDemand: clamp01(L.structuredOutputDemand ?? local.structuredOutputDemand),
    structuredStrictness: (L.structuredStrictness ?? local.structuredStrictness) as StructuredOutputStrictness,
    creativeDemand: clamp01(L.creativeDemand ?? local.creativeDemand),
    factualityCritical: clamp01(L.factualityCritical ?? local.factualityCritical),
    enterpriseReliability: clamp01(L.enterpriseReliability ?? local.enterpriseReliability),
    latencySensitivity: clamp01(L.latencySensitivity ?? local.latencySensitivity),
    costSensitivity: clamp01(L.costSensitivity ?? local.costSensitivity),
    privacySelfHost: clamp01(L.privacySelfHost ?? local.privacySelfHost),
    estimatedInputTokens: L.estimatedInputTokens ?? local.estimatedInputTokens,
    estimatedOutputTokens: L.estimatedOutputTokens ?? local.estimatedOutputTokens,
    interpretationConfidence: clamp01(L.interpretationConfidence ?? local.interpretationConfidence),
    ambiguityNotes: L.ambiguityNotes !== undefined ? L.ambiguityNotes : local.ambiguityNotes,
    method: "llm",
  };

  return { interpretation, parseWarnings };
}

export const INTERPRETATION_JSON_SPEC = `You are interpreting a user prompt so a separate routing system can pick the best LLM for the job. Return ONE JSON object. Every number must be between 0 and 1 (not percentages).

Required structure:
{
  "jobToBeDone": "<one sentence describing the true underlying job>",
  "primaryTasks": [
    { "id": "<kebab-case-slug>", "label": "<short human label>", "weight": 0.0-1.0 }
  ],
  "secondaryTasks": [ { "id": "...", "label": "...", "weight": 0.0-1.0 } ],
  "hiddenIntentHypotheses": [ { "text": "<inferred hidden goal>", "confidence": 0.0-1.0 } ],
  "reasoningDepth": 0.0-1.0,
  "codingDemand": 0.0-1.0,
  "agentToolDemand": 0.0-1.0,
  "multimodalUnderstanding": 0.0-1.0,
  "imageGenerationOutput": 0.0-1.0,
  "longContextDemand": 0.0-1.0,
  "structuredOutputDemand": 0.0-1.0,
  "structuredStrictness": "none" | "loose_json" | "strict_schema",
  "creativeDemand": 0.0-1.0,
  "factualityCritical": 0.0-1.0,
  "enterpriseReliability": 0.0-1.0,
  "latencySensitivity": 0.0-1.0,
  "costSensitivity": 0.0-1.0,
  "privacySelfHost": 0.0-1.0,
  "estimatedInputTokens": <positive integer>,
  "estimatedOutputTokens": <positive integer>,
  "interpretationConfidence": 0.0-1.0,
  "ambiguityNotes": ["<notes about unclear parts>"]
}

Hard rules:
- "id" fields MUST be strings (never numbers). Use kebab-case slugs like "backend-architecture" or "legal-analysis".
- Infer implicit constraints: a fintech prompt implies high factuality + enterpriseReliability. A "quick chat" implies high latencySensitivity + low reasoningDepth. A "200-page PDF" implies high longContextDemand.
- primaryTasks should have 1-3 entries with weights summing to ~1.0. secondaryTasks 0-3 entries.
- hiddenIntentHypotheses should capture what the user actually needs beyond the literal words (0-4 entries).
- DO NOT recommend models or mention providers. Just interpret the prompt.
- Output JSON only. No prose. No markdown fences.`;
