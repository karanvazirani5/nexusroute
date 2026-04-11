// NexusRoute Model Advisor — minimal API client.
// The advisor is a no-keys, no-execution product. The only backend call is
// fetching the model registry for the /models page; recommendations run
// entirely in the browser over the local ALL_MODELS data.

import { API_BASE } from "@/lib/constants";

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail?.message || error.detail || res.statusText);
  }
  return res.json();
}

// ── ModelInfo (the shape the backend returns from /api/models) ──
export interface ModelInfo {
  id: string;
  provider: string;
  display_name: string;
  litellm_model: string;
  strengths: string[];
  weaknesses: string[];
  max_tokens: number;
  cost_per_1k_input: number;
  cost_per_1k_output: number;
  avg_latency_ms: number;
  quality_scores: Record<string, number>;
  supports_json_mode: boolean;
  supports_vision: boolean;
  supports_streaming: boolean;
  is_active: boolean;

  family?: string;
  tier?: string;
  release_status?: string;
  release_date?: string;
  description?: string;
  context_window?: number;
  output_token_limit?: number;
  cost_per_1m_input?: number;
  cost_per_1m_output?: number;

  supports_audio?: boolean;
  supports_audio_out?: boolean;
  supports_video?: boolean;
  supports_image_gen?: boolean;
  supports_image_edit?: boolean;

  supports_function_calling?: boolean;
  supports_structured_output?: boolean;
  supports_reasoning?: boolean;
  supports_realtime?: boolean;
  supports_computer_use?: boolean;
  supports_web_search?: boolean;

  open_weight?: boolean;
  hosting_options?: string;
  knowledge_cutoff?: string;

  score_raw_intelligence?: number;
  score_reasoning_depth?: number;
  score_coding?: number;
  score_tool_use?: number;
  score_multimodal?: number;
  score_image_gen?: number;
  score_audio_voice?: number;
  score_long_context?: number;
  score_structured_output?: number;
  score_latency?: number;
  score_cost_efficiency?: number;
  score_enterprise_readiness?: number;
  score_openness?: number;

  best_use_cases?: string;
  worst_use_cases?: string;
  benchmark_evidence?: string;
  source_citations?: string;
  deprecation_notes?: string;

  last_verified_at?: string;
  source_count?: number;
  is_outdated?: boolean;
  outdated_reason?: string;
  deprecation_warning?: string;
}

// ── API functions ─────────────────────────────────────────────
export const api = {
  getModels: () => fetchAPI<ModelInfo[]>("/models"),
  getModelsByProvider: (provider: string) =>
    fetchAPI<ModelInfo[]>(`/models?provider=${provider}`),
  getProviders: () => fetchAPI<string[]>("/models/providers"),
  getModel: (id: string) => fetchAPI<ModelInfo>(`/models/${id}`),
  getStaleModels: () => fetchAPI<ModelInfo[]>("/models/stale"),
  getDeprecatedModels: () => fetchAPI<ModelInfo[]>("/models/deprecated"),
  updateModel: (id: string, data: Partial<ModelInfo>) =>
    fetchAPI<ModelInfo>(`/models/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};
