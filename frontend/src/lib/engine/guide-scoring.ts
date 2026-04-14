/**
 * Guide-specific model scoring.
 * Computes a weighted capability score for a guide category,
 * returning the top N models with breakdown and relevant pros/cons.
 */

import type { ModelProfile, CapabilityDimension } from "@/lib/types";
import type { GuideCategory } from "@/lib/data/guides";

export interface GuideModelScore {
  model: ModelProfile;
  score: number;
  breakdown: Record<string, { weight: number; raw: number; weighted: number }>;
  prosForTask: string[];
  consForTask: string[];
}

export function scoreModelsForGuide(
  guide: GuideCategory,
  models: ModelProfile[],
  topN = 5,
): GuideModelScore[] {
  const activeModels = models.filter((m) => m.isActive);
  const dims = Object.entries(guide.weights) as [CapabilityDimension, number][];
  const totalWeight = dims.reduce((sum, [, w]) => sum + w, 0);

  const scored = activeModels.map((model) => {
    const breakdown: GuideModelScore["breakdown"] = {};
    let weightedSum = 0;

    for (const [dim, weight] of dims) {
      const raw = model.capabilities[dim] ?? 5;
      const weighted = (raw / 10) * weight;
      weightedSum += weighted;
      breakdown[dim] = { weight, raw, weighted };
    }

    const score = Math.round((weightedSum / totalWeight) * 100);

    // Derive relevant pros/cons from model intelligence
    const slug = guide.slug.toLowerCase();
    const prosForTask = model.intelligence.bestUseCases
      .filter((u) => matchesGuide(u, slug))
      .slice(0, 3);
    const consForTask = model.intelligence.worstUseCases
      .filter((u) => matchesGuide(u, slug))
      .slice(0, 2);

    // If no specific matches, fall back to top strengths/weaknesses
    if (prosForTask.length === 0) {
      prosForTask.push(...model.intelligence.knownStrengths.slice(0, 2));
    }
    if (consForTask.length === 0) {
      consForTask.push(...model.intelligence.knownWeaknesses.slice(0, 1));
    }

    return { model, score, breakdown, prosForTask, consForTask };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, topN);
}

/** Fuzzy match: does this use-case string relate to the guide slug? */
function matchesGuide(text: string, slug: string): boolean {
  const t = text.toLowerCase();
  const keywords: Record<string, string[]> = {
    coding: ["code", "programming", "debug", "software", "api", "development"],
    "creative-writing": ["writing", "creative", "fiction", "story", "prose", "copy"],
    research: ["research", "analysis", "academic", "literature", "synthesis"],
    "data-analysis": ["data", "analytics", "sql", "csv", "statistics", "chart"],
    "customer-support": ["support", "customer", "chat", "helpdesk", "ticket"],
    translation: ["translat", "multilingual", "locali"],
    summarization: ["summar", "condense", "digest", "brief"],
    agents: ["agent", "tool", "autonom", "orchestrat", "multi-step"],
    "image-generation": ["image", "visual", "picture", "illustration", "design"],
    "math-reasoning": ["math", "reason", "logic", "proof", "calculation"],
    legal: ["legal", "contract", "compliance", "law", "regulatory"],
    medical: ["medical", "clinical", "health", "patient", "diagnosis"],
    education: ["education", "tutor", "learn", "teach", "lesson"],
    "content-marketing": ["marketing", "seo", "social media", "brand", "campaign"],
  };
  const kws = keywords[slug] ?? [slug.replace(/-/g, " ")];
  return kws.some((kw) => t.includes(kw));
}
