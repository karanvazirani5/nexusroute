"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Lightbulb,
  Gauge,
  TrendingUp,
  Loader2,
} from "lucide-react";
import type { RewriteResult, ImprovementType } from "@/lib/promptRewriter";
import { rewritePrompt, getProfileForModel } from "@/lib/promptRewriter";

/* ── Props ── */

export interface PromptRewriteCardProps {
  originalPrompt: string;
  modelId: string;
  modelDisplayName: string;
  onCopy?: () => void;
  onUseModel?: (modelId: string, optimizedPrompt: string) => void;
}

/* ── Improvement dot colors ── */

const DOT_COLORS: Record<ImprovementType["type"], string> = {
  structure: "bg-purple-400",
  specificity: "bg-amber-400",
  context: "bg-emerald-400",
  format: "bg-blue-400",
  persona: "bg-pink-400",
  constraints: "bg-indigo-400",
  examples: "bg-teal-400",
  "chain-of-thought": "bg-orange-400",
};

/* ── Copy helper ── */

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

/* ── Loading skeleton ── */

function RewriteSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl border border-violet-500/15 bg-gradient-to-br from-violet-500/[0.04] via-[#0c0c20] to-[#0c0c20] overflow-hidden"
      style={{ boxShadow: "0 0 60px -20px rgba(139,92,246,0.12)" }}
    >
      <div className="px-6 py-8 flex flex-col items-center gap-3">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 text-violet-400 animate-spin" />
          <span className="text-sm font-semibold text-violet-300">
            Optimizing your prompt with AI...
          </span>
        </div>
        <div className="w-full max-w-md space-y-2.5 mt-2">
          <div className="h-3 rounded-full bg-white/[0.04] animate-pulse" />
          <div className="h-3 rounded-full bg-white/[0.04] animate-pulse w-4/5" />
          <div className="h-3 rounded-full bg-white/[0.04] animate-pulse w-3/5" />
        </div>
      </div>
    </motion.div>
  );
}

/* ── Component ── */

export default function PromptRewriteCard({
  originalPrompt,
  modelId,
  modelDisplayName,
  onCopy,
  onUseModel,
}: PromptRewriteCardProps) {
  const [result, setResult] = useState<RewriteResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"optimized" | "original">("optimized");
  const [copied, setCopied] = useState(false);
  const [tipsOpen, setTipsOpen] = useState(false);
  const [btnPressed, setBtnPressed] = useState(false);

  // Track current request to ignore stale responses
  const requestId = useRef(0);

  useEffect(() => {
    const id = ++requestId.current;
    setLoading(true);
    setResult(null);
    setTab("optimized");

    (async () => {
      try {
        const res = await fetch("/api/advisor/rewrite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: originalPrompt,
            modelId,
            modelDisplayName,
          }),
        });

        if (id !== requestId.current) return; // stale

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        if (id !== requestId.current) return; // stale

        if (data.error) throw new Error(data.error);

        setResult({
          optimizedPrompt: data.optimizedPrompt,
          modelId: data.modelId,
          modelDisplayName: data.modelDisplayName,
          improvements: data.improvements ?? [],
          confidenceScore: data.confidenceScore ?? 70,
          estimatedQualityGain: data.estimatedQualityGain ?? 20,
          tips: data.tips ?? [],
          directLink: data.directLink ?? "",
        });
      } catch {
        // Fallback to local rewriter
        if (id !== requestId.current) return;
        const local = rewritePrompt(originalPrompt, modelId);
        setResult(local);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    })();
  }, [originalPrompt, modelId, modelDisplayName]);

  const handleCopy = useCallback(async () => {
    if (!result) return;
    const ok = await copyToClipboard(result.optimizedPrompt);
    if (ok) {
      setCopied(true);
      onCopy?.();
      setTimeout(() => setCopied(false), 2000);
    }
  }, [result, onCopy]);

  const handleUseModel = useCallback(async () => {
    if (!result) return;
    await copyToClipboard(result.optimizedPrompt);
    if (onUseModel) {
      onUseModel(result.modelId, result.optimizedPrompt);
    } else if (result.directLink) {
      window.open(result.directLink, "_blank", "noopener");
    }
  }, [result, onUseModel]);

  // ── Loading state ──
  if (loading) return <RewriteSkeleton />;

  // ── No result or no improvements ──
  const r = result;
  if (!r || r.improvements.length === 0) return null;

  const gainColor =
    r.estimatedQualityGain >= 30
      ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
      : r.estimatedQualityGain >= 15
        ? "text-blue-400 bg-blue-500/10 border-blue-500/20"
        : "text-zinc-400 bg-white/[0.04] border-white/[0.06]";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl border border-violet-500/15 bg-gradient-to-br from-violet-500/[0.04] via-[#0c0c20] to-[#0c0c20] overflow-hidden"
      style={{ boxShadow: "0 0 60px -20px rgba(139,92,246,0.12)" }}
    >
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4 text-violet-400 shrink-0" />
            <h3 className="text-sm font-bold text-white truncate">
              Optimized for {r.modelDisplayName}
            </h3>
          </div>
          <p className="text-[11px] text-zinc-500">
            {r.improvements.length} improvement{r.improvements.length !== 1 ? "s" : ""} applied
          </p>
        </div>
        <span
          className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${gainColor}`}
        >
          <TrendingUp className="h-3 w-3" />
          +{r.estimatedQualityGain}% better
        </span>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex gap-1 px-6 mb-3">
        {(["optimized", "original"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              tab === t
                ? "bg-violet-500/15 text-violet-300"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]"
            }`}
          >
            {t === "optimized" ? "Optimized prompt" : "Original"}
          </button>
        ))}
      </div>

      {/* ── Prompt display ── */}
      <div className="relative mx-6 mb-5">
        <div className="rounded-xl border border-white/[0.06] bg-[#0a0a1a] p-4 pr-14 max-h-72 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.pre
              key={tab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="text-sm text-zinc-300 whitespace-pre-wrap break-words font-sans leading-relaxed"
            >
              {tab === "optimized" ? r.optimizedPrompt : originalPrompt}
            </motion.pre>
          </AnimatePresence>
        </div>

        {/* Copy button */}
        <button
          onClick={handleCopy}
          className="absolute top-3 right-3 flex items-center gap-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] px-2.5 py-1.5 text-[11px] font-semibold text-zinc-400 hover:text-white transition-all"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              Copy
            </>
          )}
        </button>
      </div>

      {/* ── Improvements ── */}
      {r.improvements.length > 0 && (
        <div className="px-6 mb-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">
            What we improved
          </p>
          <div className="flex flex-wrap gap-1.5">
            {r.improvements.map((imp, i) => (
              <span
                key={i}
                title={imp.description}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] border border-white/[0.06] px-2.5 py-1 text-[11px] font-medium text-zinc-300 hover:bg-white/[0.07] transition-colors cursor-default"
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${DOT_COLORS[imp.type] ?? "bg-zinc-400"}`}
                />
                {imp.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Tips (collapsible) ── */}
      {r.tips.length > 0 && (
        <div className="px-6 mb-5">
          <button
            onClick={() => setTipsOpen(!tipsOpen)}
            className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <Lightbulb className="h-3 w-3" />
            Tips for {r.modelDisplayName}
            {tipsOpen ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
          <AnimatePresence>
            {tipsOpen && (
              <motion.ul
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden mt-2 space-y-1 pl-4"
              >
                {r.tips.map((tip, i) => (
                  <li
                    key={i}
                    className="text-[12px] text-zinc-400 leading-relaxed list-disc marker:text-zinc-600"
                  >
                    {tip}
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Footer ── */}
      <div className="flex items-center justify-between gap-4 border-t border-white/[0.06] px-6 py-4">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
            <Gauge className="h-3 w-3" />
            <span>
              Confidence{" "}
              <span className="font-bold text-zinc-300">{r.confidenceScore}%</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
            <TrendingUp className="h-3 w-3" />
            <span>
              Quality{" "}
              <span className="font-bold text-emerald-400">+{r.estimatedQualityGain}%</span>
            </span>
          </div>
        </div>

        <button
          onClick={handleUseModel}
          onMouseDown={() => setBtnPressed(true)}
          onMouseUp={() => setBtnPressed(false)}
          onMouseLeave={() => setBtnPressed(false)}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-violet-500/20 ring-1 ring-white/10 hover:brightness-110 transition-all"
          style={{ transform: btnPressed ? "scale(0.97)" : "scale(1)" }}
        >
          Use in {r.modelDisplayName}
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  );
}
