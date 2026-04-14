import type { MetadataRoute } from "next";
import { ALL_MODELS } from "@/lib/data/models";
import { USE_CASES } from "@/lib/data/use-cases";

const BASE = "https://nexusrouteai.com";

const GUIDE_SLUGS = [
  "coding", "creative-writing", "research", "data-analysis",
  "customer-support", "translation", "summarization", "agents",
  "image-generation", "math-reasoning", "legal", "medical",
  "education", "content-marketing",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${BASE}/models`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/compare`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/guides`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/use-cases`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/changelog`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE}/methodology`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/privacy`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];

  const modelPages: MetadataRoute.Sitemap = ALL_MODELS
    .filter((m) => m.isActive)
    .map((m) => ({
      url: `${BASE}/models/${m.id}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

  const guidePages: MetadataRoute.Sitemap = GUIDE_SLUGS.map((slug) => ({
    url: `${BASE}/guides/${slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.85,
  }));

  const useCasePages: MetadataRoute.Sitemap = USE_CASES.map((uc) => ({
    url: `${BASE}/use-cases/${uc.slug}`,
    lastModified: new Date(uc.updatedAt),
    changeFrequency: "weekly" as const,
    priority: 0.85,
  }));

  return [...staticPages, ...modelPages, ...guidePages, ...useCasePages];
}
