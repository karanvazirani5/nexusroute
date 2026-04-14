"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FAQItem } from "@/lib/seo/json-ld";

export default function GuideClient({
  faqItems,
  presetSlug,
  guideTitle,
}: {
  faqItems: FAQItem[];
  presetSlug: string | null;
  guideTitle: string;
}) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <>
      {/* FAQ */}
      {faqItems.length > 0 && (
        <section className="mb-12">
          <h2 className="text-lg font-bold text-white mb-4">Frequently Asked Questions</h2>
          <div className="space-y-2">
            {faqItems.map((item, i) => (
              <div
                key={i}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-4 text-left"
                >
                  <span className="text-sm font-semibold text-white pr-4">{item.question}</span>
                  <ChevronDown
                    className={`h-4 w-4 text-zinc-500 shrink-0 transition-transform ${openFaq === i ? "rotate-180" : ""}`}
                  />
                </button>
                {openFaq === i && (
                  <div className="px-4 pb-4">
                    <p className="text-sm text-zinc-400">{item.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="rounded-2xl border border-violet-500/20 bg-gradient-to-r from-violet-500/[0.06] to-indigo-500/[0.04] p-8 text-center">
        <h2 className="text-xl font-bold text-white mb-2">
          Try it yourself
        </h2>
        <p className="text-sm text-zinc-400 mb-5">
          Describe your {guideTitle.toLowerCase()} task and get a personalized model recommendation in seconds.
        </p>
        <Link href={presetSlug ? `/?preset=${presetSlug}` : "/"}>
          <Button className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 shadow-lg shadow-violet-600/20">
            <Sparkles className="h-4 w-4" />
            Open Advisor{presetSlug ? ` with ${guideTitle} preset` : ""}
          </Button>
        </Link>
      </section>
    </>
  );
}
