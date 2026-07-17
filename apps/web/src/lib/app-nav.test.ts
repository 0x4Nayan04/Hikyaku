import { List, Send, Settings, User } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { filterNavSections, getNavEndPaths, isNavItemActive, type AppNavItem } from '@/layouts/app-nav'

describe('getNavEndPaths', () => {
  it('marks parent paths when a sibling nav item is nested under them', () => {
    const items: AppNavItem[] = [
      { title: 'Events', to: '/events', icon: List },
      { title: 'Send event', to: '/events/send', icon: Send },
      { title: 'Settings', to: '/settings', icon: Settings },
      { title: 'Profile', to: '/settings/profile', icon: User },
    ]

    const endPaths = getNavEndPaths(items)

    expect(endPaths.has('/events')).toBe(true)
    expect(endPaths.has('/settings')).toBe(true)
    expect(endPaths.has('/events/send')).toBe(false)
    expect(endPaths.has('/settings/profile')).toBe(false)
  })
})

describe('isNavItemActive', () => {
  const items: AppNavItem[] = [
    { title: 'Events', to: '/events', icon: List },
    { title: 'Send event', to: '/events/send', icon: Send },
    { title: 'Deliveries', to: '/deliveries', icon: List },
  ]

  const events = items[0]
  const sendEvent = items[1]
  const deliveries = items[2]

  it('highlights Events on the list and detail pages', () => {
    expect(isNavItemActive('/events', events, items)).toBe(true)
    expect(isNavItemActive('/events/101b0b89-b62e-408d-adfa-02bdcae4f589', events, items)).toBe(true)
  })

  it('does not highlight Events on Send event', () => {
    expect(isNavItemActive('/events/send', events, items)).toBe(false)
    expect(isNavItemActive('/events/send', sendEvent, items)).toBe(true)
  })

  it('highlights Deliveries on detail pages', () => {
    expect(isNavItemActive('/deliveries', deliveries, items)).toBe(true)
    expect(isNavItemActive('/deliveries/abc-123', deliveries, items)).toBe(true)
  })
})

describe('filterNavSections', () => {
  it('hides tenant-only routes from super-admins', () => {
    const sections = filterNavSections(true)
    const paths = sections.flatMap((section) => section.items.map((item) => item.to))

    expect(paths).toContain('/admin')
    expect(paths).toContain('/admin/operators')
    expect(paths).toContain('/admin/audit')
    expect(paths).toContain('/settings')
    expect(paths).not.toContain('/dashboard')
    expect(paths).not.toContain('/endpoints')
  })

  it('hides admin routes from tenant operators', () => {
    const sections = filterNavSections(false)
    const paths = sections.flatMap((section) => section.items.map((item) => item.to))

    expect(paths).toContain('/dashboard')
    expect(paths).toContain('/settings')
    expect(paths).not.toContain('/admin')
    expect(paths).not.toContain('/admin/operators')
  })

  it('omits empty sections after filtering', () => {
    const sections = filterNavSections(true)

    expect(sections.find((section) => section.id === 'overview')).toBeUndefined()
    expect(sections.find((section) => section.id === 'operations')).toBeUndefined()
    expect(sections.find((section) => section.id === 'platform')).toBeDefined()
    expect(sections.find((section) => section.id === 'account')).toBeDefined()
  })
})
