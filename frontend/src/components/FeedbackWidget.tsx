"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ThumbsUp, ThumbsDown, ChevronRight, MessageSquare, Check, RefreshCcw } from "lucide-react";
import { recordOutcome, submitFeedback } from "@/lib/telemetry";

const OVERRIDE_REASONS = [
  { id: "cheaper", label: "Cheaper option available" },
  { id: "faster", label: "Need faster inference" },
  { id: "better_writing", label: "Better at writing" },
  { id: "better_coding", label: "Better at coding" },
  { id: "better_reasoning", label: "Better at reasoning" },
  { id: "privacy", label: "Privacy / self-hosted" },
  { id: "habit", label: "I always use that model" },
  { id: "other", label: "Other reason" },
] as const;

const NOT_HELPFUL_REASONS = [
  { id: "wrong_category", label: "Wrong task category" },
  { id: "irrelevant", label: "Irrelevant recommendation" },
  { id: "missing_context", label: "Missed important context" },
  { id: "outdated", label: "Model info seems outdated" },
  { id: "other", label: "Other reason" },
] as const;

type OverrideReasonId = (typeof OVERRIDE_REASONS)[number]["id"];
type NotHelpfulReasonId = (typeof NOT_HELPFUL_REASONS)[number]["id"];

interface FeedbackWidgetProps {
  eventId: string | null;
  recommendedModelId: string;
  recommendedModelName?: string;
  allModelNames: Array<{ id: string; name: string }>;
  startedAt: number;
}

export default function FeedbackWidget({
  eventId,
  recommendedModelId,
  recommendedModelName,
  allModelNames,
  startedAt,
}: FeedbackWidgetProps) {
  const [state, setState] = useState<
    "idle" | "not_helpful" | "picked_another" | "submitted"
  >("idle");
  const [rating, setRating] = useState<"up" | "down" | "other" | null>(null);
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedOverrideReason, setSelectedOverrideReason] = useState<OverrideReasonId | null>(null);
  const [selectedNotHelpfulReason, setSelectedNotHelpfulReason] = useState<NotHelpfulReasonId | null>(null);
  const [freeText, setFreeText] = useState("");

  const elapsedMs = () => Date.now() - startedAt;

  /* ── Thumbs Up ── */
  const handleThumbsUp = useCallback(() => {
    setRating("up");
    setState("submitted");
    if (eventId) {
      recordOutcome(eventId, {
        user_accepted_recommendation: true,
        user_overrode_recommendation: false,
        explicit_rating: 5,
        selected_model: recommendedModelId,
        time_to_decision_ms: elapsedMs(),
      });
      submitFeedback({
        event_id: eventId,
        feedback_type: "thumbs_up",
        recommended_model: recommendedModelId,
        selected_model: recommendedModelId,
        rating: 5,
        time_to_feedback_ms: elapsedMs(),
      });
    }
  }, [eventId, recommendedModelId, startedAt]);

  /* ── Thumbs Down → expand reason chips ── */
  const handleThumbsDown = useCallback(() => {
    setRating("down");
    setState("not_helpful");
  }, []);

  /* ── "I picked another model" ── */
  const handlePickedAnother = useCallback(() => {
    setRating("other");
    setState("picked_another");
  }, []);

  /* ── Submit "not helpful" with reason ── */
  const handleNotHelpfulSubmit = useCallback(() => {
    setState("submitted");
    if (eventId) {
      recordOutcome(eventId, {
        user_accepted_recommendation: false,
        user_overrode_recommendation: false,
        explicit_rating: 2,
        time_to_decision_ms: elapsedMs(),
      });
      submitFeedback({
        event_id: eventId,
        feedback_type: "thumbs_down",
        recommended_model: recommendedModelId,
        override_reason: selectedNotHelpfulReason ?? undefined,
        override_reason_text: freeText || undefined,
        rating: 2,
        time_to_feedback_ms: elapsedMs(),
      });
    }
  }, [eventId, recommendedModelId, selectedNotHelpfulReason, freeText, startedAt]);

  /* ── Submit override (picked another model) ── */
  const handleOverrideSubmit = useCallback(() => {
    setState("submitted");
    if (eventId) {
      recordOutcome(eventId, {
        user_accepted_recommendation: false,
        user_overrode_recommendation: true,
        explicit_rating: 1,
        selected_model: selectedModel || undefined,
        override_reason: selectedOverrideReason ?? "other",
        time_to_decision_ms: elapsedMs(),
      });
      submitFeedback({
        event_id: eventId,
        feedback_type: "override",
        recommended_model: recommendedModelId,
        selected_model: selectedModel || undefined,
        override_reason: selectedOverrideReason ?? "other",
        override_reason_text: freeText || undefined,
        rating: 1,
        time_to_feedback_ms: elapsedMs(),
      });
    }
  }, [eventId, recommendedModelId, selectedModel, selectedOverrideReason, freeText, startedAt]);

  /* ── Submitted state ── */
  if (state === "submitted") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] px-4 py-3"
      >
        <Check className="h-4 w-4 text-emerald-400" />
        <span className="text-sm text-emerald-300 font-medium">
          Thanks for your feedback!
        </span>
      </motion.div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Primary: three choices */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          Was this helpful?
        </span>
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={handleThumbsUp}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all border ${
              rating === "up"
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                : "bg-white/[0.03] text-zinc-400 border-white/[0.06] hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/20"
            }`}
          >
            <ThumbsUp className="h-3.5 w-3.5" />
            Helpful
          </button>
          <button
            onClick={handleThumbsDown}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all border ${
              rating === "down"
                ? "bg-red-500/15 text-red-400 border-red-500/30"
                : "bg-white/[0.03] text-zinc-400 border-white/[0.06] hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20"
            }`}
          >
            <ThumbsDown className="h-3.5 w-3.5" />
            Not helpful
          </button>
          <button
            onClick={handlePickedAnother}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all border ${
              rating === "other"
                ? "bg-violet-500/15 text-violet-400 border-violet-500/30"
                : "bg-white/[0.03] text-zinc-400 border-white/[0.06] hover:bg-violet-500/10 hover:text-violet-400 hover:border-violet-500/20"
            }`}
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            I picked another model
          </button>
        </div>
      </div>

      {/* Expanded: "Not helpful" details */}
      <AnimatePresence>
        {state === "not_helpful" && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-2">
                  What went wrong?
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {NOT_HELPFUL_REASONS.map((r) => (
                    <button
                      key={r.id}
                      onClick={() =>
                        setSelectedNotHelpfulReason(selectedNotHelpfulReason === r.id ? null : r.id)
                      }
                      className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition-all border ${
                        selectedNotHelpfulReason === r.id
                          ? "bg-red-500/15 text-red-300 border-red-500/30"
                          : "bg-white/[0.03] text-zinc-500 border-white/[0.06] hover:text-zinc-300 hover:border-white/[0.12]"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional free text */}
              <div>
                <textarea
                  value={freeText}
                  onChange={(e) => setFreeText(e.target.value.slice(0, 500))}
                  placeholder="Tell us more (optional)..."
                  rows={2}
                  className="w-full rounded-lg border border-white/[0.08] bg-[#0c0c20] px-3 py-2 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-red-500/40 resize-none"
                />
                <span className="text-[10px] text-zinc-600 mt-1 block text-right">{freeText.length}/500</span>
              </div>

              <button
                onClick={handleNotHelpfulSubmit}
                disabled={!selectedNotHelpfulReason}
                className="flex items-center gap-2 rounded-xl bg-red-500/15 border border-red-500/25 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Submit feedback
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expanded: "I picked another model" details */}
      <AnimatePresence>
        {state === "picked_another" && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-4">
              {/* Model picker */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-2">
                  Which model would you use instead?
                </label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full rounded-lg border border-white/[0.08] bg-[#0c0c20] px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
                >
                  <option value="">— Select a model —</option>
                  {allModelNames
                    .filter((m) => m.id !== recommendedModelId)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Override reason chips */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-2">
                  Why?
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {OVERRIDE_REASONS.map((r) => (
                    <button
                      key={r.id}
                      onClick={() =>
                        setSelectedOverrideReason(selectedOverrideReason === r.id ? null : r.id)
                      }
                      className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition-all border ${
                        selectedOverrideReason === r.id
                          ? "bg-violet-500/15 text-violet-300 border-violet-500/30"
                          : "bg-white/[0.03] text-zinc-500 border-white/[0.06] hover:text-zinc-300 hover:border-white/[0.12]"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional free text */}
              <div>
                <textarea
                  value={freeText}
                  onChange={(e) => setFreeText(e.target.value.slice(0, 500))}
                  placeholder="Any additional context (optional)..."
                  rows={2}
                  className="w-full rounded-lg border border-white/[0.08] bg-[#0c0c20] px-3 py-2 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-violet-500/40 resize-none"
                />
                <span className="text-[10px] text-zinc-600 mt-1 block text-right">{freeText.length}/500</span>
              </div>

              {/* Submit */}
              <button
                onClick={handleOverrideSubmit}
                disabled={!selectedModel && !selectedOverrideReason}
                className="flex items-center gap-2 rounded-xl bg-violet-500/15 border border-violet-500/25 px-4 py-2 text-sm font-semibold text-violet-300 hover:bg-violet-500/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Submit feedback
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
