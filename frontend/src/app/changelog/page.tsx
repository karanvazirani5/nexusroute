"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, Plus, RefreshCw, AlertTriangle, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { API_BASE } from "@/lib/constants";

interface ChangelogEntry {
  update_id: string;
  model_id: string;
  model_name: string;
  provider: string;
  update_type: string;
  description: string | null;
  old_values: Record<string, unknown>;
  new_values: Record<string, unknown>;
  created_at: string;
}

const TYPE_STYLES: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  added: { label: "Added", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: <Plus className="h-3 w-3" /> },
  scores_updated: { label: "Updated", color: "bg-blue-500/10 text-blue-400 border-blue-500/20", icon: <RefreshCw className="h-3 w-3" /> },
  deprecated: { label: "Deprecated", color: "bg-amber-500/10 text-amber-400 border-amber-500/20", icon: <AlertTriangle className="h-3 w-3" /> },
  reactivated: { label: "Reactivated", color: "bg-violet-500/10 text-violet-400 border-violet-500/20", icon: <CheckCircle className="h-3 w-3" /> },
};

export default function ChangelogPage() {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/changelog?limit=100`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setEntries)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Group by date
  const grouped = entries.reduce<Record<string, ChangelogEntry[]>>((acc, entry) => {
    const date = new Date(entry.created_at).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    (acc[date] ??= []).push(entry);
    return acc;
  }, {});

  return (
    <div>
      <div className="mb-10">
        <h1 className="text-3xl font-black text-white mb-2">Model Changelog</h1>
        <p className="text-sm text-zinc-500">
          Track when models are added, scores are updated, or models are deprecated.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </div>
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Clock className="h-12 w-12 text-zinc-700 mb-4" />
          <h2 className="text-lg font-bold text-white mb-2">No changelog entries yet</h2>
          <p className="text-sm text-zinc-500">Model changes will appear here as they happen.</p>
        </div>
      ) : (
        <div className="space-y-8 max-w-3xl">
          {Object.entries(grouped).map(([date, items]) => (
            <div key={date}>
              <h2 className="text-sm font-bold text-zinc-400 mb-3 sticky top-0 bg-background py-1">
                {date}
              </h2>
              <div className="space-y-2 pl-4 border-l border-white/[0.06]">
                {items.map((entry) => {
                  const style = TYPE_STYLES[entry.update_type] ?? TYPE_STYLES.added;
                  return (
                    <div
                      key={entry.update_id}
                      className="relative pl-4"
                    >
                      <div className="absolute -left-[7px] top-2 h-3 w-3 rounded-full bg-zinc-800 border-2 border-zinc-600" />
                      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <Link
                            href={`/models/${entry.model_id}`}
                            className="text-sm font-bold text-white hover:text-violet-300 transition-colors"
                          >
                            {entry.model_name}
                          </Link>
                          <span className="text-[10px] text-zinc-600">{entry.provider}</span>
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${style.color}`}>
                            {style.icon} {style.label}
                          </span>
                        </div>
                        {entry.description && (
                          <p className="text-[12px] text-zinc-500">{entry.description}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
