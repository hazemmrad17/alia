// ──────────────────────────────────────────────
// ALIA Avatar — Typed API Client for Admin Dashboard
// ──────────────────────────────────────────────

import type {
  StartSessionRequest,
  StartSessionResponse,
  ConversationRequest,
  ConversationResponse,
  Product,
  SessionStats,
  LevelDistribution,
  StepAnalysis,
  LevelInfo,
  FormatInfo,
  VisitSession,
  CRMReport,
} from "@/types/alia";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Generic fetch helper ──

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API error ${res.status}: ${body || res.statusText}`);
  }

  return res.json() as Promise<T>;
}

// ── Health check ──

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Session endpoints ──

export async function startSession(request: StartSessionRequest): Promise<StartSessionResponse> {
  return apiFetch<StartSessionResponse>("/api/v1/session/start", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function sendMessage(request: ConversationRequest): Promise<ConversationResponse> {
  return apiFetch<ConversationResponse>("/api/v1/chat", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function getSession(sessionId: string): Promise<VisitSession> {
  return apiFetch<VisitSession>(`/api/v1/session/${sessionId}`);
}

export async function getSessionHistory(sessionId: string) {
  return apiFetch(`/api/v1/session/${sessionId}/history`);
}

export async function listSessions(): Promise<{ total: number; sessions: VisitSession[] }> {
  return apiFetch("/api/v1/sessions");
}

// ── Catalog endpoints ──

export async function listProducts(): Promise<{ total: number; products: Product[] }> {
  return apiFetch("/api/v1/products");
}

export async function listLevels(): Promise<{ levels: LevelInfo[] }> {
  return apiFetch("/api/v1/levels");
}

export async function listFormats(): Promise<{ formats: FormatInfo[] }> {
  return apiFetch("/api/v1/formats");
}

// ── Dashboard endpoints ──

export async function getDashboardStats(): Promise<SessionStats> {
  return apiFetch<SessionStats>("/api/v1/dashboard/stats");
}

/** A finished session as stored on the server.
    Scores are admin-only and absent unless `include_scores` was requested. */
export interface SavedSession {
  session_id: string;
  level: string;
  visit_format: string;
  doctor_style: string;
  product_focus?: string | null;
  messages: number;
  duration_seconds?: number;
  completed_at: string | null;
  rating: number | null;
  comment: string | null;
  would_recommend: boolean | null;
  has_feedback: boolean;
  overall_score?: number;
  step_scores?: Record<string, number>;
}

/** One day of the last week: how many sessions were played and the score. */
export interface WeeklyActivityPoint {
  day: string;
  date: string;
  sessions: number;
  score: number;
}

export interface SavedSessionsResponse {
  total: number;
  this_week: number;
  rated: number;
  average_rating: number | null;
  /** Average evaluation score (admin-only field, null for delegates). */
  average_score?: number | null;
  week_score?: number | null;
  week_delta_percent?: number | null;
  average_duration_seconds?: number | null;
  weekly?: WeeklyActivityPoint[];
  include_scores: boolean;
  sessions: SavedSession[];
}

/** Finished sessions saved on the server (delegate-safe by default). */
export async function getSavedSessions(
  includeScores = false,
  filters: { level?: string; visitFormat?: string; ratedOnly?: boolean; since?: string } = {}
): Promise<SavedSessionsResponse> {
  const params = new URLSearchParams({ include_scores: includeScores ? "true" : "false" });
  if (filters.level && filters.level !== "all") params.set("level", filters.level);
  if (filters.visitFormat && filters.visitFormat !== "all") params.set("visit_format", filters.visitFormat);
  if (filters.ratedOnly) params.set("rated_only", "true");
  if (filters.since) params.set("since", filters.since);
  return apiFetch<SavedSessionsResponse>(`/api/v1/dashboard/saved-sessions?${params.toString()}`);
}

export async function getLevelDistribution(): Promise<LevelDistribution> {
  return apiFetch<LevelDistribution>("/api/v1/dashboard/scores/level-distribution");
}

export async function getStepAnalysis(): Promise<StepAnalysis> {
  return apiFetch<StepAnalysis>("/api/v1/dashboard/scores/step-analysis");
}

export async function getSessionReport(sessionId: string): Promise<CRMReport | { error: string }> {
  return apiFetch(`/api/v1/dashboard/sessions/${sessionId}/report`);
}

// ── Support: problem reports & feedback about ALIA ──

/** `problem` = something is broken, `suggestion` / `feedback` = an idea or a rating. */
export type SupportReportKind = "problem" | "suggestion" | "feedback";

export interface SupportReportInput {
  kind: SupportReportKind;
  category?: string;
  message: string;
  /** 1-5, only meaningful for feedback. */
  rating?: number;
  contact?: string;
  /** Scenario context, so the team can reproduce the session. */
  session_id?: string;
  level?: string;
  visit_format?: string;
  doctor_style?: string;
  product_focus?: string;
  step?: string;
  page?: string;
}

export interface SupportReport extends SupportReportInput {
  id: string;
  status: string;
  created_at: string;
}

/** File a report or a feedback note. Works with or without a running session. */
export async function createSupportReport(
  input: SupportReportInput
): Promise<{ saved: boolean; id: string; total: number }> {
  return apiFetch("/api/v1/support/reports", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** The team's inbox of reports, newest first. */
export async function listSupportReports(
  limit = 50,
  kind?: SupportReportKind
): Promise<{ total: number; open: number; reports: SupportReport[] }> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (kind) params.set("kind", kind);
  return apiFetch(`/api/v1/support/reports?${params.toString()}`);
}

// ── WebSocket factory ──

export function createWebSocketURL(sessionId: string): string {
  const wsBase = API_BASE.replace(/^http/, "ws");
  return `${wsBase}/api/v1/conversation/ws/${sessionId}`;
}
