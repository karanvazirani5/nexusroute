import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ALL_MODELS } from "@/lib/data/models";
import { GUIDE_CATEGORIES } from "@/lib/data/guides";
import { scoreModelsForGuide } from "@/lib/engine/guide-scoring";
import { buildFAQSchema, buildGuideSchema, buildModelProductSchema } from "@/lib/seo/json-ld";
import { CAPABILITY_LABELS } from "@/lib/types";
import GuideClient from "./GuideClient";

export const revalidate = 86400; // 24h ISR

export function generateStaticParams() {
  return GUIDE_CATEGORIES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const guide = GUIDE_CATEGORIES.find((g) => g.slug === slug);
  if (!guide) return { title: "Guide Not Found — NexusRoute" };
  return {
    title: guide.metaTitle,
    description: guide.metaDescription,
    openGraph: { title: guide.metaTitle, description: guide.metaDescription },
  };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = GUIDE_CATEGORIES.find((g) => g.slug === slug);
  if (!guide) notFound();

  const topModels = scoreModelsForGuide(guide, ALL_MODELS, 5);

  const faqSchema = buildFAQSchema(guide.faqItems);
  const guideSchema = buildGuideSchema({
    title: guide.title,
    description: guide.description,
    slug: guide.slug,
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(guideSchema) }} />

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <p className="text-[11px] font-bold uppercase tracking-widest text-violet-400 mb-2">Guide</p>
          <h1 className="text-3xl font-black text-white mb-3">
            Best AI Model for {guide.title}
          </h1>
          <p className="text-sm text-zinc-400 max-w-2xl">{guide.description}</p>
        </div>

        {/* Top Models */}
        <section className="mb-12">
          <h2 className="text-lg font-bold text-white mb-4">Top Recommended Models</h2>
          <div className="space-y-4">
            {topModels.map((entry, i) => (
              <div
                key={entry.model.id}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15 text-sm font-black text-violet-300">
                      {i + 1}
                    </span>
                    <div>
                      <h3 className="text-base font-bold text-white">{entry.model.displayName}</h3>
                      <p className="text-[11px] text-zinc-500">{entry.model.provider} &middot; {entry.model.tier}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-white">{entry.score}</span>
                    <span className="text-[11px] text-zinc-500">/100</span>
                  </div>
                </div>

                {/* Scoring breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                  {Object.entries(entry.breakdown).map(([dim, { raw, weight }]) => (
                    <div key={dim} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-1.5">
                      <span className="text-[10px] text-zinc-500">{CAPABILITY_LABELS[dim as keyof typeof CAPABILITY_LABELS] ?? dim}</span>
                      <span className="text-[11px] font-bold text-zinc-300">{raw}/10</span>
                    </div>
                  ))}
                </div>

                {/* Pricing */}
                <div className="flex gap-4 mb-3 text-[11px] text-zinc-500">
                  <span>${entry.model.specs.inputPricePer1M}/1M in</span>
                  <span>${entry.model.specs.outputPricePer1M}/1M out</span>
                  <span>{(entry.model.specs.contextWindow / 1000).toFixed(0)}K context</span>
                </div>

                {/* Pros/Cons */}
                {(entry.prosForTask.length > 0 || entry.consForTask.length > 0) && (
                  <div className="flex flex-wrap gap-2">
                    {entry.prosForTask.map((p, j) => (
                      <span key={j} className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-[10px] font-medium text-emerald-400">
                        {p}
                      </span>
                    ))}
                    {entry.consForTask.map((c, j) => (
                      <span key={j} className="rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-[10px] font-medium text-amber-400">
                        {c}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Pricing Comparison Table */}
        <section className="mb-12">
          <h2 className="text-lg font-bold text-white mb-4">Pricing Comparison</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left py-3 px-3 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Model</th>
                  <th className="text-right py-3 px-3 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Input $/1M</th>
                  <th className="text-right py-3 px-3 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Output $/1M</th>
                  <th className="text-right py-3 px-3 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Context</th>
                  <th className="text-right py-3 px-3 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Score</th>
                </tr>
              </thead>
              <tbody>
                {topModels.map((entry) => (
                  <tr key={entry.model.id} className="border-b border-white/[0.03]">
                    <td className="py-2.5 px-3 text-white font-medium">{entry.model.displayName}</td>
                    <td className="py-2.5 px-3 text-right text-zinc-400">${entry.model.specs.inputPricePer1M}</td>
                    <td className="py-2.5 px-3 text-right text-zinc-400">${entry.model.specs.outputPricePer1M}</td>
                    <td className="py-2.5 px-3 text-right text-zinc-400">{(entry.model.specs.contextWindow / 1000).toFixed(0)}K</td>
                    <td className="py-2.5 px-3 text-right font-bold text-violet-300">{entry.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* FAQ + CTA (client component) */}
        <GuideClient
          faqItems={guide.faqItems}
          presetSlug={guide.presetSlug}
          guideTitle={guide.title}
        />
      </div>
    </>
  );
}
