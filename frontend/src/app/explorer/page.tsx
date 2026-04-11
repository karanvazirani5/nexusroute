"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Binary,
  Compass,
  Database,
  Download,
  Eye,
  Filter,
  RefreshCw,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { API_BASE, CATEGORIES, CATEGORY_EMOJI } from "@/lib/constants";

interface EventRow {
  event_id: string;
  created_at: string | null;
  prompt_redacted: string | null;
  prompt_length_chars: number;
  prompt_length_tokens: number;
  language: string | null;
  contains_code: boolean;
  category_primary: string | null;
  subcategory: string | null;
  intent_label: string | null;
  goal_label: string | null;
  domain_label: string | null;
  output_type: string | null;
  task_structure: string | null;
  reasoning_intensity: number | null;
  creativity_score: number | null;
  precision_requirement: number | null;
  latency_sensitivity: number | null;
  cost_sensitivity: number | null;
  risk_class: string | null;
  complexity_score: number | null;
  ambiguity_score: number | null;
  craft_score: number | null;
  classifier_confidence: number | null;
  classifier_version: string | null;
  enrichment_tier: number | null;
  recommended_model: string | null;
  selected_model: string | null;
  user_accepted_recommendation: boolean | null;
  user_overrode_recommendation: boolean | null;
  override_reason: string | null;
  copied: boolean;
  abandoned: boolean;
  time_to_decision_ms: number | null;
  inferred_satisfaction: number | null;
  redaction_counts: Record<string, number>;
}

interface SearchResponse {
  total: number;
  limit: number;
  offset: number;
  rows: EventRow[];
}

/* ── Prompt DNA Modal ────────────────────────────────────────────── */

function PromptDNA({ row, onClose }: { row: EventRow; onClose: () => void }) {
  const dna = [
    { axis: "Reasoning", value: row.reasoning_intensity ?? 0, full: 5 },
    { axis: "Creativity", value: row.creativity_score ?? 0, full: 5 },
    { axis: "Precision", value: row.precision_requirement ?? 0, full: 5 },
    { axis: "Latency", value: row.latency_sensitivity ?? 0, full: 5 },
    { axis: "Cost", value: row.cost_sensitivity ?? 0, full: 5 },
    { axis: "Craft", value: row.craft_score ?? 0, full: 5 },
    { axis: "Complex", value: Math.round(((row.complexity_score ?? 0) / 10) * 5), full: 5 },
    { axis: "Clarity", value: Math.round((1 - (row.ambiguity_score ?? 0)) * 5), full: 5 },
  ];

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#050510]/85 backdrop-blur-lg p-4"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="my-8 w-full max-w-3xl overflow-hidden rounded-2xl border border-white/[0.08] bg-[var(--surface-0)] shadow-2xl shadow-violet-500/5"
        onClick={(e) => e.stopPropagation()}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/[0.06] p-5">
          <div>
            <div className="flex items-center gap-2">
              <Binary className="h-4 w-4 text-violet-400" />
              <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-200">Prompt DNA</h3>
              <span className="panel-chip chip-sm">{row.event_id.slice(0, 8)}</span>
              <span className="panel-chip panel-chip-active chip-sm">tier {row.enrichment_tier ?? 1}</span>
            </div>
            <p className="mt-1 text-[11px] text-zinc-500">
              {row.classifier_version ?? "—"} · {row.created_at ? new Date(row.created_at).toLocaleString() : "—"}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-6 p-6 md:grid-cols-2">
          {/* Left — radar + labels */}
          <div className="space-y-4">
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={dna} outerRadius="75%">
                  <PolarGrid stroke="rgba(255,255,255,0.06)" />
                  <PolarAngleAxis dataKey="axis" stroke="#71717a" tick={{ fontSize: 10, fill: "#a1a1aa" }} />
                  <PolarRadiusAxis domain={[0, 5]} tick={{ fontSize: 9, fill: "#52525b" }} />
                  <Radar dataKey="value" stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.25} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <DNARow label="category" value={`${CATEGORY_EMOJI[row.category_primary ?? ""] || "•"} ${row.category_primary ?? "—"}`} />
              <DNARow label="subcategory" value={row.subcategory ?? "—"} />
              <DNARow label="intent" value={row.intent_label ?? "—"} />
              <DNARow label="goal" value={row.goal_label ?? "—"} />
              <DNARow label="domain" value={row.domain_label ?? "—"} />
              <DNARow label="output type" value={row.output_type ?? "—"} />
              <DNARow label="task structure" value={row.task_structure ?? "—"} />
              <DNARow label="risk class" value={row.risk_class ?? "—"} />
            </div>
          </div>

          {/* Right — prompt + routing */}
          <div className="space-y-4 text-xs">
            <div>
              <p className="panel-label">redacted prompt</p>
              <p className="mt-1 rounded-lg border border-white/[0.05] bg-black/30 p-3 font-mono leading-relaxed text-zinc-200">
                {row.prompt_redacted || "—"}
              </p>
              <p className="mt-1 text-[10px] text-zinc-600">
                {row.prompt_length_chars} chars · {row.prompt_length_tokens} tokens · {row.language || "?"}
                {Object.keys(row.redaction_counts || {}).length > 0 && (
                  <>{" · redacted: "}{Object.entries(row.redaction_counts).map(([k, v]) => `${k}×${v}`).join(", ")}</>
                )}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              <DNARow label="recommended" value={row.recommended_model ?? "—"} />
              <DNARow label="selected" value={row.selected_model ?? "—"} />
              <DNARow label="classifier conf" value={row.classifier_confidence != null ? (row.classifier_confidence * 100).toFixed(0) + "%" : "—"} />
              <DNARow label="time to decision" value={row.time_to_decision_ms != null ? `${row.time_to_decision_ms}ms` : "—"} />
              <DNARow label="outcome" value={row.user_accepted_recommendation ? "accepted" : row.user_overrode_recommendation ? `overrode (${row.override_reason ?? "—"})` : row.abandoned ? "abandoned" : "pending"} />
              <DNARow label="inferred sat" value={row.inferred_satisfaction != null ? row.inferred_satisfaction.toFixed(2) : "—"} />
            </div>
            <div>
              <p className="panel-label">raw json</p>
              <pre className="mt-1 max-h-48 overflow-auto rounded-lg border border-white/[0.05] bg-black/30 p-3 text-[10px] text-zinc-500 panel-scroll">
                {JSON.stringify(row, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function DNARow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="panel-label">{label}</p>
      <p className="truncate text-zinc-200">{value}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   EXPLORER PAGE
   ═══════════════════════════════════════════════════════════════════ */

export default function ExplorerPage() {
  const [rows, setRows] = useState<EventRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [category, setCategory] = useState("");
  const [outcome, setOutcome] = useState("");
  const [minConf, setMinConf] = useState("");
  const [days, setDays] = useState(30);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<EventRow | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    debounceRef.current = setTimeout(() => setDebouncedQ(q), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (debouncedQ) params.set("q", debouncedQ);
      if (category) params.set("category", category);
      if (outcome) params.set("outcome", outcome);
      if (minConf) params.set("min_confidence", minConf);
      params.set("days", String(days));
      params.set("limit", "100");
      params.set("offset", String(offset));
      const r = await fetch(`${API_BASE}/panel/events/search?${params}`);
      if (!r.ok) throw new Error(`${r.status}`);
      const data = (await r.json()) as SearchResponse;
      setRows(data.rows);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "search failed");
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, category, outcome, minConf, days, offset]);

  useEffect(() => { void load(); }, [load]);

  const csvUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    params.set("days", String(days));
    return `${API_BASE}/panel/events/export.csv?${params}`;
  }, [q, category, days]);

  const outcomeBadge = (row: EventRow) => {
    if (row.user_accepted_recommendation) return { label: "accepted", cls: "border-emerald-500/25 bg-emerald-500/8 text-emerald-300" };
    if (row.user_overrode_recommendation) return { label: "overrode", cls: "border-amber-500/25 bg-amber-500/8 text-amber-300" };
    if (row.abandoned) return { label: "abandoned", cls: "border-rose-500/25 bg-rose-500/8 text-rose-300" };
    return { label: "pending", cls: "border-white/[0.08] bg-white/[0.02] text-zinc-500" };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        className="flex flex-wrap items-start justify-between gap-3"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div>
          <span className="page-badge page-badge-violet mb-3">
            <Compass className="h-2.5 w-2.5" /> Raw Data · Intent Panel
          </span>
          <h1 className="text-display !text-[32px] md:!text-[40px]">Explorer</h1>
          <p className="mt-2 max-w-2xl text-subtitle">
            Full-text search over every redacted prompt. Click a row to see the Prompt DNA radar.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void load()} disabled={loading} className="panel-chip" title="Refresh">
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          </button>
          <a href={csvUrl} className="panel-chip"><Download className="mr-1 h-3 w-3" /> CSV</a>
          <Link href="/dashboard" className="panel-chip panel-chip-active"><Sparkles className="mr-1 h-3 w-3" /> Panel</Link>
        </div>
      </motion.div>

      {/* Filters */}
      <div className="panel-card p-4">
        <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
            <Input
              placeholder="Search redacted prompts..."
              value={q}
              onChange={(e) => { setQ(e.target.value); setOffset(0); }}
              className="pl-8 text-xs border-white/[0.08] bg-white/[0.02]"
            />
          </div>
          <select value={category} onChange={(e) => { setCategory(e.target.value); setOffset(0); }} className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-2 text-xs text-zinc-200">
            <option value="">all categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{(CATEGORY_EMOJI[c] || "•") + " " + c.replace(/_/g, " ")}</option>)}
          </select>
          <select value={outcome} onChange={(e) => { setOutcome(e.target.value); setOffset(0); }} className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-2 text-xs text-zinc-200">
            <option value="">all outcomes</option>
            <option value="accepted">accepted</option>
            <option value="overrode">overrode</option>
            <option value="pending">pending</option>
          </select>
          <select value={minConf} onChange={(e) => { setMinConf(e.target.value); setOffset(0); }} className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-2 text-xs text-zinc-200">
            <option value="">any confidence</option>
            <option value="0.3">&ge; 30%</option>
            <option value="0.5">&ge; 50%</option>
            <option value="0.7">&ge; 70%</option>
            <option value="0.85">&ge; 85%</option>
          </select>
          <select value={days} onChange={(e) => { setDays(Number(e.target.value)); setOffset(0); }} className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-2 text-xs text-zinc-200">
            <option value={1}>last 24h</option>
            <option value={7}>last 7d</option>
            <option value={30}>last 30d</option>
            <option value={90}>last 90d</option>
            <option value={365}>last 1y</option>
          </select>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span className="flex items-center gap-1.5">
          <Filter className="h-3 w-3" />
          <span className="num-tabular">{total.toLocaleString()}</span> events · showing <span className="num-tabular">{rows.length}</span>
        </span>
        <div className="flex items-center gap-2">
          <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 100))} className="panel-chip disabled:opacity-30">&larr; prev</button>
          <button disabled={offset + rows.length >= total} onClick={() => setOffset(offset + 100)} className="panel-chip disabled:opacity-30">next &rarr;</button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-300">{error}</div>}

      {/* Table */}
      <motion.div
        className="panel-card overflow-hidden"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15, ease: "easeOut" }}
      >
        <div className="overflow-x-auto panel-scroll">
          <table className="panel-table">
            <thead>
              <tr>
                <th>when</th>
                <th>cat</th>
                <th>subcategory</th>
                <th>prompt (redacted)</th>
                <th className="text-right">conf</th>
                <th className="text-right">cplx</th>
                <th>rec</th>
                <th>sel</th>
                <th>outcome</th>
                <th className="text-right">sat</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading && (
                <tr>
                  <td colSpan={11} className="!py-12 text-center">
                    <div className="mx-auto max-w-sm space-y-2">
                      <Database className="mx-auto h-6 w-6 text-zinc-700" />
                      <p className="text-sm text-zinc-400">No events match</p>
                      <p className="text-[11px] text-zinc-600">Try broadening filters or extending the window.</p>
                    </div>
                  </td>
                </tr>
              )}
              {rows.map((row) => {
                const dt = row.created_at ? new Date(row.created_at) : null;
                const when = dt ? `${dt.toLocaleDateString([], { month: "short", day: "numeric" })} ${dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "—";
                const badge = outcomeBadge(row);
                return (
                  <tr key={row.event_id} onClick={() => setSelected(row)} className="cursor-pointer group">
                    <td className="text-zinc-500 num-tabular">{when}</td>
                    <td><span className="mr-1.5">{CATEGORY_EMOJI[row.category_primary ?? ""] || "•"}</span><span className="text-zinc-200">{(row.category_primary ?? "—").replace(/_/g, " ")}</span></td>
                    <td className="text-zinc-400">{(row.subcategory ?? "—").replace(/_/g, " ")}</td>
                    <td className="max-w-md truncate text-zinc-300" title={row.prompt_redacted ?? ""}>{row.prompt_redacted}</td>
                    <td className="text-right text-zinc-400 num-tabular">{row.classifier_confidence != null ? `${Math.round(row.classifier_confidence * 100)}%` : "—"}</td>
                    <td className="text-right text-zinc-400 num-tabular">{row.complexity_score ?? "—"}</td>
                    <td className="font-mono text-[11px] text-zinc-400">{row.recommended_model ?? "—"}</td>
                    <td className="font-mono text-[11px] text-zinc-300">{row.selected_model ?? "—"}</td>
                    <td>
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="text-right text-zinc-400 num-tabular">{row.inferred_satisfaction != null ? row.inferred_satisfaction.toFixed(2) : "—"}</td>
                    <td><Eye className="h-3.5 w-3.5 text-zinc-600 transition-colors group-hover:text-violet-300" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>

      <AnimatePresence>
        {selected && <PromptDNA row={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </div>
  );
}
