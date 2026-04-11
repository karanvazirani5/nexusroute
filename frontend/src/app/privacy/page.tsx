"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Eye, EyeOff, Trash2, Shield, Check, AlertTriangle } from "lucide-react";

import {
  getConsentTier,
  grantConsent,
  revokeConsent,
  type ConsentTier,
} from "@/lib/telemetry";
import { Button } from "@/components/ui/button";

const TIERS: Array<{
  value: ConsentTier;
  label: string;
  description: string;
  icon: string;
}> = [
  {
    value: 0,
    label: "Essential only",
    description: "Anonymous instrumentation. Redacted prompt text, routing decision, and outcome are stored so we can measure router accuracy and category share. The raw prompt is discarded; nothing identifiable leaves your browser.",
    icon: "shield",
  },
  {
    value: 1,
    label: "Research contribution",
    description: "Same as essential, plus the redacted prompt is retained for clustering and archetype research. Your prompt may contribute to aggregate public insights (always with n >= 100 and never shown individually).",
    icon: "eye",
  },
];

export default function PrivacyPage() {
  const [tier, setTier] = useState<ConsentTier>(0);
  const [mounted, setMounted] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    setTier(getConsentTier());
    setMounted(true);
  }, []);

  const choose = useCallback(async (next: ConsentTier) => {
    await grantConsent(next, next === 0 ? ["essential"] : ["essential", "research"]);
    setTier(next);
  }, []);

  const forgetMe = useCallback(async () => {
    await revokeConsent();
    setTier(0);
    setShowConfirm(false);
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <span className="page-badge page-badge-blue mb-3">
          <Shield className="h-2.5 w-2.5" /> Privacy · Intent Panel v1.0
        </span>
        <h1 className="text-display !text-[32px] md:!text-[40px]">Your Data, Honestly</h1>
        <p className="mt-3 max-w-3xl text-subtitle">
          The panel only works if it is trustworthy enough to keep running. This page is the whole contract — read it, tune your consent, and keep the repository handy to verify the code matches the words.
        </p>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* What gets stored */}
        <section className="panel-card">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/8">
                <Lock className="h-4 w-4 text-violet-400" />
              </div>
              <h2 className="text-base font-semibold text-white">What actually gets stored</h2>
            </div>
            <div className="prose-panel">
              <ul>
                <li>An anonymous user id and session id generated on your first visit. Stored in your browser&apos;s localStorage, never linked across devices.</li>
                <li>A SHA-256 hash of your prompt text (stable across redaction version bumps, used to de-duplicate).</li>
                <li>A redacted copy of the prompt. Emails, phone numbers, credit cards, SSNs, API keys, JWTs, URLs are stripped before text hits disk.</li>
                <li>Structural features (length, language, contains_code) and taxonomy labels (category, subcategory, domain, etc.).</li>
                <li>The advisor&apos;s routing decision and whichever model you selected / copied / overrode.</li>
              </ul>
              <p className="text-xs text-zinc-500 mt-3">
                We do not store IP addresses, device fingerprints, browser versions, saved passwords, autofill data, model completions, cross-device identifiers, or location.
              </p>
            </div>
          </div>
        </section>

        {/* What never happens */}
        <section className="panel-card">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/8">
                <EyeOff className="h-4 w-4 text-rose-400" />
              </div>
              <h2 className="text-base font-semibold text-white">What never happens</h2>
            </div>
            <div className="space-y-2.5">
              {[
                "We never train a model on your prompts.",
                "We never sell raw prompt text to third parties.",
                "We never publish an individual prompt — only aggregates where n >= 100.",
                "We never run any provider API call on your behalf.",
                "We never auto-link prompts across users.",
                "We never share browser version or fingerprint signals.",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2.5 text-xs text-zinc-400">
                  <Check className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-400" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Consent tier */}
      <section className="panel-card glow-violet">
        <div className="p-6 space-y-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/8">
              <Eye className="h-4 w-4 text-violet-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Your consent tier</h2>
              <p className="text-[11px] text-zinc-500">
                {mounted ? `Current: Tier ${tier} — ${tier === 0 ? "essential only" : "research contribution"}` : "Loading..."}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {TIERS.map((t) => (
              <motion.button
                key={t.value}
                layout
                onClick={() => void choose(t.value)}
                className={`rounded-xl border p-5 text-left transition-all ${
                  tier === t.value
                    ? "border-violet-500/30 bg-violet-500/8 ring-1 ring-violet-500/15"
                    : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1]"
                }`}
                transition={{ layout: { duration: 0.3, ease: "easeInOut" } }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-white">{t.label}</span>
                  <AnimatePresence mode="wait">
                    {tier === t.value && (
                      <motion.span
                        key="active-badge"
                        className="panel-chip panel-chip-active chip-sm"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.2 }}
                      >
                        Active
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">{t.description}</p>
              </motion.button>
            ))}
          </div>

          <div className="panel-divider" />

          <div>
            <AnimatePresence mode="wait">
              {!showConfirm ? (
                <motion.div
                  key="forget-button"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowConfirm(true)}
                    className="text-xs border-white/[0.08] bg-white/[0.02] hover:bg-red-500/8 hover:border-red-500/25 hover:text-red-300"
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" /> Forget me — revoke all consent
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="forget-confirm"
                  className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 space-y-3"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-red-300">Are you sure?</p>
                      <p className="text-xs text-zinc-400 mt-1">This will mark every consent grant for your anonymous ID as revoked and reset your local consent tier to 0.</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => void forgetMe()} className="bg-red-600 text-white hover:bg-red-500 text-xs">
                      Yes, forget me
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowConfirm(false)} className="text-xs">
                      Cancel
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {!showConfirm && (
              <p className="mt-2 text-[11px] text-zinc-500">
                This marks every consent grant for your anonymous id as revoked on the server and resets your local consent tier to 0.
              </p>
            )}
          </div>
        </div>
      </section>

      <p className="text-[11px] text-zinc-600">
        If you want the ugly details, read{" "}
        <Link href="/methodology" className="text-violet-400 hover:text-violet-300 transition-colors">the methodology page</Link>{" "}
        or inspect <code className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[10px] font-mono text-violet-300">backend/app/core/redaction.py</code> in the repository.
      </p>
    </div>
  );
}
