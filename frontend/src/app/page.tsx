"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  ArrowRight,
  Brain,
  GitCompare,
  Database,
  Trophy,
  Loader2,
  Zap,
  Compass,
  BarChart3,
  Lock,
  DollarSign,
  Server,
  CheckCircle2,
  TrendingUp,
  Shield,
  Send,
  Target,
  Eye,
  Share2,
  ChevronRight,
  ChevronDown,
  Copy,
  Check,
  Lightbulb,
  AlertTriangle,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { analyzePromptRemote } from "@/lib/engine/analyzer";
import { ALL_MODELS } from "@/lib/data/models";
import { captureEvent, recordOutcome, submitFeedback } from "@/lib/telemetry";
import PromptRewriteCard from "@/components/PromptRewriteCard";
import FeedbackWidget from "@/components/FeedbackWidget";
import ConfidenceBand from "@/components/ConfidenceBand";
import OnboardingFlow from "@/components/OnboardingFlow";
import OnboardingNudge from "@/components/OnboardingNudge";
import ProductionReadiness from "@/components/ProductionReadiness";
import { useAuthFetch } from "@/lib/auth";
import { usePreferences } from "@/lib/preferences";
import type { AnalysisResult, TrackRecommendation } from "@/lib/types";

/* ── TYPEWRITER PLACEHOLDERS ────────────────────────────────────── */
const PLACEHOLDERS = [
  "Build a REST API in Python with auth...",
  "Summarize this 200-page legal contract...",
  "Create an autonomous research agent...",
  "Write a marketing email for my SaaS...",
  "Analyze financial data and build a report...",
  "Generate unit tests for my React app...",
];

function useTypewriter(strings: string[], speed = 50, pause = 2000) {
  const [text, setText] = useState("");
  const [idx, setIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const current = strings[idx];
    if (!deleting && charIdx < current.length) {
      const t = setTimeout(() => { setText(current.slice(0, charIdx + 1)); setCharIdx(charIdx + 1); }, speed);
      return () => clearTimeout(t);
    }
    if (!deleting && charIdx === current.length) {
      const t = setTimeout(() => setDeleting(true), pause);
      return () => clearTimeout(t);
    }
    if (deleting && charIdx > 0) {
      const t = setTimeout(() => { setText(current.slice(0, charIdx - 1)); setCharIdx(charIdx - 1); }, speed / 2);
      return () => clearTimeout(t);
    }
    if (deleting && charIdx === 0) {
      setDeleting(false);
      setIdx((idx + 1) % strings.length);
    }
  }, [charIdx, deleting, idx, strings, speed, pause]);

  return text;
}

/* ── USE-CASE TEMPLATES ─────────────────────────────────────────── */
const EXAMPLES = [
  { emoji: "🎫", label: "Support triage", full: "Classify and route incoming support tickets by urgency, category, and required expertise level. Handle 5K tickets/day.", category: "support", track: "speed" },
  { emoji: "💻", label: "Codebase Q&A", full: "Answer developer questions about a large TypeScript monorepo with 500+ files, using repo context and documentation.", category: "coding", track: "quality" },
  { emoji: "📄", label: "Long-doc extraction", full: "Extract key clauses, dates, parties, and obligations from 200-page legal contracts into structured JSON.", category: "extraction", track: "quality" },
  { emoji: "🤖", label: "Agent workflows", full: "Build an autonomous research agent that searches, evaluates sources, and produces a synthesized report with citations.", category: "agent", track: "quality" },
  { emoji: "📊", label: "Cheap classification", full: "Classify 100K product reviews by sentiment and topic at the lowest possible cost per request.", category: "data", track: "cost" },
  { emoji: "✍️", label: "Polished writing", full: "Write a compelling 2000-word thought leadership article about AI in enterprise, matching our sophisticated brand voice.", category: "writing", track: "quality" },
];

const FEATURES = [
  { icon: Database, title: "Models", desc: "24+ frontier models", href: "/models", gradient: "from-cyan-500 to-blue-500" },
  { icon: GitCompare, title: "Compare", desc: "Side-by-side", href: "/compare", gradient: "from-emerald-500 to-teal-500" },
  { icon: Compass, title: "Explorer", desc: "Event search", href: "/explorer", gradient: "from-amber-500 to-orange-500" },
  { icon: BarChart3, title: "Panel", desc: "Live analytics", href: "/dashboard", gradient: "from-rose-500 to-pink-500" },
  { icon: Lock, title: "Privacy", desc: "Transparent", href: "/privacy", gradient: "from-slate-400 to-slate-500" },
];

/* ── Shared UI primitives ─────────────────────────────────────── */
const PROVIDER_COLORS: Record<string, string> = {
  OpenAI: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  Anthropic: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  Google: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Mistral: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  xAI: "bg-red-500/10 text-red-400 border-red-500/20",
  DeepSeek: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  Meta: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  Alibaba: "bg-amber-500/10 text-amber-400 border-amber-500/20",
};
const TIER_COLORS: Record<string, string> = {
  frontier: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  mid: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  budget: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  specialized: "bg-purple-500/10 text-purple-400 border-purple-500/20",
};
const IMPORTANCE_STYLES: Record<string, { bg: string }> = {
  Critical: { bg: "bg-red-500" }, Important: { bg: "bg-orange-500" },
  Moderate: { bg: "bg-blue-500" }, Low: { bg: "bg-zinc-500" },
};

function PBadge({ provider }: { provider: string }) {
  return <Badge variant="outline" className={`${PROVIDER_COLORS[provider] ?? "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"} text-[10px]`}>{provider}</Badge>;
}
function TBadge({ tier }: { tier: string }) {
  return <Badge variant="outline" className={`${TIER_COLORS[tier] ?? "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"} text-[10px] capitalize`}>{tier}</Badge>;
}

/* ── Score Ring ────────────────────────────────────────────────── */
function ScoreRing({ score, size = 100 }: { score: number; size?: number }) {
  const r = size * 0.4; const sw = size * 0.06; const c = 2 * Math.PI * r;
  const color = score >= 80 ? "#34d399" : score >= 60 ? "#60a5fa" : score >= 40 ? "#fbbf24" : "#f87171";
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={sw} />
        <motion.circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={sw}
          strokeLinecap="round" strokeDasharray={c}
          initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c - (score / 100) * c }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.2 }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black text-white">{score}</span>
        <span className="text-[8px] font-bold uppercase tracking-wider text-zinc-500">/ 100</span>
      </div>
    </div>
  );
}

/* ── Collapsible ────────────────────────────────────────────────── */
function Collapsible({ title, children, defaultOpen = false, badge }: { title: string; children: React.ReactNode; defaultOpen?: boolean; badge?: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.01] overflow-hidden">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-white/[0.02]">
        <motion.div animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />
        </motion.div>
        <span className="text-sm font-semibold text-zinc-200 flex-1">{title}</span>
        {badge}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }}>
            <div className="px-5 pb-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Track Card ─────────────────────────────────────────────────── */
function TrackCard({ title, track, color }: { title: string; track: TrackRecommendation | null; color: string }) {
  if (!track) return (
    <div className="rounded-2xl border border-white/[0.04] bg-white/[0.01] p-5">
      <p className="text-sm font-semibold text-zinc-400">{title}</p>
      <p className="mt-1 text-xs text-zinc-600">Not applicable for this prompt.</p>
    </div>
  );
  return (
    <div className={`rounded-2xl border ${color} bg-[#0a0a1f]/60 p-5 space-y-3`}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-white">{title}</p>
        <PBadge provider={track.provider} />
      </div>
      <p className="text-lg font-black text-violet-300">{track.modelName}</p>
      <p className="text-[11px] text-zinc-500">{track.metricDetail}</p>
      <div className="space-y-2 text-xs">
        <div>
          <p className="text-[10px] font-bold text-emerald-400/80 uppercase tracking-wider">Why it won</p>
          <ul className="mt-1 list-inside list-disc text-zinc-400">{track.whyWon.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </div>
        {track.whyAlternativesLost.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-red-400/80 uppercase tracking-wider">Why #2 lost</p>
            <ul className="mt-1 list-inside list-disc text-zinc-400">{track.whyAlternativesLost.map((x, i) => <li key={i}>{x}</li>)}</ul>
          </div>
        )}
        {track.tradeoffs.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-amber-400/80 uppercase tracking-wider">Tradeoffs</p>
            <ul className="mt-1 list-inside list-disc text-zinc-400">{track.tradeoffs.map((x, i) => <li key={i}>{x}</li>)}</ul>
          </div>
        )}
        {track.switchToAlternativeIf.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-blue-400/80 uppercase tracking-wider">What would change the winner</p>
            <ul className="mt-1 list-inside list-disc text-zinc-400">{track.switchToAlternativeIf.map((x, i) => <li key={i}>{x}</li>)}</ul>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Deep Analysis ──────────────────────────────────────────────── */
function DeepAnalysis({ result }: { result: AnalysisResult }) {
  const a = result.advisor;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10">
          <Eye className="h-4 w-4 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-white">Deep Analysis</h2>
          <p className="text-[10px] text-zinc-500">Full reasoning pipeline</p>
        </div>
      </div>

      <Collapsible title="Prompt Understanding" defaultOpen>
        <p className="text-sm text-zinc-300 mb-2">{a.interpretation.jobToBeDone}</p>
        <div className="flex flex-wrap gap-4 text-xs text-zinc-500">
          <span><span className="text-zinc-400">Primary:</span> {a.interpretation.primaryTasks.map(t => t.label).join(" · ") || "—"}</span>
          <span><span className="text-zinc-400">Secondary:</span> {a.interpretation.secondaryTasks.map(t => t.label).join(" · ") || "—"}</span>
        </div>
      </Collapsible>

      <Collapsible title="Eligibility Filtering" badge={<span className="panel-chip chip-sm">{a.eligibilityExclusions.length} excluded</span>}>
        <div className="max-h-48 space-y-2 overflow-y-auto panel-scroll text-xs">
          {a.eligibilityExclusions.length === 0 ? <p className="text-zinc-500">All models passed.</p> :
            a.eligibilityExclusions.slice(0, 15).map(e => (
              <div key={e.modelId} className="border-b border-white/[0.03] pb-2 last:border-0">
                <p className="font-semibold text-zinc-300">{e.modelName}</p>
                <ul className="list-inside list-disc text-zinc-500">{e.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
              </div>
            ))
          }
        </div>
      </Collapsible>

      <Collapsible title="Multi-Track Winners" defaultOpen>
        <div className="grid gap-3 md:grid-cols-2">
          <TrackCard title="Best Quality" track={a.tracks.bestAbsolute} color="border-yellow-500/15" />
          <TrackCard title="Best Value" track={a.tracks.bestValue} color="border-emerald-500/15" />
          <TrackCard title="Lowest Latency" track={a.tracks.bestLowLatency} color="border-cyan-500/15" />
          <TrackCard title="Open / Self-Hosted" track={a.tracks.bestOpenSelfHosted} color="border-indigo-500/15" />
        </div>
      </Collapsible>

      <Collapsible title="Confidence & Uncertainty" defaultOpen>
        <div className="grid gap-2 sm:grid-cols-2 text-sm">
          {[
            ["Interpretation", `~${Math.round(a.uncertainty.interpretationConfidence * 100)}%`],
            ["Ranking", `~${Math.round(a.uncertainty.rankingConfidence * 100)}%`],
            ["Top score gap", a.uncertainty.topScoreGap.toFixed(1)],
            ["Marginal winner", a.uncertainty.isMarginalWinner ? "Yes" : "No"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between rounded-xl bg-white/[0.02] px-4 py-2.5">
              <span className="text-zinc-500">{k}</span>
              <span className={`font-semibold ${v === "Yes" ? "text-amber-400" : "text-zinc-200"}`}>{v}</span>
            </div>
          ))}
        </div>
      </Collapsible>
    </div>
  );
}

/* ── Sidebar ────────────────────────────────────────────────────── */
function Sidebar({ result }: { result: AnalysisResult }) {
  const reqs = result.keyRequirements.filter(r => r.importance !== "Not needed");
  const interp = result.advisor.interpretation;
  const tc = result.taskClassification;
  return (
    <div className="space-y-5">
      {reqs.length > 0 && (
        <div className="panel-card p-5 space-y-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-white"><Target className="h-4 w-4 text-violet-400" />Requirements</h3>
          {reqs.map((req, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-300">{req.label}</span>
                <span className="text-[10px] text-zinc-500 text-data">{Math.round(req.weight * 100)}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.04]">
                <motion.div className={`h-full rounded-full ${(IMPORTANCE_STYLES[req.importance] ?? IMPORTANCE_STYLES.Low).bg}`}
                  initial={{ width: 0 }} animate={{ width: `${Math.round(req.weight * 100)}%` }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: i * 0.05 }} />
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="panel-card p-5 space-y-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-white"><Brain className="h-4 w-4 text-pink-400" />Task Analysis</h3>
        <p className="text-sm text-zinc-300">{interp.jobToBeDone}</p>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div><p className="text-zinc-500">Category</p><p className="text-zinc-200 font-semibold">{tc.parentCategory}</p></div>
          <div><p className="text-zinc-500">Domain</p><p className="text-zinc-200 font-semibold">{result.promptContext.domain ?? "General"}</p></div>
          <div><p className="text-zinc-500">Input tokens</p><p className="text-zinc-200 font-mono">{result.promptContext.estimatedInputTokens.toLocaleString()}</p></div>
          <div><p className="text-zinc-500">Output tokens</p><p className="text-zinc-200 font-mono">{result.promptContext.estimatedOutputTokens.toLocaleString()}</p></div>
        </div>
      </div>
    </div>
  );
}

/* ── Telemetry helper ─────────────────────────────────────────── */
function routingCapture(analysis: AnalysisResult) {
  const top = analysis.recommendations[0];
  const tracks = analysis.advisor?.tracks;
  const tradeoff = tracks?.bestAbsolute?.modelId === top?.modelId ? "quality_first" : tracks?.bestValue?.modelId === top?.modelId ? "balanced" : "speed_first";
  return { recommended_model: top?.modelId, candidate_models: analysis.recommendations.slice(0, 5).map((r, i) => ({ model_id: r.modelId, score: r.score, track: i === 0 ? "bestAbsolute" : undefined })), routing_confidence: Math.max(0, Math.min(1, analysis.confidence / 100)), routing_explanation: analysis.explanationSummary, tradeoff_profile: tradeoff, routing_strategy_version: "advisor-v3.0.0" };
}

/* ═══════════════════════════════════════════════════════════════════ */

function HomePageInner() {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [promptCount, setPromptCount] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const startedAt = useRef(0);
  const placeholder = useTypewriter(PLACEHOLDERS);
  const searchParams = useSearchParams();
  const { authFetch, isSignedIn } = useAuthFetch();
  const { preferences } = usePreferences();

  // Show onboarding on first visit
  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem("nr_onboarding_completed")) {
      setShowOnboarding(true);
    }
  }, []);

  // Workflow presets
  const [presets, setPresets] = useState<Array<{ preset_id: string; name: string; slug: string; icon: string | null; is_system: boolean; default_track: string; excluded_providers: string[]; preferred_providers: string[]; budget_ceiling_per_1m: number | null; prefer_open_weight: boolean; min_reasoning_score: number | null; min_coding_score: number | null; require_function_calling: boolean; require_structured_output: boolean; require_vision: boolean; require_long_context: boolean }>>([]);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"}/presets`)
      .then(r => r.ok ? r.json() : [])
      .then(setPresets)
      .catch(() => {});
  }, []);

  // Build constraint overrides from preferences + active preset
  const buildOverrides = useCallback(() => {
    const overrides: {
      excludedProviders?: string[];
      preferredProviders?: string[];
      allowedProviders?: string[];
      budgetCeiling?: number;
      preferOpenWeight?: boolean;
      defaultTrack?: string;
    } = {};

    // Layer 0: onboarding provider selection (localStorage)
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("nr_onboarding_providers");
      if (stored) {
        try {
          const providers = JSON.parse(stored) as string[];
          if (Array.isArray(providers) && providers.length > 0) {
            overrides.allowedProviders = providers;
          }
        } catch { /* ignore malformed */ }
      }
    }

    // Layer 1: user preferences
    if (preferences) {
      if (preferences.excluded_providers.length) overrides.excludedProviders = preferences.excluded_providers;
      if (preferences.preferred_providers.length) overrides.preferredProviders = preferences.preferred_providers;
      if (preferences.budget_ceiling_per_1m != null) overrides.budgetCeiling = preferences.budget_ceiling_per_1m;
      if (preferences.prefer_open_weight) overrides.preferOpenWeight = true;
      if (preferences.default_track !== "balanced") overrides.defaultTrack = preferences.default_track;
    }

    // Layer 2: active preset overrides preferences
    const preset = presets.find(p => p.preset_id === activePreset);
    if (preset) {
      if (preset.excluded_providers.length) overrides.excludedProviders = preset.excluded_providers;
      if (preset.preferred_providers.length) overrides.preferredProviders = preset.preferred_providers;
      if (preset.budget_ceiling_per_1m != null) overrides.budgetCeiling = preset.budget_ceiling_per_1m;
      if (preset.prefer_open_weight) overrides.preferOpenWeight = true;
      if (preset.default_track !== "balanced") overrides.defaultTrack = preset.default_track;
    }

    return Object.keys(overrides).length > 0 ? overrides : undefined;
  }, [preferences, presets, activePreset]);

  const analyze = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setLoading(true); setError(null); setResult(null); startedAt.current = Date.now();
    try {
      const overrides = buildOverrides();
      const r = await analyzePromptRemote(text.trim(), ALL_MODELS, overrides);
      setResult(r);
      captureEvent({ prompt: text.trim(), routing: routingCapture(r) }).then(ev => { if (ev) setEventId(ev.event_id); }).catch(() => {});

      // Auto-save to history for signed-in users
      if (isSignedIn) {
        const top = r.recommendations[0];
        authFetch("/user/history", {
          method: "POST",
          body: JSON.stringify({
            prompt_text: text.trim(),
            prompt_preview: text.trim().slice(0, 300),
            winner_model_id: top?.modelId ?? null,
            winner_model_name: top?.modelName ?? null,
            winner_provider: top?.provider ?? null,
            winner_score: top?.score ?? null,
            task_type: r.taskClassification?.primary ?? null,
            optimization_track: r.advisor?.tracks?.bestAbsolute?.trackId ?? null,
            full_result_json: r,
          }),
        }).catch(() => {});
      }
      setPromptCount((c) => c + 1);
    } catch (e) { setError(e instanceof Error ? e.message : "Analysis failed"); }
    finally { setLoading(false); }
  }, [buildOverrides, isSignedIn, authFetch]);

  // Re-run from history via ?q= or deep-link from use-case pages via ?prompt=
  useEffect(() => {
    const q = searchParams.get("q") || searchParams.get("prompt");
    if (q) {
      const decoded = decodeURIComponent(q);
      setPrompt(decoded);
      void analyze(decoded);
    }
    // Auto-select track from deep-link
    const track = searchParams.get("track");
    if (track) {
      const preset = presets.find((p) => p.default_track === track || p.slug === track);
      if (preset) setActivePreset(preset.preset_id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCopy = useCallback(async () => {
    const top = result?.recommendations[0]; if (!top) return;
    try { await navigator.clipboard.writeText(top.modelId); } catch {}
    setCopied(true); setTimeout(() => setCopied(false), 2000);
    if (eventId) recordOutcome(eventId, { selected_model: top.modelId, copied: true, time_to_decision_ms: Date.now() - startedAt.current }).catch(() => {});
  }, [eventId, result]);

  const handleShare = useCallback(async () => {
    if (!result || !result.recommendations[0]) return;
    const top = result.recommendations[0];
    const payload = {
      prompt: result.promptPreview || result.prompt.slice(0, 300),
      winner: {
        modelId: top.modelId,
        modelName: top.modelName,
        provider: top.provider,
        score: top.score,
        tier: top.tier,
        reasoning: top.reasoning[0],
        inputCost: top.pricingEstimate.inputCost,
        outputCost: top.pricingEstimate.outputCost,
      },
      alternatives: result.recommendations.slice(1, 4).map(r => ({
        modelId: r.modelId,
        modelName: r.modelName,
        provider: r.provider,
        score: r.score,
        tier: r.tier,
      })),
      task: result.taskClassification.primaryLabel,
      confidence: result.confidence,
      ts: result.timestamp,
    };
    const encoded = btoa(encodeURIComponent(JSON.stringify(payload)));
    const url = `${window.location.origin}/result?d=${encoded}`;
    try { await navigator.clipboard.writeText(url); } catch {}
    setShared(true); setTimeout(() => setShared(false), 2500);
  }, [result]);

  // Override capture state (Sprint 1.2)
  const [overrideTarget, setOverrideTarget] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState<string | null>(null);
  const [overrideSubmitted, setOverrideSubmitted] = useState(false);

  const top = result?.recommendations[0];
  const runnerUps = result?.recommendations.slice(1, 5) ?? [];

  return (
    <div className="space-y-24">
      {/* ═══════ ONBOARDING ═══════ */}
      <AnimatePresence>
        {showOnboarding && !result && (
          <section className="relative pt-8">
            <OnboardingFlow
              onComplete={(seedPrompt, track) => {
                setShowOnboarding(false);
                setPrompt(seedPrompt);
                void analyze(seedPrompt);
              }}
              onSkip={() => setShowOnboarding(false)}
            />
          </section>
        )}
      </AnimatePresence>

      {/* ═══════ HERO ═══════ */}
      <section className="relative pt-8 md:pt-16">
        {/* Animated background orbs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute top-[-30%] left-1/2 -translate-x-1/2 w-[1000px] h-[800px] rounded-full opacity-40"
            style={{ background: "radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)" }} />
          <div className="absolute top-[10%] left-[10%] w-[400px] h-[400px] rounded-full opacity-30 animate-pulse"
            style={{ background: "radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)", animationDuration: "4s" }} />
          <div className="absolute bottom-[0%] right-[15%] w-[300px] h-[300px] rounded-full opacity-20 animate-pulse"
            style={{ background: "radial-gradient(circle, rgba(168,85,247,0.1) 0%, transparent 70%)", animationDuration: "6s" }} />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="relative text-center max-w-4xl mx-auto"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 rounded-full bg-violet-500/10 border border-violet-500/20 px-4 py-2 mb-8"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
              24 models &middot; 8 providers &middot; Free forever
            </span>
          </motion.div>

          {/* Title */}
          <h1 className="text-[56px] md:text-[80px] lg:text-[96px] font-black tracking-[-0.05em] leading-[0.9] mb-8"
            style={{
              background: "linear-gradient(135deg, #ffffff 0%, #e0e7ff 30%, #a78bfa 60%, #7c3aed 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text"
            }}>
            Find your<br />perfect AI.
          </h1>

          <p className="text-xl md:text-2xl text-zinc-400 max-w-lg mx-auto leading-relaxed font-medium mb-12">
            Describe your task. Get the <span className="text-white">best model</span> instantly.
          </p>
        </motion.div>

        {/* ═══════ INPUT ═══════ */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.7 }}
          className="relative max-w-2xl mx-auto"
        >
          <div className="absolute -inset-1 rounded-[28px] bg-gradient-to-r from-violet-500/20 via-indigo-500/20 to-purple-500/20 blur-xl opacity-60 pointer-events-none" />
          <div className="relative rounded-[24px] border border-white/[0.1] bg-[#0c0c20]/90 backdrop-blur-2xl shadow-2xl shadow-black/40 overflow-hidden">
            <textarea
              ref={inputRef}
              placeholder={placeholder}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void analyze(prompt); }}
              className="w-full bg-transparent text-white text-lg placeholder:text-zinc-600 resize-none border-0 focus:outline-none focus:ring-0 px-6 pt-6 pb-2 min-h-[80px]"
              rows={2}
            />
            <div className="flex items-center justify-between px-4 pb-4 pt-1">
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {EXAMPLES.map((ex) => (
                  <button key={ex.label} onClick={() => { setPrompt(ex.full); void analyze(ex.full); }}
                    className="shrink-0 rounded-full bg-white/[0.04] border border-white/[0.06] px-3 py-1.5 text-[11px] font-medium text-zinc-500 hover:text-white hover:border-violet-500/30 hover:bg-violet-500/8 transition-all whitespace-nowrap flex items-center gap-1.5">
                    <span>{ex.emoji}</span> {ex.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => void analyze(prompt)}
                disabled={!prompt.trim() || loading}
                className="ml-3 shrink-0 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 hover:brightness-110 transition-all disabled:opacity-30 disabled:cursor-not-allowed ring-1 ring-white/10"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Workflow presets */}
          {presets.length > 0 && (
            <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-1 scrollbar-none">
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-zinc-600">Workflow:</span>
              {presets.map((p) => (
                <button
                  key={p.preset_id}
                  onClick={() => setActivePreset(activePreset === p.preset_id ? null : p.preset_id)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all whitespace-nowrap ${
                    activePreset === p.preset_id
                      ? "bg-violet-500/20 text-violet-300 border border-violet-500/40 ring-1 ring-violet-500/30"
                      : "bg-white/[0.03] text-zinc-500 border border-white/[0.06] hover:text-zinc-300 hover:border-white/10"
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </motion.div>

        {/* ═══════ LOADING ═══════ */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-2xl mx-auto mt-8"
            >
              <div className="rounded-2xl border border-violet-500/15 bg-violet-500/[0.04] p-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-violet-500/5 to-transparent animate-pulse" style={{ animationDuration: "2s" }} />
                <div className="relative flex items-center gap-4">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <motion.div key={i}
                        className="w-2.5 h-2.5 rounded-full bg-violet-400"
                        animate={{ y: [0, -8, 0], opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
                      />
                    ))}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-violet-300">Routing your prompt</p>
                    <p className="text-[11px] text-zinc-500">Scoring 24 models across 13 capability dimensions...</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══════ ERROR ═══════ */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="max-w-2xl mx-auto mt-6">
              <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-center text-sm text-red-300">{error}</div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══════ RESULTS ═══════ */}
        <AnimatePresence>
          {result && top && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-5xl mx-auto mt-12 space-y-8"
            >
              {/* Task badge + confidence band */}
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <span className="panel-chip panel-chip-active">{result.taskClassification.primaryLabel}</span>
                <ConfidenceBand rawConfidence={result.confidence} compact showAdvice={false} />
              </div>

              <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
                <div className="space-y-6">
                  {/* Winner */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 }}
                    className="relative rounded-3xl border border-yellow-500/20 bg-gradient-to-br from-yellow-500/[0.04] via-[#0c0c20] to-[#0c0c20] overflow-hidden"
                    style={{ boxShadow: "0 0 80px -20px rgba(250,204,21,0.12)" }}
                  >
                    <div className="p-8 flex flex-col md:flex-row items-center gap-8">
                      <ScoreRing score={top.score} size={110} />
                      <div className="flex-1 text-center md:text-left">
                        <div className="flex items-center gap-2 justify-center md:justify-start mb-1">
                          <Trophy className="h-4 w-4 text-yellow-400" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-yellow-400">Best Match</span>
                        </div>
                        <h2 className="text-3xl font-black text-white mb-2">{top.modelName}</h2>
                        <p className="text-sm text-zinc-400 mb-2">{top.reasoning[0]}</p>
                        {runnerUps[0] && (
                          <p className="text-[11px] text-zinc-500 mb-4">
                            <span className="text-zinc-400 font-medium">vs {runnerUps[0].modelName}:</span>{" "}
                            {runnerUps[0].reasoning[0]}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                          <PBadge provider={top.provider} /><TBadge tier={top.tier} />
                          <span className="panel-chip chip-sm">In: {top.pricingEstimate.inputCost}</span>
                          <span className="panel-chip chip-sm">Out: {top.pricingEstimate.outputCost}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => void handleCopy()} className="gap-1.5 rounded-xl">
                      {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      {copied ? "Copied!" : "Copy ID"}
                    </Button>
                    <Link href={`/models/${top.modelId}`}><Button size="sm" variant="outline" className="gap-1.5 rounded-xl"><Database className="h-3 w-3" />View Model</Button></Link>
                    {runnerUps[0] && <Link href="/compare"><Button size="sm" variant="outline" className="gap-1.5 rounded-xl"><GitCompare className="h-3 w-3" />Compare</Button></Link>}
                    <Button size="sm" variant="outline" onClick={() => void handleShare()} className="gap-1.5 rounded-xl">
                      {shared ? <Check className="h-3 w-3 text-emerald-400" /> : <Share2 className="h-3 w-3" />}
                      {shared ? "Link copied!" : "Share"}
                    </Button>
                    <button onClick={() => { setPrompt(""); setResult(null); setEventId(null); inputRef.current?.focus(); }}
                      className="ml-auto text-sm text-zinc-500 hover:text-violet-300 transition-colors font-semibold">
                      Try another
                    </button>
                  </div>

                  {/* Feedback */}
                  <FeedbackWidget
                    eventId={eventId}
                    recommendedModelId={top.modelId}
                    recommendedModelName={top.modelName}
                    allModelNames={ALL_MODELS.filter(m => m.isActive).map(m => ({ id: m.id, name: m.displayName }))}
                    startedAt={startedAt.current}
                  />

                  {/* Confidence detail */}
                  <ConfidenceBand rawConfidence={result.confidence} />

                  {/* Onboarding nudge */}
                  <OnboardingNudge promptCount={promptCount} />

                  {/* Production readiness */}
                  <ProductionReadiness result={result} />

                  {/* Prompt Rewrite */}
                  {prompt.trim() && top && (
                    <PromptRewriteCard
                      originalPrompt={prompt.trim()}
                      modelId={top.modelId}
                      modelDisplayName={top.modelName}
                    />
                  )}

                  {/* Runner-ups with override capture */}
                  {runnerUps.length > 0 && (
                    <div>
                      <h3 className="panel-label mb-3 flex items-center gap-2"><BarChart3 className="h-3.5 w-3.5 text-violet-400" />Alternatives</h3>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {runnerUps.map((rec, i) => (
                          <motion.div key={rec.modelId} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.08 }}>
                            <div
                              onClick={() => { if (overrideTarget !== rec.modelId) { setOverrideTarget(rec.modelId); setOverrideReason(null); setOverrideSubmitted(false); } }}
                              className="panel-card panel-card-hover p-4 cursor-pointer"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/[0.06] text-[10px] font-black text-zinc-400">{rec.rank}</span>
                                  <span className="font-bold text-white text-sm">{rec.modelName}</span>
                                </div>
                                <span className="text-sm font-black text-data text-zinc-300">{rec.score}</span>
                              </div>
                              <p className="text-[11px] text-zinc-500 line-clamp-2">{rec.reasoning[0]}</p>
                              <div className="mt-2 flex gap-1.5"><PBadge provider={rec.provider} /><TBadge tier={rec.tier} /></div>
                            </div>
                            {/* Override capture slide-down */}
                            <AnimatePresence>
                              {overrideTarget === rec.modelId && !overrideSubmitted && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden"
                                >
                                  <div className="mt-1 rounded-xl border border-violet-500/15 bg-violet-500/[0.03] p-3 space-y-2">
                                    <p className="text-[11px] font-semibold text-violet-300">What made you choose this instead?</p>
                                    <div className="flex flex-wrap gap-1">
                                      {["cheaper","faster","better_coding","better_writing","better_reasoning","privacy","habit"].map(r => (
                                        <button key={r} onClick={(e) => { e.stopPropagation(); setOverrideReason(overrideReason === r ? null : r); }}
                                          className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition-all border ${
                                            overrideReason === r
                                              ? "bg-violet-500/15 text-violet-300 border-violet-500/30"
                                              : "bg-white/[0.03] text-zinc-500 border-white/[0.06] hover:text-zinc-300"
                                          }`}>
                                          {r.replace("_", " ")}
                                        </button>
                                      ))}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setOverrideSubmitted(true);
                                          if (eventId && top) {
                                            submitFeedback({
                                              event_id: eventId,
                                              feedback_type: "override",
                                              recommended_model: top.modelId,
                                              selected_model: rec.modelId,
                                              override_reason: overrideReason ?? undefined,
                                              time_to_feedback_ms: Date.now() - startedAt.current,
                                            });
                                            recordOutcome(eventId, {
                                              user_accepted_recommendation: false,
                                              user_overrode_recommendation: true,
                                              selected_model: rec.modelId,
                                              override_reason: overrideReason ?? "other",
                                              time_to_decision_ms: Date.now() - startedAt.current,
                                            });
                                          }
                                        }}
                                        className="rounded-lg bg-violet-500/15 border border-violet-500/25 px-3 py-1.5 text-[11px] font-semibold text-violet-300 hover:bg-violet-500/20 transition-all"
                                      >
                                        Submit
                                      </button>
                                      <button onClick={(e) => { e.stopPropagation(); setOverrideTarget(null); }}
                                        className="text-[11px] text-zinc-600 hover:text-zinc-400">
                                        Dismiss
                                      </button>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                              {overrideTarget === rec.modelId && overrideSubmitted && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-1 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.03] p-2 flex items-center gap-2">
                                  <Check className="h-3 w-3 text-emerald-400" />
                                  <span className="text-[11px] text-emerald-300 font-medium">Thanks!</span>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Budget / Open Weight */}
                  {(result.budgetAlternative || result.openWeightAlternative) && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {result.budgetAlternative && (
                        <div className="panel-card p-4 border-emerald-500/10">
                          <div className="flex items-center gap-2 mb-2">
                            <DollarSign className="h-4 w-4 text-emerald-400" />
                            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">Budget Pick</span>
                          </div>
                          <p className="font-bold text-white">{result.budgetAlternative.modelName}</p>
                          <p className="text-[11px] text-zinc-500 mt-1">{result.budgetAlternative.reasoning[0]}</p>
                        </div>
                      )}
                      {result.openWeightAlternative && (
                        <div className="panel-card p-4 border-indigo-500/10">
                          <div className="flex items-center gap-2 mb-2">
                            <Server className="h-4 w-4 text-indigo-400" />
                            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400">Open Weight</span>
                          </div>
                          <p className="font-bold text-white">{result.openWeightAlternative.modelName}</p>
                          <p className="text-[11px] text-zinc-500 mt-1">{result.openWeightAlternative.reasoning[0]}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Deep Analysis */}
                  <DeepAnalysis result={result} />
                </div>

                {/* Sidebar */}
                <Sidebar result={result} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ═══════ FEATURES ═══════ */}
      <section>
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-headline">Every tool you need.</h2>
          <p className="text-zinc-500 mt-2">Five surfaces, one intelligence platform.</p>
        </motion.div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {FEATURES.map((f, i) => (
            <motion.div key={f.href}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
            >
              <Link href={f.href}>
                <div className="panel-card panel-card-hover p-5 text-center h-full group cursor-pointer">
                  <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${f.gradient} shadow-lg group-hover:scale-110 group-hover:shadow-xl transition-all duration-300`}>
                    <f.icon className="h-5 w-5 text-white" />
                  </div>
                  <p className="font-bold text-white text-sm">{f.title}</p>
                  <p className="text-[11px] text-zinc-500 mt-1">{f.desc}</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══════ STATS ═══════ */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="panel-card p-0 overflow-hidden"
      >
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-white/[0.04]">
          {[
            { value: "24+", label: "Models" },
            { value: "8", label: "Providers" },
            { value: "13", label: "Score Axes" },
            { value: "$0", label: "Cost" },
          ].map((s) => (
            <div key={s.label} className="p-8 text-center">
              <p className="text-3xl md:text-4xl font-black text-white text-data">{s.value}</p>
              <p className="text-xs font-bold text-zinc-500 mt-1.5 uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </div>
      </motion.section>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense>
      <HomePageInner />
    </Suspense>
  );
}
