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
  VisitSession
} from '@/types/alia'
import { authHeaders, notifySessionExpired, tokenQueryParam, type AccountRole, type AuthUser } from '@/lib/auth'

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

/** Thrown for any non-2xx answer, so callers can branch on the status. */
export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// ── Generic fetch helper ──

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...authHeaders(options?.headers) }
  })

  if (!res.ok) {
    // A 401 anywhere means the stored token is gone or dead. Dropping it here
    // rather than at each call site is what makes the login guard reliable: the
    // session is cleared and one event sends the app to the login page.
    // The login call itself is excluded, otherwise a wrong password would clear
    // a session that was never there and bounce the user mid-form.
    if (res.status === 401 && !path.startsWith('/api/v1/auth/login')) {
      notifySessionExpired()
    }

    const body = await res.text().catch(() => '')
    let detail = body || res.statusText

    try {
      const parsed = JSON.parse(body) as { detail?: unknown }

      if (typeof parsed?.detail === 'string') detail = parsed.detail
    } catch {
      // Not JSON — keep the raw body.
    }

    throw new ApiError(res.status, detail)
  }

  if (res.status === 204) return undefined as T

  return res.json() as Promise<T>
}

// ── Authentication ──

export interface LoginResult {
  access_token: string
  token_type: string
  expires_in: number
  user: AuthUser
}

export async function login(email: string, password: string): Promise<LoginResult> {
  return apiFetch<LoginResult>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  })
}

/** Confirms a stored token is still valid and returns the current account. */
export async function fetchCurrentUser(): Promise<AuthUser> {
  return apiFetch<AuthUser>('/api/v1/auth/me')
}

export interface CreateAccountRequest {
  email: string
  password: string
  full_name: string
  role: AccountRole
  specialty?: string
  city?: string
}

/** Admin only — the server answers 403 for every other role. */
export async function createAccount(request: CreateAccountRequest): Promise<AuthUser> {
  return apiFetch<AuthUser>('/api/v1/auth/users', {
    method: 'POST',
    body: JSON.stringify(request)
  })
}

export async function listAccounts(): Promise<{ total: number; users: AuthUser[] }> {
  return apiFetch('/api/v1/auth/users')
}

/** Partial edit: only the fields present are changed. Admin only. */
export async function updateAccount(
  userId: string,
  patch: { full_name?: string; role?: AccountRole; is_active?: boolean; specialty?: string; city?: string }
): Promise<AuthUser> {
  return apiFetch<AuthUser>(`/api/v1/auth/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch)
  })
}

/** Admin removes an account permanently — for a typo, not for a departure. */
export async function deleteAccount(userId: string): Promise<void> {
  return apiFetch<void>(`/api/v1/auth/users/${userId}`, { method: 'DELETE' })
}

/** Admin sets a new password for someone else. */
export async function resetAccountPassword(userId: string, newPassword: string): Promise<void> {
  return apiFetch<void>(`/api/v1/auth/users/${userId}/password`, {
    method: 'POST',
    body: JSON.stringify({ new_password: newPassword })
  })
}

/** The signed-in user changes their own password. */
export async function changeOwnPassword(currentPassword: string, newPassword: string): Promise<void> {
  return apiFetch<void>('/api/v1/auth/me/password', {
    method: 'POST',
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
  })
}

// ── Health check ──

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(5000) })

    return res.ok
  } catch {
    return false
  }
}

// ── Session endpoints ──

export async function startSession(request: StartSessionRequest): Promise<StartSessionResponse> {
  return apiFetch<StartSessionResponse>('/api/v1/session/start', {
    method: 'POST',
    body: JSON.stringify(request)
  })
}

export async function sendMessage(request: ConversationRequest): Promise<ConversationResponse> {
  return apiFetch<ConversationResponse>('/api/v1/chat', {
    method: 'POST',
    body: JSON.stringify(request)
  })
}

export async function getSession(sessionId: string): Promise<VisitSession> {
  return apiFetch<VisitSession>(`/api/v1/session/${sessionId}`)
}

export async function getSessionHistory(sessionId: string) {
  return apiFetch(`/api/v1/session/${sessionId}/history`)
}

export async function listSessions(): Promise<{ total: number; sessions: VisitSession[] }> {
  return apiFetch('/api/v1/sessions')
}

// ── Catalog endpoints ──

export async function listProducts(): Promise<{ total: number; products: Product[] }> {
  return apiFetch('/api/v1/products')
}

export async function listLevels(): Promise<{ levels: LevelInfo[] }> {
  return apiFetch('/api/v1/levels')
}

export async function listFormats(): Promise<{ formats: FormatInfo[] }> {
  return apiFetch('/api/v1/formats')
}

// ── Dashboard endpoints ──

export async function getDashboardStats(): Promise<SessionStats> {
  return apiFetch<SessionStats>('/api/v1/dashboard/stats')
}

/** A finished session as stored on the server.
    Scores are admin-only and absent unless `include_scores` was requested. */
export interface SavedSession {
  session_id: string

  /** `training` | `commercial` — a delegate's drill, or a doctor's visit. */
  mode?: string
  level: string
  visit_format: string
  doctor_style: string
  product_focus?: string | null
  messages: number
  duration_seconds?: number
  completed_at: string | null
  rating: number | null
  comment: string | null
  would_recommend: boolean | null
  has_feedback: boolean
  overall_score?: number
  step_scores?: Record<string, number>
}

/** One day of the last week: how many sessions were played and the score. */
export interface WeeklyActivityPoint {
  day: string
  date: string
  sessions: number
  score: number
}

export interface SavedSessionsResponse {
  total: number
  this_week: number
  rated: number
  average_rating: number | null

  /** Average evaluation score (admin-only field, null for delegates). */
  average_score?: number | null
  week_score?: number | null
  week_delta_percent?: number | null
  average_duration_seconds?: number | null
  weekly?: WeeklyActivityPoint[]

  /** How many sessions carry each mode, over the whole scoped history. */
  modes?: Record<string, number>
  include_scores: boolean
  sessions: SavedSession[]
}

/** Finished sessions saved on the server (delegate-safe by default). */
export async function getSavedSessions(
  includeScores = false,
  filters: {
    level?: string
    mode?: string
    visitFormat?: string
    ratedOnly?: boolean
    since?: string

    /** Rows returned (1-500). The overview raises it to aggregate the whole history. */
    limit?: number
  } = {}
): Promise<SavedSessionsResponse> {
  const params = new URLSearchParams({ include_scores: includeScores ? 'true' : 'false' })

  if (filters.level && filters.level !== 'all') params.set('level', filters.level)
  if (filters.mode && filters.mode !== 'all') params.set('mode', filters.mode)
  if (filters.visitFormat && filters.visitFormat !== 'all') params.set('visit_format', filters.visitFormat)
  if (filters.ratedOnly) params.set('rated_only', 'true')
  if (filters.since) params.set('since', filters.since)
  if (filters.limit) params.set('limit', String(filters.limit))

  return apiFetch<SavedSessionsResponse>(`/api/v1/dashboard/saved-sessions?${params.toString()}`)
}

export async function getLevelDistribution(): Promise<LevelDistribution> {
  return apiFetch<LevelDistribution>('/api/v1/dashboard/scores/level-distribution')
}

export async function getStepAnalysis(): Promise<StepAnalysis> {
  return apiFetch<StepAnalysis>('/api/v1/dashboard/scores/step-analysis')
}

// ── Support: problem reports & feedback about ALIA ──

/** `problem` = something is broken, `suggestion` / `feedback` = an idea or a rating. */
export type SupportReportKind = 'problem' | 'suggestion' | 'feedback'

export interface SupportReportInput {
  kind: SupportReportKind
  category?: string
  message: string

  /** 1-5, only meaningful for feedback. */
  rating?: number
  contact?: string

  /** Scenario context, so the team can reproduce the session. */
  session_id?: string
  level?: string
  visit_format?: string
  doctor_style?: string
  product_focus?: string
  step?: string
  page?: string
}

export interface SupportReport extends SupportReportInput {
  id: string
  status: string
  created_at: string
}

/** File a report or a feedback note. Works with or without a running session. */
export async function createSupportReport(
  input: SupportReportInput
): Promise<{ saved: boolean; id: string; total: number }> {
  return apiFetch('/api/v1/support/reports', {
    method: 'POST',
    body: JSON.stringify(input)
  })
}

/** The team's inbox of reports, newest first. */
export async function listSupportReports(
  limit = 50,
  kind?: SupportReportKind
): Promise<{ total: number; open: number; reports: SupportReport[] }> {
  const params = new URLSearchParams({ limit: String(limit) })

  if (kind) params.set('kind', kind)

  return apiFetch(`/api/v1/support/reports?${params.toString()}`)
}

// ── L'équipe: the admin–delegate relationship ──

/** One entry in a delegate's level audit trail. */
export interface LevelChange {
  delegate_id: string
  from_level: string | null
  to_level: string
  changed_at: string
  changed_by: string | null
}

/** A roster entry: when the delegate joined, their certified level, its history. */
export interface TeamDelegate extends AuthUser {
  assigned_at?: string | null
  current_level?: string | null
  level_history?: LevelChange[]

  /** Set when the delegate was moved here from another admin's team. */
  previous_manager_id?: string | null
  previous_manager_name?: string | null
  assigned_by_name?: string | null
}

export interface TeamResponse {
  manager: AuthUser | null
  delegates: TeamDelegate[]
}

/** One session in an admin's team log — identity plus its evaluation. */
export interface TeamSession {
  session_id: string
  user_id: string
  user_name: string | null
  mode?: string
  level: string
  visit_format: string
  doctor_style: string
  product_focus?: string | null
  messages: number
  duration_seconds: number
  completed_at: string | null
  overall_score?: number | null
  step_scores?: Record<string, number>
  level_progression?: unknown
}

export interface TeamSessionsResponse {
  total: number
  delegates: TeamDelegate[]
  filters: { delegate: string | null; level: string | null; visit_format: string | null; since: string | null }
  sessions: TeamSession[]
}

/** The signed-in admin's delegates; a delegate gets their manager mirrored back. */
export async function getTeam(): Promise<TeamResponse> {
  return apiFetch('/api/v1/team')
}

/** Put a delegate under the signed-in admin. Re-assigning moves them. */
export async function assignToTeam(delegateId: string): Promise<{ assignment: unknown; delegate: AuthUser }> {
  return apiFetch('/api/v1/team', {
    method: 'POST',
    body: JSON.stringify({ delegate_id: delegateId })
  })
}

/** Release a delegate from their manager. */
export async function removeFromTeam(delegateId: string): Promise<{ removed: boolean }> {
  return apiFetch(`/api/v1/team/${delegateId}`, { method: 'DELETE' })
}

/**
 * Grant a delegate a new certified level. Admin only, and audited server-side:
 * the response carries the recorded change and the delegate's updated record.
 */
export async function promoteDelegate(
  delegateId: string,
  level: string
): Promise<{ change: LevelChange; delegate: TeamDelegate }> {
  return apiFetch(`/api/v1/team/${delegateId}/promote`, {
    method: 'POST',
    body: JSON.stringify({ level })
  })
}

/**
 * The team's session log — every finished session of the admin's delegates,
 * with the evaluation fields the anonymous feed deliberately omits. Admin only.
 */
export async function getTeamSessions(
  filters: {
    delegate?: string
    level?: string
    visitFormat?: string
    since?: string
    limit?: number
  } = {}
): Promise<TeamSessionsResponse> {
  const params = new URLSearchParams()

  if (filters.delegate) params.set('delegate', filters.delegate)
  if (filters.level && filters.level !== 'all') params.set('level', filters.level)
  if (filters.visitFormat && filters.visitFormat !== 'all') params.set('visit_format', filters.visitFormat)
  if (filters.since) params.set('since', filters.since)
  if (filters.limit) params.set('limit', String(filters.limit))

  const query = params.toString()

  return apiFetch(`/api/v1/team/sessions${query ? `?${query}` : ''}`)
}

// ── Les médecins: the admin–doctor relationship ──

/**
 * A doctor on the admin's list. Carries the practice (specialty, city) rather
 * than a competence: a doctor is never scored and has no level ladder.
 */
export interface DoctorRecord extends AuthUser {
  assigned_at?: string | null

  /**
   * Whose list this doctor was on before, when the assignment was a handover.
   * The names are resolved server-side: the client only ever holds ids, and a
   * reader looking at a roster wants a name, not a uuid.
   */
  previous_manager_id?: string | null
  previous_manager_name?: string | null
  assigned_by_name?: string | null
}

/** One presentation received by a doctor — the visit report, not a scoring. */
export interface DoctorPresentation {
  session_id: string
  doctor_id: string
  doctor_name: string
  specialty?: string | null
  city?: string | null
  product_focus?: string | null
  visit_format: string
  need_identified?: string | null
  engagement_level?: string | null
  next_step?: string | null
  next_step_date?: string | null
  material_left?: string[]
  duration_seconds: number
  completed_at: string | null
}

export interface DoctorSessionsResponse {
  total: number

  /** `team` when an admin is reading their doctors, `self` for the doctor. */
  scope: 'team' | 'self'
  doctors: DoctorRecord[]
  filters: { doctor: string | null; since: string | null }
  sessions: DoctorPresentation[]
}

/** The admin's doctors; a doctor gets their manager mirrored back. */
export async function getDoctors(): Promise<{ manager: AuthUser | null; doctors: DoctorRecord[] }> {
  return apiFetch('/api/v1/doctors')
}

/** Put a doctor under the signed-in admin. Re-assigning moves them. */
export async function assignDoctorToTeam(doctorId: string): Promise<{ assignment: unknown; doctor: AuthUser }> {
  return apiFetch('/api/v1/doctors', {
    method: 'POST',
    body: JSON.stringify({ doctor_id: doctorId })
  })
}

/** Release a doctor from the admin's list. */
export async function removeDoctorFromTeam(doctorId: string): Promise<{ removed: boolean }> {
  return apiFetch(`/api/v1/doctors/${doctorId}`, { method: 'DELETE' })
}

/**
 * Presentations received — an admin reads their doctors', a doctor reads his own.
 * Only `commercial` sessions appear; the training log lives on /team/sessions.
 */
export async function getDoctorSessions(
  filters: { doctor?: string; since?: string; limit?: number } = {}
): Promise<DoctorSessionsResponse> {
  const params = new URLSearchParams()

  if (filters.doctor) params.set('doctor', filters.doctor)
  if (filters.since) params.set('since', filters.since)
  if (filters.limit) params.set('limit', String(filters.limit))

  const query = params.toString()

  return apiFetch(`/api/v1/doctors/sessions${query ? `?${query}` : ''}`)
}

// ── WebSocket factory ──

export function createWebSocketURL(sessionId: string): string {
  const wsBase = API_BASE.replace(/^http/, 'ws')

  // The socket is authenticated too, and a browser cannot set an Authorization
  // header on a handshake, so the token travels as a query parameter. Without it
  // the server closes the connection and voice silently stops working.
  return `${wsBase}/api/v1/conversation/ws/${sessionId}${tokenQueryParam()}`
}

// ── Delegate leaderboard (tenant-scoped) ──

export interface LeaderboardEntry {
  user_id: string
  full_name: string
  role?: string | null
  current_level?: string | null
  sessions: number
  xp: number
  avg_score: number | null
  best_score: number | null
  is_me: boolean
  rank: number
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[]
  me: LeaderboardEntry | null
}

export async function getLeaderboard(): Promise<LeaderboardResponse> {
  return apiFetch<LeaderboardResponse>('/api/v1/leaderboard')
}

// ── Doctor loyalty / rewards (Mon espace fidélité Vital) ──

export interface RewardGift {
  id: string
  tenant_id: string
  title: string
  description?: string | null
  cost: number
  stock?: number | null
  active: boolean
  created_at?: string
}

export interface LedgerEntry {
  id: string
  doctor_id: string
  delta: number
  reason: string
  ref_id?: string | null
  created_at: string
}

export interface RewardsOverview {
  balance: number
  lifetime_points: number
  tier: { name: string; min_points: number }
  next_gift: RewardGift | null
  progress_to_next: number
  stats: { pitches_received: number; feedbacks_given: number; gifts_obtained: number }
  recent_ledger: LedgerEntry[]
}

export interface GiftClaim {
  id: string
  doctor_id: string
  gift_id: string
  gift_title?: string | null
  status: 'requested' | 'delivered' | 'cancelled'
  requested_at: string
  delivered_at?: string | null
  doctor_name?: string | null
}

export async function getRewardsOverview(): Promise<RewardsOverview> {
  return apiFetch<RewardsOverview>('/api/v1/doctor/rewards/overview')
}

export async function listRewardGifts(): Promise<{ balance: number; gifts: RewardGift[] }> {
  return apiFetch('/api/v1/doctor/rewards/gifts')
}

export async function claimGift(giftId: string): Promise<{ claim: GiftClaim; balance: number }> {
  return apiFetch(`/api/v1/doctor/rewards/gifts/${giftId}/claim`, { method: 'POST' })
}

export async function listMyClaims(): Promise<{ claims: GiftClaim[] }> {
  return apiFetch('/api/v1/doctor/rewards/claims')
}

// ── Admin side ──

export async function adminListGifts(): Promise<{ gifts: RewardGift[] }> {
  return apiFetch('/api/v1/admin/rewards/gifts')
}

export interface GiftInput {
  title: string
  description?: string | null
  cost: number
  stock?: number | null
  active?: boolean
}

export async function adminCreateGift(input: GiftInput): Promise<{ gift: RewardGift }> {
  return apiFetch('/api/v1/admin/rewards/gifts', { method: 'POST', body: JSON.stringify(input) })
}

export async function adminUpdateGift(giftId: string, patch: Partial<GiftInput>): Promise<{ gift: RewardGift }> {
  return apiFetch(`/api/v1/admin/rewards/gifts/${giftId}`, { method: 'PATCH', body: JSON.stringify(patch) })
}

export async function adminListClaims(): Promise<{ claims: GiftClaim[] }> {
  return apiFetch('/api/v1/admin/rewards/claims')
}

export async function adminUpdateClaim(claimId: string, status: GiftClaim['status']): Promise<{ claim: GiftClaim }> {
  return apiFetch(`/api/v1/admin/rewards/claims/${claimId}`, { method: 'PATCH', body: JSON.stringify({ status }) })
}

export async function adminAdjustPoints(doctorId: string, delta: number, reason = 'admin_adjust'): Promise<void> {
  await apiFetch('/api/v1/admin/rewards/adjust', {
    method: 'POST',
    body: JSON.stringify({ doctor_id: doctorId, delta, reason })
  })
}

// ── Session detail (transcript + scores + feedback) ──

export interface TranscriptTurn {
  role: string
  content: string
}

/** Where this session left the trainee: next level, threshold and the gap. */
export interface LevelProgression {
  eligible: boolean
  current_level: string
  next_level: string
  /** Score on the backend's 0–10 evaluation scale. */
  score_achieved: number
  threshold: number
  /** Points still missing when the level was not reached. */
  gap?: number
  message: string
}

/** One objection raised during the visit — text, and whether it was handled. */
export interface Objection {
  objection?: string
  handled?: string
}

export interface SessionDetail {
  session_id: string
  mode?: string | null
  level?: string | null
  visit_format?: string | null
  doctor_style?: string | null
  product_focus?: string | null
  duration_seconds?: number | null
  completed_at?: string | null
  unscored: boolean
  overall_score?: number | null
  step_scores: Record<string, number>
  strengths: string[]
  areas_for_improvement: string[]
  level_progression?: LevelProgression | null
  /** Turns exchanged during the session (the transcript itself may be empty). */
  messages?: number | null
  owner_name?: string | null
  transcript: TranscriptTurn[]
  crm: {
    context?: string | null
    doctor_specialty?: string | null
    material_left?: string[] | null
    level_at_session?: string | null
    engagement_level?: string | null
    need_identified?: string | null
    message_delivered?: string | null
    objections_encountered?: (string | Objection)[] | null
    soncas_detected?: string[] | null
    next_step?: string | null
    next_step_date?: string | null
  }
  feedback?: {
    rating?: number
    comment?: string
    would_recommend?: boolean
    saved_at?: string
  } | null
}

export async function getSessionDetail(sessionId: string): Promise<SessionDetail> {
  return apiFetch<SessionDetail>(`/api/v1/sessions/${sessionId}/detail`)
}
