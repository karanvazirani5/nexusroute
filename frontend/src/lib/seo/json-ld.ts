/**
 * JSON-LD structured data builders for SEO.
 * Render as <script type="application/ld+json">{JSON.stringify(schema)}</script>
 */

export interface FAQItem {
  question: string;
  answer: string;
}

export function buildFAQSchema(items: FAQItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function buildGuideSchema(guide: {
  title: string;
  description: string;
  slug: string;
  steps?: string[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: `How to choose the best AI model for ${guide.title.toLowerCase()}`,
    description: guide.description,
    url: `https://nexusrouteai.com/guides/${guide.slug}`,
    step: (guide.steps ?? [
      "Describe your task in the NexusRoute advisor",
      "Review the top model recommendations with scoring breakdowns",
      "Compare pricing and capabilities across recommended models",
      "Select the best model for your specific requirements",
    ]).map((text, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      text,
    })),
  };
}

export function buildModelProductSchema(model: {
  displayName: string;
  provider: string;
  description: string;
  id: string;
  inputPrice: number;
  outputPrice: number;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: model.displayName,
    applicationCategory: "AI Language Model",
    operatingSystem: "Cloud API",
    description: model.description,
    url: `https://nexusrouteai.com/models/${model.id}`,
    offers: {
      "@type": "Offer",
      price: model.inputPrice,
      priceCurrency: "USD",
      description: `$${model.inputPrice}/1M input tokens, $${model.outputPrice}/1M output tokens`,
    },
    author: {
      "@type": "Organization",
      name: model.provider,
    },
  };
}
