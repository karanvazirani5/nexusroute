"use client";

import { useEffect, useState, useCallback } from "react";
import { SignInButton, useAuth } from "@clerk/nextjs";
import { Settings2, Save, Plus, Trash2, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthFetch } from "@/lib/auth";
import { usePreferences, type UserPreferences } from "@/lib/preferences";

const PROVIDERS = ["OpenAI", "Anthropic", "Google", "Mistral", "xAI", "DeepSeek", "Meta", "Alibaba"];
const TRACKS = [
  { value: "quality", label: "Quality" },
  { value: "balanced", label: "Balanced" },
  { value: "speed", label: "Speed" },
  { value: "cost", label: "Cost" },
];

interface PresetEntry {
  preset_id: string;
  name: string;
  slug: string;
  description: string | null;
  is_system: boolean;
  default_track: string;
}

export default function SettingsPage() {
  const { isSignedIn } = useAuth();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-black text-white mb-2">Settings</h1>
        <p className="text-sm text-zinc-500">Configure your routing preferences and manage custom workflow presets.</p>
      </div>
      {isSignedIn ? (
        <SettingsContent />
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Settings2 className="h-12 w-12 text-zinc-700 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Sign in to manage settings</h2>
          <p className="text-sm text-zinc-500 mb-6 max-w-md">
            Preferences let you customize how the advisor routes your prompts.
          </p>
          <SignInButton mode="modal">
            <Button className="bg-gradient-to-r from-violet-600 to-indigo-600">Sign in</Button>
          </SignInButton>
        </div>
      )}
    </div>
  );
}

function SettingsContent() {
  const { authFetch } = useAuthFetch();
  const { preferences, loading: prefsLoading, refetch } = usePreferences();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Local form state
  const [track, setTrack] = useState("balanced");
  const [preferred, setPreferred] = useState<string[]>([]);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [budget, setBudget] = useState("");
  const [openWeight, setOpenWeight] = useState(false);

  // Sync from fetched preferences
  useEffect(() => {
    if (preferences) {
      setTrack(preferences.default_track);
      setPreferred(preferences.preferred_providers);
      setExcluded(preferences.excluded_providers);
      setBudget(preferences.budget_ceiling_per_1m != null ? String(preferences.budget_ceiling_per_1m) : "");
      setOpenWeight(preferences.prefer_open_weight);
    }
  }, [preferences]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await authFetch("/user/preferences", {
        method: "PATCH",
        body: JSON.stringify({
          default_track: track,
          preferred_providers: preferred,
          excluded_providers: excluded,
          budget_ceiling_per_1m: budget ? parseFloat(budget) : null,
          prefer_open_weight: openWeight,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      refetch();
    } catch {} finally { setSaving(false); }
  };

  const toggleProvider = (list: string[], setList: (v: string[]) => void, provider: string) => {
    setList(list.includes(provider) ? list.filter(p => p !== provider) : [...list, provider]);
  };

  // Custom presets section
  const [presets, setPresets] = useState<PresetEntry[]>([]);
  const [showNewPreset, setShowNewPreset] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTrack, setNewTrack] = useState("balanced");
  const [newDesc, setNewDesc] = useState("");

  const fetchPresets = useCallback(async () => {
    try {
      const res = await authFetch("/presets");
      if (res.ok) {
        const all: PresetEntry[] = await res.json();
        setPresets(all.filter(p => !p.is_system));
      }
    } catch {}
  }, [authFetch]);

  useEffect(() => { fetchPresets(); }, [fetchPresets]);

  const handleCreatePreset = async () => {
    if (!newName.trim()) return;
    try {
      await authFetch("/user/presets", {
        method: "POST",
        body: JSON.stringify({ name: newName, default_track: newTrack, description: newDesc || null }),
      });
      setNewName(""); setNewDesc(""); setNewTrack("balanced"); setShowNewPreset(false);
      fetchPresets();
    } catch {}
  };

  const handleDeletePreset = async (id: string) => {
    try {
      await authFetch(`/user/presets/${id}`, { method: "DELETE" });
      setPresets(prev => prev.filter(p => p.preset_id !== id));
    } catch {}
  };

  if (prefsLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="flex gap-1">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-10">
      {/* ── Routing Preferences ── */}
      <section>
        <h2 className="text-lg font-bold text-white mb-1">Routing Preferences</h2>
        <p className="text-sm text-zinc-500 mb-6">These defaults apply to every analysis you run.</p>

        <div className="space-y-6">
          {/* Default track */}
          <div>
            <label className="text-sm font-semibold text-zinc-300 mb-2 block">Default Optimization Track</label>
            <div className="flex flex-wrap gap-2">
              {TRACKS.map(t => (
                <button
                  key={t.value}
                  onClick={() => setTrack(t.value)}
                  className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-all ${
                    track === t.value
                      ? "bg-violet-500/20 text-violet-300 border-violet-500/40"
                      : "bg-white/[0.03] text-zinc-500 border-white/[0.06] hover:text-zinc-300"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Preferred providers */}
          <div>
            <label className="text-sm font-semibold text-zinc-300 mb-2 block">Preferred Providers</label>
            <p className="text-[11px] text-zinc-600 mb-2">Models from these providers will be ranked higher.</p>
            <div className="flex flex-wrap gap-2">
              {PROVIDERS.map(p => (
                <button
                  key={p}
                  onClick={() => toggleProvider(preferred, setPreferred, p)}
                  className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition-all ${
                    preferred.includes(p)
                      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                      : "bg-white/[0.03] text-zinc-500 border-white/[0.06] hover:text-zinc-300"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Excluded providers */}
          <div>
            <label className="text-sm font-semibold text-zinc-300 mb-2 block">Excluded Providers</label>
            <p className="text-[11px] text-zinc-600 mb-2">Models from these providers will be filtered out.</p>
            <div className="flex flex-wrap gap-2">
              {PROVIDERS.map(p => (
                <button
                  key={p}
                  onClick={() => toggleProvider(excluded, setExcluded, p)}
                  className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition-all ${
                    excluded.includes(p)
                      ? "bg-red-500/15 text-red-400 border-red-500/30"
                      : "bg-white/[0.03] text-zinc-500 border-white/[0.06] hover:text-zinc-300"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Budget ceiling */}
          <div>
            <label className="text-sm font-semibold text-zinc-300 mb-2 block">Budget Ceiling ($/1M tokens)</label>
            <p className="text-[11px] text-zinc-600 mb-2">Leave empty for no limit.</p>
            <input
              type="number"
              min="0"
              step="0.1"
              value={budget}
              onChange={e => setBudget(e.target.value)}
              placeholder="e.g. 5.00"
              className="w-48 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/40"
            />
          </div>

          {/* Open weight preference */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-semibold text-zinc-300 block">Prefer Open-Weight Models</label>
              <p className="text-[11px] text-zinc-600">Prioritize models you can self-host.</p>
            </div>
            <button
              onClick={() => setOpenWeight(!openWeight)}
              className={`relative h-6 w-11 rounded-full transition-colors ${openWeight ? "bg-violet-500" : "bg-zinc-700"}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${openWeight ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>

          <Button onClick={handleSave} disabled={saving} className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600">
            <Save className="h-3.5 w-3.5" />
            {saved ? "Saved!" : saving ? "Saving..." : "Save Preferences"}
          </Button>
        </div>
      </section>

      {/* ── Custom Workflow Presets ── */}
      <section>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-white">My Workflow Presets</h2>
          <button
            onClick={() => setShowNewPreset(!showNewPreset)}
            className="flex items-center gap-1 text-sm text-violet-400 hover:text-violet-300 transition-colors"
          >
            {showNewPreset ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {showNewPreset ? "Cancel" : "New Preset"}
          </button>
        </div>
        <p className="text-sm text-zinc-500 mb-6">Create reusable constraint profiles for common workflows.</p>

        {showNewPreset && (
          <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.03] p-4 mb-4 space-y-3">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Preset name"
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/40"
            />
            <input
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              placeholder="Description (optional)"
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/40"
            />
            <div className="flex gap-2">
              {TRACKS.map(t => (
                <button
                  key={t.value}
                  onClick={() => setNewTrack(t.value)}
                  className={`rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-all ${
                    newTrack === t.value
                      ? "bg-violet-500/20 text-violet-300 border-violet-500/40"
                      : "bg-white/[0.03] text-zinc-500 border-white/[0.06]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <Button onClick={handleCreatePreset} disabled={!newName.trim()} size="sm" className="bg-violet-600">
              Create Preset
            </Button>
          </div>
        )}

        {presets.length === 0 && !showNewPreset ? (
          <p className="text-sm text-zinc-600 py-8 text-center">No custom presets yet. System presets are always available on the advisor page.</p>
        ) : (
          <div className="space-y-2">
            {presets.map(p => (
              <div
                key={p.preset_id}
                className="group flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 hover:border-white/10 transition-all"
              >
                <div>
                  <span className="text-sm font-semibold text-white">{p.name}</span>
                  {p.description && <span className="text-[11px] text-zinc-500 ml-2">{p.description}</span>}
                  <Badge variant="outline" className="ml-2 text-[9px]">{p.default_track}</Badge>
                </div>
                <button
                  onClick={() => handleDeletePreset(p.preset_id)}
                  className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
