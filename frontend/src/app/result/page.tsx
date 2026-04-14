"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Trophy,
  ArrowLeft,
  Sparkles,
  BarChart3,
  DollarSign,
  Server,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/* ── helpers ──────────────────────────────────────────────────── */

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

interface SharedResult {
  prompt: string;
  winner: {
    modelId: string;
    modelName: string;
    provider: string;
    score: number;
    tier: string;
    reasoning: string;
    inputCost: string;
    outputCost: string;
  };
  alternatives: Array<{
    modelId: string;
    modelName: string;
    provider: string;
    score: number;
    tier: string;
  }>;
  task: string;
  confidence: number;
  ts: string;
}

function decodeResult(encoded: string | null): SharedResult | null {
  if (!encoded) return null;
  try {
    return JSON.parse(decodeURIComponent(atob(encoded)));
  } catch {
    return null;
  }
}

/* Score ring (simplified) */
function ScoreRing({ score, size = 90 }: { score: number; size?: number }) {
  const r = size * 0.4;
  const sw = size * 0.06;
  const c = 2 * Math.PI * r;
  const color =
    score >= 80 ? "#34d399" : score >= 60 ? "#60a5fa" : score >= 40 ? "#fbbf24" : "#f87171";
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={sw} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={sw}
          strokeLinecap="round" strokeDasharray={c}
          strokeDashoffset={c - (score / 100) * c}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-black text-white">{score}</span>
        <span className="text-[7px] font-bold uppercase tracking-wider text-zinc-500">/ 100</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */

export default function SharedResultPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-32"><div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" /></div>}>
      <SharedResultContent />
    </Suspense>
  );
}

function SharedResultContent() {
  const searchParams = useSearchParams();
  const data = useMemo(() => decodeResult(searchParams.get("d")), [searchParams]);

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <h1 className="text-2xl font-bold text-white">Invalid or expired result</h1>
        <p className="text-zinc-400 text-sm">This shared result link could not be decoded.</p>
        <Link href="/">
          <Button variant="outline" className="gap-2 border-white/10 bg-white/[0.03]">
            <ArrowLeft className="h-4 w-4" /> Try the advisor
          </Button>
        </Link>
      </div>
    );
  }

  const { winner, alternatives, prompt, task, confidence, ts } = data;

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-violet-400">
            NexusRoute Recommendation
          </span>
        </div>
        <h1 className="text-2xl font-bold text-white">Shared Result</h1>
        <p className="text-sm text-zinc-500">
          Generated {new Date(ts).toLocaleDateString()} for task: <span className="text-zinc-300">{task}</span>
          {" · "}{confidence}% confidence
        </p>
      </motion.div>

      {/* Prompt */}
      <div className="panel-card p-5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">Prompt analyzed</p>
        <p className="text-sm text-zinc-300 leading-relaxed">{prompt}</p>
      </div>

      {/* Winner card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="relative rounded-3xl border border-yellow-500/20 bg-gradient-to-br from-yellow-500/[0.04] via-[#0c0c20] to-[#0c0c20] overflow-hidden"
        style={{ boxShadow: "0 0 80px -20px rgba(250,204,21,0.12)" }}
      >
        <div className="p-8 flex flex-col sm:flex-row items-center gap-6">
          <ScoreRing score={winner.score} />
          <div className="flex-1 text-center sm:text-left">
            <div className="flex items-center gap-2 justify-center sm:justify-start mb-1">
              <Trophy className="h-4 w-4 text-yellow-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-yellow-400">Best Match</span>
            </div>
            <h2 className="text-2xl font-black text-white mb-2">{winner.modelName}</h2>
            <p className="text-sm text-zinc-400 mb-3">{winner.reasoning}</p>
            <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
              <Badge variant="outline" className={`${PROVIDER_COLORS[winner.provider] ?? ""} text-[10px]`}>{winner.provider}</Badge>
              <Badge variant="outline" className={`${TIER_COLORS[winner.tier] ?? ""} text-[10px] capitalize`}>{winner.tier}</Badge>
              <span className="panel-chip chip-sm">In: {winner.inputCost}</span>
              <span className="panel-chip chip-sm">Out: {winner.outputCost}</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Alternatives */}
      {alternatives.length > 0 && (
        <div>
          <h3 className="panel-label mb-3 flex items-center gap-2">
            <BarChart3 className="h-3.5 w-3.5 text-violet-400" /> Alternatives
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {alternatives.map((alt, i) => (
              <div key={alt.modelId} className="panel-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/[0.06] text-[10px] font-black text-zinc-400">{i + 2}</span>
                    <span className="font-bold text-white text-sm">{alt.modelName}</span>
                  </div>
                  <span className="text-sm font-black text-zinc-300">{alt.score}</span>
                </div>
                <div className="flex gap-1.5">
                  <Badge variant="outline" className={`${PROVIDER_COLORS[alt.provider] ?? ""} text-[10px]`}>{alt.provider}</Badge>
                  <Badge variant="outline" className={`${TIER_COLORS[alt.tier] ?? ""} text-[10px] capitalize`}>{alt.tier}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="text-center pt-4">
        <Link href="/">
          <Button className="gap-2 bg-violet-600 hover:bg-violet-500">
            <Zap className="h-4 w-4" /> Try your own prompt
          </Button>
        </Link>
        <p className="text-[11px] text-zinc-600 mt-3">
          NexusRoute — free, private, browser-native AI model routing
        </p>
      </div>
    </div>
  );
}
