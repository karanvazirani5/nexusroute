"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SignInButton, useAuth } from "@clerk/nextjs";
import { Clock, Trash2, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthFetch } from "@/lib/auth";

interface HistoryEntry {
  history_id: string;
  prompt_text: string;
  prompt_preview: string;
  winner_model_id: string | null;
  winner_model_name: string | null;
  winner_provider: string | null;
  winner_score: number | null;
  task_type: string | null;
  optimization_track: string | null;
  created_at: string;
}

const PROVIDER_COLORS: Record<string, string> = {
  OpenAI: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  Anthropic: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  Google: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Mistral: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  xAI: "bg-red-500/10 text-red-400 border-red-500/20",
  DeepSeek: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  Meta: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  Alibaba: "bg-amber-500/10 text-amber-400 border-amber-500/20",
};

export default function HistoryPage() {
  const { isSignedIn } = useAuth();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-black text-white mb-2">Prompt History</h1>
        <p className="text-sm text-zinc-500">Your past model recommendations, auto-saved after each analysis.</p>
      </div>
      {isSignedIn ? (
        <HistoryList />
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Clock className="h-12 w-12 text-zinc-700 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Sign in to view your history</h2>
          <p className="text-sm text-zinc-500 mb-6 max-w-md">
            Your prompt analyses are automatically saved when you&apos;re signed in. Sign in to access your full history.
          </p>
          <SignInButton mode="modal">
            <Button className="bg-gradient-to-r from-violet-600 to-indigo-600">Sign in</Button>
          </SignInButton>
        </div>
      )}
    </div>
  );
}

function HistoryList() {
  const { authFetch } = useAuthFetch();
  const router = useRouter();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<string | null>(null);
  const perPage = 20;

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`/user/history?page=${page}&per_page=${perPage}`);
      if (res.ok) setEntries(await res.json());
    } catch {} finally { setLoading(false); }
  }, [authFetch, page]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await authFetch(`/user/history/${id}`, { method: "DELETE" });
      setEntries(prev => prev.filter(e => e.history_id !== id));
    } catch {} finally { setDeleting(null); }
  };

  const handleRerun = (prompt: string) => {
    router.push(`/?q=${encodeURIComponent(prompt)}`);
  };

  if (loading) {
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

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Clock className="h-12 w-12 text-zinc-700 mb-4" />
        <h2 className="text-lg font-bold text-white mb-2">No history yet</h2>
        <p className="text-sm text-zinc-500 mb-6">Run your first analysis and it will appear here.</p>
        <Link href="/"><Button>Go to Advisor</Button></Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <div
          key={entry.history_id}
          className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-violet-500/20 hover:bg-violet-500/[0.03] transition-all"
        >
          <div className="flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium truncate mb-1.5">
                {entry.prompt_preview}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {entry.winner_model_name && (
                  <Badge variant="outline" className="text-[10px] font-bold">
                    {entry.winner_model_name}
                  </Badge>
                )}
                {entry.winner_provider && (
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${PROVIDER_COLORS[entry.winner_provider] || "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"}`}>
                    {entry.winner_provider}
                  </span>
                )}
                {entry.task_type && (
                  <span className="text-[10px] text-zinc-600">{entry.task_type}</span>
                )}
                {entry.winner_score != null && (
                  <span className="text-[10px] text-zinc-600">Score: {entry.winner_score}</span>
                )}
                <span className="text-[10px] text-zinc-600">
                  {new Date(entry.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => handleRerun(entry.prompt_text)}
                className="p-2 rounded-lg text-zinc-500 hover:text-violet-400 hover:bg-violet-500/10 transition-all"
                title="Re-run this prompt"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => handleDelete(entry.history_id)}
                disabled={deleting === entry.history_id}
                className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-30"
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* Pagination */}
      <div className="flex items-center justify-center gap-4 pt-4">
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
          className="flex items-center gap-1 text-sm text-zinc-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> Previous
        </button>
        <span className="text-sm text-zinc-600">Page {page}</span>
        <button
          onClick={() => setPage(p => p + 1)}
          disabled={entries.length < perPage}
          className="flex items-center gap-1 text-sm text-zinc-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Next <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
