import { describe, expect, it } from 'vitest'
import { hasActiveDeliveryWork, hasPendingEventWork } from './polling-utils'

describe('polling enablement', () => {
  it('polls events only while a loaded event is pending', () => {
    expect(hasPendingEventWork([{ status: 'completed' as const }])).toBe(false)
    expect(hasPendingEventWork([{ status: 'pending' as const }])).toBe(true)
  })

  it('polls deliveries only while loaded work is active', () => {
    expect(hasActiveDeliveryWork([{ status: 'succeeded' as const }])).toBe(false)
    expect(hasActiveDeliveryWork([{ status: 'in_progress' as const }])).toBe(true)
  })
})
