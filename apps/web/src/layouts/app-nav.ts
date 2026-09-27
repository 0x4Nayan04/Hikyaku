import type { LucideIcon } from 'lucide-react'
import { LayoutDashboard, List, Package, Send, Settings, Shield, Webhook } from 'lucide-react'

export type AppNavItem = {
  title: string
  to: string
  icon: LucideIcon
  description?: string
  superAdminOnly?: boolean
  tenantOnly?: boolean
}

type AppNavSection = {
  id: string
  label: string
  items: AppNavItem[]
}

export function filterNavSections(
  isSuperAdmin: boolean,
  hasWorkspace = !isSuperAdmin,
): AppNavSection[] {
  return appNavSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.superAdminOnly && !isSuperAdmin) return false
        if (item.tenantOnly && !hasWorkspace) return false
        return true
      }),
    }))
    .filter((section) => section.items.length > 0)
}

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
        title: 'Deliveries',
        to: '/deliveries',
        icon: Package,
        description: 'Outbound deliveries',
        tenantOnly: true,
      },
    ],
  },
  {
    id: 'devtools',
    label: 'Dev tools',
    items: [
      {
        title: 'Test event',
        to: '/events/send',
        icon: Send,
        description: 'Send a real sample webhook',
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
        description: 'Tenants and invitations',
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
