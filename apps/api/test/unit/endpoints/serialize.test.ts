import { describe, expect, it } from 'vitest'
import { toEndpointJson } from '../../../src/routes/endpoints/serialize.js'

describe('toEndpointJson', () => {
  const row = {
    id: '11111111-1111-4111-8111-111111111111',
    url: 'https://example.com/hooks',
    status: 'active',
    description: 'prod',
    createdAt: new Date('2026-07-18T12:00:00.000Z'),
  }

  it('omits last_delivery when not provided', () => {
    expect(toEndpointJson(row)).not.toHaveProperty('last_delivery')
  })

  it('includes null last_delivery for list rows without deliveries', () => {
    expect(toEndpointJson(row, undefined, null)).toMatchObject({
      id: row.id,
      last_delivery: null,
    })
  })

  it('serializes the per-endpoint last delivery', () => {
    expect(
      toEndpointJson(row, undefined, {
        id: '22222222-2222-4222-8222-222222222222',
        status: 'failed',
        updatedAt: new Date('2026-07-18T13:00:00.000Z'),
        lastError: 'timeout',
      }),
    ).toMatchObject({
      last_delivery: {
        id: '22222222-2222-4222-8222-222222222222',
        status: 'failed',
        updated_at: '2026-07-18T13:00:00.000Z',
        last_error: 'timeout',
      },
    })
  })
})
