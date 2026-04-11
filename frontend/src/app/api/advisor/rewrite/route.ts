import { NextRequest, NextResponse } from "next/server";
import {
  rewritePrompt,
  getProfileForModel,
  REWRITE_SYSTEM_PROMPT,
  APP_TO_PROFILE_ID,
  MODEL_PROFILES,
} from "@/lib/promptRewriter";
import type { ImprovementType } from "@/lib/promptRewriter";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const modelId = typeof body.modelId === "string" ? body.modelId.trim() : "";
    const modelDisplayName =
      typeof body.modelDisplayName === "string"
        ? body.modelDisplayName.trim()
        : modelId;

    if (!prompt) {
      return NextResponse.json({ error: "prompt required" }, { status: 400 });
    }
    if (!modelId) {
      return NextResponse.json({ error: "modelId required" }, { status: 400 });
    }

    const key = process.env.OPENAI_API_KEY;
    const model =
      process.env.ADVISOR_REWRITE_MODEL?.trim() || "gpt-4o-mini";
    const baseUrl = (
      process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"
    ).replace(/\/$/, "");

    // ── Fallback: no API key → use local heuristic rewriter ──
    if (!key) {
      const local = rewritePrompt(prompt, modelId);
      return NextResponse.json({ ...local, source: "local" as const });
    }

    // ── Build model context for the LLM ──
    const profile = getProfileForModel(modelId);
    const modelContext = profile
      ? {
          id: profile.id,
          displayName: profile.displayName,
          provider: profile.provider,
          prefersXmlTags: profile.prefersXmlTags,
          prefersMarkdown: profile.prefersMarkdown,
          prefersChainOfThought: profile.prefersChainOfThought,
          prefersConciseInput: profile.prefersConciseInput,
          strengths: profile.strengths,
        }
      : {
          id: modelId,
          displayName: modelDisplayName,
          provider: "unknown",
          prefersXmlTags: false,
          prefersMarkdown: true,
          prefersChainOfThought: true,
          prefersConciseInput: false,
          strengths: [],
        };

    // ── Call OpenAI ──
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    let res: Response;
    try {
      res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          response_format: { type: "json_object" },
          temperature: 0.4,
          messages: [
            { role: "system", content: REWRITE_SYSTEM_PROMPT },
            {
              role: "user",
              content: JSON.stringify({
                prompt: prompt.slice(0, 48_000),
                model: modelContext,
              }),
            },
          ],
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    // ── Handle HTTP errors → fallback ──
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`[rewrite] Upstream HTTP ${res.status}: ${errText.slice(0, 200)}`);
      const local = rewritePrompt(prompt, modelId);
      return NextResponse.json({
        ...local,
        source: "local" as const,
        llmError: `HTTP ${res.status}`,
      });
    }

    // ── Parse LLM response ──
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;

    if (!content || typeof content !== "string") {
      const local = rewritePrompt(prompt, modelId);
      return NextResponse.json({ ...local, source: "local" as const });
    }

    let parsed: {
      optimizedPrompt?: string;
      improvements?: Array<{ type?: string; label?: string; description?: string }>;
      tips?: string[];
    };
    try {
      parsed = JSON.parse(content);
    } catch {
      const local = rewritePrompt(prompt, modelId);
      return NextResponse.json({ ...local, source: "local" as const });
    }

    // ── Validate and shape the response ──
    const optimizedPrompt =
      typeof parsed.optimizedPrompt === "string" && parsed.optimizedPrompt.trim()
        ? parsed.optimizedPrompt.trim()
        : prompt;

    const VALID_TYPES = new Set([
      "structure", "specificity", "context", "format",
      "persona", "constraints", "examples", "chain-of-thought",
    ]);

    const improvements: ImprovementType[] = Array.isArray(parsed.improvements)
      ? parsed.improvements
          .filter(
            (imp): imp is { type: string; label: string; description: string } =>
              typeof imp.type === "string" &&
              typeof imp.label === "string" &&
              typeof imp.description === "string"
          )
          .map((imp) => ({
            type: (VALID_TYPES.has(imp.type) ? imp.type : "specificity") as ImprovementType["type"],
            label: imp.label.slice(0, 60),
            description: imp.description.slice(0, 200),
          }))
          .slice(0, 8)
      : [];

    const tips: string[] = Array.isArray(parsed.tips)
      ? parsed.tips
          .filter((t): t is string => typeof t === "string")
          .map((t) => t.slice(0, 200))
          .slice(0, 5)
      : profile?.tips ?? [];

    // ── Compute scores ──
    const confidenceScore = Math.min(95, 70 + improvements.length * 4);
    const estimatedQualityGain = Math.min(65, improvements.length * 10 + 5);

    return NextResponse.json({
      optimizedPrompt,
      modelId,
      modelDisplayName: profile?.displayName ?? modelDisplayName,
      improvements,
      confidenceScore,
      estimatedQualityGain,
      tips,
      directLink: profile?.directLink ?? "",
      source: "llm" as const,
    });
  } catch (e) {
    console.error("[rewrite] Error:", e);
    const message = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
