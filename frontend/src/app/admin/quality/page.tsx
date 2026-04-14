"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BarChart3, TrendingUp, AlertTriangle, RefreshCcw, Activity,
  ChevronDown, Play, Target, Layers, BookOpen, Users,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, Line, LineChart, Cell,
} from "recharts";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

/* ── Stat Card ───────────────────────────────────────────────── */
function Stat({ label, value, sub, color = "text-white" }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`text-2xl font-black mt-1 ${color}`}>{value}</p>
      {sub && <p className="text-[11px] text-zinc-500 mt-0.5">{sub}</p>}
    </div>
  );
}

/* ── Tabs ─────────────────────────────────────────────────────── */
const TABS = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "segments", label: "Problem Segments", icon: AlertTriangle },
  { id: "calibration", label: "Calibration", icon: Target },
  { id: "tracks", label: "Track Performance", icon: Layers },
  { id: "replay", label: "Replay", icon: Play },
  { id: "onboarding", label: "Onboarding", icon: Users },
  { id: "content", label: "Content", icon: BookOpen },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function QualityAdminPage() {
  const [tab, setTab] = useState<TabId>("overview");
  const [days, setDays] = useState(30);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Recommendation Quality</h1>
          <p className="text-sm text-zinc-500">Internal analytics dashboard</p>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="rounded-lg border border-white/[0.08] bg-[#0c0c20] px-3 py-2 text-sm text-zinc-300"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
              tab === t.id
                ? "bg-violet-500/15 text-violet-300 border border-violet-500/30"
                : "text-zinc-500 hover:text-zinc-300 border border-transparent"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab days={days} />}
      {tab === "segments" && <SegmentsTab days={days} />}
      {tab === "calibration" && <CalibrationTab />}
      {tab === "tracks" && <TracksTab days={days} />}
      {tab === "replay" && <ReplayTab />}
      {tab === "onboarding" && <OnboardingTab days={days} />}
      {tab === "content" && <ContentTab days={days} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Overview Tab (Sprint 1.5 + 3.1)
   ═══════════════════════════════════════════════════════════════════ */
function OverviewTab({ days }: { days: number }) {
  const [data, setData] = useState<any>(null);
  const [feedback, setFeedback] = useState<any[]>([]);

  useEffect(() => {
    fetch(`${API}/panel/quality/outcomes/summary?days=${days}`).then(r => r.json()).then(setData).catch(() => {});
    fetch(`${API}/panel/quality/feedback?days=${days}&limit=20`).then(r => r.json()).then(setFeedback).catch(() => {});
  }, [days]);

  if (!data) return <p className="text-zinc-500 text-sm">Loading...</p>;

  const pct = (v: number | null) => v != null ? `${(v * 100).toFixed(1)}%` : "—";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat label="Outcomes" value={data.total_outcomes} />
        <Stat label="Feedback" value={data.feedback_volume} />
        <Stat label="Acceptance" value={pct(data.acceptance_rate)} color="text-emerald-400" />
        <Stat label="Override" value={pct(data.override_rate)} color="text-amber-400" />
        <Stat label="Abandon" value={pct(data.abandon_rate)} color="text-red-400" />
        <Stat label="Helpful" value={pct(data.helpful_rate)} color="text-blue-400" />
      </div>

      {/* Category breakdown */}
      {data.category_breakdown?.length > 0 && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h3 className="text-sm font-bold text-white mb-4">Quality by Category</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.category_breakdown}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="category" tick={{ fill: "#71717a", fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
              <YAxis tick={{ fill: "#71717a", fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} />
              <Bar dataKey="acceptance_rate" fill="#34d399" name="Acceptance" radius={[4, 4, 0, 0]} />
              <Bar dataKey="override_rate" fill="#fbbf24" name="Override" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent feedback */}
      {feedback.length > 0 && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h3 className="text-sm font-bold text-white mb-4">Recent Feedback</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-zinc-500 border-b border-white/[0.04]">
                  <th className="text-left py-2 px-2">Type</th>
                  <th className="text-left py-2 px-2">Recommended</th>
                  <th className="text-left py-2 px-2">Selected</th>
                  <th className="text-left py-2 px-2">Reason</th>
                  <th className="text-left py-2 px-2">Rating</th>
                  <th className="text-left py-2 px-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {feedback.map((f: any) => (
                  <tr key={f.feedback_id} className="border-b border-white/[0.02] text-zinc-300">
                    <td className="py-2 px-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        f.feedback_type === "thumbs_up" ? "bg-emerald-500/10 text-emerald-400" :
                        f.feedback_type === "override" ? "bg-violet-500/10 text-violet-400" :
                        "bg-red-500/10 text-red-400"
                      }`}>{f.feedback_type}</span>
                    </td>
                    <td className="py-2 px-2 text-zinc-400">{f.recommended_model || "—"}</td>
                    <td className="py-2 px-2">{f.selected_model || "—"}</td>
                    <td className="py-2 px-2 text-zinc-400">{f.override_reason || "—"}</td>
                    <td className="py-2 px-2">{f.rating ?? "—"}</td>
                    <td className="py-2 px-2 text-zinc-500">{new Date(f.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Problem Segments Tab (Sprint 3.2)
   ═══════════════════════════════════════════════════════════════════ */
function SegmentsTab({ days }: { days: number }) {
  const [alerts, setAlerts] = useState<any[]>([]);
  useEffect(() => {
    fetch(`${API}/panel/quality/bad-segments?days=${days}`).then(r => r.json()).then(setAlerts).catch(() => {});
  }, [days]);

  if (!alerts.length) return <p className="text-zinc-500 text-sm">No problem segments detected.</p>;

  const sevColor = (s: string) => s === "critical" ? "text-red-400 bg-red-500/10" : s === "warning" ? "text-amber-400 bg-amber-500/10" : "text-blue-400 bg-blue-500/10";

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
      <h3 className="text-sm font-bold text-white mb-4">Problem Segments</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-zinc-500 border-b border-white/[0.04]">
              <th className="text-left py-2 px-2">Severity</th>
              <th className="text-left py-2 px-2">Category</th>
              <th className="text-left py-2 px-2">Model</th>
              <th className="text-left py-2 px-2">Samples</th>
              <th className="text-left py-2 px-2">Override Rate</th>
              <th className="text-left py-2 px-2">Success Rate</th>
              <th className="text-left py-2 px-2">Reasons</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((a: any, i: number) => (
              <tr key={i} className="border-b border-white/[0.02] text-zinc-300">
                <td className="py-2 px-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${sevColor(a.severity)}`}>
                    {a.severity}
                  </span>
                </td>
                <td className="py-2 px-2">{a.category}</td>
                <td className="py-2 px-2 font-mono text-zinc-400">{a.model}</td>
                <td className="py-2 px-2">{a.sample_count}</td>
                <td className="py-2 px-2">{a.override_rate != null ? `${(a.override_rate * 100).toFixed(0)}%` : "—"}</td>
                <td className="py-2 px-2">{a.success_rate != null ? `${(a.success_rate * 100).toFixed(0)}%` : "—"}</td>
                <td className="py-2 px-2 text-zinc-500">{a.reasons?.join("; ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Calibration Tab (Sprint 2.5)
   ═══════════════════════════════════════════════════════════════════ */
function CalibrationTab() {
  const [data, setData] = useState<any>(null);
  const [running, setRunning] = useState(false);

  const load = useCallback(() => {
    fetch(`${API}/panel/quality/calibration/latest`).then(r => r.json()).then(setData).catch(() => {});
  }, []);
  useEffect(load, [load]);

  const runCalibration = async () => {
    setRunning(true);
    try {
      await fetch(`${API}/panel/quality/calibration/run`, { method: "POST" });
      load();
    } catch {} finally { setRunning(false); }
  };

  const buckets = data?.buckets || [];
  const run = data?.run;

  // Reliability diagram data
  const reliabilityData = buckets.map((b: any) => ({
    predicted: b.predicted_confidence,
    empirical: b.empirical_success_rate,
    samples: b.sample_count,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={runCalibration}
          disabled={running}
          className="flex items-center gap-2 rounded-xl bg-violet-500/15 border border-violet-500/25 px-4 py-2 text-sm font-semibold text-violet-300 hover:bg-violet-500/20 transition-all disabled:opacity-40"
        >
          <RefreshCcw className={`h-4 w-4 ${running ? "animate-spin" : ""}`} />
          {running ? "Running..." : "Run Calibration"}
        </button>
        {run && (
          <span className="text-xs text-zinc-500">
            Last run: {new Date(run.completed_at).toLocaleString()} &middot; {run.events_processed} events &middot; v{run.calibration_version}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="ECE Score" value={run?.ece_score != null ? run.ece_score.toFixed(4) : "—"} sub="Expected Calibration Error" />
        <Stat label="Events" value={run?.events_processed ?? 0} />
        <Stat label="Buckets" value={buckets.length} />
        <Stat label="Version" value={run?.calibration_version ?? "—"} />
      </div>

      {/* Reliability diagram */}
      {reliabilityData.length > 0 && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h3 className="text-sm font-bold text-white mb-4">Reliability Diagram</h3>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 10, right: 30, bottom: 30, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="predicted" name="Predicted" tick={{ fill: "#71717a", fontSize: 10 }} label={{ value: "Predicted Confidence", position: "insideBottom", offset: -15, fill: "#71717a", fontSize: 11 }} domain={[0, 1]} />
              <YAxis dataKey="empirical" name="Empirical" tick={{ fill: "#71717a", fontSize: 10 }} label={{ value: "Empirical Success", angle: -90, position: "insideLeft", fill: "#71717a", fontSize: 11 }} domain={[0, 1]} />
              <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} />
              <Scatter data={reliabilityData} fill="#a78bfa" />
              {/* Perfect calibration line */}
              <Line type="monotone" data={[{ predicted: 0, empirical: 0 }, { predicted: 1, empirical: 1 }]} dataKey="empirical" stroke="rgba(255,255,255,0.1)" strokeDasharray="5 5" dot={false} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Bucket table */}
      {buckets.length > 0 && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h3 className="text-sm font-bold text-white mb-4">Calibration Buckets</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-zinc-500 border-b border-white/[0.04]">
                <th className="text-left py-2 px-2">Range</th>
                <th className="text-left py-2 px-2">Avg Predicted</th>
                <th className="text-left py-2 px-2">Empirical Success</th>
                <th className="text-left py-2 px-2">Gap</th>
                <th className="text-left py-2 px-2">Samples</th>
              </tr>
            </thead>
            <tbody>
              {buckets.map((b: any) => {
                const gap = Math.abs(b.predicted_confidence - b.empirical_success_rate);
                return (
                  <tr key={b.bucket_id} className="border-b border-white/[0.02] text-zinc-300">
                    <td className="py-2 px-2 font-mono">{b.bucket_label}</td>
                    <td className="py-2 px-2">{(b.predicted_confidence * 100).toFixed(1)}%</td>
                    <td className="py-2 px-2">{(b.empirical_success_rate * 100).toFixed(1)}%</td>
                    <td className={`py-2 px-2 font-semibold ${gap > 0.15 ? "text-red-400" : gap > 0.08 ? "text-amber-400" : "text-emerald-400"}`}>
                      {(gap * 100).toFixed(1)}%
                    </td>
                    <td className={`py-2 px-2 ${b.sample_count < 20 ? "text-amber-400" : "text-zinc-400"}`}>
                      {b.sample_count}{b.sample_count < 20 ? " ⚠" : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Track Performance Tab (Sprint 3.5)
   ═══════════════════════════════════════════════════════════════════ */
function TracksTab({ days }: { days: number }) {
  const [tracks, setTracks] = useState<any[]>([]);
  useEffect(() => {
    fetch(`${API}/panel/quality/tracks?days=${days}`).then(r => r.json()).then(setTracks).catch(() => {});
  }, [days]);

  const trackColors: Record<string, string> = {
    absolute_quality: "border-yellow-500/20 bg-yellow-500/[0.03]",
    value: "border-emerald-500/20 bg-emerald-500/[0.03]",
    low_latency: "border-cyan-500/20 bg-cyan-500/[0.03]",
    open_self_hosted: "border-indigo-500/20 bg-indigo-500/[0.03]",
  };
  const trackLabels: Record<string, string> = {
    absolute_quality: "Quality", value: "Value", low_latency: "Low Latency", open_self_hosted: "Open Weight",
  };

  if (!tracks.length) return <p className="text-zinc-500 text-sm">No track data available yet.</p>;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {tracks.map((t: any) => (
        <div key={t.track} className={`rounded-2xl border p-5 space-y-3 ${trackColors[t.track] || "border-white/[0.06] bg-white/[0.02]"}`}>
          <h3 className="text-sm font-bold text-white">{trackLabels[t.track] || t.track}</h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-zinc-500">Total</p>
              <p className="text-white font-bold text-lg">{t.total_recommendations}</p>
            </div>
            <div>
              <p className="text-zinc-500">Acceptance</p>
              <p className="text-emerald-400 font-bold text-lg">{t.acceptance_rate != null ? `${(t.acceptance_rate * 100).toFixed(0)}%` : "—"}</p>
            </div>
            <div>
              <p className="text-zinc-500">Override</p>
              <p className="text-amber-400 font-bold text-lg">{t.override_rate != null ? `${(t.override_rate * 100).toFixed(0)}%` : "—"}</p>
            </div>
            <div>
              <p className="text-zinc-500">Avg Satisfaction</p>
              <p className="text-blue-400 font-bold text-lg">{t.avg_satisfaction != null ? t.avg_satisfaction.toFixed(2) : "—"}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Replay Tab (Sprint 3.3)
   ═══════════════════════════════════════════════════════════════════ */
function ReplayTab() {
  const [eventId, setEventId] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const replay = async () => {
    if (!eventId.trim()) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch(`${API}/panel/quality/replay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId.trim() }),
      });
      if (!res.ok) { setError((await res.json())?.detail || "Replay failed"); return; }
      setResult(await res.json());
    } catch (e) { setError("Network error"); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-3">
        <input
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
          placeholder="Enter event_id..."
          className="flex-1 rounded-lg border border-white/[0.08] bg-[#0c0c20] px-4 py-2 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
        />
        <button
          onClick={replay}
          disabled={loading || !eventId.trim()}
          className="flex items-center gap-2 rounded-xl bg-violet-500/15 border border-violet-500/25 px-4 py-2 text-sm font-semibold text-violet-300 hover:bg-violet-500/20 transition-all disabled:opacity-40"
        >
          <Play className="h-4 w-4" />
          {loading ? "Running..." : "Replay"}
        </button>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {result && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-blue-500/15 bg-blue-500/[0.03] p-5 space-y-3">
            <h3 className="text-sm font-bold text-blue-400">Original (at capture time)</h3>
            <p className="text-xs text-zinc-400 italic">{result.prompt_preview}</p>
            <div className="space-y-1 text-xs">
              <p><span className="text-zinc-500">Model:</span> <span className="text-zinc-200 font-semibold">{result.original.recommended_model || "—"}</span></p>
              <p><span className="text-zinc-500">Category:</span> {result.original.category_primary}</p>
              <p><span className="text-zinc-500">Subcategory:</span> {result.original.subcategory}</p>
              <p><span className="text-zinc-500">Confidence:</span> {result.original.classifier_confidence ? `${(result.original.classifier_confidence * 100).toFixed(0)}%` : "—"}</p>
              <p><span className="text-zinc-500">Complexity:</span> {result.original.complexity_score ?? "—"}</p>
              {result.original.outcome && (
                <div className="mt-2 p-2 rounded-lg bg-white/[0.03] border border-white/[0.04]">
                  <p className="text-zinc-400 font-semibold">Outcome: <span className={result.original.outcome.success ? "text-emerald-400" : result.original.outcome.success === false ? "text-red-400" : "text-zinc-500"}>{result.original.outcome.label}</span></p>
                </div>
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-violet-500/15 bg-violet-500/[0.03] p-5 space-y-3">
            <h3 className="text-sm font-bold text-violet-400">Replayed (current engine)</h3>
            <div className="space-y-1 text-xs">
              <p><span className="text-zinc-500">Category:</span> <span className={result.diff.category_changed ? "text-amber-400 font-bold" : "text-zinc-200"}>{result.replayed.category_primary}</span>{result.diff.category_changed && " ← changed"}</p>
              <p><span className="text-zinc-500">Subcategory:</span> <span className={result.diff.subcategory_changed ? "text-amber-400 font-bold" : "text-zinc-200"}>{result.replayed.subcategory}</span></p>
              <p><span className="text-zinc-500">Confidence:</span> {result.replayed.classifier_confidence ? `${(result.replayed.classifier_confidence * 100).toFixed(0)}%` : "—"}
                {result.diff.confidence_delta !== 0 && <span className={`ml-1 font-semibold ${result.diff.confidence_delta > 0 ? "text-emerald-400" : "text-red-400"}`}>({result.diff.confidence_delta > 0 ? "+" : ""}{(result.diff.confidence_delta * 100).toFixed(1)}%)</span>}
              </p>
              <p><span className="text-zinc-500">Complexity:</span> {result.replayed.complexity_score ?? "—"}</p>
              <p><span className="text-zinc-500">Classifier:</span> {result.replayed.classifier_version}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Onboarding Tab (Sprint 4.5)
   ═══════════════════════════════════════════════════════════════════ */
function OnboardingTab({ days }: { days: number }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    fetch(`${API}/panel/onboarding/analytics?days=${days}`).then(r => r.json()).then(setData).catch(() => {});
  }, [days]);

  if (!data) return <p className="text-zinc-500 text-sm">Loading...</p>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Started" value={data.total_started} />
        <Stat label="Completion" value={data.completion_rate != null ? `${(data.completion_rate * 100).toFixed(0)}%` : "—"} color="text-emerald-400" />
        <Stat label="Skip Rate" value={data.skip_rate != null ? `${(data.skip_rate * 100).toFixed(0)}%` : "—"} color="text-amber-400" />
        <Stat label="Templates Used" value={Object.values(data.template_usage || {}).reduce((a: number, b: any) => a + b, 0) as number} />
      </div>

      {/* Funnel */}
      {data.funnel && Object.keys(data.funnel).length > 0 && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h3 className="text-sm font-bold text-white mb-4">Onboarding Funnel</h3>
          <div className="space-y-2">
            {Object.entries(data.funnel).map(([step, count]: [string, any]) => {
              const total = data.total_started || 1;
              const pct = (count / total) * 100;
              return (
                <div key={step} className="flex items-center gap-3">
                  <span className="text-xs text-zinc-400 w-24">{step}</span>
                  <div className="flex-1 h-6 bg-white/[0.03] rounded-lg overflow-hidden">
                    <div className="h-full bg-violet-500/30 rounded-lg transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-zinc-300 w-16 text-right">{count} ({pct.toFixed(0)}%)</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Use case & template distributions */}
      <div className="grid gap-4 md:grid-cols-2">
        {Object.keys(data.use_case_distribution || {}).length > 0 && (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
            <h3 className="text-sm font-bold text-white mb-3">Use Cases Selected</h3>
            {Object.entries(data.use_case_distribution).sort((a: any, b: any) => b[1] - a[1]).map(([uc, count]: [string, any]) => (
              <div key={uc} className="flex justify-between text-xs py-1 border-b border-white/[0.02]">
                <span className="text-zinc-300">{uc}</span>
                <span className="text-zinc-500">{count}</span>
              </div>
            ))}
          </div>
        )}
        {Object.keys(data.template_usage || {}).length > 0 && (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
            <h3 className="text-sm font-bold text-white mb-3">Templates Used</h3>
            {Object.entries(data.template_usage).sort((a: any, b: any) => b[1] - a[1]).map(([t, count]: [string, any]) => (
              <div key={t} className="flex justify-between text-xs py-1 border-b border-white/[0.02]">
                <span className="text-zinc-300">{t}</span>
                <span className="text-zinc-500">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Content Tab (Sprint 5.5)
   ═══════════════════════════════════════════════════════════════════ */
function ContentTab({ days }: { days: number }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    fetch(`${API}/panel/content/analytics?days=${days}`).then(r => r.json()).then(setData).catch(() => {});
  }, [days]);

  if (!data) return <p className="text-zinc-500 text-sm">Loading...</p>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Stat label="Total Views" value={data.total_views} />
        <Stat label="Click-throughs" value={data.total_click_throughs} />
        <Stat label="Overall CTR" value={data.total_views > 0 ? `${((data.total_click_throughs / data.total_views) * 100).toFixed(1)}%` : "—"} color="text-emerald-400" />
      </div>

      {data.pages?.length > 0 && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h3 className="text-sm font-bold text-white mb-4">Page Performance</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-zinc-500 border-b border-white/[0.04]">
                <th className="text-left py-2 px-2">Page</th>
                <th className="text-left py-2 px-2">Views</th>
                <th className="text-left py-2 px-2">Click-throughs</th>
                <th className="text-left py-2 px-2">CTR</th>
              </tr>
            </thead>
            <tbody>
              {data.pages.map((p: any) => (
                <tr key={p.slug} className="border-b border-white/[0.02] text-zinc-300">
                  <td className="py-2 px-2 font-mono">{p.slug}</td>
                  <td className="py-2 px-2">{p.views}</td>
                  <td className="py-2 px-2">{p.click_throughs}</td>
                  <td className="py-2 px-2 font-semibold">{(p.ctr * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
