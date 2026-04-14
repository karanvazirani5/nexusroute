"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Lightbulb } from "lucide-react";

interface NudgeConfig {
  id: string;
  message: string;
  triggerAfterPrompts: number;
}

const NUDGES: NudgeConfig[] = [
  { id: "try_tracks", message: "Tip: Try the same prompt with different optimization tracks to compare recommendations.", triggerAfterPrompts: 1 },
  { id: "save_prefs", message: "Tip: Save your preferred providers and budget in Settings to personalize all future recommendations.", triggerAfterPrompts: 3 },
  { id: "check_panel", message: "Tip: Check the Panel to see patterns in your recommendations and routing decisions.", triggerAfterPrompts: 5 },
];

interface OnboardingNudgeProps {
  promptCount: number;
}

export default function OnboardingNudge({ promptCount }: OnboardingNudgeProps) {
  const [activeNudge, setActiveNudge] = useState<NudgeConfig | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const shown = JSON.parse(localStorage.getItem("nr_nudges_shown") || "[]") as string[];
    const dismissed = JSON.parse(localStorage.getItem("nr_nudges_dismissed") || "[]") as string[];

    // Find the first nudge whose trigger threshold has been met and hasn't been shown/dismissed
    const candidate = NUDGES.find(
      (n) => promptCount >= n.triggerAfterPrompts && !shown.includes(n.id) && !dismissed.includes(n.id)
    );

    if (candidate) {
      setActiveNudge(candidate);
      localStorage.setItem("nr_nudges_shown", JSON.stringify([...shown, candidate.id]));
    }
  }, [promptCount]);

  const dismiss = () => {
    if (!activeNudge) return;
    const dismissed = JSON.parse(localStorage.getItem("nr_nudges_dismissed") || "[]") as string[];
    localStorage.setItem("nr_nudges_dismissed", JSON.stringify([...dismissed, activeNudge.id]));
    setActiveNudge(null);
  };

  return (
    <AnimatePresence>
      {activeNudge && (
        <motion.div
          initial={{ opacity: 0, y: -10, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -10, height: 0 }}
          transition={{ duration: 0.3 }}
          className="overflow-hidden"
        >
          <div className="flex items-center gap-3 rounded-xl border border-blue-500/15 bg-blue-500/[0.04] px-4 py-3">
            <Lightbulb className="h-4 w-4 text-blue-400 shrink-0" />
            <p className="text-xs text-blue-300 flex-1">{activeNudge.message}</p>
            <button onClick={dismiss} className="text-zinc-600 hover:text-zinc-400 shrink-0">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
