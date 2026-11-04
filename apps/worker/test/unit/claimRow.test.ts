import { describe, expect, it } from 'vitest'
import { parseClaimResult } from '../../src/claimRow.js'

const row = {
  id: 'delivery',
  tenant_id: 'tenant',
  event_id: 'event',
  replay_count: 0,
  attempt_count: '1',
  previous_attempt_count: 0,
  event_type: 'order.created',
  event_payload: { ok: true },
  event_created_at: new Date(),
  url: 'https://example.com',
  secret: 'secret',
  endpoint_status: 'active',
}

describe('delivery claim boundary', () => {
  it('accepts PostgreSQL number/string counters and empty claim results', () => {
    expect(parseClaimResult({ rows: [row] })).toMatchObject({
      row: { attemptCount: 1, replayCount: 0, endpointStatus: 'active' },
      previousAttemptCount: 0,
    })
    expect(parseClaimResult({ rows: [] })).toBeNull()
  })
  it.each([
    { rows: null },
    { rows: [null] },
    { rows: [{ ...row, attempt_count: 'NaN' }] },
    { rows: [{ ...row, replay_count: -1 }] },
    { rows: [{ ...row, replay_count: ' ' }] },
    { rows: [{ ...row, event_created_at: 'invalid' }] },
    { rows: [{ ...row, endpoint_status: 'unknown' }] },
    { rows: [{ ...row, tenant_id: 1 }] },
  ])('rejects malformed database results %#', (result) => {
    expect(() => parseClaimResult(result)).toThrow('invalid_delivery_claim')
  })
})
