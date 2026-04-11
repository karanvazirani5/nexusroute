/**
 * Shared constants for the NexusRoute Intelligence Terminal.
 *
 * SINGLE SOURCE OF TRUTH for category colors, emoji, and the API base URL.
 * Every component imports from here — no more duplication across 5 files.
 */

// ──────────────────────────────────────────────────────────────────
// API
// ──────────────────────────────────────────────────────────────────
export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

// ──────────────────────────────────────────────────────────────────
// Category visual mapping — used by dashboard, explorer, ticker, etc.
// ──────────────────────────────────────────────────────────────────
export const CATEGORY_EMOJI: Record<string, string> = {
  writing_content: "✍️",
  coding_engineering: "💻",
  analysis_research: "🔍",
  learning_explanation: "🎓",
  brainstorming_ideation: "💡",
  planning_strategy: "📋",
  transformation_reformatting: "🔄",
  extraction_structuring: "📥",
  decision_support: "🎯",
  communication_drafting: "📧",
  creative_narrative: "🎨",
  conversational_companion: "💬",
  data_calculation: "📊",
  visual_description: "🖼️",
  tools_agents: "🤖",
  meta_ai: "🛰️",
};

export const CATEGORY_COLORS: Record<string, string> = {
  writing_content: "#a78bfa",
  coding_engineering: "#22d3ee",
  analysis_research: "#f472b6",
  learning_explanation: "#fbbf24",
  brainstorming_ideation: "#fb923c",
  planning_strategy: "#4ade80",
  transformation_reformatting: "#60a5fa",
  extraction_structuring: "#2dd4bf",
  decision_support: "#f87171",
  communication_drafting: "#e879f9",
  creative_narrative: "#f59e0b",
  conversational_companion: "#94a3b8",
  data_calculation: "#34d399",
  visual_description: "#c084fc",
  tools_agents: "#38bdf8",
  meta_ai: "#fb7185",
  unknown: "#6b7280",
  other: "#6b7280",
};

export const INSIGHT_COLORS: Record<string, { glow: string; text: string }> = {
  emerald: { glow: "glow-emerald", text: "text-emerald-300" },
  blue: { glow: "glow-cyan", text: "text-cyan-300" },
  violet: { glow: "glow-violet", text: "text-violet-300" },
  amber: { glow: "glow-amber", text: "text-amber-300" },
  cyan: { glow: "glow-cyan", text: "text-cyan-300" },
};

export const CATEGORIES = [
  "writing_content",
  "coding_engineering",
  "analysis_research",
  "learning_explanation",
  "brainstorming_ideation",
  "planning_strategy",
  "transformation_reformatting",
  "extraction_structuring",
  "decision_support",
  "communication_drafting",
  "creative_narrative",
  "conversational_companion",
  "data_calculation",
  "visual_description",
  "tools_agents",
  "meta_ai",
] as const;

// ──────────────────────────────────────────────────────────────────
// Formatting helpers
// ──────────────────────────────────────────────────────────────────
export function pct(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${(v * 100).toFixed(digits)}%`;
}

export function num(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return Math.round(v).toLocaleString();
}

export function emojiFor(cat?: string | null): string {
  if (!cat) return "•";
  return CATEGORY_EMOJI[cat] || "•";
}

export function colorFor(cat?: string | null): string {
  if (!cat) return "#6b7280";
  return CATEGORY_COLORS[cat] || "#6b7280";
}

/**
 * Render **bold** markdown fragments as <strong> elements.
 * Used by the home page live demo and advisor explanation display.
 */
export function renderBoldText(text: string): string[] {
  return text.split(/(\*\*[^*]+\*\*)/g);
}

// ──────────────────────────────────────────────────────────────────
// Provider & Tier visual mapping — centralized for all pages
// ──────────────────────────────────────────────────────────────────
export const PROVIDER_BADGE_CLASSES: Record<string, string> = {
  OpenAI: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  Anthropic: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  Google: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Mistral: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  xAI: "bg-red-500/10 text-red-400 border-red-500/20",
  DeepSeek: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  Meta: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  Alibaba: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  TogetherAI: "bg-rose-500/10 text-rose-400 border-rose-500/20",
};

export const TIER_BADGE_CLASSES: Record<string, string> = {
  frontier: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  mid: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  budget: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  specialized: "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

export function providerBadgeClass(provider: string): string {
  return PROVIDER_BADGE_CLASSES[provider] ?? "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
}

export function tierBadgeClass(tier: string): string {
  return TIER_BADGE_CLASSES[tier] ?? "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
}

// ──────────────────────────────────────────────────────────────────
// Fetch helper (typed, with basic error context)
// ──────────────────────────────────────────────────────────────────
export async function fetchJson<T>(path: string): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`);
  if (!r.ok) throw new Error(`${r.status} ${path}`);
  return (await r.json()) as T;
}
