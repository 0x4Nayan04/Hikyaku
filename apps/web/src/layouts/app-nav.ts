import type { LucideIcon } from 'lucide-react'
import {
  ClipboardList,
  LayoutDashboard,
  List,
  Package,
  Send,
  Settings,
  Shield,
  Users,
  Webhook,
} from 'lucide-react'

export type AppNavItem = {
  title: string
  to: string
  icon: LucideIcon
  description?: string
  superAdminOnly?: boolean
  tenantOnly?: boolean
}

export type AppNavSection = {
  id: string
  label: string
  items: AppNavItem[]
}

export function filterNavSections(isSuperAdmin: boolean): AppNavSection[] {
  return appNavSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.superAdminOnly && !isSuperAdmin) return false
        if (item.tenantOnly && isSuperAdmin) return false
        return true
      }),
    }))
    .filter((section) => section.items.length > 0)
}

/** Nav paths that need `NavLink end` — another nav item lives under this prefix. */
export function getNavEndPaths(items: AppNavItem[]): ReadonlySet<string> {
  const paths = items.map((item) => item.to)
  const endPaths = new Set<string>()
  for (const path of paths) {
    if (paths.some((other) => other !== path && other.startsWith(`${path}/`))) {
      endPaths.add(path)
    }
  }
  return endPaths
}

/** Whether a nav item should appear active for the current pathname. */
export function isNavItemActive(
  pathname: string,
  item: AppNavItem,
  allItems: AppNavItem[],
): boolean {
  const matchesSelf = pathname === item.to || pathname.startsWith(`${item.to}/`)
  if (!matchesSelf) return false

  const nestedSibling = allItems.some(
    (other) =>
      other.to !== item.to &&
      other.to.startsWith(`${item.to}/`) &&
      (pathname === other.to || pathname.startsWith(`${other.to}/`)),
  )

  return !nestedSibling
}

const appNavSections: AppNavSection[] = [
  {
    id: 'overview',
    label: 'Overview',
    items: [
      {
        title: 'Dashboard',
        to: '/dashboard',
        icon: LayoutDashboard,
        description: 'Delivery metrics and activity',
        tenantOnly: true,
      },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    items: [
      {
        title: 'Endpoints',
        to: '/endpoints',
        icon: Webhook,
        description: 'Receiver URLs and secrets',
        tenantOnly: true,
      },
      {
        title: 'Events',
        to: '/events',
        icon: List,
        description: 'Ingest log',
        tenantOnly: true,
      },
      {
        title: 'Send event',
        to: '/events/send',
        icon: Send,
        description: 'Send a test event',
        tenantOnly: true,
      },
      {
        title: 'Deliveries',
        to: '/deliveries',
        icon: Package,
        description: 'Outbound attempts',
        tenantOnly: true,
      },
    ],
  },
  {
    id: 'platform',
    label: 'Platform',
    items: [
      {
        title: 'Admin',
        to: '/admin',
        icon: Shield,
        description: 'Tenants and signups',
        superAdminOnly: true,
      },
      {
        title: 'Operators',
        to: '/admin/operators',
        icon: Users,
        description: 'Platform administrators',
        superAdminOnly: true,
      },
      {
        title: 'Audit log',
        to: '/admin/audit',
        icon: ClipboardList,
        description: 'Platform activity',
        superAdminOnly: true,
      },
    ],
  },
  {
    id: 'account',
    label: 'Account',
    items: [
      {
        title: 'Settings',
        to: '/settings',
        icon: Settings,
        description: 'Profile and account settings',
      },
    ],
  },
]
