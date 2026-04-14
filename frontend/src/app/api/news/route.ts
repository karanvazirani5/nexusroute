import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

export interface NewsHeadline {
  title: string;
  source: string;
  url: string;
  category: string;
  summary: string;
}

/* ── In-memory cache (survives across requests within the same serverless instance) ── */
let cachedHeadlines: NewsHeadline[] | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/* ── Fallback headlines when no API key or fetch fails ── */
const FALLBACK_HEADLINES: NewsHeadline[] = [
  { title: "OpenAI launches GPT-5.4 with native computer use and 1M context", source: "OpenAI Blog", url: "https://openai.com", category: "launch", summary: "OpenAI's latest flagship model features native computer use capabilities, a 1M token context window, and 128K output tokens. Benchmarks show significant improvements across reasoning, coding, and multimodal tasks." },
  { title: "Anthropic releases Claude Opus 4.6 with extended thinking", source: "Anthropic", url: "https://anthropic.com", category: "launch", summary: "Claude Opus 4.6 introduces extended thinking mode for complex reasoning tasks, improved tool use reliability, and enhanced coding capabilities. Available via API with 200K context." },
  { title: "Google DeepMind unveils Gemini 3.1 Pro with video understanding", source: "Google Blog", url: "https://deepmind.google", category: "launch", summary: "Gemini 3.1 Pro brings native video understanding, improved long-context performance up to 2M tokens, and competitive pricing. Available through Google AI Studio and Vertex AI." },
  { title: "xAI open-sources Grok 3 Mini weights for researchers", source: "xAI", url: "https://x.ai", category: "open-source", summary: "xAI releases Grok 3 Mini model weights under an open license, enabling researchers and developers to fine-tune and deploy the model locally. Strong performance on reasoning benchmarks." },
  { title: "Meta releases Llama 4 Maverick with 128 experts MoE architecture", source: "Meta AI", url: "https://ai.meta.com", category: "open-source", summary: "Llama 4 Maverick uses a mixture-of-experts architecture with 128 experts, achieving frontier-level performance while remaining open-weight. Supports 1M context and multimodal inputs." },
  { title: "DeepSeek R2 achieves state-of-the-art on math and coding benchmarks", source: "DeepSeek", url: "https://deepseek.com", category: "research", summary: "DeepSeek's R2 model sets new records on MATH, GSM8K, and HumanEval benchmarks. The model uses a novel reinforcement learning approach for improved chain-of-thought reasoning." },
  { title: "EU AI Act enforcement begins with fines up to 7% of global revenue", source: "Reuters", url: "https://reuters.com", category: "regulation", summary: "The European Union begins enforcing the AI Act, with penalties reaching up to 7% of global annual revenue for non-compliance. Companies must classify AI systems by risk level and implement appropriate safeguards." },
  { title: "AI coding assistants now used by 92% of developers according to Stack Overflow survey", source: "Stack Overflow", url: "https://stackoverflow.com", category: "industry", summary: "Stack Overflow's annual developer survey reveals that 92% of professional developers now use AI coding assistants. GitHub Copilot leads with 55% adoption, followed by Claude and ChatGPT." },
];

export async function GET() {
  // Return cache if fresh
  if (cachedHeadlines && Date.now() - cachedAt < CACHE_TTL_MS) {
    return NextResponse.json(
      { headlines: cachedHeadlines, cached: true },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return NextResponse.json({ headlines: FALLBACK_HEADLINES, cached: false });
  }

  const baseUrl = (
    process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"
  ).replace(/\/$/, "");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);

    let res: Response;
    try {
      res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini-search-preview",
          response_format: { type: "json_object" },
          temperature: 0.3,
          web_search_options: {
            search_context_size: "medium",
          },
          messages: [
            {
              role: "system",
              content: `You are an AI news aggregator. Search the web for the latest important AI and LLM news from the past 48 hours. Return a JSON object with a "headlines" array containing 8-10 items. Each item must have: "title" (the headline), "source" (publication name), "url" (article URL), "category" (one of: launch, research, open-source, regulation, industry, funding, partnership), "summary" (2-3 sentence summary of the story with key details). Focus on model releases, major research breakthroughs, industry moves, and regulation updates. Prioritize breaking news and announcements from the past 24 hours.`,
            },
            {
              role: "user",
              content:
                "What are the most important AI news stories right now? Search the web and give me the latest.",
            },
          ],
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      console.error(`OpenAI news fetch failed: ${res.status}`);
      cachedHeadlines = FALLBACK_HEADLINES;
      cachedAt = Date.now();
      return NextResponse.json({ headlines: FALLBACK_HEADLINES, cached: false });
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      cachedHeadlines = FALLBACK_HEADLINES;
      cachedAt = Date.now();
      return NextResponse.json({ headlines: FALLBACK_HEADLINES, cached: false });
    }

    let parsed: { headlines?: NewsHeadline[] };
    try {
      parsed = JSON.parse(content);
    } catch {
      cachedHeadlines = FALLBACK_HEADLINES;
      cachedAt = Date.now();
      return NextResponse.json({ headlines: FALLBACK_HEADLINES, cached: false });
    }

    if (
      !parsed.headlines ||
      !Array.isArray(parsed.headlines) ||
      parsed.headlines.length === 0
    ) {
      cachedHeadlines = FALLBACK_HEADLINES;
      cachedAt = Date.now();
      return NextResponse.json({ headlines: FALLBACK_HEADLINES, cached: false });
    }

    // Validate and sanitize
    const headlines: NewsHeadline[] = parsed.headlines
      .filter(
        (h) =>
          typeof h.title === "string" &&
          typeof h.source === "string" &&
          h.title.length > 5
      )
      .slice(0, 12)
      .map((h) => ({
        title: h.title.slice(0, 200),
        source: (h.source || "Unknown").slice(0, 50),
        url: typeof h.url === "string" ? h.url : "#",
        category: typeof h.category === "string" ? h.category : "industry",
        summary: typeof h.summary === "string" ? h.summary.slice(0, 500) : "",
      }));

    cachedHeadlines = headlines.length > 0 ? headlines : FALLBACK_HEADLINES;
    cachedAt = Date.now();

    return NextResponse.json(
      { headlines: cachedHeadlines, cached: false },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (e) {
    console.error("News fetch error:", e);
    cachedHeadlines = FALLBACK_HEADLINES;
    cachedAt = Date.now();
    return NextResponse.json({ headlines: FALLBACK_HEADLINES, cached: false });
  }
}
