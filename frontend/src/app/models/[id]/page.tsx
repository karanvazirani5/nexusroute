"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  X,
  ExternalLink,
  Calendar,
  Clock,
  Cpu,
  DollarSign,
  Zap,
  AlertTriangle,
  BookOpen,
  Shield,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ALL_MODELS } from "@/lib/data/models";
import type { ModelProfile } from "@/lib/types";
import { CAPABILITY_LABELS } from "@/lib/types";
import { providerBadgeClass, tierBadgeClass } from "@/lib/constants";

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M tokens`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K tokens`;
  return `${n} tokens`;
}

function formatPrice(price: number): string {
  if (price < 0.01) return `$${price.toFixed(4)} / 1M tokens`;
  if (price < 1) return `$${price.toFixed(3)} / 1M tokens`;
  return `$${price.toFixed(2)} / 1M tokens`;
}

function scoreColor(score: number): string {
  if (score >= 8) return "bg-emerald-500";
  if (score >= 6) return "bg-blue-500";
  if (score >= 4) return "bg-amber-500";
  return "bg-red-500";
}

function scoreTextColor(score: number): string {
  if (score >= 8) return "text-emerald-400";
  if (score >= 6) return "text-blue-400";
  if (score >= 4) return "text-amber-400";
  return "text-red-400";
}

function speedTier(speed: number): string {
  if (speed >= 9) return "Ultra Fast";
  if (speed >= 7) return "Fast";
  if (speed >= 5) return "Moderate";
  if (speed >= 3) return "Slow";
  return "Very Slow";
}

const FEATURE_CHECKS: { label: string; check: (m: ModelProfile) => boolean }[] = [
  { label: "Vision", check: (m) => m.specs.supportsVision },
  { label: "Audio In", check: (m) => m.specs.supportsAudio },
  { label: "Audio Out", check: (m) => m.tags.includes("audio-out") },
  { label: "Video", check: (m) => m.specs.supportsVideo },
  { label: "Image Generation", check: (m) => m.tags.includes("image-gen") || m.tags.includes("image-generation") },
  { label: "Image Editing", check: (m) => m.tags.includes("image-editing") },
  { label: "Function Calling", check: (m) => m.specs.supportsFunctionCalling },
  { label: "JSON Mode", check: (m) => m.specs.supportsJsonMode },
  { label: "Structured Output", check: (m) => m.capabilities.structuredOutput >= 7 },
  { label: "Streaming", check: (m) => m.specs.supportsStreaming },
  { label: "Reasoning", check: (m) => m.tags.includes("reasoning") || m.capabilities.reasoning >= 8.5 },
  { label: "Realtime", check: (m) => m.tags.includes("realtime") },
  { label: "Computer Use", check: (m) => m.tags.includes("computer-use") },
  { label: "Web Search", check: (m) => m.tags.includes("web-search") },
];

const BENCHMARK_LABELS: Record<string, { label: string; max: number; unit: string }> = {
  mmluScore: { label: "MMLU", max: 100, unit: "%" },
  humanEvalScore: { label: "HumanEval", max: 100, unit: "%" },
  arenaElo: { label: "Arena Elo", max: 1500, unit: "" },
  gsm8kScore: { label: "GSM8K", max: 100, unit: "%" },
};

const sectionVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0 },
};

export default function ModelDetailPage() {
  const params = useParams<{ id: string }>();
  const model = useMemo(
    () => ALL_MODELS.find((m) => m.id === params.id),
    [params.id],
  );

  if (!model) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <h1 className="text-2xl font-bold text-white">Model not found</h1>
        <p className="text-zinc-400">
          No model with ID &ldquo;{params.id}&rdquo; exists in the registry.
        </p>
        <Link href="/models">
          <Button variant="outline" className="gap-2 border-white/10 bg-white/[0.03]">
            <ArrowLeft className="h-4 w-4" />
            Back to Models
          </Button>
        </Link>
      </div>
    );
  }

  const sortedCapabilities = Object.entries(model.capabilities)
    .map(([key, value]) => ({
      key: key as keyof typeof CAPABILITY_LABELS,
      label: CAPABILITY_LABELS[key as keyof typeof CAPABILITY_LABELS],
      score: value,
    }))
    .sort((a, b) => b.score - a.score);

  const benchmarkEntries = (
    ["mmluScore", "humanEvalScore", "arenaElo", "gsm8kScore"] as const
  )
    .filter((k) => model.benchmarks[k] != null)
    .map((k) => ({
      key: k,
      value: model.benchmarks[k]!,
      ...BENCHMARK_LABELS[k],
    }));

  return (
    <div className="space-y-8 pb-16">
      {/* Back link */}
      <Link
        href="/models"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Models
      </Link>

      {/* Hero */}
      <motion.div
        className="space-y-4"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-display !text-[32px] md:!text-[40px]">
            {model.displayName}
          </h1>
          <Badge
            variant="outline"
            className={`text-sm ${providerBadgeClass(model.provider)}`}
          >
            {model.provider}
          </Badge>
          <Badge
            variant="outline"
            className={`text-sm capitalize ${tierBadgeClass(model.tier)}`}
          >
            {model.tier}
          </Badge>
        </div>

        <p className="text-zinc-400 max-w-3xl leading-relaxed">
          {model.description}
        </p>

        <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-500">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            Released {model.releaseDate}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            Knowledge cutoff: {model.specs.knowledgeCutoff}
          </span>
        </div>
      </motion.div>

      <div className="panel-divider" />

      {/* Specs grid */}
      <motion.section
        className="space-y-4"
        variants={sectionVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
      >
        <h2 className="panel-label">Specifications</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: Cpu, label: "Context Window", value: formatTokens(model.specs.contextWindow) },
            { icon: Cpu, label: "Max Output", value: formatTokens(model.specs.maxOutputTokens) },
            { icon: DollarSign, label: "Input Price", value: formatPrice(model.specs.inputPricePer1M) },
            { icon: DollarSign, label: "Output Price", value: formatPrice(model.specs.outputPricePer1M) },
          ].map((spec) => (
            <div key={spec.label} className="panel-card p-4">
              <div className="flex items-center gap-2 text-zinc-500 mb-1">
                <spec.icon className="h-3.5 w-3.5" />
                <span className="text-[11px]">{spec.label}</span>
              </div>
              <p className="text-lg font-mono font-semibold text-white">{spec.value}</p>
            </div>
          ))}
          <div className="panel-card p-4 col-span-2 lg:col-span-4">
            <div className="flex items-center gap-2 text-zinc-500 mb-1">
              <Zap className="h-3.5 w-3.5" />
              <span className="text-[11px]">Latency Tier</span>
            </div>
            <p className="text-lg font-mono font-semibold text-white">
              {speedTier(model.capabilities.speed)}{" "}
              <span className="text-sm text-zinc-500 font-normal">
                (speed score: {model.capabilities.speed}/10)
              </span>
            </p>
          </div>
        </div>
      </motion.section>

      <div className="panel-divider" />

      {/* Capability bars */}
      <motion.section
        className="space-y-4"
        variants={sectionVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
      >
        <h2 className="panel-label">Capability Profile</h2>
        <div className="panel-card p-5 space-y-3">
          {sortedCapabilities.map(({ key, label, score }) => (
            <div key={key} className="flex items-center gap-3">
              <span className="w-40 shrink-0 text-sm text-zinc-400 truncate">
                {label}
              </span>
              <div className="flex-1 h-2.5 rounded-full bg-white/[0.04] overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${scoreColor(score)}`}
                  initial={{ width: 0 }}
                  whileInView={{ width: `${(score / 10) * 100}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              </div>
              <span
                className={`w-12 text-right text-sm font-mono font-semibold ${scoreTextColor(score)}`}
              >
                {score}/10
              </span>
            </div>
          ))}
        </div>
      </motion.section>

      <div className="panel-divider" />

      {/* Features grid */}
      <motion.section
        className="space-y-4"
        variants={sectionVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
      >
        <h2 className="panel-label">Feature Support</h2>
        <div className="panel-card p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5">
            {FEATURE_CHECKS.map(({ label, check }) => {
              const supported = check(model);
              return (
                <div
                  key={label}
                  className="flex items-center justify-between py-1.5 border-b border-white/[0.04] last:border-0"
                >
                  <span className="text-sm text-zinc-300">{label}</span>
                  {supported ? (
                    <span className="inline-flex items-center gap-1 text-emerald-400 text-sm font-medium">
                      <Check className="h-4 w-4" /> Yes
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-zinc-600 text-sm">
                      <X className="h-4 w-4" /> No
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </motion.section>

      <div className="panel-divider" />

      {/* Best Use Cases & Not Ideal For */}
      <motion.div
        className="grid grid-cols-1 lg:grid-cols-2 gap-4"
        variants={sectionVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
      >
        <div className="panel-card p-5">
          <h3 className="panel-label mb-3">Best Use Cases</h3>
          <div className="space-y-2">
            {model.intelligence.bestUseCases.map((item, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                <span className="text-sm text-zinc-300">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel-card p-5">
          <h3 className="panel-label mb-3">Not Ideal For</h3>
          <div className="space-y-2">
            {model.intelligence.worstUseCases.map((item, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                <span className="text-sm text-zinc-300">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Strengths & Weaknesses */}
      <motion.div
        className="grid grid-cols-1 lg:grid-cols-2 gap-4"
        variants={sectionVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
      >
        <div className="panel-card p-5">
          <h3 className="panel-label mb-3 flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-emerald-400" />
            Strengths
          </h3>
          <div className="space-y-2">
            {model.intelligence.knownStrengths.map((item, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <span className="text-sm text-zinc-300">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel-card p-5">
          <h3 className="panel-label mb-3 flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
            Weaknesses
          </h3>
          <div className="space-y-2">
            {model.intelligence.knownWeaknesses.map((item, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <X className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <span className="text-sm text-zinc-300">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Edge Cases */}
      {(model.intelligence.edgeCaseNotes.length > 0 || model.intelligence.providerNotes) && (
        <motion.div
          className="panel-card p-5 space-y-4"
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
        >
          <h3 className="panel-label">Edge Cases & Notes</h3>
          {model.intelligence.edgeCaseNotes.length > 0 && (
            <div className="space-y-2">
              {model.intelligence.edgeCaseNotes.map((note, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                  <span className="text-sm text-zinc-300">{note}</span>
                </div>
              ))}
            </div>
          )}
          {model.intelligence.providerNotes && (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500 mb-1">
                Provider Notes
              </p>
              <p className="text-sm text-zinc-300">{model.intelligence.providerNotes}</p>
            </div>
          )}
        </motion.div>
      )}

      {/* Benchmarks */}
      {(benchmarkEntries.length > 0 || model.benchmarks.notes) && (
        <motion.div
          className="panel-card p-5 space-y-4"
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
        >
          <h3 className="panel-label">Benchmarks</h3>
          {benchmarkEntries.length > 0 && (
            <div className="space-y-3">
              {benchmarkEntries.map(({ key, value, label, max, unit }) => (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">{label}</span>
                    <span className="font-mono font-semibold text-white">
                      {value}{unit}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-white/[0.04] overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-violet-500"
                      initial={{ width: 0 }}
                      whileInView={{ width: `${Math.min((value / max) * 100, 100)}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
          {model.benchmarks.notes && (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500 mb-1">
                Benchmark Notes
              </p>
              <p className="text-sm text-zinc-300">{model.benchmarks.notes}</p>
            </div>
          )}
        </motion.div>
      )}

      <div className="panel-divider" />

      {/* Research Meta */}
      <motion.section
        className="space-y-4"
        variants={sectionVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
      >
        <h2 className="panel-label flex items-center gap-2">
          <BookOpen className="h-3.5 w-3.5 text-violet-400" />
          Research Meta
        </h2>
        <div className="panel-card p-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500 mb-0.5">
                Last Evaluated
              </p>
              <p className="text-sm font-mono text-zinc-200">{model.researchMeta.lastEvaluatedDate}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500 mb-0.5">
                Source Confidence
              </p>
              <p className="text-sm font-mono text-zinc-200">
                {(model.researchMeta.sourceConfidence * 100).toFixed(0)}%
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500 mb-0.5">
                Evaluation Method
              </p>
              <p className="text-sm text-zinc-200">{model.researchMeta.evaluationMethod}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500 mb-0.5">
                Needs Re-evaluation
              </p>
              {model.researchMeta.needsReEvaluation ? (
                <span className="inline-flex items-center gap-1 text-sm text-amber-400 font-medium">
                  <RefreshCw className="h-3.5 w-3.5" /> Yes
                </span>
              ) : (
                <span className="text-sm text-emerald-400 font-medium">No</span>
              )}
            </div>
          </div>

          {model.researchMeta.sources.length > 0 && (
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500 mb-2">Sources</p>
              <ul className="space-y-1.5">
                {model.researchMeta.sources.map((source, i) => {
                  const isUrl =
                    source.startsWith("http://") || source.startsWith("https://");
                  return (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-600" />
                      {isUrl ? (
                        <a
                          href={source}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-violet-400 hover:text-violet-300 transition-colors inline-flex items-center gap-1"
                        >
                          {source}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-zinc-400">{source}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </motion.section>

      {/* Next Actions */}
      <div className="reveal-step" style={{ animationDelay: "0.2s" }}>
        <h2 className="mb-3 panel-label">Continue exploring</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          <Link href="/" className="next-action">
            <div className="next-action-icon"><Zap className="h-4 w-4" /></div>
            <div><p className="font-medium text-white text-sm">Route a prompt</p><p className="text-[11px] text-zinc-500">See how {model.displayName} ranks</p></div>
          </Link>
          <Link href="/compare" className="next-action">
            <div className="next-action-icon"><ArrowLeft className="h-4 w-4 rotate-180" /></div>
            <div><p className="font-medium text-white text-sm">Compare models</p><p className="text-[11px] text-zinc-500">Side-by-side analysis</p></div>
          </Link>
          <Link href="/models" className="next-action">
            <div className="next-action-icon"><BookOpen className="h-4 w-4" /></div>
            <div><p className="font-medium text-white text-sm">Browse registry</p><p className="text-[11px] text-zinc-500">Explore all {ALL_MODELS.length} models</p></div>
          </Link>
        </div>
      </div>
    </div>
  );
}
