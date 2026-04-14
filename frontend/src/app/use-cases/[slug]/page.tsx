import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { USE_CASES } from "@/lib/data/use-cases";
import { buildFAQSchema } from "@/lib/seo/json-ld";
import UseCaseClient from "./UseCaseClient";

export const revalidate = 86400; // 24h ISR

export async function generateStaticParams() {
  return USE_CASES.map((uc) => ({ slug: uc.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const uc = USE_CASES.find((u) => u.slug === slug);
  if (!uc) return {};
  return {
    title: uc.metaTitle,
    description: uc.metaDescription,
  };
}

export default async function UseCaseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const uc = USE_CASES.find((u) => u.slug === slug);
  if (!uc) notFound();

  const faqSchema = uc.faqItems.length > 0 ? buildFAQSchema(uc.faqItems) : null;

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      {/* JSON-LD */}
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )}

      {/* Hero */}
      <div className="space-y-4">
        <Link href="/use-cases" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
          &larr; All use cases
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-5xl">{uc.heroEmoji}</span>
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-white">{uc.title}</h1>
            <p className="text-lg text-zinc-400 mt-1">{uc.subtitle}</p>
          </div>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="rounded-full bg-white/[0.04] border border-white/[0.06] px-3 py-1.5 text-zinc-400">{uc.category}</span>
          <span className="rounded-full bg-violet-500/10 border border-violet-500/20 px-3 py-1.5 text-violet-400">{uc.templateTrack} track</span>
          <span className="rounded-full bg-white/[0.04] border border-white/[0.06] px-3 py-1.5 text-zinc-500">Updated {uc.updatedAt}</span>
        </div>
      </div>

      {/* Description */}
      <p className="text-base text-zinc-300 leading-relaxed">{uc.description}</p>

      {/* Content sections */}
      <div className="space-y-8">
        {uc.sections.map((s, i) => (
          <div key={i}>
            <h2 className="text-xl font-bold text-white mb-3">{s.heading}</h2>
            <p className="text-sm text-zinc-400 leading-relaxed">{s.body}</p>
          </div>
        ))}
      </div>

      {/* Recommended models */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4">Recommended models</h2>
        <div className="flex flex-wrap gap-2">
          {uc.recommendedModels.map((m) => (
            <Link key={m} href={`/models/${m}`}>
              <span className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-2.5 text-sm font-semibold text-zinc-300 hover:border-violet-500/20 hover:text-violet-300 transition-all cursor-pointer">
                {m}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Related guides */}
      {uc.relatedGuides.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-white mb-3">Related guides</h2>
          <div className="flex gap-2">
            {uc.relatedGuides.map((g) => (
              <Link key={g} href={`/guides/${g}`}>
                <span className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2 text-xs text-zinc-400 hover:text-violet-300 hover:border-violet-500/20 transition-all">
                  {g}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* FAQ */}
      {uc.faqItems.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-white mb-4">Frequently asked questions</h2>
          <div className="space-y-4">
            {uc.faqItems.map((faq, i) => (
              <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <h3 className="text-sm font-semibold text-white">{faq.question}</h3>
                <p className="text-sm text-zinc-400 mt-2">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <UseCaseClient slug={uc.slug} prompt={uc.templatePrompt} track={uc.templateTrack} />
    </div>
  );
}
