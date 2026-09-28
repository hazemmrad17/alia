// ──────────────────────────────────────────────
// ALIA Avatar — client session
//
// One place that knows where the token lives and how a request proves who it
// is. Nothing else in the app should read localStorage for auth directly, so
// moving to httpOnly cookies later means rewriting this file and nothing more.
// ──────────────────────────────────────────────

import { setStoredRole, type UserRole } from '@/lib/user-role'

/** What the backend says about the account. */
export type AccountRole = 'admin' | 'doctor' | 'delegate'

/**
 * The three navbars the app renders, one per audience: the delegate trains, the
 * doctor receives ALIA's presentation, the platform account reads both.
 */
export type Workspace = 'delegate' | 'doctor' | 'admin'

export interface AuthUser {
  id: string
  email: string
  full_name: string
  role: AccountRole
  tenant_id: string
  is_active: boolean

  /** ISO timestamps from the server; absent on records created client-side. */
  created_at?: string | null
  last_login_at?: string | null

  /** Doctor / pharmacist practice. Empty on the other roles. */
  specialty?: string | null
  city?: string | null
}

interface StoredSession {
  access_token: string

  /** Epoch milliseconds, so an expired token is rejected without a round trip. */
  expires_at: number
  user: AuthUser
}

const SESSION_KEY = 'alia-session'

/** Fired when the API answers 401 and the session has been dropped. */
export const AUTH_EXPIRED_EVENT = 'alia-auth-expired'

// ── storage ──

function isBrowser(): boolean {
  return typeof window !== 'undefined'
}

export function getSession(): StoredSession | null {
  if (!isBrowser()) return null

  try {
    const raw = window.localStorage.getItem(SESSION_KEY)

    if (!raw) return null

    const session = JSON.parse(raw) as StoredSession

    if (!session?.access_token || !session.user) return null

    // A token that has already expired is the same as no token: clearing it here
    // saves a doomed request on every page load.
    if (typeof session.expires_at === 'number' && session.expires_at <= Date.now()) {
      clearSession()

      return null
    }

    return session
  } catch {
    return null
  }
}

export function getToken(): string | null {
  return getSession()?.access_token ?? null
}

export function getCurrentUser(): AuthUser | null {
  return getSession()?.user ?? null
}

export function isAuthenticated(): boolean {
  return getSession() !== null
}

/**
 * Store a freshly issued token and the account it belongs to, and point the
 * navbar at the workspace that account should land in.
 */
export function setSession(accessToken: string, expiresInSeconds: number, user: AuthUser): void {
  if (!isBrowser()) return

  const session: StoredSession = {
    access_token: accessToken,
    expires_at: Date.now() + Math.max(0, expiresInSeconds) * 1000,
    user
  }

  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  setStoredRole(workspaceFor(user.role))
}

/** Replace the cached account (after /auth/me) without touching the token. */
export function updateStoredUser(user: AuthUser): void {
  if (!isBrowser()) return

  const session = getSession()

  if (!session) return

  window.localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, user }))
}

export function clearSession(): void {
  if (!isBrowser()) return
  window.localStorage.removeItem(SESSION_KEY)
}

/** Drop the token and send the navbar back to its unauthenticated default. */
export function signOut(): void {
  clearSession()
  setStoredRole('delegate')
}

// ── requests ──

/** Headers every authenticated call needs. Spread these into `options.headers`. */
export function authHeaders(extra?: HeadersInit): Record<string, string> {
  const headers: Record<string, string> = { ...(extra as Record<string, string> | undefined) }
  const token = getToken()

  if (token) headers.Authorization = `Bearer ${token}`

  return headers
}

/** Token for the WebSocket handshake, which cannot carry headers. */
export function tokenQueryParam(): string {
  const token = getToken()

  return token ? `?token=${encodeURIComponent(token)}` : ''
}

/**
 * Tell the app the session is gone. Called from the API layer on a 401 so every
 * caller gets the same behaviour instead of each one inventing a redirect.
 */
export function notifySessionExpired(): void {
  clearSession()
  if (isBrowser()) window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT))
}

// ── roles ──

/**
 * Which navbar an account should see — one per role, because the three are
 * different apps, not permission levels on one. An unknown role is treated as
 * the platform account, which is the whole app rather than half of it.
 */
export function workspaceFor(role: AccountRole | string): Workspace {
  if (role === 'delegate') return 'delegate'
  if (role === 'doctor') return 'doctor'

  return 'admin'
}

/**
 * Where to send someone right after they sign in. Each target is a real route:
 * the delegate's own progress, the doctor's presentation flow, and the platform
 * overview over every session.
 */
export function landingPathFor(role: AccountRole | string): string {
  switch (workspaceFor(role)) {
    case 'delegate':
      return '/dashboard/training'
    case 'doctor':
      return '/commercial'
    default:
      return '/dashboard/commercial'
  }
}

export const ACCOUNT_ROLE_LABELS: Record<AccountRole, string> = {
  admin: 'Administrateur',
  doctor: 'Médecin / Pharmacien',
  delegate: 'Délégué Médical'
}

export const WORKSPACE_LABELS: Record<Workspace, string> = {
  delegate: 'Medical Delegate',
  doctor: 'Doctor / Pharmacist',
  admin: 'Administration'
}

export function initialsOf(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)

  if (parts.length === 0) return '?'

  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
}

export type { UserRole }
