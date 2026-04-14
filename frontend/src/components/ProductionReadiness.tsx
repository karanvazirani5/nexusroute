"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Server, DollarSign, Clock, Shield, Layers, AlertTriangle } from "lucide-react";
import type { AnalysisResult } from "@/lib/types";
import { ALL_MODELS } from "@/lib/data/models";

interface ProductionReadinessProps {
  result: AnalysisResult;
}

export default function ProductionReadiness({ result }: ProductionReadinessProps) {
  const [open, setOpen] = useState(false);
  const top = result.recommendations[0];
  if (!top) return null;

  const model = ALL_MODELS.find((m) => m.id === top.modelId);
  if (!model) return null;

  const inputCostPer1M = model.specs.inputPricePer1M ?? 0;
  const outputCostPer1M = model.specs.outputPricePer1M ?? 0;
  const costPerReq = (inputCostPer1M / 1_000_000) * 1000 + (outputCostPer1M / 1_000_000) * 1000;

  const costAt1K = costPerReq * 1_000;
  const costAt10K = costPerReq * 10_000;
  const costAt100K = costPerReq * 100_000;

  // Fallback candidate
  const runnerUp = result.recommendations[1];
  const tracks = result.advisor?.tracks;
  const valueTrack = tracks?.bestValue;
  const fallback = valueTrack && valueTrack.modelId !== top.modelId ? valueTrack : runnerUp;

  // Feature checks
  const features = [
    { label: "Function calling", available: model.specs.supportsFunctionCalling },
    { label: "JSON mode", available: model.specs.supportsJsonMode },
    { label: "Streaming", available: model.specs.supportsStreaming },
    { label: "Vision", available: model.specs.supportsVision },
    { label: "Audio", available: model.specs.supportsAudio },
  ];

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.01] overflow-hidden">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-white/[0.02]">
        <motion.div animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />
        </motion.div>
        <Server className="h-4 w-4 text-emerald-400" />
        <span className="text-sm font-semibold text-zinc-200 flex-1">Production Notes</span>
        <span className="text-[10px] text-zinc-500">Cost, latency, fallback</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }}>
            <div className="px-5 pb-5 space-y-4">
              {/* Cost at scale */}
              <div>
                <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">
                  <DollarSign className="h-3 w-3" /> Estimated Cost at Scale
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "1K req/day", cost: costAt1K, period: "/day" },
                    { label: "10K req/day", cost: costAt10K, period: "/day" },
                    { label: "100K req/day", cost: costAt100K, period: "/day" },
                  ].map((tier) => (
                    <div key={tier.label} className="rounded-lg bg-white/[0.03] border border-white/[0.04] p-3 text-center">
                      <p className="text-[10px] text-zinc-500">{tier.label}</p>
                      <p className="text-sm font-bold text-white">
                        ${tier.cost < 1 ? tier.cost.toFixed(2) : tier.cost < 100 ? tier.cost.toFixed(1) : Math.round(tier.cost).toLocaleString()}
                        <span className="text-[10px] text-zinc-500">{tier.period}</span>
                      </p>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-zinc-600 mt-1">Based on ~1K input + ~1K output tokens per request</p>
              </div>

              {/* Latency */}
              <div>
                <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">
                  <Clock className="h-3 w-3" /> Latency Profile
                </h4>
                <div className="flex gap-2 text-xs">
                  <span className="rounded-lg bg-white/[0.03] border border-white/[0.04] px-3 py-2">
                    <span className="text-zinc-500">Speed score: </span>
                    <span className="text-zinc-200 font-semibold">{model.capabilities.speed.toFixed(1)}/10</span>
                  </span>
                  <span className="rounded-lg bg-white/[0.03] border border-white/[0.04] px-3 py-2">
                    <span className="text-zinc-500">Tier: </span>
                    <span className="text-zinc-200 font-semibold capitalize">{model.tier}</span>
                  </span>
                </div>
              </div>

              {/* Fallback */}
              {fallback && (
                <div>
                  <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">
                    <Shield className="h-3 w-3" /> Fallback Candidate
                  </h4>
                  <div className="rounded-lg bg-white/[0.03] border border-white/[0.04] p-3">
                    <p className="text-sm font-semibold text-zinc-200">{fallback.modelName}</p>
                    <p className="text-[10px] text-zinc-500 mt-1">
                      Use as fallback when primary is unavailable or rate-limited.
                      {fallback.provider && ` Provider: ${fallback.provider}.`}
                    </p>
                  </div>
                </div>
              )}

              {/* Features */}
              <div>
                <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">
                  <Layers className="h-3 w-3" /> Feature Availability
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {features.map((f) => (
                    <span
                      key={f.label}
                      className={`rounded-full px-2.5 py-1 text-[10px] font-medium border ${
                        f.available
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : "bg-white/[0.02] text-zinc-600 border-white/[0.04]"
                      }`}
                    >
                      {f.available ? "✓" : "✗"} {f.label}
                    </span>
                  ))}
                </div>
              </div>

              {/* When to switch */}
              {inputCostPer1M > 10 && (
                <div className="rounded-lg border border-amber-500/15 bg-amber-500/[0.03] p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="h-3 w-3 text-amber-400" />
                    <span className="text-[10px] font-bold uppercase text-amber-400">When to downgrade</span>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    At high volume (&gt;50K req/day), consider switching to the value-track recommendation
                    {valueTrack ? ` (${valueTrack.modelName})` : ""} for 3-5x cost savings with acceptable quality loss.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
