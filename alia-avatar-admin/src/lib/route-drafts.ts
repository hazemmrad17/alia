// A tournée saved from the planner lives in the browser.
//
// There is no routes endpoint behind this page yet, and a Save draft button that
// silently does nothing is worse than one that says where the plan went: these
// drafts are kept in localStorage, they show up at the top of the list, and
// dispatching one moves it to "prête à expédier" like any seeded tournée.
//
// Storage is an external system, so it is read through useSyncExternalStore rather
// than copied into state from an effect: the server renders the empty snapshot, the
// browser renders its own, and a save or a delete notifies every mounted page.

import { ROUTE_STATUS_LABELS, type Route } from './route-data'

const STORAGE_KEY = 'alia.route-planner.drafts'

/** The snapshot before the browser has been read — the server's, and hydration's. */
const UNREAD: Route[] = []

let cachedRaw: string | null = null
let cache: Route[] = UNREAD

/** A half-written or hand-edited entry must not take the page down with it. */
function parse(raw: string | null): Route[] {
  if (!raw) return []

  try {
    const parsed: unknown = JSON.parse(raw)

    if (!Array.isArray(parsed)) return []

    return parsed.filter(
      (entry): entry is Route =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as Route).id === 'string' &&
        typeof (entry as Route).startAt === 'string' &&
        Array.isArray((entry as Route).stops) &&
        (entry as Route).status in ROUTE_STATUS_LABELS
    )
  } catch {
    return []
  }
}

function readRaw(): string | null {
  if (typeof window === 'undefined') return null

  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    // Storage can be blocked; the planner then simply has no saved drafts.
    return null
  }
}

/** Everything saved from the planner in this browser, newest first. */
export function getLocalRoutes(): Route[] {
  const raw = readRaw()

  // The snapshot must keep its identity until storage actually changes, or React
  // re-renders on every read.
  if (raw === cachedRaw && cache !== UNREAD) return cache

  cachedRaw = raw
  cache = parse(raw)

  return cache
}

/** The snapshot the server, and the first client render, agree on. */
export function getServerRoutes(): Route[] {
  return UNREAD
}

/** True while the browser's copy has not been read yet. */
export function isUnread(snapshot: Route[]): boolean {
  return snapshot === UNREAD
}

const listeners = new Set<() => void>()

export function subscribeLocalRoutes(listener: () => void): () => void {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

function persist(routes: Route[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(routes))
  } catch {
    // A full or blocked storage is not a reason to break the page.
  }

  cachedRaw = null
  listeners.forEach(listener => listener())
}

/** Saves a plan, replacing any earlier save of the same tournée. */
export function saveLocalRoute(route: Route): void {
  persist([route, ...getLocalRoutes().filter(entry => entry.id !== route.id)])
}

export function removeLocalRoute(id: string): void {
  persist(getLocalRoutes().filter(entry => entry.id !== id))
}

/** "TR-2026-0189" — the next serial after everything the page can already see. */
export function nextRouteId(known: string[]): string {
  const year = new Date().getFullYear()

  // Seeded from the ids themselves, never from a constant: the planner's serials
  // run in the 1700s, and a stray default would hand out a number below them.
  const highest = known.reduce((max, id) => {
    const match = /^TR-\d{4}-(\d+)$/.exec(id)

    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `TR-${year}-${String(highest + 1).padStart(4, '0')}`
}

/** Seeds plus local saves, local first, one row per tournée. */
export function mergeRoutes(seeds: Route[], local: Route[]): Route[] {
  const overridden = new Set(local.map(route => route.id))

  return [...local, ...seeds.filter(route => !overridden.has(route.id))]
}
