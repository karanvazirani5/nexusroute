"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Clock,
} from "lucide-react";
import type { NewsHeadline } from "@/app/api/news/route";

/**
 * AI News Ticker — Bloomberg-terminal style scrolling headlines.
 *
 * Click to expand into a full news panel with summaries and links.
 * Fetches from /api/news (backed by OpenAI web search).
 * Refreshes every 10 minutes.
 */

const CATEGORY_EMOJI: Record<string, string> = {
  launch: "🚀",
  research: "🔬",
  "open-source": "🔓",
  regulation: "⚖️",
  industry: "📊",
  funding: "💰",
  partnership: "🤝",
};

const CATEGORY_COLORS: Record<string, string> = {
  launch: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  research: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  "open-source": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  regulation: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  industry: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  funding: "bg-green-500/10 text-green-400 border-green-500/20",
  partnership: "bg-rose-500/10 text-rose-400 border-rose-500/20",
};

const POLL_INTERVAL_MS = 10 * 60 * 1000;

export function LiveTicker() {
  const [headlines, setHeadlines] = useState<NewsHeadline[]>([]);
  const [status, setStatus] = useState<"loading" | "live" | "error">(
    "loading"
  );
  const [expanded, setExpanded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchNews() {
    try {
      const res = await fetch("/api/news");
      if (!res.ok) throw new Error(`${res.status}`);
      const data = (await res.json()) as { headlines: NewsHeadline[] };
      if (data.headlines?.length > 0) {
        setHeadlines(data.headlines);
        setStatus("live");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    fetchNews();
    timerRef.current = setInterval(fetchNews, POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const statusColor =
    status === "live"
      ? "bg-emerald-400 shadow-emerald-400/50"
      : status === "loading"
      ? "bg-amber-400 shadow-amber-400/40"
      : "bg-red-500 shadow-red-500/40";

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950">
      {/* ── Header bar (always visible, clickable) ── */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 border-b border-white/[0.06]/60 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-zinc-500 hover:bg-white/[0.02] transition-colors"
      >
        <div className="relative flex h-2.5 w-2.5 items-center justify-center">
          <span
            className={`absolute inline-flex h-full w-full rounded-full ${statusColor} opacity-60 ${
              status === "live" ? "animate-ping" : ""
            }`}
          />
          <span
            className={`relative inline-flex h-2 w-2 rounded-full ${statusColor}`}
          />
        </div>
        <Globe className="h-3 w-3 text-violet-400" />
        <span>AI News</span>
        <span className="text-zinc-700">·</span>
        <span>{headlines.length} stories</span>
        {!expanded && (
          <span className="rounded-full border border-violet-500/20 bg-violet-500/5 px-2 py-0.5 text-[9px] font-medium text-violet-400 normal-case tracking-normal">
            Click to expand
          </span>
        )}
        <span className="ml-auto flex items-center gap-2 text-zinc-600">
          {status === "live"
            ? "live"
            : status === "loading"
            ? "loading…"
            : "unavailable"}
          {expanded ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </span>
      </button>

      {/* ── Scrolling ticker (visible when collapsed) ── */}
      {!expanded && (
        <div
          className="relative h-10 overflow-hidden cursor-pointer hover:bg-white/[0.015] transition-colors"
          onClick={() => setExpanded(true)}
        >
          {headlines.length === 0 ? (
            <div className="flex h-full items-center px-4 text-xs text-zinc-500">
              {status === "loading"
                ? "Loading latest AI news…"
                : "News temporarily unavailable — check back soon."}
            </div>
          ) : (
            <div
              className="marquee-row flex h-full whitespace-nowrap"
              style={{ minWidth: "max-content" }}
            >
              {[...headlines, ...headlines].map((h, i) => (
                <span
                  key={`${h.title.slice(0, 20)}-${i}`}
                  className="flex items-center gap-2 px-5 text-xs text-zinc-300 cursor-pointer"
                  onClick={() => setExpanded(true)}
                >
                  <span className="text-base">
                    {CATEGORY_EMOJI[h.category] ?? "📰"}
                  </span>
                  <span className="font-medium text-violet-300">
                    {h.source}
                  </span>
                  <span className="text-zinc-600">·</span>
                  <span className="max-w-sm truncate text-zinc-400">
                    {h.title}
                  </span>
                  <span className="mx-3 text-zinc-800">│</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Expanded news panel ── */}
      <AnimatePresence>
        {expanded && headlines.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              {headlines.map((h, i) => (
                <motion.a
                  key={h.title.slice(0, 30)}
                  href={h.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: i * 0.04,
                    duration: 0.3,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="group flex flex-col gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-violet-500/20 hover:bg-violet-500/[0.03] transition-all"
                >
                  {/* Category + source row */}
                  <div className="flex items-center gap-2">
                    <span className="text-lg">
                      {CATEGORY_EMOJI[h.category] ?? "📰"}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                        CATEGORY_COLORS[h.category] ??
                        "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                      }`}
                    >
                      {h.category.replace("-", " ")}
                    </span>
                    <span className="text-[10px] text-zinc-600 ml-auto">
                      {h.source}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-sm font-semibold text-zinc-200 leading-snug group-hover:text-white transition-colors">
                    {h.title}
                  </h3>

                  {/* Summary */}
                  {h.summary && (
                    <p className="text-[12px] text-zinc-500 leading-relaxed line-clamp-3">
                      {h.summary}
                    </p>
                  )}

                  {/* Read more */}
                  <div className="flex items-center gap-1 text-[10px] text-violet-400/70 group-hover:text-violet-400 transition-colors mt-auto pt-1">
                    <ExternalLink className="h-2.5 w-2.5" />
                    <span>Read full article</span>
                  </div>
                </motion.a>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
