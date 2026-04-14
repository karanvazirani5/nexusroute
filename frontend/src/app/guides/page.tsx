import type { Metadata } from "next";
import Link from "next/link";
import { GUIDE_CATEGORIES } from "@/lib/data/guides";

export const metadata: Metadata = {
  title: "Best AI Model Guides — NexusRoute",
  description: "Find the best AI model for every task. Expert guides for coding, writing, research, data analysis, agents, and more — with model comparisons and pricing.",
  openGraph: {
    title: "Best AI Model Guides — NexusRoute",
    description: "Expert guides for choosing the right AI model for every task.",
  },
};

export default function GuidesIndexPage() {
  return (
    <div>
      <div className="mb-10">
        <h1 className="text-3xl font-black text-white mb-2">Best Model Guides</h1>
        <p className="text-sm text-zinc-500 max-w-2xl">
          Expert guides to help you choose the right AI model for every task.
          Each guide ranks models by capability, compares pricing, and links directly to the advisor.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {GUIDE_CATEGORIES.map((guide) => (
          <Link
            key={guide.slug}
            href={`/guides/${guide.slug}`}
            className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 hover:border-violet-500/20 hover:bg-violet-500/[0.03] transition-all"
          >
            <h2 className="text-lg font-bold text-white mb-1 group-hover:text-violet-300 transition-colors">
              {guide.title}
            </h2>
            <p className="text-[12px] text-zinc-500 line-clamp-2">
              {guide.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
