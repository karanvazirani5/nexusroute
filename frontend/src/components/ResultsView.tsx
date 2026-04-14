"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Database,
  DollarSign,
  Eye,
  GitCompare,
  Server,
  Share2,
  Sparkles,
  Target,
  Brain,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ConfidenceBand from "@/components/ConfidenceBand";
import FeedbackWidget from "@/components/FeedbackWidget";
import ProductionReadiness from "@/components/ProductionReadiness";
import PromptRewriteCard from "@/components/PromptRewriteCard";
import { ALL_MODELS } from "@/lib/data/models";
import { submitFeedback, recordOutcome } from "@/lib/telemetry";
import type {
  AnalysisResult,
  TrackRecommendation,
  ModelRecommendation,
} from "@/lib/types";

/* ── Helpers ─────────────────────────────────────────────────────── */

const EASE = [0.22, 1, 0.36, 1] as const;

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
  Critical: { bg: "bg-red-500" },
  Important: { bg: "bg-orange-500" },
  Moderate: { bg: "bg-blue-500" },
  Low: { bg: "bg-zinc-500" },
};

function PBadge({ provider }: { provider: string }) {
  return (
    <Badge
      variant="outline"
      className={`${PROVIDER_COLORS[provider] ?? "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"} text-[10px]`}
    >
      {provider}
    </Badge>
  );
}

function TBadge({ tier }: { tier: string }) {
  return (
    <Badge
      variant="outline"
      className={`${TIER_COLORS[tier] ?? "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"} text-[10px] capitalize`}
    >
      {tier}
    </Badge>
  );
}

/* ── Collapsible ────────────────────────────────────────────────── */
function Section({
  title,
  children,
  defaultOpen = false,
  icon,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  icon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-white/[0.02]"
      >
        {icon && (
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/[0.04]">
            {icon}
          </div>
        )}
        <span className="text-[13px] font-semibold text-zinc-300 flex-1">
          {title}
        </span>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-3.5 w-3.5 text-zinc-600" />
        </motion.div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="px-5 pb-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Track Card ─────────────────────────────────────────────────── */
function TrackCard({
  title,
  track,
  color,
}: {
  title: string;
  track: TrackRecommendation | null;
  color: string;
}) {
  if (!track)
    return (
      <div className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-4">
        <p className="text-xs font-semibold text-zinc-500">{title}</p>
        <p className="mt-1 text-[11px] text-zinc-600">Not applicable.</p>
      </div>
    );
  return (
    <div className={`rounded-xl border ${color} bg-[#0a0a1f]/60 p-4 space-y-2`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-white">{title}</p>
        <PBadge provider={track.provider} />
      </div>
      <p className="text-sm font-black text-violet-300">{track.modelName}</p>
      <p className="text-[11px] text-zinc-500">{track.metricDetail}</p>
      {track.whyWon.length > 0 && (
        <ul className="list-inside list-disc text-[11px] text-zinc-400">
          {track.whyWon.slice(0, 2).map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   RESULTS VIEW
   ══════════════════════════════════════════════════════════════════ */

interface ResultsViewProps {
  result: AnalysisResult;
  prompt: string;
  eventId: string | null;
  startedAt: number;
  onTryAnother: () => void;
  onCopyId: () => Promise<void>;
  onShare: () => Promise<void>;
  copied: boolean;
  shared: boolean;
}

export function ResultsView({
  result,
  prompt,
  eventId,
  startedAt,
  onTryAnother,
  onCopyId,
  onShare,
  copied,
  shared,
}: ResultsViewProps) {
  const top = result.recommendations[0];
  const runnerUps = result.recommendations.slice(1, 4);
  const [expandedAlt, setExpandedAlt] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState<string | null>(null);
  const [overrideSubmitted, setOverrideSubmitted] = useState(false);

  if (!top) return null;

  const handleOverrideSubmit = (rec: ModelRecommendation) => {
    setOverrideSubmitted(true);
    if (eventId) {
      submitFeedback({
        event_id: eventId,
        feedback_type: "override",
        recommended_model: top.modelId,
        selected_model: rec.modelId,
        override_reason: overrideReason ?? undefined,
        time_to_feedback_ms: Date.now() - startedAt,
      });
      recordOutcome(eventId, {
        user_accepted_recommendation: false,
        user_overrode_recommendation: true,
        selected_model: rec.modelId,
        override_reason: overrideReason ?? "other",
        time_to_decision_ms: Date.now() - startedAt,
      });
    }
  };

  const reqs = result.keyRequirements.filter(
    (r) => r.importance !== "Not needed"
  );
  const a = result.advisor;
  const tc = result.taskClassification;

  return (
    <div className="max-w-2xl mx-auto mt-10 space-y-6">
      {/* ── TIER 1: The Answer ──────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.03] to-transparent p-6 space-y-4"
        style={{
          boxShadow: "0 0 80px -30px rgba(139,92,246,0.12)",
        }}
      >
        {/* Top row: task + confidence */}
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-violet-500/10 border border-violet-500/20 px-3 py-1 text-[10px] font-bold text-violet-400 uppercase tracking-wider">
            {tc.primaryLabel}
          </span>
          <ConfidenceBand
            rawConfidence={result.confidence}
            compact
            showAdvice={false}
          />
        </div>

        {/* The model name — the biggest thing on screen */}
        <div>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">
            Use this model
          </p>
          <h2 className="text-4xl font-black text-white tracking-tight leading-none">
            {top.modelName}
          </h2>
        </div>

        {/* Why — one sentence */}
        <p className="text-[15px] text-zinc-400 leading-relaxed">
          {top.reasoning[0]}
        </p>

        {/* Metadata chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <PBadge provider={top.provider} />
          <TBadge tier={top.tier} />
          <span className="text-[11px] text-zinc-600">
            {top.pricingEstimate.inputCost} in &middot;{" "}
            {top.pricingEstimate.outputCost} out
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-3 border-t border-white/[0.06]">
          <Button
            size="sm"
            onClick={() => void onCopyId()}
            className="gap-1.5 bg-violet-600 hover:bg-violet-500 rounded-xl text-[12px]"
          >
            {copied ? (
              <Check className="h-3 w-3" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            {copied ? "Copied!" : "Copy model ID"}
          </Button>
          <Link href={`/models/${top.modelId}`}>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 rounded-xl text-[12px]"
            >
              <Database className="h-3 w-3" />
              View details
            </Button>
          </Link>
          <button
            onClick={onTryAnother}
            className="ml-auto text-[13px] text-zinc-500 hover:text-violet-300 transition-colors font-medium"
          >
            Try another
          </button>
        </div>
      </motion.div>

      {/* ── TIER 2: Alternatives ────────────────────────────────── */}
      {runnerUps.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4, ease: EASE }}
          className="space-y-2"
        >
          <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-1">
            Also strong for this task
          </p>
          {runnerUps.map((rec, i) => (
            <motion.div
              key={rec.modelId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.05, duration: 0.35, ease: EASE }}
            >
              <div
                onClick={() => {
                  if (expandedAlt === rec.modelId) {
                    setExpandedAlt(null);
                  } else {
                    setExpandedAlt(rec.modelId);
                    setOverrideReason(null);
                    setOverrideSubmitted(false);
                  }
                }}
                className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 hover:border-white/[0.12] transition-all cursor-pointer group"
              >
                <span className="text-[12px] font-bold text-zinc-600 tabular-nums w-5">
                  #{rec.rank}
                </span>
                <span className="text-[13px] font-semibold text-white flex-1 truncate">
                  {rec.modelName}
                </span>
                <PBadge provider={rec.provider} />
                <span className="text-[12px] text-zinc-500 tabular-nums font-mono">
                  {rec.score.toFixed(1)}
                </span>
                <ChevronRight
                  className={`h-3.5 w-3.5 text-zinc-600 group-hover:text-zinc-400 transition-all ${
                    expandedAlt === rec.modelId ? "rotate-90" : ""
                  }`}
                />
              </div>

              {/* Expanded detail + override capture */}
              <AnimatePresence>
                {expandedAlt === rec.modelId && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
                      <p className="text-[13px] text-zinc-400">
                        {rec.reasoning[0]}
                      </p>
                      <div className="flex gap-1.5">
                        <TBadge tier={rec.tier} />
                        <span className="text-[10px] text-zinc-600 self-center">
                          {rec.pricingEstimate.inputCost} in &middot;{" "}
                          {rec.pricingEstimate.outputCost} out
                        </span>
                      </div>

                      {/* Override capture */}
                      {!overrideSubmitted ? (
                        <div className="pt-2 border-t border-white/[0.04] space-y-2">
                          <p className="text-[11px] font-medium text-zinc-500">
                            Prefer this one? Tell us why:
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {[
                              "cheaper",
                              "faster",
                              "better_coding",
                              "better_writing",
                              "better_reasoning",
                              "privacy",
                              "habit",
                            ].map((r) => (
                              <button
                                key={r}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOverrideReason(
                                    overrideReason === r ? null : r
                                  );
                                }}
                                className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition-all border ${
                                  overrideReason === r
                                    ? "bg-violet-500/15 text-violet-300 border-violet-500/30"
                                    : "bg-white/[0.03] text-zinc-500 border-white/[0.06] hover:text-zinc-300"
                                }`}
                              >
                                {r.replace("_", " ")}
                              </button>
                            ))}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOverrideSubmit(rec);
                              }}
                              className="rounded-lg bg-violet-500/15 border border-violet-500/25 px-3 py-1.5 text-[11px] font-semibold text-violet-300 hover:bg-violet-500/20 transition-all"
                            >
                              Submit
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedAlt(null);
                              }}
                              className="text-[11px] text-zinc-600 hover:text-zinc-400"
                            >
                              Dismiss
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 pt-2 border-t border-white/[0.04]">
                          <Check className="h-3 w-3 text-emerald-400" />
                          <span className="text-[11px] text-emerald-300 font-medium">
                            Thanks for the feedback!
                          </span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* ── Budget + Open Weight callouts ───────────────────────── */}
      {(result.budgetAlternative || result.openWeightAlternative) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.35, ease: EASE }}
          className="flex gap-3"
        >
          {result.budgetAlternative && (
            <div className="flex-1 flex items-center gap-3 rounded-xl border border-emerald-500/10 bg-emerald-500/[0.03] px-4 py-3">
              <DollarSign className="h-4 w-4 text-emerald-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                  Budget pick
                </p>
                <p className="text-[13px] font-semibold text-white truncate">
                  {result.budgetAlternative.modelName}
                </p>
              </div>
            </div>
          )}
          {result.openWeightAlternative && (
            <div className="flex-1 flex items-center gap-3 rounded-xl border border-indigo-500/10 bg-indigo-500/[0.03] px-4 py-3">
              <Server className="h-4 w-4 text-indigo-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                  Open weight
                </p>
                <p className="text-[13px] font-semibold text-white truncate">
                  {result.openWeightAlternative.modelName}
                </p>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* ── Feedback ────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.3 }}
      >
        <FeedbackWidget
          eventId={eventId}
          recommendedModelId={top.modelId}
          recommendedModelName={top.modelName}
          allModelNames={ALL_MODELS.filter((m) => m.isActive).map((m) => ({
            id: m.id,
            name: m.displayName,
          }))}
          startedAt={startedAt}
        />
      </motion.div>

      {/* ── TIER 3: Dig deeper ──────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35, duration: 0.3 }}
        className="space-y-2"
      >
        <p className="text-[11px] font-semibold text-zinc-600 uppercase tracking-wider px-1 mb-3">
          Dig deeper
        </p>

        {/* Why this model */}
        <Section
          title="Why this model"
          icon={<Target className="h-3.5 w-3.5 text-violet-400" />}
        >
          <div className="space-y-5">
            {/* Requirements */}
            {reqs.length > 0 && (
              <div className="space-y-3">
                <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                  Key requirements detected
                </p>
                {reqs.map((req, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-300">
                        {req.label}
                      </span>
                      <span className="text-[10px] text-zinc-500 tabular-nums">
                        {Math.round(req.weight * 100)}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.04]">
                      <motion.div
                        className={`h-full rounded-full ${
                          (
                            IMPORTANCE_STYLES[req.importance] ??
                            IMPORTANCE_STYLES.Low
                          ).bg
                        }`}
                        initial={{ width: 0 }}
                        animate={{
                          width: `${Math.round(req.weight * 100)}%`,
                        }}
                        transition={{
                          duration: 0.8,
                          ease: EASE,
                          delay: i * 0.05,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Task context */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-zinc-500">Category</p>
                <p className="text-zinc-200 font-semibold">
                  {tc.parentCategory}
                </p>
              </div>
              <div>
                <p className="text-zinc-500">Domain</p>
                <p className="text-zinc-200 font-semibold">
                  {result.promptContext.domain ?? "General"}
                </p>
              </div>
              <div>
                <p className="text-zinc-500">Input tokens</p>
                <p className="text-zinc-200 font-mono">
                  {result.promptContext.estimatedInputTokens.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-zinc-500">Output tokens</p>
                <p className="text-zinc-200 font-mono">
                  {result.promptContext.estimatedOutputTokens.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Full confidence */}
            <ConfidenceBand rawConfidence={result.confidence} />
          </div>
        </Section>

        {/* Optimize your prompt */}
        {prompt.trim() && (
          <Section
            title="Optimize your prompt"
            icon={<Sparkles className="h-3.5 w-3.5 text-amber-400" />}
          >
            <PromptRewriteCard
              originalPrompt={prompt.trim()}
              modelId={top.modelId}
              modelDisplayName={top.modelName}
            />
          </Section>
        )}

        {/* Production notes */}
        <Section
          title="Production notes"
          icon={<Eye className="h-3.5 w-3.5 text-emerald-400" />}
        >
          <ProductionReadiness result={result} />
        </Section>

        {/* Full analysis pipeline */}
        <Section
          title="Full analysis pipeline"
          icon={<Brain className="h-3.5 w-3.5 text-pink-400" />}
        >
          <div className="space-y-4">
            {/* Prompt understanding */}
            <div>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">
                Prompt understanding
              </p>
              <p className="text-sm text-zinc-300 mb-2">
                {a.interpretation.jobToBeDone}
              </p>
              <div className="flex flex-wrap gap-4 text-xs text-zinc-500">
                <span>
                  <span className="text-zinc-400">Primary:</span>{" "}
                  {a.interpretation.primaryTasks
                    .map((t) => t.label)
                    .join(" · ") || "—"}
                </span>
                <span>
                  <span className="text-zinc-400">Secondary:</span>{" "}
                  {a.interpretation.secondaryTasks
                    .map((t) => t.label)
                    .join(" · ") || "—"}
                </span>
              </div>
            </div>

            {/* Eligibility */}
            {a.eligibilityExclusions.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">
                  Excluded models ({a.eligibilityExclusions.length})
                </p>
                <div className="max-h-36 space-y-2 overflow-y-auto panel-scroll text-xs">
                  {a.eligibilityExclusions.slice(0, 10).map((e) => (
                    <div
                      key={e.modelId}
                      className="border-b border-white/[0.03] pb-2 last:border-0"
                    >
                      <p className="font-semibold text-zinc-300">
                        {e.modelName}
                      </p>
                      <ul className="list-inside list-disc text-zinc-500">
                        {e.reasons.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Multi-track winners */}
            <div>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">
                Optimization tracks
              </p>
              <div className="grid gap-2 md:grid-cols-2">
                <TrackCard
                  title="Best Quality"
                  track={a.tracks.bestAbsolute}
                  color="border-yellow-500/15"
                />
                <TrackCard
                  title="Best Value"
                  track={a.tracks.bestValue}
                  color="border-emerald-500/15"
                />
                <TrackCard
                  title="Lowest Latency"
                  track={a.tracks.bestLowLatency}
                  color="border-cyan-500/15"
                />
                <TrackCard
                  title="Open / Self-Hosted"
                  track={a.tracks.bestOpenSelfHosted}
                  color="border-indigo-500/15"
                />
              </div>
            </div>

            {/* Confidence metrics */}
            <div>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">
                Confidence metrics
              </p>
              <div className="grid gap-2 sm:grid-cols-2 text-sm">
                {(
                  [
                    [
                      "Interpretation",
                      `~${Math.round(a.uncertainty.interpretationConfidence * 100)}%`,
                    ],
                    [
                      "Ranking",
                      `~${Math.round(a.uncertainty.rankingConfidence * 100)}%`,
                    ],
                    ["Top score gap", a.uncertainty.topScoreGap.toFixed(1)],
                    [
                      "Marginal winner",
                      a.uncertainty.isMarginalWinner ? "Yes" : "No",
                    ],
                  ] as const
                ).map(([k, v]) => (
                  <div
                    key={k}
                    className="flex justify-between rounded-xl bg-white/[0.02] px-3 py-2"
                  >
                    <span className="text-zinc-500 text-xs">{k}</span>
                    <span
                      className={`font-semibold text-xs ${
                        v === "Yes" ? "text-amber-400" : "text-zinc-300"
                      }`}
                    >
                      {v}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* Secondary actions */}
        <div className="flex items-center gap-2 pt-2 px-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => void onShare()}
            className="gap-1.5 rounded-xl text-[11px]"
          >
            {shared ? (
              <Check className="h-3 w-3 text-emerald-400" />
            ) : (
              <Share2 className="h-3 w-3" />
            )}
            {shared ? "Link copied!" : "Share result"}
          </Button>
          {runnerUps[0] && (
            <Link href="/compare">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 rounded-xl text-[11px]"
              >
                <GitCompare className="h-3 w-3" />
                Compare models
              </Button>
            </Link>
          )}
        </div>
      </motion.div>
    </div>
  );
}
