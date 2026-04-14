import type { Metadata } from "next";
import Link from "next/link";
import { ALL_MODELS } from "@/lib/data/models";
import { buildModelProductSchema } from "@/lib/seo/json-ld";
import ModelDetailClient from "./ModelDetailClient";

export const revalidate = 3600; // ISR: revalidate every hour

export function generateStaticParams() {
  return ALL_MODELS.filter((m) => m.isActive).map((m) => ({ id: m.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const model = ALL_MODELS.find((m) => m.id === id);
  if (!model) return { title: "Model Not Found — NexusRoute" };

  return {
    title: `${model.displayName} — NexusRoute Model Profile`,
    description: model.description.slice(0, 160),
    openGraph: {
      title: `${model.displayName} by ${model.provider}`,
      description: model.description.slice(0, 160),
    },
  };
}

export default async function ModelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const model = ALL_MODELS.find((m) => m.id === id);

  if (!model) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <h1 className="text-2xl font-bold text-white">Model not found</h1>
        <p className="text-zinc-400">
          No model with ID &ldquo;{id}&rdquo; exists in the registry.
        </p>
        <Link href="/models">
          <button className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors">
            Back to Models
          </button>
        </Link>
      </div>
    );
  }

  const jsonLd = buildModelProductSchema({
    displayName: model.displayName,
    provider: model.provider,
    description: model.description,
    id: model.id,
    inputPrice: model.specs.inputPricePer1M,
    outputPrice: model.specs.outputPricePer1M,
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ModelDetailClient model={model} />
    </>
  );
}
