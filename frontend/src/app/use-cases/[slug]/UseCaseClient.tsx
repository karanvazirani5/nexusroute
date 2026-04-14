"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

interface UseCaseClientProps {
  slug: string;
  prompt: string;
  track: string;
}

export default function UseCaseClient({ slug, prompt, track }: UseCaseClientProps) {
  // Track page view
  useEffect(() => {
    fetch(`${API}/panel/content/view`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, source: "use-case-page" }),
    }).catch(() => {});
  }, [slug]);

  const handleCTA = () => {
    // Track click-through
    fetch(`${API}/panel/content/click-through`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, source: "use-case-cta" }),
    }).catch(() => {});
  };

  const advisorUrl = `/?prompt=${encodeURIComponent(prompt)}&track=${encodeURIComponent(track)}&source=use-case-${slug}`;

  return (
    <div className="rounded-2xl border border-violet-500/15 bg-gradient-to-br from-violet-500/[0.06] to-transparent p-8 text-center">
      <h2 className="text-xl font-bold text-white mb-2">Try it in the advisor</h2>
      <p className="text-sm text-zinc-400 mb-6 max-w-md mx-auto">
        Get a personalized model recommendation for this workload with our AI advisor.
      </p>
      <Link href={advisorUrl} onClick={handleCTA}>
        <span className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40 transition-all cursor-pointer">
          Find the best model
          <ArrowRight className="h-4 w-4" />
        </span>
      </Link>
    </div>
  );
}
