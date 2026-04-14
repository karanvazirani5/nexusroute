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
  Loader2,
  Zap,
  BarChart3,
  Lock,
  CheckCircle2,
  TrendingUp,
  Shield,
  Send,
  Target,
  ChevronDown,
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
import { ResultsView } from "@/components/ResultsView";
import OnboardingFlow from "@/components/OnboardingFlow";
import OnboardingNudge from "@/components/OnboardingNudge";
import { useAuthFetch } from "@/lib/auth";
import { usePreferences } from "@/lib/preferences";
import type { AnalysisResult } from "@/lib/types";

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
  { icon: Target, title: "Use Cases", desc: "Real workloads", href: "/use-cases", gradient: "from-amber-500 to-orange-500" },
  { icon: Brain, title: "Guides", desc: "Expert advice", href: "/guides", gradient: "from-rose-500 to-pink-500" },
  { icon: Lock, title: "Privacy", desc: "Transparent", href: "/privacy", gradient: "from-slate-400 to-slate-500" },
];

/* ── Shared UI primitives ─────────────────────────────────────── */
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
  const [activeProviders, setActiveProviders] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const startedAt = useRef(0);
  const placeholder = useTypewriter(PLACEHOLDERS);
  const searchParams = useSearchParams();
  const { authFetch, isSignedIn } = useAuthFetch();
  const { preferences } = usePreferences();

  // Show onboarding only for signed-in users who haven't completed it
  useEffect(() => {
    if (typeof window !== "undefined" && isSignedIn && !localStorage.getItem("nr_onboarding_completed")) {
      setShowOnboarding(true);
    }
  }, [isSignedIn]);

  // Load saved provider selections from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("nr_onboarding_providers");
      if (stored) {
        try {
          const providers = JSON.parse(stored) as string[];
          if (Array.isArray(providers) && providers.length > 0) {
            setActiveProviders(new Set(providers));
          }
        } catch { /* ignore */ }
      }
    }
  }, []);

  const toggleProviderFilter = (id: string) => {
    setActiveProviders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      if (typeof window !== "undefined") {
        if (next.size > 0) {
          localStorage.setItem("nr_onboarding_providers", JSON.stringify([...next]));
        } else {
          localStorage.removeItem("nr_onboarding_providers");
        }
      }
      return next;
    });
  };

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

    // Layer 0: provider filter from top-bar buttons
    if (activeProviders.size > 0) {
      overrides.allowedProviders = [...activeProviders];
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
  }, [preferences, presets, activePreset, activeProviders]);

  const analyze = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setLoading(true); setError(null); setResult(null); startedAt.current = Date.now();
    try {
      const overrides = buildOverrides();
      const r = await analyzePromptRemote(text.trim(), ALL_MODELS, overrides);
      setResult(r);
      // Auto-scroll to results
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
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

  const top = result?.recommendations[0];

  return (
    <div className="space-y-24">
      {/* ═══════ ONBOARDING ═══════ */}
      <AnimatePresence>
        {showOnboarding && !result && (
          <section className="relative pt-8">
            <OnboardingFlow
              onComplete={() => {
                setShowOnboarding(false);
                // Reload provider selections from localStorage (set by OnboardingFlow)
                const stored = localStorage.getItem("nr_onboarding_providers");
                if (stored) {
                  try {
                    const providers = JSON.parse(stored) as string[];
                    if (Array.isArray(providers) && providers.length > 0) {
                      setActiveProviders(new Set(providers));
                    }
                  } catch { /* ignore */ }
                }
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
          {/* Provider filter pills */}
          <div className="flex items-center gap-1.5 mb-3 overflow-x-auto pb-1 scrollbar-none justify-center flex-wrap">
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-zinc-600 mr-1">Models:</span>
            {(["OpenAI", "Anthropic", "Google", "xAI", "Mistral", "DeepSeek"] as const).map((prov) => (
              <button
                key={prov}
                onClick={() => toggleProviderFilter(prov)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all whitespace-nowrap border ${
                  activeProviders.has(prov)
                    ? `${PROVIDER_COLORS[prov]} ring-1 ring-current/20`
                    : "bg-white/[0.03] text-zinc-500 border-white/[0.06] hover:text-zinc-300 hover:border-white/10"
                }`}
              >
                {prov}
              </button>
            ))}
            {activeProviders.size > 0 && (
              <button
                onClick={() => { setActiveProviders(new Set()); localStorage.removeItem("nr_onboarding_providers"); }}
                className="shrink-0 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors ml-1"
              >
                Clear
              </button>
            )}
          </div>

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
              ref={resultRef}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              <OnboardingNudge promptCount={promptCount} />
              <ResultsView
                result={result}
                prompt={prompt}
                eventId={eventId}
                startedAt={startedAt.current}
                onTryAnother={() => { setPrompt(""); setResult(null); setEventId(null); inputRef.current?.focus(); }}
                onCopyId={handleCopy}
                onShare={handleShare}
                copied={copied}
                shared={shared}
              />
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
