import type { Delivery, Endpoint, EventSummary, Paginated, Stats } from '@/api/types'
import type { OnboardingStep } from '@/lib/tenant-onboarding'

let nextId = 0

/** One recent result per page; nothing is persisted outside this app session. */
export class SavedResult<T> {
  readonly id = ++nextId
  generation = 0
  private saved: { key: string; data: T; savedAt: number } | undefined

  read(key: string): T | undefined {
    if (!this.saved || this.saved.key !== key) return undefined
    if (Date.now() - this.saved.savedAt >= 60_000) {
      this.saved = undefined
      return undefined
    }
    return this.saved.data
  }

  write(key: string, data: T, generation: number): void {
    if (generation !== this.generation) return
    this.saved = { key, data, savedAt: Date.now() }
  }

  clear(): void {
    this.generation += 1
    this.saved = undefined
  }
}

export type DashboardSnapshot = {
  stats: Stats
  hasDisabledEndpoint: boolean
  events: EventSummary[]
  deliveries: Delivery[]
  onboarding: OnboardingStep[] | null
  onboardingError: string | null
  lastUpdated: string
}

export function createPageCache() {
  const dashboard = new SavedResult<DashboardSnapshot>()
  const events = new SavedResult<Paginated<EventSummary>>()
  const deliveries = new SavedResult<Paginated<Delivery>>()
  const endpoints = new SavedResult<Paginated<Endpoint>>()
  return {
    dashboard,
    events,
    deliveries,
    endpoints,
    clear() {
      dashboard.clear()
      events.clear()
      deliveries.clear()
      endpoints.clear()
    },
  }
}
