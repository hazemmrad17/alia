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
    label: 'Settings',
    href: '/settings'
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

// ──────────────────────────────────────
// USER STORY 1 — MEDICAL DELEGATE (Training)
// Own navbar: only training tools + shared utilities.
// ──────────────────────────────────────
export const delegateNavItems: NavItem[] = [
  {
    groupLabel: 'Delegate Training',
    items: [
      {
        icon: 'LayoutDashboard',
        label: 'Dashboard',
        href: '/dashboard/training'
      },
      {
        icon: 'GraduationCap',
        label: 'Training Dashboard',
        href: '/dashboard/training/simulator',
        badge: 'Live',
        badgeClassName: 'bg-primary/15 text-primary font-bold'
      },
      {
        icon: 'Pill',
        label: 'VITAL Products',
        href: '/products/catalog'
      },
      {
        icon: 'MessageSquare',
        label: 'Chat',
        href: '/chat'
      },
      {
        icon: 'Contact',
        label: 'Contacts',
        href: '/contacts'
      }
    ]
  },
  {
    groupLabel: 'General',
    items: GENERAL_ITEMS
  },
  {
    groupLabel: 'Miscellaneous',
    items: MISCELLANEOUS_ITEMS
  }
]

// ──────────────────────────────────────
// USER STORY 2 — DOCTOR / PHARMACIST (Commercial)
// Own navbar: only commercial tools + shared utilities.
// ──────────────────────────────────────
export const commercialNavItems: NavItem[] = [
  {
    groupLabel: 'Doctor Experience',
    items: [
      {
        icon: 'LayoutDashboard',
        label: 'Overview',
        href: '/dashboard/commercial'
      },
      {
        icon: 'Pill',
        label: 'VITAL Products',
        href: '/products/catalog'
      },
      {
        icon: 'Calendar',
        label: 'Consultation Calendar',
        href: '/sessions/calendar'
      },
      {
        icon: 'MessageSquare',
        label: 'Chat',
        href: '/chat'
      },
      {
        icon: 'Contact',
        label: 'Contacts',
        href: '/contacts'
      }
    ]
  },
  {
    groupLabel: 'General',
    items: GENERAL_ITEMS
  },
  {
    groupLabel: 'Miscellaneous',
    items: MISCELLANEOUS_ITEMS
  }
]
