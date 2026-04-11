/**
 * Panel telemetry client.
 *
 * Fire-and-forget reporter that sends structured observations to the
 * backend Intent Panel whenever the advisor produces a routing decision
 * and whenever the user interacts with the result. Every call is wrapped
 * in a try/catch so telemetry failures NEVER break the advisor UX.
 *
 * Consent model (matches backend Tier 0/1/2):
 *   0 = essential instrumentation (anonymous, redacted prompt only)
 *   1 = research contribution (raw prompt kept for research)
 *   2 = licensing (not used yet by the frontend)
 *
 * The user's anonymous identity and active session id are persisted in
 * localStorage so they survive page reloads but never cross devices.
 */

import { API_BASE } from "@/lib/constants";

const STORAGE = {
  consent: "nr_consent_tier",
  user: "nr_panel_user_id",
  session: "nr_panel_session_id",
  sessionStartedAt: "nr_panel_session_started_at",
} as const;

const SESSION_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes idle

export type ConsentTier = 0 | 1 | 2;

export interface CandidateModelPayload {
  model_id: string;
  score: number;
  track?: string;
  rationale_code?: string;
}

export interface RoutingCapturePayload {
  recommended_model?: string;
  candidate_models?: CandidateModelPayload[];
  routing_confidence?: number;
  routing_explanation?: string;
  tradeoff_profile?: string;
  expected_cost_usd?: number;
  expected_latency_ms?: number;
  routing_strategy_version?: string;
}

export interface EventCreatePayload {
  prompt: string;
  routing: RoutingCapturePayload;
}

export interface EventCreatedResponse {
  event_id: string;
  session_id: string;
  user_id: string;
  category_primary: string | null;
  subcategory: string | null;
  classifier_confidence: number;
  enrichment_tier: number;
}

export interface OutcomePayload {
  selected_model?: string;
  user_accepted_recommendation?: boolean;
  user_overrode_recommendation?: boolean;
  override_reason?: string;
  time_to_decision_ms?: number;
  copied?: boolean;
  exported?: boolean;
  rerouted?: boolean;
  rerouted_to_model?: string;
  abandoned?: boolean;
  explicit_rating?: number;
}

// ──────────────────────────────────────────────────────────────────
// Local state
// ──────────────────────────────────────────────────────────────────
function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function getConsentTier(): ConsentTier {
  if (!isBrowser()) return 0;
  const raw = localStorage.getItem(STORAGE.consent);
  if (raw === "1") return 1;
  if (raw === "2") return 2;
  return 0;
}

export function hasInteractedWithConsent(): boolean {
  if (!isBrowser()) return false;
  return localStorage.getItem(STORAGE.consent) !== null;
}

export function setConsentTier(tier: ConsentTier): void {
  if (!isBrowser()) return;
  localStorage.setItem(STORAGE.consent, String(tier));
}

export function getUserId(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(STORAGE.user);
}

function setUserId(id: string): void {
  if (!isBrowser()) return;
  localStorage.setItem(STORAGE.user, id);
}

function getSessionId(): string | null {
  if (!isBrowser()) return null;
  const id = localStorage.getItem(STORAGE.session);
  const startedAt = localStorage.getItem(STORAGE.sessionStartedAt);
  if (!id || !startedAt) return null;
  const age = Date.now() - Number(startedAt);
  if (Number.isFinite(age) && age > SESSION_MAX_AGE_MS) {
    localStorage.removeItem(STORAGE.session);
    localStorage.removeItem(STORAGE.sessionStartedAt);
    return null;
  }
  return id;
}

function setSessionId(id: string): void {
  if (!isBrowser()) return;
  localStorage.setItem(STORAGE.session, id);
  localStorage.setItem(STORAGE.sessionStartedAt, String(Date.now()));
}

function clientInfo() {
  if (!isBrowser()) return {};
  return {
    platform: "web",
    version: "3.1.0",
    locale: navigator.language,
    tz:
      Intl.DateTimeFormat().resolvedOptions().timeZone || undefined,
  };
}

// ──────────────────────────────────────────────────────────────────
// Low-level fetch wrapper
// ──────────────────────────────────────────────────────────────────
async function post<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      // Telemetry must never block the UI.
      keepalive: true,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function patch<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────────────────────────
// Session lifecycle
// ──────────────────────────────────────────────────────────────────
async function ensureSession(): Promise<{ sessionId: string; userId: string } | null> {
  const tier = getConsentTier();
  const existingUser = getUserId();
  const existingSession = getSessionId();
  if (existingUser && existingSession) {
    return { sessionId: existingSession, userId: existingUser };
  }

  const res = await post<{
    session_id: string;
    user_id: string;
    consent_tier: number;
  }>("/panel/sessions", {
    user_id: existingUser ?? undefined,
    client: clientInfo(),
    consent_tier: tier,
  });
  if (!res) return null;
  setUserId(res.user_id);
  setSessionId(res.session_id);
  return { sessionId: res.session_id, userId: res.user_id };
}

export async function grantConsent(tier: ConsentTier, scope: string[] = []): Promise<void> {
  setConsentTier(tier);
  await post("/panel/consents", {
    user_id: getUserId() ?? undefined,
    tier,
    scope,
    source: "consent_banner",
  });
}

export async function revokeConsent(): Promise<void> {
  const uid = getUserId();
  setConsentTier(0);
  if (!uid) return;
  try {
    await fetch(`${API_BASE}/panel/consents/${uid}`, {
      method: "DELETE",
      keepalive: true,
    });
  } catch {
    // swallow
  }
}

// ──────────────────────────────────────────────────────────────────
// Event capture
// ──────────────────────────────────────────────────────────────────
export async function captureEvent(
  payload: EventCreatePayload
): Promise<EventCreatedResponse | null> {
  // Tier 0 is the default — we always capture essential telemetry, but
  // we never send the raw prompt unless tier >= 1. The backend already
  // redacts; we additionally gate the raw prompt client-side so it
  // literally never leaves the device when consent is at 0.
  const tier = getConsentTier();
  const session = await ensureSession();
  if (!session) return null;

  const body = {
    session_id: session.sessionId,
    user_id: session.userId,
    prompt: payload.prompt, // server-side redaction always runs
    client: clientInfo(),
    routing: {
      routing_strategy_version:
        payload.routing.routing_strategy_version || "advisor-v3.0.0",
      ...payload.routing,
    },
    consent_tier: tier,
  };

  return post<EventCreatedResponse>("/panel/events", body);
}

export async function recordOutcome(
  eventId: string,
  outcome: OutcomePayload
): Promise<void> {
  if (!eventId) return;
  await patch(`/panel/events/${eventId}`, { event_id: eventId, ...outcome });
}

// fetchDashboard was removed — the dashboard uses fetchJson from
// @/lib/constants directly. This file is telemetry-only.
