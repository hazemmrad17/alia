// ──────────────────────────────────────────────
// Rôles & permissions
//
// There is no roles endpoint to read. The three roles ship with the platform's
// auth model (AccountRole in lib/auth.ts), the navbars in configs/navConfig.tsx
// decide what each one sees, and the API answers 403 to what it may not call.
// This module is the transcription of those rules in one place, so the Rôles page
// can describe them without inventing an access the application does not actually
// enforce.
//
// Every figure that page shows is counted from the grants below rather than typed
// beside them, so a card cannot claim a permission the matrix does not hold.
//
// Deliberately not read: the API. Roles are a client-side description of rules the
// server owns — the moment the server can vary them per tenant, this file becomes
// a read of that endpoint instead of a transcription.
// ──────────────────────────────────────────────

import type { AccountRole } from './auth'

export type RoleAction = 'lire' | 'ecrire' | 'creer' | 'supprimer'

/** The order the permission strip reads in, left to right. */
export const ROLE_ACTIONS: RoleAction[] = ['lire', 'ecrire', 'creer', 'supprimer']

export const ROLE_ACTION_LABELS: Record<RoleAction, string> = {
  lire: 'Lire',
  ecrire: 'Écrire',
  creer: 'Créer',
  supprimer: 'Supprimer'
}

/** One surface of the platform, and what a role may do on it. */
export interface RoleGrant {
  /** Named the way the left-hand navbar names it. */
  module: string
  actions: RoleAction[]

  /** True when the access covers the account's own records only. */
  own?: boolean
}

export interface RoleDefinition {
  role: AccountRole

  /** One line: what the role exists for. */
  purpose: string
  grants: RoleGrant[]
}

const ALL: RoleAction[] = ['lire', 'ecrire', 'creer', 'supprimer']

/**
 * The three accounts the licence is sold against. The administrator is the union
 * of the other two plus the platform's own surfaces — which is exactly how the
 * admin navbar in configs/navConfig.tsx is built.
 */
export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    role: 'admin',
    purpose: 'L’équipe VITAL : tout le plateforme, comptes compris.',
    grants: [
      { module: 'Comptes & accès', actions: ALL },
      { module: 'Opérations & tournées', actions: ALL },
      { module: 'Stock & dépôts', actions: ['lire'] },
      { module: 'Formation & évaluations', actions: ['lire'] },
      { module: 'Sessions & comptes rendus', actions: ['lire'] },
      { module: 'Rapports & analytics', actions: ['lire'] },
      { module: 'Catalogue VITAL', actions: ['lire'] },
      { module: 'Messagerie', actions: ['lire', 'creer'] },
      { module: 'Contacts', actions: ['lire'] },
      { module: 'Paramètres', actions: ['lire', 'ecrire'], own: true }
    ]
  },
  {
    role: 'doctor',
    purpose: 'Reçoit les présentations ALIA et signe le compte rendu de visite.',
    grants: [
      { module: 'Sessions & comptes rendus', actions: ['lire'], own: true },
      { module: 'Catalogue VITAL', actions: ['lire'] },
      { module: 'Messagerie', actions: ['lire', 'creer'] },
      { module: 'Contacts', actions: ['lire'] },
      { module: 'Paramètres', actions: ['lire', 'ecrire'], own: true }
    ]
  },
  {
    role: 'delegate',
    purpose: 'Se forme sur les gammes VITAL et progresse étape par étape.',
    grants: [
      { module: 'Formation & évaluations', actions: ['lire', 'creer'], own: true },
      { module: 'Catalogue VITAL', actions: ['lire'] },
      { module: 'Messagerie', actions: ['lire', 'creer'] },
      { module: 'Contacts', actions: ['lire'] },
      { module: 'Paramètres', actions: ['lire', 'ecrire'], own: true }
    ]
  }
]

const BY_ROLE = new Map(ROLE_DEFINITIONS.map(definition => [definition.role, definition]))

export function roleDefinition(role: AccountRole): RoleDefinition {
  // AccountRole is a closed union, so a miss means the two lists have drifted —
  // worth failing loudly over rather than rendering an empty card.
  const definition = BY_ROLE.get(role)

  if (!definition) throw new Error(`Aucune définition pour le rôle « ${role} ».`)

  return definition
}

/** How many modules grant each action — the strip the cards show. */
export function roleActionCounts(role: AccountRole): Record<RoleAction, number> {
  const counts = { lire: 0, ecrire: 0, creer: 0, supprimer: 0 }

  for (const grant of roleDefinition(role).grants) {
    for (const action of grant.actions) counts[action] += 1
  }

  return counts
}

/** The modules the role can do something on — what its "Total" counts. */
export function roleModules(role: AccountRole): string[] {
  return roleDefinition(role)
    .grants.filter(grant => grant.actions.length > 0)
    .map(grant => grant.module)
}

/** Every module any role can reach, so the page can state the platform's size. */
export function allModules(): string[] {
  const modules: string[] = []

  for (const definition of ROLE_DEFINITIONS) {
    for (const grant of definition.grants) {
      if (!modules.includes(grant.module)) modules.push(grant.module)
    }
  }

  return modules
}

// ── La matrice ────────────────────────────────────────────────────────────────
// The Permissions page reads the grants through these, so a cell cannot show an
// access the matrix does not hold.

/** A role's grant on one module, or null when the role has no access to it. */
export function roleGrant(role: AccountRole, module: string): RoleGrant | null {
  return roleDefinition(role).grants.find(grant => grant.module === module) ?? null
}

/** Whether a role may take one action on one module. */
export function roleCan(role: AccountRole, module: string, action: RoleAction): boolean {
  return roleGrant(role, module)?.actions.includes(action) ?? false
}

/** Every (module, action) pair the platform grants — the "Active Permissions" count. */
export function activePermissionCount(): number {
  return ROLE_DEFINITIONS.reduce(
    (total, definition) => total + definition.grants.reduce((sum, grant) => sum + grant.actions.length, 0),
    0
  )
}

/** How many grants carry each action, across every role — the matrix legend. */
export function actionUsageCounts(): Record<RoleAction, number> {
  const counts = { lire: 0, ecrire: 0, creer: 0, supprimer: 0 }

  for (const definition of ROLE_DEFINITIONS) {
    for (const grant of definition.grants) {
      for (const action of grant.actions) counts[action] += 1
    }
  }

  return counts
}
