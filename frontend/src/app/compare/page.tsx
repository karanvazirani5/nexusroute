"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { ALL_MODELS } from "@/lib/data/models";
import type { ModelProfile, CapabilityDimension } from "@/lib/types";
import { CAPABILITY_LABELS } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeftRight,
  Check,
  X,
  Trophy,
  Coins,
  Zap,
  Brain,
  Crown,
} from "lucide-react";

/* -- Helpers -------------------------------------------------------- */

function formatTokens(n: number): string {
  if (n >= 1_000_000) { const m = n / 1_000_000; return m % 1 === 0 ? `${m}M` : `${m.toFixed(1)}M`; }
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

function formatPrice(price: number): string {
  if (price === 0) return "Free";
  if (price < 0.01) return `$${price.toFixed(4)}`;
  if (price < 0.1) return `$${price.toFixed(3)}`;
  return `$${price.toFixed(2)}`;
}

const TIER_STYLES: Record<string, string> = {
  frontier: "border-violet-500/30 bg-violet-500/10 text-violet-300",
  mid: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  budget: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  specialized: "border-amber-500/30 bg-amber-500/10 text-amber-300",
};

function scoreBarColor(v: number) {
  if (v >= 8) return "bg-emerald-500";
  if (v >= 6) return "bg-blue-500";
  if (v >= 4) return "bg-amber-500";
  return "bg-red-500";
}

function scoreTextColor(v: number) {
  if (v >= 8) return "text-emerald-400";
  if (v >= 6) return "text-blue-400";
  if (v >= 4) return "text-amber-400";
  return "text-red-400";
}

/* -- Constants ------------------------------------------------------ */

const modelsByProvider = ALL_MODELS.reduce<Record<string, ModelProfile[]>>((acc, m) => {
  (acc[m.provider] ??= []).push(m);
  return acc;
}, {});

const CAPABILITY_KEYS = Object.keys(CAPABILITY_LABELS) as CapabilityDimension[];

const FEATURE_ROWS: { key: keyof ModelProfile["specs"]; label: string }[] = [
  { key: "supportsVision", label: "Vision" },
  { key: "supportsAudio", label: "Audio" },
  { key: "supportsVideo", label: "Video" },
  { key: "supportsFunctionCalling", label: "Function Calling" },
  { key: "supportsJsonMode", label: "JSON Mode" },
  { key: "supportsStreaming", label: "Streaming" },
];

const QUICK_PICKS = [
  { label: "Frontier Face-off", icon: Trophy, ids: ["gpt-5.4", "claude-opus-4.6", "gemini-3.1-pro"] },
  { label: "Best Budget", icon: Coins, ids: ["gpt-5.4-nano", "claude-haiku-4.5", "gemini-2.5-flash-lite"] },
  { label: "Open Weight Champions", icon: Zap, ids: ["llama-4-maverick", "deepseek-v3.2", "qwen-3.5"] },
  { label: "Reasoning Specialists", icon: Brain, ids: ["o3", "deepseek-r1", "claude-opus-4.6"] },
];

/* -- Sub-components ------------------------------------------------- */

function BoolIcon({ value }: { value: boolean }) {
  return value ? <Check className="h-4 w-4 text-emerald-400" /> : <X className="h-4 w-4 text-zinc-600" />;
}

/* -- Verdict Banner ------------------------------------------------- */

function VerdictBanner({ models }: { models: ModelProfile[] }) {
  if (models.length < 2) return null;

  const capScores = models.map((m) => ({
    id: m.id,
    name: m.displayName,
    total: CAPABILITY_KEYS.reduce((sum, k) => sum + m.capabilities[k], 0),
    price: m.specs.inputPricePer1M + m.specs.outputPricePer1M,
  }));

  const best = capScores.reduce((a, b) => (a.total > b.total ? a : b));
  const cheapest = capScores.reduce((a, b) => (a.price < b.price ? a : b));

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="panel-card glow-violet p-5"
    >
      <div className="flex items-center gap-2 mb-3">
        <Crown className="h-4 w-4 text-yellow-400" />
        <h3 className="text-sm font-semibold text-white">Quick Verdict</h3>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-yellow-500/15 bg-yellow-500/[0.04] px-3.5 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-yellow-400">Highest Capability</p>
          <p className="text-sm font-semibold text-white mt-0.5">{best.name}</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">Total score: {best.total.toFixed(1)}</p>
        </div>
        <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] px-3.5 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">Most Affordable</p>
          <p className="text-sm font-semibold text-white mt-0.5">{cheapest.name}</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">{formatPrice(cheapest.price)} / 1M combined</p>
        </div>
      </div>
    </motion.div>
  );
}

/* ===================================================================
   COMPARE PAGE
   =================================================================== */

export default function ComparePage() {
  const [selectedIds, setSelectedIds] = useState(["gpt-5.4", "claude-opus-4.6", ""]);
  const [resetKey, setResetKey] = useState(0);

  const activeModels = useMemo(
    () => selectedIds.filter((id) => id !== "").map((id) => ALL_MODELS.find((m) => m.id === id)).filter(Boolean) as ModelProfile[],
    [selectedIds],
  );

  function updateSlot(idx: number, value: string) {
    setSelectedIds((prev) => { const next = [...prev]; next[idx] = value; return next; });
  }
  function clearSlot(idx: number) { updateSlot(idx, ""); setResetKey((k) => k + 1); }
  function applyPreset(ids: string[]) {
    const padded = ids.length >= 3 ? ids.slice(0, 3) : [...ids, ...Array<string>(3 - ids.length).fill("")];
    setSelectedIds(padded);
    setResetKey((k) => k + 1);
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <span className="page-badge page-badge-cyan mb-3">
          <ArrowLeftRight className="h-2.5 w-2.5" /> Head-to-Head Analysis
        </span>
        <h1 className="text-display">Compare Models</h1>
        <p className="mt-3 max-w-2xl text-subtitle">
          Select up to 3 models to compare capabilities, pricing, and features side by side.
        </p>
      </motion.div>

      {/* Model Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="panel-card panel-card-hover rounded-[24px] p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="panel-label">Model {i + 1}</span>
              {selectedIds[i] !== "" && (
                <button onClick={() => clearSlot(i)} className="text-zinc-500 hover:text-white transition-colors" aria-label={`Clear model ${i + 1}`}>
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Select key={`${resetKey}-${i}`} defaultValue={selectedIds[i] || undefined} onValueChange={(v) => v && updateSlot(i, v)}>
              <SelectTrigger className="w-full rounded-xl border-white/[0.08] bg-white/[0.02]">
                <SelectValue placeholder="Select a model..." />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(modelsByProvider).map(([provider, models]) => (
                  <SelectGroup key={provider}>
                    <SelectLabel>{provider}</SelectLabel>
                    {models.map((m) => <SelectItem key={m.id} value={m.id}>{m.displayName}</SelectItem>)}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      {/* Quick Picks */}
      <div>
        <h2 className="panel-label mb-3">Quick Picks</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {QUICK_PICKS.map((pick, i) => {
            const Icon = pick.icon;
            return (
              <motion.div
                key={pick.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05, ease: "easeOut" }}
              >
                <button className="panel-card panel-card-hover flex items-center gap-3 p-4 text-left w-full" onClick={() => applyPreset(pick.ids)}>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/10">
                    <Icon className="h-4 w-4 text-violet-400" />
                  </div>
                  <span className="text-sm font-medium text-zinc-200">{pick.label}</span>
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Verdict + Comparison Table */}
      {activeModels.length >= 2 ? (
        <div className="space-y-6">
          <VerdictBanner models={activeModels} />
          <div className="panel-card overflow-hidden">
            <div className="overflow-x-auto panel-scroll">
              <div className="min-w-[640px]">
                <ComparisonTable models={activeModels} />
              </div>
            </div>
          </div>

          {/* Next Actions */}
          <div className="reveal-step" style={{ animationDelay: "0.2s" }}>
            <h2 className="mb-3 panel-label">Next steps</h2>
            <div className="grid gap-2 sm:grid-cols-3">
              <a href="/advisor" className="next-action">
                <div className="next-action-icon bg-gradient-to-r from-violet-600 to-indigo-600"><Brain className="h-4 w-4" /></div>
                <div><p className="font-medium text-white text-sm">Test with your prompt</p><p className="text-[11px] text-zinc-500">See which wins for your task</p></div>
              </a>
              {activeModels[0] && (
                <a href={`/models/${activeModels[0].id}`} className="next-action">
                  <div className="next-action-icon"><Zap className="h-4 w-4" /></div>
                  <div><p className="font-medium text-white text-sm">Deep dive: {activeModels[0].displayName}</p><p className="text-[11px] text-zinc-500">Full specs & benchmarks</p></div>
                </a>
              )}
              <a href="/models" className="next-action">
                <div className="next-action-icon"><Trophy className="h-4 w-4" /></div>
                <div><p className="font-medium text-white text-sm">Explore all models</p><p className="text-[11px] text-zinc-500">Browse the full registry</p></div>
              </a>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.01] px-6 py-20 text-center">
          <ArrowLeftRight className="h-12 w-12 text-violet-400/50" />
          <p className="text-sm font-medium text-zinc-300">Select at least 2 models to compare</p>
          <p className="text-[11px] text-zinc-500">Or try a quick pick to get started</p>
        </div>
      )}
    </div>
  );
}

/* -- Comparison Table ----------------------------------------------- */

function ComparisonTable({ models }: { models: ModelProfile[] }) {
  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: `160px ${models.map(() => "1fr").join(" ")}`,
    gap: "0 1rem",
  };

  function Row({ label, children, striped = false }: { label: string; children: React.ReactNode; striped?: boolean }) {
    return (
      <div style={gridStyle} className={`items-center px-5 py-2.5 text-sm ${striped ? "bg-white/[0.015]" : ""}`}>
        <span className="text-[11px] text-zinc-500">{label}</span>
        {children}
      </div>
    );
  }

  function SectionHeading({ children }: { children: React.ReactNode }) {
    return (
      <div className="px-5 pt-5 pb-1">
        <span className="panel-label">{children}</span>
        <div className="mt-1.5 panel-divider" />
      </div>
    );
  }

  return (
    <>
      {/* Model Headers */}
      <div style={gridStyle} className="items-start px-5 py-5 border-b border-white/[0.06] bg-white/[0.02]">
        <div />
        {models.map((m) => (
          <div key={m.id} className="space-y-2">
            <div className="font-semibold text-base leading-tight text-white">{m.displayName}</div>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline" className="text-[10px] border-white/[0.08] bg-white/[0.03]">{m.provider}</Badge>
              <Badge variant="outline" className={`text-[10px] ${TIER_STYLES[m.tier] ?? ""}`}>{m.tier}</Badge>
            </div>
          </div>
        ))}
      </div>

      {/* Specs */}
      <SectionHeading>Specs</SectionHeading>
      <Row label="Context Window" striped>{models.map((m) => <span key={m.id} className="font-mono text-sm text-zinc-200">{formatTokens(m.specs.contextWindow)}</span>)}</Row>
      <Row label="Max Output">{models.map((m) => <span key={m.id} className="font-mono text-sm text-zinc-200">{formatTokens(m.specs.maxOutputTokens)}</span>)}</Row>
      <Row label="Input Price / 1M" striped>{models.map((m) => <span key={m.id} className="font-mono text-sm text-zinc-200">{formatPrice(m.specs.inputPricePer1M)}</span>)}</Row>
      <Row label="Output Price / 1M">{models.map((m) => <span key={m.id} className="font-mono text-sm text-zinc-200">{formatPrice(m.specs.outputPricePer1M)}</span>)}</Row>
      <Row label="Knowledge Cutoff" striped>{models.map((m) => <span key={m.id} className="text-sm text-zinc-300">{m.specs.knowledgeCutoff}</span>)}</Row>

      {/* Capabilities */}
      <SectionHeading>Capabilities</SectionHeading>
      {CAPABILITY_KEYS.map((dim, idx) => {
        const scores = models.map((m) => m.capabilities[dim]);
        const maxScore = Math.max(...scores);
        return (
          <Row key={dim} label={CAPABILITY_LABELS[dim]} striped={idx % 2 === 0}>
            {models.map((m) => {
              const v = m.capabilities[dim];
              const isMax = v === maxScore && models.length > 1;
              return (
                <div key={m.id} className="flex items-center gap-2.5">
                  <div className="flex-1 h-2 rounded-full bg-white/[0.04] overflow-hidden max-w-28">
                    <div className={`h-full rounded-full transition-all duration-500 ${scoreBarColor(v)}`} style={{ width: `${v * 10}%` }} />
                  </div>
                  <span className={`font-mono text-xs tabular-nums w-7 text-right ${isMax ? `font-bold ${scoreTextColor(v)}` : "text-zinc-500"}`}>
                    {v}
                  </span>
                </div>
              );
            })}
          </Row>
        );
      })}

      {/* Features */}
      <SectionHeading>Features</SectionHeading>
      {FEATURE_ROWS.map((feat, idx) => (
        <Row key={feat.key} label={feat.label} striped={idx % 2 === 0}>
          {models.map((m) => <div key={m.id}><BoolIcon value={m.specs[feat.key] as boolean} /></div>)}
        </Row>
      ))}

      {/* Best For */}
      <SectionHeading>Best For</SectionHeading>
      <div style={gridStyle} className="items-start px-5 py-3">
        <div />
        {models.map((m) => (
          <div key={m.id} className="flex flex-wrap gap-1.5">
            {m.intelligence.bestUseCases.slice(0, 4).map((uc, i) => <span key={i} className="panel-chip chip-sm">{uc}</span>)}
          </div>
        ))}
      </div>

      {/* Weaknesses */}
      <SectionHeading>Weaknesses</SectionHeading>
      <div style={gridStyle} className="items-start px-5 py-3 pb-6">
        <div />
        {models.map((m) => (
          <ul key={m.id} className="space-y-1.5 text-xs text-zinc-400 list-disc pl-3.5">
            {m.intelligence.knownWeaknesses.slice(0, 4).map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        ))}
      </div>
    </>
  );
}
