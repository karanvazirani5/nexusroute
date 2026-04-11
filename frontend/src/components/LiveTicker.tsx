"use client";

import { useEffect, useRef, useState } from "react";
import { Activity } from "lucide-react";
import { API_BASE, emojiFor } from "@/lib/constants";

/**
 * Bloomberg-terminal style live ticker.
 *
 * Connects to the backend /api/panel/intel/stream SSE endpoint and rolls
 * new events across the screen as they arrive. Connection state is shown
 * as a pulsing indicator: green = connected, amber = reconnecting,
 * zinc = idle (no events yet).
 */

interface TickerEvent {
  event_id: string;
  created_at?: string;
  category_primary?: string | null;
  subcategory?: string | null;
  preview?: string;
  recommended_model?: string | null;
  classifier_confidence?: number | null;
  complexity_score?: number | null;
  reasoning_intensity?: number | null;
  creativity_score?: number | null;
}

export function LiveTicker() {
  const [events, setEvents] = useState<TickerEvent[]>([]);
  const [status, setStatus] = useState<"idle" | "connecting" | "live" | "error">(
    "connecting"
  );
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let closed = false;

    function connect() {
      try {
        const es = new EventSource(`${API_BASE}/panel/intel/stream`);
        sourceRef.current = es;
        setStatus("connecting");

        es.addEventListener("hello", () => {
          if (!closed) setStatus("live");
        });

        es.addEventListener("prompt", (e: MessageEvent) => {
          if (closed) return;
          try {
            const data = JSON.parse(e.data) as TickerEvent;
            setEvents((prev) => [data, ...prev].slice(0, 20));
            setStatus("live");
          } catch {
            /* ignore */
          }
        });

        es.onerror = () => {
          if (closed) return;
          setStatus("error");
          es.close();
          sourceRef.current = null;
          // Try to reconnect after a short delay.
          window.setTimeout(() => {
            if (!closed) connect();
          }, 2500);
        };
      } catch {
        setStatus("error");
      }
    }

    connect();
    return () => {
      closed = true;
      if (sourceRef.current) {
        sourceRef.current.close();
        sourceRef.current = null;
      }
    };
  }, []);

  const statusColor =
    status === "live"
      ? "bg-emerald-400 shadow-emerald-400/50"
      : status === "connecting"
      ? "bg-amber-400 shadow-amber-400/40"
      : status === "error"
      ? "bg-red-500 shadow-red-500/40"
      : "bg-zinc-600";

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950">
      <div className="flex items-center gap-3 border-b border-white/[0.06]/60 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-zinc-500">
        <div className="relative flex h-2.5 w-2.5 items-center justify-center">
          <span
            className={`absolute inline-flex h-full w-full rounded-full ${statusColor} opacity-60 ${
              status === "live" ? "animate-ping" : ""
            }`}
          />
          <span className={`relative inline-flex h-2 w-2 rounded-full ${statusColor}`} />
        </div>
        <Activity className="h-3 w-3 text-emerald-400" />
        <span>Live panel stream</span>
        <span className="text-zinc-700">·</span>
        <span>{events.length} events buffered</span>
        <span className="ml-auto text-zinc-600">
          {status === "live"
            ? "connected"
            : status === "connecting"
            ? "connecting…"
            : status === "error"
            ? "reconnecting…"
            : ""}
        </span>
      </div>
      <div className="relative h-10 overflow-hidden">
        {events.length === 0 ? (
          <div className="flex h-full items-center px-4 text-xs text-zinc-500">
            Waiting for events… submit a prompt on the advisor to see this
            ticker light up.
          </div>
        ) : (
          <div className="marquee-row flex h-full whitespace-nowrap" style={{ minWidth: "max-content" }}>
            {[...events, ...events].map((e, i) => (
              <div
                key={`${e.event_id}-${i}`}
                className="flex items-center gap-2 px-5 text-xs text-zinc-300"
              >
                <span className="text-base">{emojiFor(e.category_primary)}</span>
                <span className="font-medium text-violet-300">
                  {(e.category_primary || "unknown").replace(/_/g, " ")}
                </span>
                <span className="text-zinc-600">·</span>
                <span className="text-zinc-500">
                  {(e.subcategory || "—").replace(/_/g, " ")}
                </span>
                <span className="text-zinc-600">·</span>
                <span className="max-w-xs truncate text-zinc-400">
                  {e.preview}
                </span>
                <span className="text-zinc-600">·</span>
                <span className="text-amber-400/80">
                  conf {((e.classifier_confidence ?? 0) * 100).toFixed(0)}%
                </span>
                <span className="text-zinc-600">·</span>
                <span className="text-emerald-400/80">→ {e.recommended_model ?? "—"}</span>
                <span className="mx-3 text-zinc-800">│</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* marquee animation defined in globals.css as .marquee-row */}
    </div>
  );
}
