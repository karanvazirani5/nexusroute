"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Binary,
  Brain,
  Clock,
  Compass,
  Database,
  DollarSign,
  Download,
  Filter,
  Gauge,
  GitBranch,
  Hash,
  Layers,
  LineChart,
  RefreshCw,
  Shield,
  Sparkles,
  Target,
  Timer,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

import { LiveTicker } from "@/components/LiveTicker";
import {
  CountUp,
  DeltaBadge,
  DensityBar,
  EmptyState,
  Meter,
  MiniHistogram,
  PillGroup,
  Section,
  Skeleton,
  Sparkline,
  StatCard,
} from "@/components/intel/primitives";
import {
  API_BASE,
  CATEGORY_COLORS,
  CATEGORY_EMOJI,
  INSIGHT_COLORS,
  colorFor,
  emojiFor,
  fetchJson,
  num,
  pct,
} from "@/lib/constants";

// ──────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────
const WINDOW_CHOICES = [1, 7, 14, 30, 90] as const;

// ──────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────
interface CategoryShare {
  category_primary: string;
  label: string;
  events: number;
  share: number;
}

interface RouterHealth {
  total_events: number;
  events_with_outcome: number;
  accuracy_at_1: number | null;
  override_rate: number | null;
  avg_routing_confidence: number | null;
  avg_classifier_confidence: number | null;
  unclassified_rate: number | null;
  category_distribution: CategoryShare[];
}

interface DashboardPayload {
  as_of: string;
  total_events: number;
  total_sessions: number;
  total_users: number;
  events_24h: number;
  events_7d: number;
  router_health: RouterHealth;
  taxonomy_version: string;
  classifier_version: string;
}

interface WordRow {
  word: string;
  count: number;
  weight: number;
  top_category?: string | null;
  top_category_label?: string | null;
}

interface NgramRow {
  phrase: string;
  count: number;
  size: number;
}

interface ConstellationPoint {
  event_id: string;
  x: number;
  y: number;
  z: number;
  category: string;
  subcategory?: string;
  model?: string | null;
  preview?: string;
  confidence?: number;
}

interface HeatRow {
  hour: number;
  [cat: string]: number;
}

interface HeatmapPayload {
  categories: { id: string; label: string }[];
  rows: HeatRow[];
  total_events: number;
}

interface TrendRow {
  category: string;
  label: string;
  current_events: number;
  prior_events: number;
  current_share: number;
  prior_share: number;
  delta: number;
  direction: "up" | "down" | "flat";
}

interface LeaderRow {
  model_id: string;
  events: number;
  share: number;
  avg_satisfaction: number | null;
  avg_override_rate: number | null;
  avg_routing_confidence: number | null;
}

interface InsightCardPayload {
  id: string;
  headline: string;
  finding: string;
  sample_size: number;
  window_days: number;
  confidence: number;
  emoji: string;
  color: string;
}

interface ConfusionRow {
  category: string;
  category_label: string;
  reason: string;
  count: number;
}

interface TemplateRow {
  template: string;
  count: number;
  exemplar: string;
}

interface TimeseriesPoint {
  t: string;
  events: number;
}

interface TimeseriesPayload {
  bucket: string;
  total: TimeseriesPoint[];
  by_category: Record<string, TimeseriesPoint[]>;
  categories: { id: string; label: string }[];
}

interface Distributions {
  sample_size: number;
  complexity: { bin: number; count: number }[];
  reasoning_intensity: { bin: number; count: number }[];
  creativity: { bin: number; count: number }[];
  precision: { bin: number; count: number }[];
  craft: { bin: number; count: number }[];
  ambiguity: { bin: number; count: number }[];
  prompt_length_tokens: { bin: number; count: number }[];
  classifier_confidence: { bin: number; count: number }[];
}

interface MixItem {
  id: string;
  label: string;
  count: number;
  share: number;
}

interface MixBreakdowns {
  task_structure: MixItem[];
  output_type: MixItem[];
  risk_class: MixItem[];
  domain: MixItem[];
  intent: MixItem[];
  goal: MixItem[];
  prompt_structure: MixItem[];
}

interface RisingPhrase {
  phrase: string;
  current: number;
  prior: number;
  delta_rate: number;
  score: number;
}

interface ModelStrength {
  model_id: string;
  events: number;
  top_categories: { category: string; label: string; count: number }[];
  top_subcategories: { subcategory: string; count: number }[];
  avg_reasoning: number;
  avg_creativity: number;
  avg_complexity: number;
  avg_satisfaction: number | null;
  override_rate: number;
  selected_rate: number;
}

interface Narrative {
  headline: string;
  paragraph: string;
  keywords: string[];
  sample_size: number;
  window_days: number;
  insight_count: number;
}

interface CostByModel {
  model_id: string;
  cost_usd: number;
}

interface CostByCategory {
  category: string;
  label: string;
  cost_usd: number;
}

interface CostAnalytics {
  total_cost_usd: number;
  events_with_cost: number;
  avg_cost_per_event: number;
  by_model: CostByModel[];
  by_category: CostByCategory[];
}

interface FunnelStage {
  stage: string;
  count: number;
  rate: number | null;
}

interface FunnelPayload {
  stages: FunnelStage[];
  window_days: number;
}

interface PercentilesEntry {
  label?: string;
  category?: string;
  complexity?: number;
  p50: number | null;
  p90: number | null;
  p99?: number | null;
  mean?: number | null;
  count: number;
}

interface TimeToDecisionPayload {
  overall: { p50: number | null; p90: number | null; mean: number | null; count: number };
  by_category: PercentilesEntry[];
  by_complexity: PercentilesEntry[];
}

// ──────────────────────────────────────────────────────────────────
// Sub-components (defined BEFORE the default export)
// ──────────────────────────────────────────────────────────────────

function PulseChip({
  icon: Icon,
  label,
  value,
  hint,
  color,
  emoji,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  color: string;
  emoji?: string;
}) {
  return (
    <div className="panel-card panel-card-hover p-3">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="panel-label flex items-center gap-1">
            <span className="inline-flex" style={{ color }}>
              <Icon className="h-3 w-3" />
            </span>
            {label}
          </p>
          <p className="mt-1 flex items-center gap-1.5 truncate text-sm font-semibold text-white">
            {emoji && <span>{emoji}</span>}
            <span className="truncate">{value}</span>
          </p>
          {hint && <p className="mt-0.5 text-[10px] text-zinc-500">{hint}</p>}
        </div>
        <span
          className="h-8 w-1 shrink-0 rounded-full"
          style={{ background: `linear-gradient(180deg, ${color}, ${color}33)` }}
        />
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="panel-label">{label}</p>
      <p className="text-xs text-zinc-200 num-tabular">{value}</p>
    </div>
  );
}

function MixList({
  items,
  color,
}: {
  items: { id: string; label: string; count: number; share: number }[];
  color: string;
}) {
  if (!items.length) return <EmptyState title="No data" />;
  return (
    <div className="space-y-2">
      {items.slice(0, 7).map((i) => (
        <Meter
          key={i.id}
          label={i.label}
          value={i.share}
          color={color}
          annotation={`${i.count} · ${(i.share * 100).toFixed(0)}%`}
        />
      ))}
    </div>
  );
}

function ModelStrengthCard({ model }: { model: ModelStrength }) {
  return (
    <div className="panel-card panel-card-hover p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-sm font-semibold text-white">
            {model.model_id}
          </p>
          <p className="panel-label mt-0.5">{model.events} events</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-zinc-500">satisfaction</p>
          <p className="num-tabular text-sm font-semibold text-emerald-300">
            {model.avg_satisfaction !== null
              ? model.avg_satisfaction.toFixed(2)
              : "\u2014"}
          </p>
        </div>
      </div>
      <div className="mt-3 space-y-1">
        <p className="panel-label">chosen for</p>
        {model.top_categories.slice(0, 3).map((c) => (
          <div
            key={c.category}
            className="flex items-center justify-between text-xs"
          >
            <span className="flex items-center gap-1 text-zinc-300">
              <span>{emojiFor(c.category)}</span>
              {c.label}
            </span>
            <span className="num-tabular text-zinc-500">{c.count}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/[0.04] pt-2 text-[10px]">
        <div>
          <p className="text-zinc-600">reason</p>
          <p className="num-tabular text-zinc-300">
            {model.avg_reasoning.toFixed(1)}
          </p>
        </div>
        <div>
          <p className="text-zinc-600">creative</p>
          <p className="num-tabular text-zinc-300">
            {model.avg_creativity.toFixed(1)}
          </p>
        </div>
        <div>
          <p className="text-zinc-600">complex</p>
          <p className="num-tabular text-zinc-300">
            {model.avg_complexity.toFixed(1)}
          </p>
        </div>
      </div>
    </div>
  );
}

function WordCloud({ words }: { words: WordRow[] }) {
  if (!words.length)
    return (
      <EmptyState
        icon={Hash}
        title="No tokens extracted yet"
        description="Words appear here after a few prompts. Stopwords + PII markers are filtered out automatically."
      />
    );
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
      {words.map((w) => {
        const size = 11 + Math.round(w.weight * 28);
        const opacity = 0.5 + w.weight * 0.5;
        const color = colorFor(w.top_category);
        return (
          <span
            key={w.word}
            className="cursor-default leading-none transition-transform duration-200 hover:scale-110"
            style={{
              fontSize: `${size}px`,
              color,
              opacity,
              fontWeight: 500 + Math.round(w.weight * 300),
            }}
            title={`${w.count} occurrences · top in ${w.top_category_label ?? "\u2014"}`}
          >
            {w.word}
          </span>
        );
      })}
    </div>
  );
}

function HourHeatmap({ data }: { data: HeatmapPayload | null }) {
  if (!data || data.total_events === 0) {
    return <EmptyState icon={Clock} title="Not enough events yet" />;
  }
  const cats = data.categories;
  const maxVal = Math.max(
    1,
    ...data.rows.flatMap((r) => cats.map((c) => Number(r[c.id] || 0))),
  );
  return (
    <div className="panel-scroll overflow-x-auto">
      <div className="min-w-[640px]">
        <div
          className="mb-2 grid"
          style={{ gridTemplateColumns: `90px repeat(24, 1fr)` }}
        >
          <div className="panel-label">cat / hour</div>
          {Array.from({ length: 24 }, (_, h) => (
            <div
              key={h}
              className="num-tabular text-center text-[9px] text-zinc-600"
            >
              {h}
            </div>
          ))}
        </div>
        {cats.map((cat) => (
          <div
            key={cat.id}
            className="mb-1 grid items-center gap-[1px]"
            style={{ gridTemplateColumns: `90px repeat(24, 1fr)` }}
          >
            <div className="flex items-center gap-1.5 truncate pr-2 text-[10px] text-zinc-400">
              <span>{emojiFor(cat.id)}</span>
              <span className="truncate">{cat.label}</span>
            </div>
            {data.rows.map((row) => {
              const v = Number(row[cat.id] || 0);
              const intensity = v / maxVal;
              const color = colorFor(cat.id);
              return (
                <div
                  key={`${cat.id}-${row.hour}`}
                  className="aspect-square rounded-[3px] transition-all duration-300 hover:scale-110"
                  style={{
                    backgroundColor: v
                      ? color
                      : "rgba(255,255,255,0.02)",
                    opacity: v ? 0.35 + intensity * 0.65 : 0.3,
                    boxShadow:
                      v > maxVal * 0.7
                        ? `0 0 8px -2px ${color}`
                        : undefined,
                  }}
                  title={`${cat.label} · ${row.hour}:00 · ${v} events`}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function TimeseriesChart({ data }: { data: TimeseriesPayload | null }) {
  if (!data || data.total.length === 0) {
    return (
      <EmptyState
        icon={LineChart}
        title="No events in window"
        description="Fire a few prompts on the advisor to populate this chart."
      />
    );
  }
  const values = data.total.map((p) => p.events);
  const max = Math.max(1, ...values);
  return (
    <div className="space-y-4">
      <div className="relative h-32 w-full">
        <Sparkline values={values} color="#a78bfa" height={128} />
        <div className="absolute inset-0 flex items-start justify-between px-1 text-[9px] text-zinc-600">
          <span>{data.total[0]?.t.split("T")[0]}</span>
          <span>{data.total[data.total.length - 1]?.t.split("T")[0]}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {data.categories.slice(0, 6).map((cat) => {
          const series = data.by_category[cat.id] || [];
          const vals = series.map((p) => p.events);
          const color = colorFor(cat.id);
          const sum = vals.reduce((a, b) => a + b, 0);
          return (
            <div
              key={cat.id}
              className="rounded-lg border border-white/5 bg-white/[0.02] p-2"
            >
              <div className="mb-1 flex items-center justify-between text-[10px]">
                <span className="flex items-center gap-1 text-zinc-400">
                  <span>{emojiFor(cat.id)}</span>
                  <span className="truncate">{cat.label}</span>
                </span>
                <span className="num-tabular text-zinc-500">{sum}</span>
              </div>
              <div className="h-8">
                {vals.length >= 2 ? (
                  <Sparkline values={vals} color={color} height={32} />
                ) : (
                  <div className="h-full rounded bg-white/[0.03]" />
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="panel-label text-right">
        bucket={data.bucket} · max={max} · cats={data.categories.length}
      </p>
    </div>
  );
}

function ConstellationTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ConstellationPoint }>;
}) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  const color = colorFor(p.category);
  return (
    <div className="max-w-xs rounded-xl border border-white/10 bg-black/95 p-2.5 text-[11px] text-zinc-300 shadow-2xl backdrop-blur">
      <div className="flex items-center gap-1.5" style={{ color }}>
        <span>{emojiFor(p.category)}</span>
        <span className="font-medium">{p.category.replace(/_/g, " ")}</span>
        <span className="text-zinc-600">&middot;</span>
        <span className="text-zinc-500">
          {(p.subcategory || "\u2014").replace(/_/g, " ")}
        </span>
      </div>
      <div className="mt-1 text-zinc-400">{p.preview}</div>
      <div className="mt-1 flex items-center gap-2 text-[10px] text-zinc-600">
        <span>R {Math.round(p.x)}</span>
        <span>C {Math.round(p.y)}</span>
        <span>complex {p.z}</span>
        <span>conf {((p.confidence ?? 0) * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Safely attempt a fetch — returns null on failure so other panels
// still render.
// ──────────────────────────────────────────────────────────────────
async function safeFetch<T>(path: string): Promise<T | null> {
  try {
    return await fetchJson<T>(path);
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────────────────────────
// Main dashboard
// ──────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  // ── existing state ──
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [narrative, setNarrative] = useState<Narrative | null>(null);
  const [words, setWords] = useState<WordRow[]>([]);
  const [bigrams, setBigrams] = useState<NgramRow[]>([]);
  const [trigrams, setTrigrams] = useState<NgramRow[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapPayload | null>(null);
  const [constellation, setConstellation] = useState<ConstellationPoint[]>([]);
  const [trends, setTrends] = useState<TrendRow[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderRow[]>([]);
  const [insights, setInsights] = useState<InsightCardPayload[]>([]);
  const [confusion, setConfusion] = useState<ConfusionRow[]>([]);
  const [timeseries, setTimeseries] = useState<TimeseriesPayload | null>(null);
  const [distributions, setDistributions] = useState<Distributions | null>(
    null,
  );
  const [mix, setMix] = useState<MixBreakdowns | null>(null);
  const [rising, setRising] = useState<RisingPhrase[]>([]);
  const [strengths, setStrengths] = useState<ModelStrength[]>([]);

  // ── new panel state ──
  const [costAnalytics, setCostAnalytics] = useState<CostAnalytics | null>(
    null,
  );
  const [funnel, setFunnel] = useState<FunnelPayload | null>(null);
  const [timeToDecision, setTimeToDecision] =
    useState<TimeToDecisionPayload | null>(null);

  // ── control state ──
  const [initialLoad, setInitialLoad] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [windowDays, setWindowDays] = useState<number>(14);

  // ── Page Visibility: track whether tab is visible ──
  const visibleRef = useRef(true);

  useEffect(() => {
    const handler = () => {
      visibleRef.current = document.visibilityState === "visible";
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  // ── data loader with partial-failure resilience ──
  const loadAll = useCallback(async (days: number) => {
    setLoading(true);
    setError(null);

    const errors: string[] = [];

    // Each fetch is independent; failures are captured individually.
    const [
      dashR,
      narrativeR,
      wordsR,
      bigramsR,
      trigramsR,
      templatesR,
      heatmapR,
      constellationR,
      trendsR,
      leaderR,
      insightsR,
      confusionR,
      timeseriesR,
      distR,
      mixR,
      risingR,
      strengthsR,
      costR,
      funnelR,
      ttdR,
    ] = await Promise.all([
      safeFetch<DashboardPayload>(
        `/panel/insights/dashboard?window_days=${days}`,
      ),
      safeFetch<Narrative>(`/panel/intel/narrative?days=${days}`),
      safeFetch<{ words: WordRow[] }>(
        `/panel/intel/words?days=${days}&limit=60`,
      ),
      safeFetch<{ ngrams: NgramRow[] }>(
        `/panel/intel/ngrams?n=2&days=${days}&limit=20`,
      ),
      safeFetch<{ ngrams: NgramRow[] }>(
        `/panel/intel/ngrams?n=3&days=${days}&limit=15`,
      ),
      safeFetch<{ templates: TemplateRow[] }>(
        `/panel/intel/templates?days=${days}&limit=10`,
      ),
      safeFetch<HeatmapPayload>(`/panel/intel/heatmap?days=${days}`),
      safeFetch<{ points: ConstellationPoint[] }>(
        `/panel/intel/constellation?days=${days}&limit=800`,
      ),
      safeFetch<{ trends: TrendRow[] }>(`/panel/intel/trends?days=${days}`),
      safeFetch<{ models: LeaderRow[] }>(
        `/panel/intel/model-leaderboard?days=${days}`,
      ),
      safeFetch<{ cards: InsightCardPayload[] }>(
        `/panel/intel/insights?days=${days}`,
      ),
      safeFetch<{ cells: ConfusionRow[] }>(
        `/panel/intel/confusion?days=${days}`,
      ),
      safeFetch<TimeseriesPayload>(
        `/panel/intel/timeseries?days=${days}&bucket=auto`,
      ),
      safeFetch<Distributions>(`/panel/intel/distributions?days=${days}`),
      safeFetch<MixBreakdowns>(`/panel/intel/mix?days=${days}`),
      safeFetch<{ phrases: RisingPhrase[] }>(
        `/panel/intel/rising-phrases?days=${days}&top_n=10`,
      ),
      safeFetch<{ models: ModelStrength[] }>(
        `/panel/intel/model-strengths?days=${days}`,
      ),
      // New endpoints
      safeFetch<CostAnalytics>(`/panel/intel/cost-analytics?days=${days}`),
      safeFetch<FunnelPayload>(`/panel/intel/funnel?days=${days}`),
      safeFetch<TimeToDecisionPayload>(
        `/panel/intel/time-to-decision?days=${days}`,
      ),
    ]);

    // Apply each result independently — null means that endpoint failed.
    if (dashR) setData(dashR);
    else errors.push("dashboard");

    if (narrativeR) setNarrative(narrativeR);
    else errors.push("narrative");

    setWords(wordsR?.words ?? []);
    setBigrams(bigramsR?.ngrams ?? []);
    setTrigrams(trigramsR?.ngrams ?? []);
    setTemplates(templatesR?.templates ?? []);
    if (heatmapR) setHeatmap(heatmapR);
    setConstellation(constellationR?.points ?? []);
    setTrends(trendsR?.trends ?? []);
    setLeaderboard(leaderR?.models ?? []);
    setInsights(insightsR?.cards ?? []);
    setConfusion(confusionR?.cells ?? []);
    if (timeseriesR) setTimeseries(timeseriesR);
    if (distR) setDistributions(distR);
    if (mixR) setMix(mixR);
    setRising(risingR?.phrases ?? []);
    setStrengths(strengthsR?.models ?? []);

    // New panels
    if (costR) setCostAnalytics(costR);
    if (funnelR) setFunnel(funnelR);
    if (ttdR) setTimeToDecision(ttdR);

    if (errors.length > 0) {
      setError(`Partial load failure: ${errors.join(", ")}`);
    }

    setLoading(false);
    setInitialLoad(false);
  }, []);

  // Initial fetch + re-fetch when window changes
  useEffect(() => {
    void loadAll(windowDays);
  }, [loadAll, windowDays]);

  // Auto-refresh gated by Page Visibility API
  useEffect(() => {
    const t = window.setInterval(() => {
      if (visibleRef.current) {
        void loadAll(windowDays);
      }
    }, 20_000);
    return () => window.clearInterval(t);
  }, [loadAll, windowDays]);

  // ── derived values ──
  const health = data?.router_health;
  const totalSparkline = useMemo(
    () => timeseries?.total.map((p) => p.events) || [],
    [timeseries],
  );

  const constellationByCat = useMemo(() => {
    const g = new Map<string, ConstellationPoint[]>();
    constellation.forEach((p) => {
      if (!g.has(p.category)) g.set(p.category, []);
      g.get(p.category)!.push(p);
    });
    return g;
  }, [constellation]);

  const topCategory = useMemo(
    () => health?.category_distribution[0] ?? null,
    [health],
  );
  const topModel = useMemo(() => leaderboard[0] ?? null, [leaderboard]);
  const topRising = useMemo(
    () => trends.find((t) => t.direction === "up") ?? null,
    [trends],
  );

  // ── Loading skeleton screen ──
  if (initialLoad) {
    return (
      <div className="space-y-6">
        <LiveTicker />
        <div className="space-y-4">
          <Skeleton height={20} className="w-40" />
          <Skeleton height={48} className="w-3/4" />
        </div>
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <Skeleton height={140} />
          <div className="space-y-3">
            <Skeleton height={40} />
            <Skeleton height={40} />
            <Skeleton height={40} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height={90} />
          ))}
        </div>
        <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
          <Skeleton height={360} />
          <Skeleton height={360} />
        </div>
        <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
          <Skeleton height={200} />
          <Skeleton height={200} />
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          <Skeleton height={200} />
          <Skeleton height={200} />
          <Skeleton height={200} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─────────────── LIVE TICKER ─────────────── */}
      <LiveTicker />

      {/* ─────────────── HERO NARRATIVE ─────────────── */}
      <section className="fade-in">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/5 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-violet-300">
                <Activity className="h-2.5 w-2.5" /> Intelligence Terminal
              </span>
              <span className="text-[10px] text-zinc-600">
                auto-refresh every 20s
              </span>
            </div>
            <h1 className="bg-gradient-to-br from-white via-zinc-200 to-zinc-500 bg-clip-text text-[32px] font-semibold leading-[1.1] tracking-tight text-transparent md:text-[40px]">
              {narrative?.headline || "Loading panel state\u2026"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <PillGroup
              options={[...WINDOW_CHOICES]}
              value={windowDays}
              onChange={(v) => setWindowDays(v)}
              renderLabel={(v) => `${v}d`}
            />
            <button
              onClick={() => void loadAll(windowDays)}
              disabled={loading}
              className="rounded-full border border-white/10 bg-white/[0.03] p-1.5 text-zinc-400 transition-colors hover:border-white/20 hover:text-white"
              title="Refresh"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>

        {/* Narrative + quick pulses */}
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div className="panel-card relative overflow-hidden p-5">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />
            <p className="text-[13px] leading-relaxed text-zinc-300">
              {narrative?.paragraph ||
                "Fire prompts on the advisor to see the panel light up."}
            </p>
            {narrative?.keywords && narrative.keywords.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-1.5">
                <span className="panel-label mr-1">active categories:</span>
                {narrative.keywords.map((k) => (
                  <span key={k} className="panel-chip">
                    {k}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <PulseChip
              icon={Target}
              label="Top category"
              value={topCategory?.label ?? "\u2014"}
              hint={
                topCategory
                  ? `${(topCategory.share * 100).toFixed(0)}% share`
                  : undefined
              }
              color="#a78bfa"
              emoji={
                topCategory
                  ? CATEGORY_EMOJI[topCategory.category_primary]
                  : undefined
              }
            />
            <PulseChip
              icon={Sparkles}
              label="Leading model"
              value={topModel?.model_id ?? "\u2014"}
              hint={
                topModel
                  ? `${topModel.events} picks · ${(topModel.share * 100).toFixed(0)}%`
                  : undefined
              }
              color="#22d3ee"
            />
            <PulseChip
              icon={TrendingUp}
              label="Rising category"
              value={topRising?.label ?? "\u2014"}
              hint={
                topRising
                  ? `${topRising.delta >= 0 ? "+" : ""}${(topRising.delta * 100).toFixed(0)}% WoW`
                  : undefined
              }
              color="#34d399"
              emoji={
                topRising
                  ? CATEGORY_EMOJI[topRising.category]
                  : undefined
              }
            />
          </div>
        </div>
      </section>

      {/* ─────────────── AUTO INSIGHT CARDS ─────────────── */}
      {insights.length > 0 && (
        <section className="fade-in">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="panel-label">Auto-generated insights</h2>
            <span className="text-[10px] text-zinc-600">
              {insights.length} findings
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {insights.map((c) => {
              const style = INSIGHT_COLORS[c.color] || INSIGHT_COLORS.violet;
              return (
                <div
                  key={c.id}
                  className={`panel-card panel-card-hover ${style.glow} p-4`}
                >
                  <div className="flex items-start justify-between">
                    <span className="text-2xl leading-none">{c.emoji}</span>
                    <span className="num-tabular panel-chip">
                      n={c.sample_size}
                    </span>
                  </div>
                  <p className={`mt-3 text-sm font-semibold ${style.text}`}>
                    {c.headline}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
                    {c.finding}
                  </p>
                  <div className="mt-3 flex items-center justify-between text-[10px] text-zinc-600">
                    <span>window {c.window_days}d</span>
                    <span>conf {Math.round(c.confidence * 100)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ─────────────── KPI TILES ─────────────── */}
      {data && (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard
            label="Total events"
            value={<CountUp value={data.total_events} />}
            hint={`${num(data.events_24h)} last 24h`}
            sparkline={totalSparkline}
            accent="violet"
            icon={BarChart3}
          />
          <StatCard
            label={`Events · ${windowDays}d`}
            value={<CountUp value={health?.total_events ?? 0} />}
            hint={`${num(health?.events_with_outcome ?? 0)} w/ outcome`}
            sparkline={totalSparkline.slice(-windowDays)}
            accent="blue"
            icon={Zap}
          />
          <StatCard
            label="Router accuracy@1"
            value={pct(health?.accuracy_at_1, 1)}
            hint={`routing conf ${pct(health?.avg_routing_confidence, 0)}`}
            accent="emerald"
            icon={Gauge}
          />
          <StatCard
            label="Override rate"
            value={pct(health?.override_rate, 1)}
            hint="where users disagree"
            accent="amber"
            icon={Shield}
          />
          <StatCard
            label="Classifier conf"
            value={pct(health?.avg_classifier_confidence, 0)}
            hint={`unclassified ${pct(health?.unclassified_rate, 1)}`}
            accent="cyan"
            icon={Brain}
          />
          <StatCard
            label="Panel users"
            value={<CountUp value={data.total_users} />}
            hint={`${num(data.total_sessions)} sessions`}
            accent="neutral"
            icon={Users}
          />
        </section>
      )}

      {/* ─────────────── CONSTELLATION + VELOCITY ─────────────── */}
      <section
        id="sec-constellation"
        className="grid gap-5 lg:grid-cols-[3fr_2fr]"
      >
        <Section
          icon={Compass}
          title="Prompt constellation"
          subtitle="Every dot is one prompt on the reasoning \u00d7 creativity plane. Clusters reveal the actual shape of usage."
          right={
            <span className="num-tabular panel-chip">
              {constellation.length} points
            </span>
          }
        >
          {constellation.length === 0 ? (
            <EmptyState
              icon={Compass}
              title="Waiting for constellation data"
              description="Submit prompts through the advisor and watch them populate the plane in real time."
            />
          ) : (
            <div className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart
                  margin={{ top: 10, right: 20, bottom: 30, left: 0 }}
                >
                  <CartesianGrid stroke="#ffffff08" />
                  <XAxis
                    type="number"
                    dataKey="x"
                    domain={[0, 6]}
                    stroke="#3f3f46"
                    tick={{ fontSize: 10, fill: "#52525b" }}
                    label={{
                      value: "reasoning \u2192",
                      position: "insideBottom",
                      offset: -5,
                      fill: "#52525b",
                      fontSize: 10,
                    }}
                  />
                  <YAxis
                    type="number"
                    dataKey="y"
                    domain={[0, 6]}
                    stroke="#3f3f46"
                    tick={{ fontSize: 10, fill: "#52525b" }}
                    label={{
                      value: "creativity \u2192",
                      angle: -90,
                      position: "insideLeft",
                      fill: "#52525b",
                      fontSize: 10,
                    }}
                  />
                  <ZAxis type="number" dataKey="z" range={[60, 360]} />
                  <Tooltip
                    cursor={{
                      strokeDasharray: "3 3",
                      stroke: "#52525b",
                    }}
                    content={<ConstellationTooltip />}
                  />
                  {Array.from(constellationByCat.entries()).map(
                    ([cat, pts]) => (
                      <Scatter
                        key={cat}
                        name={cat}
                        data={pts}
                        fill={colorFor(cat)}
                        fillOpacity={0.78}
                      />
                    ),
                  )}
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          )}
        </Section>

        <Section
          icon={TrendingUp}
          title="Category velocity"
          subtitle={`Current ${windowDays}d vs prior ${windowDays}d \u2014 biggest movers.`}
        >
          {trends.length === 0 ? (
            <EmptyState
              icon={TrendingUp}
              title="Not enough history"
              description={`Needs ${windowDays * 2}+ days of data to compute WoW.`}
            />
          ) : (
            <div className="space-y-2.5">
              {trends.slice(0, 10).map((t) => (
                <div
                  key={t.category}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.03] bg-white/[0.01] p-2 transition-colors hover:bg-white/[0.025]"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="text-sm">{emojiFor(t.category)}</span>
                    <div className="min-w-0">
                      <p className="truncate text-xs text-zinc-200">
                        {t.label}
                      </p>
                      <p className="panel-label">
                        {t.current_events} events &middot;{" "}
                        {(t.current_share * 100).toFixed(0)}% share
                      </p>
                    </div>
                  </div>
                  <DeltaBadge value={t.delta} />
                </div>
              ))}
            </div>
          )}
        </Section>
      </section>

      {/* ─────────────── LANGUAGE INTELLIGENCE ─────────────── */}
      <section
        id="sec-language"
        className="grid gap-5 lg:grid-cols-[3fr_2fr]"
      >
        <Section
          icon={Hash}
          title="Most used words"
          subtitle="Colored by the category they appear in most. Stopwords and PII markers filtered."
          right={<span className="panel-chip">{words.length} tokens</span>}
        >
          <WordCloud words={words} />
        </Section>

        <Section
          icon={TrendingUp}
          title="Rising phrases"
          subtitle={`Bigrams with biggest lift vs prior ${windowDays}d.`}
        >
          {rising.length === 0 ? (
            <EmptyState icon={TrendingUp} title="No rising phrases yet" />
          ) : (
            <div className="space-y-1.5">
              {rising.slice(0, 10).map((p) => (
                <div
                  key={p.phrase}
                  className="flex items-center justify-between gap-2 border-b border-white/[0.04] pb-1.5 text-xs last:border-0"
                >
                  <span className="min-w-0 truncate text-zinc-200">
                    {p.phrase}
                  </span>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="num-tabular text-zinc-500">
                      {p.current}
                    </span>
                    <DeltaBadge value={p.delta_rate} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </section>

      {/* ─────────────── PHRASES + TEMPLATES ─────────────── */}
      <section className="grid gap-5 lg:grid-cols-3">
        <Section icon={Layers} title="Top bigrams">
          {bigrams.length === 0 ? (
            <EmptyState title="No bigrams yet" />
          ) : (
            <div className="space-y-1.5">
              {bigrams.slice(0, 12).map((g) => (
                <div
                  key={g.phrase}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="truncate text-zinc-300">{g.phrase}</span>
                  <span className="num-tabular text-zinc-500">
                    {g.count}&times;
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section icon={Layers} title="Top trigrams">
          {trigrams.length === 0 ? (
            <EmptyState title="Need more events" />
          ) : (
            <div className="space-y-1.5">
              {trigrams.slice(0, 12).map((g) => (
                <div
                  key={g.phrase}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="truncate text-zinc-300">{g.phrase}</span>
                  <span className="num-tabular text-zinc-500">
                    {g.count}&times;
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section
          icon={GitBranch}
          title="Detected templates"
          subtitle="Recurring prompt shapes with content blanked."
        >
          {templates.length === 0 ? (
            <EmptyState title="Need more events" />
          ) : (
            <div className="space-y-2">
              {templates.slice(0, 8).map((t) => (
                <div
                  key={t.template}
                  className="border-b border-white/[0.04] pb-1.5 last:border-0"
                >
                  <p className="font-mono text-[11px] text-violet-300">
                    {t.template}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-zinc-500">
                    ex: {t.exemplar}
                  </p>
                  <p className="num-tabular text-[10px] text-zinc-600">
                    {t.count}&times;
                  </p>
                </div>
              ))}
            </div>
          )}
        </Section>
      </section>

      {/* ─────────────── TIMESERIES + HEATMAP ─────────────── */}
      <section className="grid gap-5 lg:grid-cols-[3fr_2fr]">
        <Section
          icon={LineChart}
          title="Activity timeline"
          subtitle="Event rate over the window. Mini-sparklines show the top categories."
        >
          <TimeseriesChart data={timeseries} />
        </Section>

        <Section
          icon={Clock}
          title="Time-of-day \u00d7 category"
          subtitle="When people actually use AI."
        >
          <HourHeatmap data={heatmap} />
        </Section>
      </section>

      {/* ─────────────── DISTRIBUTIONS ─────────────── */}
      {distributions && distributions.sample_size > 0 && (
        <Section
          icon={BarChart3}
          title="Distribution of every numeric axis"
          subtitle="Histograms across the taxonomy \u2014 shows the shape of what the classifier sees."
        >
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            <MiniHistogram
              bins={distributions.complexity}
              color="#a78bfa"
              label="Complexity · 1-10"
            />
            <MiniHistogram
              bins={distributions.reasoning_intensity}
              color="#22d3ee"
              label="Reasoning · 1-5"
            />
            <MiniHistogram
              bins={distributions.creativity}
              color="#fbbf24"
              label="Creativity · 1-5"
            />
            <MiniHistogram
              bins={distributions.precision}
              color="#34d399"
              label="Precision · 1-5"
            />
            <MiniHistogram
              bins={distributions.craft}
              color="#f472b6"
              label="Craft · 1-5"
            />
            <MiniHistogram
              bins={distributions.ambiguity}
              color="#fb7185"
              label="Ambiguity · 0-1"
            />
            <MiniHistogram
              bins={distributions.prompt_length_tokens}
              color="#c084fc"
              label="Tokens · 0-500"
            />
            <MiniHistogram
              bins={distributions.classifier_confidence}
              color="#38bdf8"
              label="Classifier conf · 0-1"
            />
          </div>
        </Section>
      )}

      {/* ─────────────── MIX BREAKDOWNS ─────────────── */}
      {mix && (
        <section className="grid gap-5 lg:grid-cols-3">
          <Section icon={Binary} title="Task structure">
            <MixList items={mix.task_structure} color="#a78bfa" />
          </Section>
          <Section icon={Binary} title="Output type">
            <MixList items={mix.output_type} color="#22d3ee" />
          </Section>
          <Section icon={Binary} title="Domain">
            <MixList items={mix.domain} color="#34d399" />
          </Section>
          <Section icon={Binary} title="Intent">
            <MixList items={mix.intent} color="#fbbf24" />
          </Section>
          <Section icon={Binary} title="Goal">
            <MixList items={mix.goal} color="#f472b6" />
          </Section>
          <Section icon={AlertTriangle} title="Risk class">
            <MixList items={mix.risk_class} color="#fb7185" />
          </Section>
        </section>
      )}

      {/* ─────────────── CATEGORY SHARE + OVERRIDE MAP ─────────────── */}
      <section className="grid gap-5 lg:grid-cols-[3fr_2fr]">
        <Section
          icon={BarChart3}
          title="Category share"
          subtitle={`${windowDays}d · rolling`}
        >
          <div className="space-y-3">
            {(health?.category_distribution || []).map((row) => {
              const color = colorFor(row.category_primary);
              return (
                <Meter
                  key={row.category_primary}
                  label={
                    <span className="flex items-center gap-2">
                      <span>{emojiFor(row.category_primary)}</span>
                      {row.label}
                    </span>
                  }
                  value={row.share}
                  color={color}
                  annotation={`${row.events} · ${(row.share * 100).toFixed(0)}%`}
                />
              );
            })}
          </div>
        </Section>

        <Section
          icon={Shield}
          title="Override map"
          subtitle="Where users disagree with the router \u2014 gold for classifier improvement."
        >
          {confusion.length === 0 ? (
            <EmptyState
              icon={Shield}
              title="No overrides yet"
              description="Pick an override reason on the advisor to populate this panel."
            />
          ) : (
            <div className="space-y-1.5">
              {confusion.map((c) => (
                <div
                  key={`${c.category}-${c.reason}`}
                  className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.02] p-2"
                >
                  <div className="flex min-w-0 items-center gap-2 text-xs">
                    <span>{emojiFor(c.category)}</span>
                    <span className="truncate text-zinc-300">
                      {c.category_label}
                    </span>
                    <span className="panel-chip panel-chip-active">
                      {c.reason}
                    </span>
                  </div>
                  <span className="num-tabular text-xs text-zinc-500">
                    {c.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </section>

      {/* ─────────────── MODEL WAR ROOM ─────────────── */}
      <Section
        icon={Sparkles}
        title="Model war room"
        subtitle="Selected-model share over the window with inferred satisfaction and override rate."
      >
        {leaderboard.length === 0 ? (
          <EmptyState icon={Sparkles} title="No model selections yet" />
        ) : (
          <div className="space-y-3">
            {leaderboard.map((m, i) => {
              const color = `hsl(${(i * 50 + 260) % 360}, 70%, 65%)`;
              return (
                <div
                  key={m.model_id}
                  className="grid gap-3 rounded-xl border border-white/[0.04] bg-white/[0.01] p-3 md:grid-cols-[1.2fr_2fr_1fr_1fr_1fr]"
                >
                  <div>
                    <p className="text-sm font-medium text-white">
                      {m.model_id}
                    </p>
                    <p className="panel-label mt-0.5">{m.events} events</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <DensityBar
                      value={m.share}
                      max={1}
                      color={color}
                      height={8}
                    />
                    <span className="num-tabular shrink-0 text-xs text-zinc-400">
                      {(m.share * 100).toFixed(0)}%
                    </span>
                  </div>
                  <MiniStat
                    label="satisfaction"
                    value={
                      m.avg_satisfaction !== null
                        ? m.avg_satisfaction.toFixed(2)
                        : "\u2014"
                    }
                  />
                  <MiniStat label="override" value={pct(m.avg_override_rate, 0)} />
                  <MiniStat
                    label="routing conf"
                    value={pct(m.avg_routing_confidence, 0)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* ─────────────── PER-MODEL STRENGTH CARDS ─────────────── */}
      {strengths.length > 0 && (
        <Section
          icon={Target}
          title="Per-model strengths"
          subtitle="Auto-generated from real-world usage \u2014 what each model actually gets chosen for."
        >
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {strengths.map((m) => (
              <ModelStrengthCard key={m.model_id} model={m} />
            ))}
          </div>
        </Section>
      )}

      {/* ─────────────── COST INTELLIGENCE (new) ─────────────── */}
      {costAnalytics && (
        <Section
          icon={DollarSign}
          title="Cost intelligence"
          subtitle={`Estimated spend over ${windowDays}d \u2014 by model and by category.`}
        >
          <div className="space-y-5">
            {/* Total cost hero */}
            <div className="flex items-baseline gap-3">
              <span className="num-tabular text-2xl font-semibold text-emerald-300">
                ${costAnalytics.total_cost_usd.toFixed(2)}
              </span>
              <span className="text-[11px] text-zinc-500">
                total estimated cost · {windowDays}d window
              </span>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              {/* Cost by model */}
              <div>
                <p className="panel-label mb-2">By model</p>
                <div className="space-y-2">
                  {costAnalytics.by_model.slice(0, 8).map((m) => {
                    const share =
                      costAnalytics.total_cost_usd > 0
                        ? m.cost_usd /
                          costAnalytics.total_cost_usd
                        : 0;
                    return (
                      <Meter
                        key={m.model_id}
                        label={m.model_id}
                        value={share}
                        color="#34d399"
                        annotation={`$${m.cost_usd.toFixed(4)}`}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Cost by category */}
              <div>
                <p className="panel-label mb-2">By category</p>
                <div className="space-y-2">
                  {costAnalytics.by_category.slice(0, 8).map((c) => {
                    const share =
                      costAnalytics.total_cost_usd > 0
                        ? c.cost_usd /
                          costAnalytics.total_cost_usd
                        : 0;
                    return (
                      <Meter
                        key={c.category}
                        label={
                          <span className="flex items-center gap-1.5">
                            <span>{emojiFor(c.category)}</span>
                            {c.label}
                          </span>
                        }
                        value={share}
                        color={colorFor(c.category)}
                        annotation={`$${c.cost_usd.toFixed(4)}`}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </Section>
      )}

      {/* ─────────────── CONVERSION FUNNEL (new) ─────────────── */}
      {funnel && funnel.stages.length > 0 && (
        <Section
          icon={Filter}
          title="Conversion funnel"
          subtitle={`User journey stages over ${windowDays}d \u2014 from prompt to final action.`}
        >
          <div className="space-y-3">
            {funnel.stages.map((stage, idx) => {
              const maxCount = funnel.stages[0]?.count || 1;
              const barWidth = (stage.count / maxCount) * 100;
              // Funnel colors from wide (top) to narrow (bottom)
              const funnelColors = [
                "#a78bfa",
                "#22d3ee",
                "#4ade80",
                "#fbbf24",
                "#f472b6",
                "#fb923c",
                "#38bdf8",
                "#f87171",
              ];
              const color = funnelColors[idx % funnelColors.length];

              return (
                <div key={stage.stage} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-200">
                      {stage.stage.replace(/_/g, " ")}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="num-tabular text-zinc-400">
                        {num(stage.count)}
                      </span>
                      {idx > 0 && (
                        <span
                          className="num-tabular text-[10px]"
                          style={{ color }}
                        >
                          {pct(stage.rate, 1)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="h-3 w-full rounded-full bg-white/[0.03]">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${barWidth}%`,
                        backgroundColor: color,
                        opacity: 0.8,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* ─────────────── DECISION SPEED (new) ─────────────── */}
      {timeToDecision && (
        <section className="grid gap-5 lg:grid-cols-2">
          <Section
            icon={Timer}
            title="Decision speed by category"
            subtitle={`p50 / p90 latency (ms) over ${windowDays}d.`}
          >
            {timeToDecision.by_category.length === 0 ? (
              <EmptyState
                icon={Timer}
                title="No timing data yet"
                description="Decision speed is recorded when users interact with recommendations."
              />
            ) : (
              <div className="space-y-2">
                {timeToDecision.by_category.map((entry) => (
                  <div
                    key={entry.category || entry.label || "?"}
                    className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.03] bg-white/[0.01] p-2"
                  >
                    <span className="min-w-0 truncate text-xs text-zinc-200">
                      {entry.label || entry.category || "—"}
                    </span>
                    <div className="flex shrink-0 items-center gap-4 text-[10px]">
                      <span className="text-zinc-400">
                        p50{" "}
                        <span className="num-tabular text-cyan-300">
                          {entry.p50 != null ? `${Math.round(entry.p50)}ms` : "—"}
                        </span>
                      </span>
                      <span className="text-zinc-400">
                        p90{" "}
                        <span className="num-tabular text-amber-300">
                          {entry.p90 != null ? `${Math.round(entry.p90)}ms` : "—"}
                        </span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section
            icon={Timer}
            title="Decision speed by complexity"
            subtitle={`p50 / p90 latency (ms) bucketed by prompt complexity.`}
          >
            {timeToDecision.by_complexity.length === 0 ? (
              <EmptyState
                icon={Timer}
                title="No complexity timing data"
              />
            ) : (
              <div className="space-y-2">
                {timeToDecision.by_complexity.map((entry) => (
                  <div
                    key={entry.complexity ?? entry.label ?? "?"}
                    className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.03] bg-white/[0.01] p-2"
                  >
                    <span className="min-w-0 truncate text-xs text-zinc-200">
                      Complexity {entry.complexity ?? entry.label ?? "—"}
                    </span>
                    <div className="flex shrink-0 items-center gap-4 text-[10px]">
                      <span className="text-zinc-400">
                        p50{" "}
                        <span className="num-tabular text-cyan-300">
                          {entry.p50 != null ? `${Math.round(entry.p50)}ms` : "—"}
                        </span>
                      </span>
                      <span className="text-zinc-400">
                        p90{" "}
                        <span className="num-tabular text-amber-300">
                          {entry.p90 != null ? `${Math.round(entry.p90)}ms` : "—"}
                        </span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </section>
      )}

      {/* ─────────────── FOOTER META ─────────────── */}
      {data && (
        <section className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.05] pt-4 text-[10px] text-zinc-600">
          <span>
            taxonomy {data.taxonomy_version} &middot; classifier{" "}
            {data.classifier_version}
          </span>
          <span>
            last refresh {new Date(data.as_of).toLocaleTimeString()} &middot;
            auto-refresh 20s
          </span>
          <div className="flex items-center gap-2">
            <Link href="/explorer" className="panel-chip">
              <Database className="mr-1 h-3 w-3" /> Explorer
            </Link>
            <a
              href={`${API_BASE}/panel/events/export.csv?days=${windowDays}`}
              className="panel-chip"
            >
              <Download className="mr-1 h-3 w-3" /> Export {windowDays}d CSV
            </a>
            <Link href="/methodology" className="panel-chip">
              Methodology
            </Link>
          </div>
        </section>
      )}

      {error && (
        <div className="fixed bottom-6 right-6 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs text-rose-300 shadow-2xl">
          {error}
        </div>
      )}
    </div>
  );
}
