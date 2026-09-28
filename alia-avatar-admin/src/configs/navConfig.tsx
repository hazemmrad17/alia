// Third-party Imports
import type * as Icon from 'lucide-react'

type IconName = keyof typeof Icon

export type MenuLeafSubItem = {
  label: string
  href: string
  activePath?: string
  badge?: string
  badgeClassName?: string
  target?: '_blank' | '_self' | '_parent' | '_top'
}

export type MenuGroupSubItem = {
  label: string
  childItems: MenuLeafSubItem[]
}

export type MenuSubItem = MenuLeafSubItem | MenuGroupSubItem

export type MenuItem = {
  icon: IconName
  label: string
} & (
  | {
      href: string
      badge?: string
      badgeClassName?: string
      childItems?: never
      target?: '_blank' | '_self' | '_parent' | '_top'
    }
  | {
      href?: never
      badge?: string
      badgeClassName?: string
      childItems: MenuSubItem[]
    }
)

export type NavItem = {
  groupLabel?: string
  items: MenuItem[]
}

// Shared utility group included in BOTH role navbars. Role-specific business
// pages never leak across the two experiences.
// All workspace utilities (history, trends, backend, config) live on one
// Settings page whose tabs map to the following anchors: general / history /
// trends / status.
const GENERAL_ITEMS: MenuItem[] = [
  {
    icon: 'Settings',
    label: 'Paramètres',
    href: '/settings'
  }
]

// Administration group. Deliberately in the admin navbar alone: managing
// accounts is a platform concern, and the API answers 403 to everyone else —
// a doctor may not even read the staff directory.
//
// One entry, three faces of the same object: the roster of accounts, the roles
// those accounts can hold, and the matrix that puts the two side by side. They sit
// under the same parent because a question about an account is usually a question
// about its role — and because the third is the reference the first is edited
// against. Mon équipe sits above them: it is the working view — who reports to
// me and what they did — while the three below are the reference views.
const ADMINISTRATION_ITEMS: MenuItem[] = [
  {
    icon: 'Users',
    label: 'Utilisateurs',
    childItems: [
      {
        label: 'Mon équipe',
        href: '/admin/team'
      },
      {
        label: 'Mes médecins',
        href: '/admin/doctors'
      },
      {
        label: 'Comptes & accès',
        href: '/admin/accounts'
      },
      {
        label: 'Récompenses & fidélité',
        href: '/admin/rewards'
      },
      {
        label: 'Rôles & permissions',
        href: '/admin/roles'
      },
      {
        label: 'Permissions',
        href: '/admin/permissions'
      }
    ]
  }
]

// Shared help group included in BOTH role navbars.
const MISCELLANEOUS_ITEMS: MenuItem[] = [
  {
    icon: 'LifeBuoy',
    label: 'Support',
    href: '/support'
  },
  {
    icon: 'BookOpen',
    label: 'Documentation',
    href: '/documentation'
  }
]

// Operations group. The field force belongs to the platform side: a delegate
// trains, a doctor receives a presentation, neither dispatches the tournées — so
// this group is only in the admin navbar, next to the reports that judge the
// visits. It reads as one screen per question: the overview for the state of the
// operation, the map for where a unit is right now, the planner for the circuit
// it will run tomorrow, the fleet for the unit itself, and the stock for what
// those units load out of the dépôts.
//
// Kept on disk but unused while the group is disabled for the MVP — the
// eslint-disable keeps the list itself (and its labels) ready for the restore.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const LOGISTICS_ITEMS: MenuItem[] = [
  {
    icon: 'ChartNoAxesCombined',
    label: 'Vue d’ensemble',
    href: '/dashboard/logistics/overview'
  },
  {
    icon: 'MapPinned',
    label: 'Carte live',
    href: '/dashboard/logistics/live-map'
  },
  {
    icon: 'Route',
    label: 'Planificateur',
    href: '/dashboard/logistics/route-planner'
  },
  {
    icon: 'Truck',
    label: 'Flotte & tournées',
    href: '/dashboard/logistics'
  },
  {
    icon: 'Boxes',
    label: 'Stock & dépôts',
    href: '/dashboard/logistics/inventory'
  }
]

// ── Audience-neutral destinations ──
// The catalogue, the messenger and the address book are the three things every
// account uses, whatever its role: a delegate studies the gamme, a doctor checks
// what he was shown, an admin sees what was pitched. They therefore appear in
// EVERY navbar, in the same group, with the same labels.
const SHARED_ITEMS: MenuItem[] = [
  {
    icon: 'Pill',
    label: 'Catalogue VITAL',
    href: '/products/catalog'
  },
  {
    icon: 'MessageSquare',
    label: 'Messagerie',
    href: '/chat'
  },
  {
    icon: 'Contact',
    label: 'Contacts',
    href: '/contacts'
  }
]

// ── Training group (delegate's own work) ──
// Two entries: the personal home (overview + formation KPIs in tabs) and the
// step-by-step simulator. Session history lives inside the Formation tab, and
// the manager relationship is visible from the overview — no separate
// "Mon responsable" tab for a delegate.
const MY_TRAINING_ITEMS: MenuItem[] = [
  {
    icon: 'LayoutDashboard',
    label: 'Vue d’ensemble',
    href: '/dashboard/training'
  },
  {
    icon: 'GraduationCap',
    label: 'Parcours par étapes',
    href: '/dashboard/training/simulator',
    badge: 'Live',
    badgeClassName: 'bg-primary/15 text-primary font-bold'
  },
  {
    icon: 'Trophy',
    label: 'Progression',
    href: '/dashboard/progression'
  },
  {
    icon: 'Medal',
    label: 'Leaderboard',
    href: '/dashboard/leaderboard'
  }
]

// ── Training group as the platform reads it ──
// The same training material, seen for the whole team: aggregate analytics and
// the raw session log. My progression is the delegate's personal home (written
// in the second person), included so an admin can see what the delegate sees,
// and labelled as such.
//
// A "Classement délégués" entry used to sit here, pointing at a template page
// built on invented delegates and scores. A ranking the admin cannot trust is
// worse than no ranking, so it is gone; the real per-delegate figures live in
// Mon équipe, which reads the actual sessions.
//
// A "Sessions & évaluations" entry also used to sit here, pointing at
// /dashboard/training/sessions. That page is deleted: the same log, with the
// same Détail action, is the Historique table inside Formation & étapes, and a
// second copy of a list in the navbar only invites the admin to trust whichever
// one they happened to open.
const TEAM_TRAINING_ITEMS: MenuItem[] = [
  {
    icon: 'LayoutDashboard',
    label: 'Vue délégué (accueil)',
    href: '/dashboard/training'
  },
  {
    icon: 'GraduationCap',
    label: 'Formation & étapes',
    href: '/dashboard/training/simulator',
    badge: 'Live',
    badgeClassName: 'bg-primary/15 text-primary font-bold'
  },
  {
    icon: 'Target',
    label: 'Performance par étape',
    href: '/analytics/step-performance'
  }
]

// ── The other half of the field: the visits themselves ──
// Where the delegate trains against a simulated doctor, here is what reaches the
// real one: the visits and their written-up reports. /dashboard/commercial is
// the operational overview over every session.
//
// This group used to carry a "Calendrier des visites", an "Annuaire médecins"
// and a "Usage produits" entry, all three of them template pages built on
// invented rows. They are deleted rather than hidden: a menu that opens onto
// demonstration data teaches the admin something false about their own team.
// What replaced them is the real thing — the doctor roster in Mes médecins, the
// presentations in Mes présentations, the visits in Visites & comptes rendus.
// Calendar and product-usage come back when they can be built from the stored
// sessions.
const VISIT_ITEMS: MenuItem[] = [
  {
    icon: 'Stethoscope',
    label: 'Visites & comptes rendus',
    href: '/dashboard/commercial'
  }
]

// ── The doctor's own space ──
// The doctor is Vital's client: he does not launch presentations himself — he
// receives ALIA avatar visits scheduled by his delegate, from his calendar
// (docs/14). The generic /commercial flow stays reachable only by direct URL
// for now; the navbar points at the calendar instead.
const MY_CALENDAR_ITEMS: MenuItem[] = [
  {
    icon: 'CalendarDays',
    label: 'Mon calendrier',
    href: '/apps/calendar'
  }
]

// The loyalty portal: points, tier and gifts. The doctor is the client here —
// receiving pitches earns Vital Points, and points buy gifts (docs/14).
const LOYALTY_ITEMS: MenuItem[] = [
  {
    icon: 'Gift',
    label: 'Mon espace fidélité',
    href: '/dashboard/loyalty'
  },
  {
    icon: 'Award',
    label: 'Catalogue cadeaux',
    href: '/dashboard/gifts'
  }
]

// ──────────────────────────────────────
// USER STORY 1 — MEDICAL DELEGATE (Training)
// Own navbar: training tools + the shared destinations. No administration, no
// fleet: those belong to the platform account, and the API answers 403 to a
// delegate anyway.
// ──────────────────────────────────────
export const delegateNavItems: NavItem[] = [
  {
    groupLabel: 'Ma formation',
    items: MY_TRAINING_ITEMS
  },
  {
    groupLabel: 'Partagé',
    items: SHARED_ITEMS
  },
  {
    groupLabel: 'Général',
    items: GENERAL_ITEMS
  },
  {
    groupLabel: 'Aide',
    items: MISCELLANEOUS_ITEMS
  }
]

// ──────────────────────────────────────
// DOCTOR / PHARMACIST (Commercial mode)
// Deliberately small. The doctor's product surface is one interaction — ALIA
// presents a product and the session ends in a visit report — so his navbar
// carries that and the shared destinations, and none of the performance,
// fleet or account furniture the platform account needs.
// ──────────────────────────────────────
export const doctorNavItems: NavItem[] = [
  {
    groupLabel: 'Mon agenda',
    items: MY_CALENDAR_ITEMS
  },
  {
    groupLabel: 'Ma fidélité',
    items: LOYALTY_ITEMS
  },
  {
    groupLabel: 'Partagé',
    items: SHARED_ITEMS
  },
  {
    groupLabel: 'Général',
    items: GENERAL_ITEMS
  },
  {
    groupLabel: 'Aide',
    items: MISCELLANEOUS_ITEMS
  }
]

// ──────────────────────────────────────
// USER STORY 2 — ADMINISTRATEUR (the platform)
// One navbar, grouped by the audience it talks about: the delegates and their
// training, the doctors and pharmacists who receive the visits, then what all
// three accounts share, then operations and administration. It is the union of
// both audiences, which is exactly what the platform account should read.
// ──────────────────────────────────────
export const adminNavItems: NavItem[] = [
  {
    groupLabel: 'Délégués & formation',
    items: TEAM_TRAINING_ITEMS
  },
  {
    groupLabel: 'Médecins & pharmaciens',
    items: VISIT_ITEMS
  },
  {
    groupLabel: 'Partagé',
    items: SHARED_ITEMS
  },

  // Opérations (carte live, planificateur, flotte, stock) is disabled for the
  // MVP focus. The views and routes stay on disk — restore this block when
  // logistics is back on the roadmap.
  // {
  //   groupLabel: 'Opérations',
  //   items: LOGISTICS_ITEMS
  // },
  {
    groupLabel: 'Administration',
    items: ADMINISTRATION_ITEMS
  },
  {
    groupLabel: 'Général',
    items: GENERAL_ITEMS
  },
  {
    groupLabel: 'Aide',
    items: MISCELLANEOUS_ITEMS
  }
]
