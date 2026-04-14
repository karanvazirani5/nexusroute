"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Command,
  Compass,
  Database,
  Eye,
  FileText,
  Hash,
  Layers,
  Search,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react";

type Action = {
  id: string;
  label: string;
  hint?: string;
  shortcut?: string;
  icon: React.ComponentType<{ className?: string }>;
  run: () => void;
};

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        setQuery("");
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const actions: Action[] = useMemo(
    () => [
      {
        id: "go-advisor",
        label: "Open Advisor",
        hint: "Route a new prompt",
        icon: Zap,
        run: () => router.push("/"),
      },
      {
        id: "go-panel",
        label: "Open Intelligence Terminal",
        hint: "Dashboard with full intel",
        icon: Sparkles,
        run: () => router.push("/dashboard"),
      },
      {
        id: "go-explorer",
        label: "Open Explorer",
        hint: "Search & inspect raw events",
        icon: Database,
        run: () => router.push("/explorer"),
      },
      {
        id: "go-models",
        label: "Browse model registry",
        icon: Layers,
        run: () => router.push("/models"),
      },
      {
        id: "go-compare",
        label: "Compare models",
        icon: Eye,
        run: () => router.push("/compare"),
      },
      {
        id: "go-method",
        label: "Read methodology",
        hint: "How numbers are computed",
        icon: FileText,
        run: () => router.push("/methodology"),
      },
      {
        id: "go-privacy",
        label: "Privacy & consent",
        icon: Shield,
        run: () => router.push("/privacy"),
      },
    ],
    [router]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter(
      (a) =>
        a.label.toLowerCase().includes(q) ||
        (a.hint ?? "").toLowerCase().includes(q)
    );
  }, [actions, query]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 p-4 pt-[15vh] backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900 to-zinc-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-white/5 px-4 py-3">
          <Search className="h-4 w-4 text-zinc-500" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to page, action, or section…"
            className="flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
          />
          <kbd className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-zinc-500">
            esc
          </kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto panel-scroll p-1">
          {filtered.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-zinc-500">
              No matches for "{query}"
            </p>
          )}
          {filtered.map((a) => (
            <button
              key={a.id}
              onClick={() => {
                a.run();
                setOpen(false);
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-zinc-200 transition-colors hover:bg-white/[0.04]"
            >
              <a.icon className="h-4 w-4 text-violet-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{a.label}</p>
                {a.hint && (
                  <p className="truncate text-[11px] text-zinc-500">{a.hint}</p>
                )}
              </div>
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-white/5 px-4 py-2 text-[10px] text-zinc-600">
          <span className="flex items-center gap-1.5">
            <Command className="h-3 w-3" /> K to open
          </span>
          <span>NexusRoute Panel</span>
        </div>
      </div>
    </div>
  );
}
