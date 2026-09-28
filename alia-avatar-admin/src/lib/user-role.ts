// The three navbars the shell can render. They name audiences, not permissions:
// each is a different app surface, and only a signed-in account picks one for
// real (see workspaceFor in lib/auth.ts).
import { useSyncExternalStore } from 'react'

export type UserRole = 'delegate' | 'doctor' | 'admin'

const ROLE_STORAGE_KEY = 'alia-user-role'

// Role-specific route prefixes. A URL that clearly belongs to one workspace
// wins over the stored role so deep links always render the right navbar.
const DELEGATE_PREFIXES = [
  '/dashboard/training',
  '/analytics/step-performance',
  '/analytics/doctor-styles',
  '/training'
]

// /commercial is the doctor's own flow: ALIA presents a product to him and the
// session ends in a CRM visit report (docs/11-user-story-doctor.md).
const DOCTOR_PREFIXES = ['/commercial', '/dashboard/loyalty', '/dashboard/gifts']

// The platform view: what VITAL reads across both audiences. Checked last, so
// the delegate- and doctor-specific prefixes above win on a shared parent path.
const ADMIN_PREFIXES = ['/dashboard/commercial', '/dashboard/logistics', '/admin', '/analytics']

// /products is deliberately in none of them: the VITAL catalogue is a shared
// destination, so the stored role (not the path) decides which navbar renders
// while browsing it.
export const roleFromPath = (pathname: string): UserRole | null => {
  if (DELEGATE_PREFIXES.some(p => pathname === p || pathname.startsWith(`${p}/`))) return 'delegate'
  if (DOCTOR_PREFIXES.some(p => pathname === p || pathname.startsWith(`${p}/`))) return 'doctor'
  if (ADMIN_PREFIXES.some(p => pathname === p || pathname.startsWith(`${p}/`))) return 'admin'

  return null
}

// A workspace name that meant "the platform navbar" under an older build.
const LEGACY_ROLE_ALIASES: Record<string, UserRole> = { commercial: 'admin' }

const isUserRole = (value: string | null): value is UserRole =>
  value === 'delegate' || value === 'doctor' || value === 'admin'

export const getStoredRole = (): UserRole | null => {
  if (typeof window === 'undefined') return null

  const value = window.localStorage.getItem(ROLE_STORAGE_KEY)

  if (isUserRole(value)) return value

  return LEGACY_ROLE_ALIASES[value ?? ''] ?? null
}

export const setStoredRole = (role: UserRole): void => {
  if (typeof window === 'undefined') return

  window.localStorage.setItem(ROLE_STORAGE_KEY, role)
  notifyRoleChange()
}

export const clearStoredRole = (): void => {
  if (typeof window === 'undefined') return

  window.localStorage.removeItem(ROLE_STORAGE_KEY)
  notifyRoleChange()
}

// ── Reading the role as an external store ────────────────────────────────────────
// A page that hides or shows chrome per workspace (settings) cannot wait for a
// post-mount effect: that renders the other workspace's tabs for a frame and then
// yanks them away. Storage is an external system, so it is read through
// useSyncExternalStore instead — the server and the first client render agree on
// the delegate fallback, and a sign-in or a workspace switch notifies every
// mounted page at once.
const roleListeners = new Set<() => void>()

const notifyRoleChange = (): void => {
  roleListeners.forEach(listener => listener())
}

const subscribeRole = (listener: () => void): (() => void) => {
  roleListeners.add(listener)

  return () => {
    roleListeners.delete(listener)
  }
}

/** What this browser last chose, defaulting the way resolveRole does. */
export const getRoleSnapshot = (): UserRole => getStoredRole() ?? 'delegate'

/** The snapshot the server, and hydration, render. */
export const getServerRoleSnapshot = (): UserRole => 'delegate'

export const useStoredRole = (): UserRole =>
  useSyncExternalStore(subscribeRole, getRoleSnapshot, getServerRoleSnapshot)

// Landing on an ambiguous page (settings, session history, home) falls back to
// the last role the user chose, then to delegate.
export const resolveRole = (pathname: string): UserRole => {
  return roleFromPath(pathname) ?? getStoredRole() ?? 'delegate'
}

export const ROLE_LABELS: Record<UserRole, string> = {
  delegate: 'Medical Delegate',
  doctor: 'Doctor / Pharmacist',
  admin: 'Administration'
}
