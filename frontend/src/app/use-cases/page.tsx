import Link from "next/link";
import type { Metadata } from "next";
import { USE_CASES } from "@/lib/data/use-cases";

export const metadata: Metadata = {
  title: "AI Use Cases — Find the Right Model for Your Workload | NexusRoute",
  description: "Explore real-world AI workloads and find the best model for each. Support triage, codebase Q&A, document extraction, agent workflows, and more.",
};

export default function UseCasesPage() {
  return (
    <div className="space-y-12">
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">
          Real workloads, real recommendations
        </h1>
        <p className="text-lg text-zinc-400 mt-4">
          Explore common AI use cases with model recommendations, tradeoffs, and production guidance.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {USE_CASES.map((uc) => (
          <Link key={uc.slug} href={`/use-cases/${uc.slug}`}>
            <div className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 h-full transition-all hover:border-violet-500/20 hover:bg-violet-500/[0.03] hover:shadow-lg hover:shadow-violet-500/5 cursor-pointer">
              <span className="text-3xl mb-3 block">{uc.heroEmoji}</span>
              <h2 className="text-lg font-bold text-white group-hover:text-violet-300 transition-colors">
                {uc.title}
              </h2>
              <p className="text-sm text-zinc-400 mt-2 line-clamp-2">{uc.subtitle}</p>
              <div className="flex flex-wrap gap-1.5 mt-4">
                <span className="rounded-full bg-white/[0.04] border border-white/[0.06] px-2.5 py-1 text-[10px] font-medium text-zinc-500">
                  {uc.category}
                </span>
                <span className="rounded-full bg-violet-500/10 border border-violet-500/20 px-2.5 py-1 text-[10px] font-medium text-violet-400">
                  {uc.templateTrack} track
                </span>
              </div>
              <div className="mt-3 text-[11px] text-zinc-600">
                Top picks: {uc.recommendedModels.slice(0, 3).join(", ")}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
