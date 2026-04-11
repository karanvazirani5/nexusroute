"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Loader2,
  Eye,
  FileJson,
  Zap,
  Mic,
  Brain,
  Wrench,
  Search,
  Monitor,
  Image as ImageIcon,
  Radio,
  AlertTriangle,
  AlertCircle,
  Sparkles,
  Database,
  LayoutGrid,
  List,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { api, ModelInfo } from "@/lib/api";

/* Dynamic reference date: "new" = released within the last 30 days from today */
const REFERENCE_DATE = new Date().toISOString().slice(0, 10);

const PROVIDER_COLORS: Record<string, string> = {
  openai: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  anthropic: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  google: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  mistral: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  xai: "bg-red-500/10 text-red-400 border-red-500/20",
  deepseek: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  meta: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  alibaba: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  togetherai: "bg-rose-500/10 text-rose-400 border-rose-500/20",
};

type FilterTab = "all" | "frontier" | "mid-tier" | "budget" | "specialized" | "open-weight" | "deprecated";

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "frontier", label: "Frontier" },
  { id: "mid-tier", label: "Mid-tier" },
  { id: "budget", label: "Budget" },
  { id: "specialized", label: "Specialized" },
  { id: "open-weight", label: "Open Weight" },
  { id: "deprecated", label: "Deprecated" },
];

type ModelRow = ModelInfo & Record<string, unknown>;
function m(model: ModelInfo): ModelRow { return model as ModelRow; }

function formatContextWindow(tokens: unknown): string | null {
  if (tokens == null || typeof tokens !== "number" || !Number.isFinite(tokens)) return null;
  const n = tokens as number;
  if (n >= 1_000_000) return `${Math.round(n / 1_000_000)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

function formatUsdPer1m(value: unknown): string {
  if (value == null || typeof value !== "number" || !Number.isFinite(value)) return "—";
  const v = value as number;
  if (v < 0.01) return `$${v.toFixed(4)}`;
  if (v < 1) return `$${v.toFixed(3)}`;
  return `$${v.toFixed(2)}`;
}

function pricingPer1m(model: ModelInfo): { input: string; output: string } {
  const row = m(model);
  const in1m = typeof row.cost_per_1m_input === "number" ? row.cost_per_1m_input : model.cost_per_1k_input * 1000;
  const out1m = typeof row.cost_per_1m_output === "number" ? row.cost_per_1m_output : model.cost_per_1k_output * 1000;
  return { input: formatUsdPer1m(in1m), output: formatUsdPer1m(out1m) };
}

function normalizeTier(tier: unknown): string {
  if (typeof tier !== "string") return "";
  return tier.toLowerCase().replace(/\s+/g, "-");
}

function tierBadgeClass(tierNorm: string): string {
  if (tierNorm === "frontier") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (tierNorm === "mid-tier" || tierNorm === "mid") return "bg-blue-500/15 text-blue-400 border-blue-500/30";
  if (tierNorm === "budget") return "bg-yellow-500/15 text-yellow-400 border-yellow-500/30";
  if (tierNorm === "specialized") return "bg-purple-500/15 text-purple-400 border-purple-500/30";
  return "bg-muted text-muted-foreground border-border";
}

function releaseStatusBadgeClass(status: unknown): { label: string; className: string } | null {
  if (typeof status !== "string" || !status.trim()) return null;
  const s = status.toLowerCase();
  if (s === "deprecated") return { label: status, className: "bg-red-500/15 text-red-400 border-red-500/40" };
  if (s === "preview" || s === "beta") return { label: status, className: "bg-amber-500/15 text-amber-400 border-amber-500/30" };
  return { label: status, className: "bg-muted text-muted-foreground border-border" };
}

function isRecentRelease(releaseDate: unknown): boolean {
  if (typeof releaseDate !== "string" || !releaseDate) return false;
  const d = new Date(releaseDate);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return d >= start && d <= now;
}

function matchesFilter(model: ModelInfo, tab: FilterTab): boolean {
  const row = m(model);
  const tier = normalizeTier(row.tier);
  const releaseStatus = typeof row.release_status === "string" ? row.release_status.toLowerCase() : "";
  switch (tab) {
    case "all": return true;
    case "frontier": return tier === "frontier";
    case "mid-tier": return tier === "mid-tier" || tier === "mid";
    case "budget": return tier === "budget";
    case "specialized": return tier === "specialized";
    case "open-weight": return row.open_weight === true;
    case "deprecated": return releaseStatus === "deprecated";
    default: return true;
  }
}

function matchesSearch(model: ModelInfo, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const row = m(model);
  return (
    model.display_name.toLowerCase().includes(q) ||
    model.provider.toLowerCase().includes(q) ||
    model.id.toLowerCase().includes(q) ||
    (typeof row.description === "string" && row.description.toLowerCase().includes(q))
  );
}

function topQualityScores(scores: Record<string, number>, n: number): [string, number][] {
  return Object.entries(scores).filter(([, v]) => typeof v === "number" && Number.isFinite(v)).sort(([, a], [, b]) => b - a).slice(0, n);
}

function providerColorKey(provider: string): string {
  return provider.toLowerCase().replace(/\s+/g, "");
}

/* ── Model Card ──────────────────────────────────────────────────── */

function ModelCard({ model, onToggle }: { model: ModelInfo; onToggle: (id: string, active: boolean) => void }) {
  const row = m(model);
  const tierNorm = normalizeTier(row.tier);
  const releaseBadge = releaseStatusBadgeClass(row.release_status);
  const ctx = formatContextWindow(row.context_window);
  const pricing = pricingPer1m(model);
  const topScores = topQualityScores(model.quality_scores || {}, 4);
  const pKey = providerColorKey(model.provider);

  const outdated = row.is_outdated === true;
  const deprecationWarning = typeof row.deprecation_warning === "string" && row.deprecation_warning.trim().length > 0 ? (row.deprecation_warning as string) : null;

  return (
    <div className={`panel-card panel-card-hover transition-opacity ${model.is_active ? "" : "opacity-50"}`}>
      {(outdated || deprecationWarning) && (
        <div className={`mx-4 mt-4 rounded-lg border px-3 py-2 text-xs flex items-start gap-2 ${deprecationWarning ? "border-red-500/20 bg-red-500/5 text-red-200" : "border-amber-500/20 bg-amber-500/5 text-amber-200"}`}>
          {deprecationWarning ? <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> : <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
          <div>
            <p className="font-medium">{deprecationWarning ? "Deprecation" : "Outdated"}</p>
            <p className="text-[10px] mt-0.5 opacity-90">{deprecationWarning || "This model may be behind newer options."}</p>
          </div>
        </div>
      )}

      <div className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <Link href={`/models/${model.id}`} className="group">
              <h3 className="text-base font-semibold text-white leading-tight group-hover:text-violet-300 transition-colors truncate">{model.display_name}</h3>
            </Link>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className={`text-[10px] ${PROVIDER_COLORS[pKey] || PROVIDER_COLORS[model.provider.toLowerCase()] || ""}`}>{model.provider}</Badge>
              {tierNorm ? <Badge variant="outline" className={`text-[10px] capitalize ${tierBadgeClass(tierNorm)}`}>{String(row.tier).replace(/-/g, " ")}</Badge> : null}
              {releaseBadge ? <Badge variant="outline" className={`text-[10px] ${releaseBadge.className}`}>{releaseBadge.label}</Badge> : null}
            </div>
            {typeof row.description === "string" && row.description.trim() ? (
              <p className="text-[11px] text-zinc-500 mt-2 line-clamp-2">{row.description}</p>
            ) : null}
          </div>
          <Switch checked={model.is_active} onCheckedChange={(checked) => onToggle(model.id, checked)} className="shrink-0" />
        </div>

        {/* Specs grid */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
          {ctx && (
            <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-2 py-1.5">
              <p className="text-zinc-500">Context</p>
              <p className="font-mono font-medium text-zinc-200">{ctx}</p>
            </div>
          )}
          <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-2 py-1.5">
            <p className="text-zinc-500">In / 1M</p>
            <p className="font-mono font-medium text-zinc-200">{pricing.input}</p>
          </div>
          <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-2 py-1.5">
            <p className="text-zinc-500">Out / 1M</p>
            <p className="font-mono font-medium text-zinc-200">{pricing.output}</p>
          </div>
          <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-2 py-1.5">
            <p className="text-zinc-500">Latency</p>
            <p className="font-mono font-medium text-zinc-200">{model.avg_latency_ms}ms</p>
          </div>
        </div>

        {typeof row.knowledge_cutoff === "string" && row.knowledge_cutoff && (
          <p className="mt-3 text-[10px] text-zinc-500">Cutoff: <span className="font-mono text-zinc-400">{row.knowledge_cutoff}</span></p>
        )}

        {/* Capability badges */}
        <div className="mt-3 flex flex-wrap gap-1">
          {model.supports_vision && <span className="panel-chip chip-sm text-[9px]"><Eye className="h-2.5 w-2.5" /> Vision</span>}
          {row.supports_audio === true && <span className="panel-chip chip-sm text-[9px]"><Mic className="h-2.5 w-2.5" /> Audio</span>}
          {row.supports_reasoning === true && <span className="panel-chip chip-sm text-[9px]"><Brain className="h-2.5 w-2.5" /> Reasoning</span>}
          {row.supports_function_calling === true && <span className="panel-chip chip-sm text-[9px]"><Wrench className="h-2.5 w-2.5" /> Tools</span>}
          {model.supports_json_mode && <span className="panel-chip chip-sm text-[9px]"><FileJson className="h-2.5 w-2.5" /> JSON</span>}
          {row.supports_web_search === true && <span className="panel-chip chip-sm text-[9px]"><Search className="h-2.5 w-2.5" /> Search</span>}
          {row.supports_computer_use === true && <span className="panel-chip chip-sm text-[9px]"><Monitor className="h-2.5 w-2.5" /> Computer</span>}
          {row.supports_image_gen === true && <span className="panel-chip chip-sm text-[9px]"><ImageIcon className="h-2.5 w-2.5" /> Img Gen</span>}
          {row.supports_realtime === true && <span className="panel-chip chip-sm text-[9px]"><Radio className="h-2.5 w-2.5" /> Realtime</span>}
          {model.supports_streaming && <span className="panel-chip chip-sm text-[9px]"><Zap className="h-2.5 w-2.5" /> Stream</span>}
        </div>

        {/* Top scores */}
        {topScores.length > 0 && (
          <div className="mt-4">
            <p className="panel-label mb-1.5">Top scores</p>
            <div className="flex flex-wrap gap-2">
              {topScores.map(([key, val]) => (
                <div key={key} className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-2 py-1 min-w-[4.5rem]">
                  <p className="text-[9px] text-zinc-500 capitalize truncate max-w-[7rem]">{key.replace(/_/g, " ")}</p>
                  <p className="text-sm font-mono font-semibold text-white num-tabular">{Math.round(val)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Best for / Avoid for */}
        {Array.isArray(row.best_use_cases) && row.best_use_cases.length > 0 && (
          <div className="mt-3">
            <p className="text-[10px] text-zinc-500 mb-1">Best for</p>
            <div className="flex flex-wrap gap-1">
              {(row.best_use_cases as string[]).slice(0, 4).map((u) => <span key={u} className="panel-chip chip-sm text-[9px]">{u}</span>)}
            </div>
          </div>
        )}

        {Array.isArray(row.worst_use_cases) && row.worst_use_cases.length > 0 && (
          <div className="mt-2">
            <p className="text-[10px] text-zinc-500 mb-1">Avoid for</p>
            <div className="flex flex-wrap gap-1">
              {(row.worst_use_cases as string[]).slice(0, 3).map((u) => <span key={u} className="panel-chip chip-sm text-[9px] opacity-60">{u}</span>)}
            </div>
          </div>
        )}

        {model.strengths?.length ? (
          <div className="mt-3 pt-3 border-t border-white/[0.04] flex flex-wrap gap-1">
            {model.strengths.map((s) => <span key={s} className="panel-chip panel-chip-active chip-sm text-[9px] capitalize">{s.replace(/_/g, " ")}</span>)}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MODELS PAGE
   ═══════════════════════════════════════════════════════════════════ */

export default function ModelsPage() {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    api.getModels()
      .then(setModels)
      .catch((e) => setError(e?.message || "Failed to load models"))
      .finally(() => setLoading(false));
  }, []);

  const filteredModels = useMemo(
    () => models.filter((model) => matchesFilter(model, filter) && matchesSearch(model, searchQuery)),
    [models, filter, searchQuery],
  );

  const newModels = useMemo(
    () => filteredModels.filter((model) => isRecentRelease(m(model).release_date)),
    [filteredModels],
  );

  const newModelIds = useMemo(() => new Set(newModels.map((x) => x.id)), [newModels]);

  const mainGridModels = useMemo(() => {
    if (newModels.length === 0) return filteredModels;
    return filteredModels.filter((model) => !newModelIds.has(model.id));
  }, [filteredModels, newModels.length, newModelIds]);

  const handleToggle = async (id: string, active: boolean) => {
    setModels((prev) => prev.map((m) => (m.id === id ? { ...m, is_active: active } : m)));
    try { await api.updateModel(id, { is_active: active }); }
    catch { setModels((prev) => prev.map((m) => (m.id === id ? { ...m, is_active: !active } : m))); }
  };

  if (loading) {
    return (
      <motion.div
        className="flex items-center justify-center py-20"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div
        className="flex flex-col items-center justify-center gap-3 py-20"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <AlertCircle className="h-8 w-8 text-red-400" />
        <p className="text-sm font-medium text-zinc-300">Failed to load models</p>
        <p className="text-[11px] text-zinc-500 max-w-sm text-center">{error}</p>
        <button
          onClick={() => { setError(null); setLoading(true); api.getModels().then(setModels).catch((e) => setError(e?.message)).finally(() => setLoading(false)); }}
          className="mt-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 transition-colors"
        >
          Retry
        </button>
      </motion.div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <span className="page-badge page-badge-cyan mb-3">
          <Database className="h-2.5 w-2.5" /> Model Registry
        </span>
        <h1 className="text-display">Model Intelligence</h1>
        <p className="mt-3 max-w-2xl text-subtitle">
          {models.length} models across {new Set(models.map((m) => m.provider)).size} providers. Filter by tier and capabilities; toggle routing per model.
        </p>
      </motion.div>

      {/* Search + Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
          <Input
            placeholder="Search models..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-xs border-white/[0.08] bg-white/[0.02]"
          />
        </div>
        <div className="inline-flex rounded-[20px] border border-white/[0.08] bg-white/[0.02] p-0.5 backdrop-blur-sm overflow-x-auto">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition-all whitespace-nowrap ${
                filter === tab.id ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs text-zinc-500">
        Showing <span className="text-zinc-300 font-medium text-data">{filteredModels.length}</span> model{filteredModels.length !== 1 ? "s" : ""}
        {searchQuery && <> matching &ldquo;<span className="text-zinc-300">{searchQuery}</span>&rdquo;</>}
      </p>

      {/* New models section */}
      {newModels.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400" />
            <h2 className="panel-label">New since last refresh</h2>
            <span className="panel-chip chip-sm">Last 30 days</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {newModels.map((model, index) => (
              <motion.div
                key={model.id}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: index * 0.03 }}
              >
                <ModelCard model={model} onToggle={handleToggle} />
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* All models */}
      <div>
        {newModels.length > 0 && <h2 className="panel-label mb-4">All models</h2>}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {mainGridModels.map((model, index) => (
            <motion.div
              key={model.id}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: index * 0.03 }}
            >
              <ModelCard model={model} onToggle={handleToggle} />
            </motion.div>
          ))}
        </div>
        {filteredModels.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.01] px-6 py-16 text-center">
            <Database className="h-6 w-6 text-zinc-600" />
            <p className="text-sm font-medium text-zinc-300">No models match</p>
            <p className="text-[11px] text-zinc-500">Try adjusting your search or filter</p>
          </div>
        )}
      </div>
    </div>
  );
}
