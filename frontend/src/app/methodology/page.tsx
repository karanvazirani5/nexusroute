"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Shield, BookOpen, GitBranch, Layers, Gauge, Code } from "lucide-react";

function DocSection({ title, icon: Icon, children, step }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode; step: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: step * 0.08, ease: "easeOut" }}
    >
      <section className="panel-card panel-card-hover group">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/8 transition-colors group-hover:bg-violet-500/12">
              <Icon className="h-4 w-4 text-violet-400" />
            </div>
            <div>
              <span className="panel-label">Section {step}</span>
              <h2 className="text-base font-semibold text-white leading-tight">{title}</h2>
            </div>
          </div>
          <div className="prose-panel space-y-3">{children}</div>
        </div>
      </section>
    </motion.div>
  );
}

function TierCard({ label, cost, description }: { tier: number; label: string; cost: string; description: string }) {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4 transition-colors hover:border-white/[0.08]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-white">{label}</span>
        <span className="panel-chip chip-sm">{cost}</span>
      </div>
      <p className="text-xs text-zinc-400 leading-relaxed">{description}</p>
    </div>
  );
}

export default function MethodologyPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <span className="page-badge page-badge-emerald mb-3">
          <BookOpen className="h-2.5 w-2.5" /> Methodology v1.0 · taxonomy v1.0.0
        </span>
        <h1 className="text-display !text-[32px] md:!text-[40px]">How It Works</h1>
        <p className="mt-3 max-w-3xl text-subtitle">
          This page documents exactly how each prompt becomes a structured observation, how observations become aggregates, and how aggregates become the public numbers we publish. Deliberately detailed so a hostile reviewer can reproduce and audit every claim.
        </p>
      </motion.div>

      {/* Table of Contents */}
      <nav className="panel-card p-4">
        <p className="panel-label mb-2">Contents</p>
        <ol className="grid gap-1 sm:grid-cols-2 lg:grid-cols-4">
          {["Data capture", "Taxonomy", "Classifier pipeline", "Accuracy & calibration", "Sample sizes", "Versioning", "Reproducibility"].map((item, i) => (
            <li key={i} className="text-xs text-zinc-400 flex items-center gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white/[0.04] text-[10px] font-semibold text-zinc-500">{i + 1}</span>
              {item}
            </li>
          ))}
        </ol>
      </nav>

      <div className="grid gap-5">
        <DocSection title="What we capture on every prompt" icon={BookOpen} step={1}>
          <p>
            When you submit a prompt on <Link className="text-violet-400 hover:text-violet-300 transition-colors" href="/">the advisor</Link>, we synchronously run a PII redaction pipeline and a Tier 1 heuristic classifier, then write a single row to the <code>prompt_events</code> table.
          </p>
          <ul>
            <li>An anonymous user id and session id (never linked across devices).</li>
            <li>The SHA-256 hash of the original prompt (stable across redaction versions).</li>
            <li>The redacted prompt (emails, keys, SSNs, cards, phones, URLs stripped).</li>
            <li>Structural features — length, language, contains_code, contains_url, prompt shape.</li>
            <li>A multi-axis classification — category (16), subcategory (~60), intent, goal, domain, output type, task structure, reasoning intensity, creativity, precision, latency sensitivity, cost sensitivity, risk class, complexity, ambiguity, craft.</li>
            <li>The advisor&apos;s routing decision — recommended model, candidate list with scores, confidence, tradeoff profile.</li>
            <li>The outcome — which model you selected, whether you copied/exported/abandoned/re-routed, time-to-decision.</li>
          </ul>
          <p className="text-xs text-zinc-500">We do <em>not</em> capture IP, device fingerprint, saved credentials, full model completions, or location beyond the timezone you already share with every website.</p>
        </DocSection>

        <DocSection title="The taxonomy" icon={GitBranch} step={2}>
          <p>Every prompt is scored on eight orthogonal axes. Axes are deliberately independent so one prompt can belong to multiple useful dimensions.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {["Task category (16 values)", "Task subcategory (~60 values)", "Output type (20 values)", "Task structure (10 shapes)", "Domain / industry (30 values)", "User goal (14 values)", "Risk / compliance class (9 values)", "Intent label (10 values)"].map((item) => (
              <div key={item} className="flex items-center gap-2 text-xs text-zinc-400">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-400 shrink-0" />
                {item}
              </div>
            ))}
          </div>
          <p className="text-xs text-zinc-500">Labels are additive only. Every event stores the classifier version that produced it.</p>
        </DocSection>

        <DocSection title="The classifier pipeline" icon={Layers} step={3}>
          <p className="text-xs text-zinc-400">Classification runs in three tiers so cost per insight stays low:</p>
          <div className="space-y-3">
            <TierCard tier={1} label="Tier 1 · Heuristic" cost="~$0 / event" description="Keyword-weighted classifier with structural feature extraction. Runs in the hot path for every prompt. Produces a full set of labels with a calibrated confidence score." />
            <TierCard tier={2} label="Tier 2 · GPT-4o-mini" cost="~$0.0002 / event" description="Events whose heuristic confidence falls below the escalation threshold are enriched asynchronously by a batched OpenAI classifier. Output is strictly validated against the taxonomy." />
            <TierCard tier={3} label="Tier 3 · Sonnet" cost="~$0.002 / event" description="Reserved for a small rotating sample (<5%), low-confidence outliers, and disagreement cases. Produces gold-quality labels used to monitor Tier 2 drift." />
          </div>
        </DocSection>

        <DocSection title="Router accuracy and calibration" icon={Gauge} step={4}>
          <ul>
            <li><strong>Router Accuracy@1</strong>: share of events where the user&apos;s selected model equals the recommended model.</li>
            <li><strong>Override rate</strong>: share of events where the user picked a different model. Tracked per category, per domain, per complexity bucket.</li>
            <li><strong>Calibration</strong>: routing confidence vs. actual acceptance curve. Published quarterly.</li>
            <li><strong>Inferred satisfaction</strong>: composite of copied / exported / session-continued / not-abandoned / not-reformulated signals, clamped to 0–1.</li>
          </ul>
        </DocSection>

        <DocSection title="Sample sizes and caveats" icon={Shield} step={5}>
          <p className="text-xs text-zinc-400">Every public claim derived from this data will carry:</p>
          <ul>
            <li>Exact sample size per cell. Cells with <strong>n &lt; 100</strong> are never published; <strong>n &lt; 500</strong> flagged as preliminary.</li>
            <li>The exact data window (start &rarr; end timestamps).</li>
            <li>User-base composition (current panel skews developer/startup-heavy).</li>
            <li>The taxonomy version and classifier version in effect.</li>
            <li>A link back to this methodology page and to any retractions.</li>
          </ul>
          <p className="text-xs text-zinc-500">If a published finding later turns out to be wrong, we publish a public retraction with the before/after numbers rather than silently deleting the original claim.</p>
        </DocSection>

        <DocSection title="Versioning" icon={GitBranch} step={6}>
          <p className="text-xs text-zinc-400">We version four things independently and stamp every event with the version in effect at write time:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { code: "taxonomy_version", val: "1.0.0" },
              { code: "classifier_version", val: "heuristic-1.0.0" },
              { code: "routing_strategy_version", val: "advisor-v3.0.0" },
              { code: "redaction_version", val: "1.0.0" },
            ].map((v) => (
              <div key={v.code} className="flex items-center gap-2 text-xs">
                <code>{v.code}</code>
                <span className="text-zinc-300 font-semibold">{v.val}</span>
              </div>
            ))}
          </div>
        </DocSection>

        <DocSection title="Reproducibility" icon={Code} step={7}>
          <p className="text-xs text-zinc-400">
            The instrumentation layer is part of this repository. The endpoints that power this methodology page and the{" "}
            <Link href="/dashboard" className="text-violet-400 hover:text-violet-300 transition-colors">internal dashboard</Link> are open source.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { path: "backend/app/core/taxonomy.py", desc: "authoritative label sets" },
              { path: "backend/app/core/redaction.py", desc: "exact patterns run on every prompt" },
              { path: "backend/app/core/intent_classifier.py", desc: "Tier 1 heuristic classifier" },
              { path: "backend/app/api/routes/insights.py", desc: "dashboard aggregation queries" },
            ].map((f) => (
              <div key={f.path} className="text-xs">
                <code>{f.path}</code>
                <p className="text-zinc-500 text-[10px] mt-0.5">{f.desc}</p>
              </div>
            ))}
          </div>
        </DocSection>
      </div>

      <p className="text-[11px] text-zinc-600">
        Found a flaw in the methodology? Good. That is exactly what this page exists for. Open an issue on the repository and we will publish the fix and any resulting corrections.
      </p>
    </div>
  );
}
