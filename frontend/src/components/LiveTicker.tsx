"use client";

import { useEffect, useRef, useState } from "react";
import { Globe, Zap, Beaker, Scale, TrendingUp, Rocket, Handshake, Newspaper } from "lucide-react";
import type { NewsHeadline } from "@/app/api/news/route";

/**
 * AI News Ticker — Bloomberg-terminal style scrolling headlines.
 *
 * Fetches the latest AI news from /api/news (backed by OpenAI web search)
 * and scrolls them across the screen. Refreshes every 10 minutes.
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

const POLL_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

export function LiveTicker() {
  const [headlines, setHeadlines] = useState<NewsHeadline[]>([]);
  const [status, setStatus] = useState<"loading" | "live" | "error">("loading");
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
      <div className="flex items-center gap-3 border-b border-white/[0.06]/60 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-zinc-500">
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
        <span className="ml-auto text-zinc-600">
          {status === "live"
            ? "live"
            : status === "loading"
            ? "loading…"
            : "unavailable"}
        </span>
      </div>
      <div className="relative h-10 overflow-hidden">
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
              <a
                key={`${h.title.slice(0, 20)}-${i}`}
                href={h.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-5 text-xs text-zinc-300 hover:text-white transition-colors"
              >
                <span className="text-base">
                  {CATEGORY_EMOJI[h.category] ?? "📰"}
                </span>
                <span className="font-medium text-violet-300">{h.source}</span>
                <span className="text-zinc-600">·</span>
                <span className="max-w-sm truncate text-zinc-400">
                  {h.title}
                </span>
                <span className="mx-3 text-zinc-800">│</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
