import { describe, expect, it, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import { EVENT_STATUSES } from '../../src/constants/status.js'
import { reevaluateEventStatus } from '../../src/eventStatus.js'

const dialect = new PgDialect()

describe('reevaluateEventStatus SQL boundary', () => {
  it.each(EVENT_STATUSES)('locks before persisting and accepts %s', async (status) => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ id: 'event-1' }] })
      .mockResolvedValueOnce({ rows: [{ status }] })
    await expect(reevaluateEventStatus('event-1', { execute })).resolves.toBe(status)
    const queries = execute.mock.calls.map(([query]) => dialect.sqlToQuery(query))
    expect(queries[0].sql).toMatch(/FOR UPDATE/)
    expect(queries[0].params).toEqual(['event-1'])
    expect(queries[1].sql).toContain('UPDATE events SET status')
    expect(queries[1].params).toContain('event-1')
  })

  it.each([undefined, null, {}, { rows: [] }, { rows: [null] }, { rows: [{ status: 'unknown' }] }])(
    'rejects a malformed database result instead of asserting its type: %j',
    async (result) => {
      const execute = vi.fn().mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce(result)
      await expect(reevaluateEventStatus('event-1', { execute })).rejects.toThrow(
        'event_status_update_missing_row',
      )
    },
  )

  it('does not compute or write a rollup if the lock statement fails', async () => {
    const execute = vi.fn().mockRejectedValue(new Error('connection lost'))
    await expect(reevaluateEventStatus('event-1', { execute })).rejects.toThrow('connection lost')
    expect(execute).toHaveBeenCalledTimes(1)
  })
})
