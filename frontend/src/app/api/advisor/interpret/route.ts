import { NextRequest, NextResponse } from "next/server";
import { interpretPrompt } from "@/lib/engine/interpret";
import {
  mergeLLMInterpretation,
  INTERPRETATION_JSON_SPEC,
} from "@/lib/engine/advisor-interpret-schema";
import type { InterpretationProvenance } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) {
      return NextResponse.json({ error: "prompt required" }, { status: 400 });
    }

    const key = process.env.OPENAI_API_KEY;
    const model =
      process.env.ADVISOR_INTERPRET_MODEL?.trim() || "gpt-4o-mini";
    const baseUrl = (
      process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"
    ).replace(/\/$/, "");

    if (!key) {
      const interpretation = interpretPrompt(prompt);
      const provenance: InterpretationProvenance = {
        source: "structural_statistical",
        note: "OPENAI_API_KEY not set — server used structural interpreter only",
      };
      return NextResponse.json({ interpretation, provenance, parseWarnings: [] });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);

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
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content: `You are a routing interpreter. ${INTERPRETATION_JSON_SPEC}`,
            },
            { role: "user", content: prompt.slice(0, 48_000) },
          ],
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      const errText = await res.text();
      const interpretation = interpretPrompt(prompt);
      const provenance: InterpretationProvenance = {
        source: "structural_statistical",
        remoteModel: model,
        note: `Upstream HTTP ${res.status} — ${errText.slice(0, 160)}`,
      };
      return NextResponse.json({
        interpretation,
        provenance,
        parseWarnings: [provenance.note ?? ""],
        llmError: errText.slice(0, 800),
      });
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") {
      const interpretation = interpretPrompt(prompt);
      return NextResponse.json({
        interpretation,
        provenance: {
          source: "structural_statistical",
          remoteModel: model,
          note: "Empty LLM response body — fallback",
        } satisfies InterpretationProvenance,
        parseWarnings: ["empty_llm_content"],
      });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      const interpretation = interpretPrompt(prompt);
      return NextResponse.json({
        interpretation,
        provenance: {
          source: "structural_statistical",
          remoteModel: model,
          note: "LLM returned non-JSON — fallback",
        } satisfies InterpretationProvenance,
        parseWarnings: ["invalid_json_from_llm"],
      });
    }

    const { interpretation, parseWarnings } = mergeLLMInterpretation(
      prompt,
      parsed
    );
    const usedLLM = interpretation.method === "llm";
    const provenance: InterpretationProvenance = usedLLM
      ? {
          source: "llm",
          remoteModel: model,
          ...(parseWarnings.length ? { note: parseWarnings.join("; ") } : {}),
        }
      : {
          source: "structural_statistical",
          remoteModel: model,
          note:
            parseWarnings[0] ??
            "LLM payload did not match schema — merged/fallback",
        };

    return NextResponse.json({
      interpretation,
      provenance,
      parseWarnings,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
