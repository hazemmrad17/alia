export type UserRole = 'delegate' | 'commercial'

const ROLE_STORAGE_KEY = 'alia-user-role'

// Role-specific route prefixes. A URL that clearly belongs to one workspace
// wins over the stored role so deep links always render the right navbar.
const DELEGATE_PREFIXES = [
  '/dashboard/training',
  '/analytics/step-performance',
  '/analytics/doctor-styles',
  '/people/delegates',
  '/training'
]

// /products is deliberately NOT listed here: the VITAL Products catalog is a
// shared destination available to both roles, so the stored role (not the
// path) must decide which navbar renders while browsing it.
const COMMERCIAL_PREFIXES = [
  '/dashboard/commercial',
  '/sessions/crm-reports',
  '/sessions/calendar',
  '/people/doctors',
  '/commercial'
]

export const roleFromPath = (pathname: string): UserRole | null => {
  if (DELEGATE_PREFIXES.some(p => pathname === p || pathname.startsWith(`${p}/`))) return 'delegate'
  if (COMMERCIAL_PREFIXES.some(p => pathname === p || pathname.startsWith(`${p}/`))) return 'commercial'

  return null
}

export const getStoredRole = (): UserRole | null => {
  if (typeof window === 'undefined') return null

  const value = window.localStorage.getItem(ROLE_STORAGE_KEY)

  return value === 'delegate' || value === 'commercial' ? value : null
}

export const setStoredRole = (role: UserRole): void => {
  if (typeof window === 'undefined') return

  window.localStorage.setItem(ROLE_STORAGE_KEY, role)
}

export const clearStoredRole = (): void => {
  if (typeof window === 'undefined') return

  window.localStorage.removeItem(ROLE_STORAGE_KEY)
}

// Landing on an ambiguous page (settings, session history, home) falls back to
// the last role the user chose, then to delegate.
export const resolveRole = (pathname: string): UserRole => {
  return roleFromPath(pathname) ?? getStoredRole() ?? 'delegate'
}

export const ROLE_LABELS: Record<UserRole, string> = {
  delegate: 'Medical Delegate',
  commercial: 'Doctor / Pharmacist'
}
