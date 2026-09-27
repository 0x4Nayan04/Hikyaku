import request from 'supertest'
import { eq } from 'drizzle-orm'
import { deliveries, deliveryAttempts } from '@webhook/shared/schema'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import '../../src/config.js'
import { closePool, getDb } from '../../src/db/client.js'
import { closeRedis } from '../../src/lib/redis.js'
import { queue } from '../../src/queue/client.js'
import { createApp } from '../../src/server.js'
import {
  beginDeliveryTestIsolation,
  endDeliveryTestIsolation,
  seedDeliveryRow,
} from '../helpers/delivery.js'
import { createTenantWithKey, deleteTenant } from '../helpers/tenant.js'
import { createTenantSession } from '../helpers/user.js'

const app = createApp()

describe('GET /v1/deliveries', () => {
  let tenantId: string
  let deliveryId: string
  let eventId: string
  let endpointId: string
  let agent: ReturnType<typeof request.agent>

  beforeAll(async () => {
    await beginDeliveryTestIsolation()

    const tenant = await createTenantWithKey()
    tenantId = tenant.tenantId
    agent = await createTenantSession(app, tenantId)

    const seeded = await seedDeliveryRow({
      tenantId,
      idempotencyKey: 'delivery-list-test',
    })
    endpointId = seeded.endpointId
    eventId = seeded.eventId
    deliveryId = seeded.deliveryId

    const db = getDb()
    await db.insert(deliveryAttempts).values({
      deliveryId,
      attemptNumber: 1,
      httpStatus: 200,
      responseBody: '{"ok":true}',
      error: null,
      durationMs: 145,
    })
  })

  afterAll(async () => {
    await endDeliveryTestIsolation()
    await queue.close()
    await deleteTenant(tenantId)
    await closePool()
    await closeRedis()
  })

  it('lists deliveries for the authenticated tenant', async () => {
    const res = await agent.get('/v1/deliveries')

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      has_more: false,
      limit: 50,
      offset: 0,
    })
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0]).toMatchObject({
      id: deliveryId,
      event_id: eventId,
      endpoint_id: endpointId,
      endpoint_url: 'https://webhook.site/test',
      status: 'pending',
      attempt_count: 0,
      next_retry_at: null,
      last_error: null,
    })
    expect(res.body.data[0].created_at).toEqual(expect.any(String))
    expect(res.body.data[0].updated_at).toEqual(expect.any(String))
  })

  it('filters deliveries by status', async () => {
    const res = await agent.get('/v1/deliveries?status=pending')

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].id).toBe(deliveryId)

    const empty = await agent.get('/v1/deliveries?status=succeeded')

    expect(empty.status).toBe(200)
    expect(empty.body.data).toHaveLength(0)
    expect(empty.body.has_more).toBe(false)

    const open = await agent.get('/v1/deliveries?status=open&updated_within=24h')

    expect(open.status).toBe(200)
    expect(open.body.data.map((row: { id: string }) => row.id)).toContain(deliveryId)

    const outsideWindow = await agent.get('/v1/deliveries?updated_within=1h')

    expect(outsideWindow.status).toBe(400)
    expect(outsideWindow.body).toEqual({
      error: { code: 'validation_error', message: 'Invalid updated_within filter' },
    })
  })

  it('filters deliveries by event_id', async () => {
    const res = await agent.get(`/v1/deliveries?event_id=${eventId}`)

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].id).toBe(deliveryId)
    expect(res.body.data[0].event_id).toBe(eventId)

    const empty = await agent.get('/v1/deliveries?event_id=880e8400-e29b-41d4-a716-446655440099')

    expect(empty.status).toBe(200)
    expect(empty.body.data).toHaveLength(0)
    expect(empty.body.has_more).toBe(false)
  })

  it('combines open, inclusive updated-time and event filters before pagination', async () => {
    const tenant = await createTenantWithKey()
    const filteredAgent = await createTenantSession(app, tenant.tenantId)
    const now = Date.now()
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now)
    const cutoff = now - 24 * 60 * 60 * 1000
    const rows: Array<{ id: string; eventId: string; status: string; updatedAt: number }> = []
    try {
      for (const status of ['pending', 'in_progress', 'succeeded', 'failed'] as const) {
        for (const updatedAt of [cutoff - 1, cutoff, now]) {
          const row = await seedDeliveryRow({
            tenantId: tenant.tenantId,
            idempotencyKey: `filter-${status}-${updatedAt}`,
            deliveryStatus: status,
          })
          await getDb()
            .update(deliveries)
            .set({
              updatedAt: new Date(updatedAt),
              createdAt: new Date(now - rows.length * 1000),
            })
            .where(eq(deliveries.id, row.deliveryId))
          rows.push({ id: row.deliveryId, eventId: row.eventId, status, updatedAt })
        }
      }
      const openRows = rows.filter((row) => ['pending', 'in_progress'].includes(row.status))
      const recentRows = rows.filter((row) => row.updatedAt >= cutoff)
      const recentOpen = openRows.filter((row) => row.updatedAt >= cutoff)
      for (const [query, expected] of [
        ['status=open', openRows],
        ['updated_within=24h', recentRows],
        ['status=open&updated_within=24h', recentOpen],
        ['status=failed&updated_within=24h', recentRows.filter((row) => row.status === 'failed')],
        [`status=open&updated_within=24h&event_id=${recentOpen[0].eventId}`, [recentOpen[0]]],
        [`status=open&updated_within=24h&event_id=${rows[0].eventId}`, []],
        [`status=open&event_id=${eventId}`, []],
      ] as const) {
        const response = await filteredAgent.get(`/v1/deliveries?${query}`)
        expect(response.status).toBe(200)
        expect(response.body.data.map((row: { id: string }) => row.id)).toEqual(
          expected.map((row) => row.id),
        )
      }
      const response = await filteredAgent.get(
        '/v1/deliveries?status=open&updated_within=24h&limit=2&offset=1',
      )
      expect(response.body.data.map((row: { id: string }) => row.id)).toEqual(
        recentOpen.slice(1, 3).map((row) => row.id),
      )
      expect(response.body.has_more).toBe(true)
    } finally {
      clock.mockRestore()
      await deleteTenant(tenant.tenantId)
    }
  })

  it('rejects an invalid event_id filter', async () => {
    const res = await agent.get('/v1/deliveries?event_id=not-a-uuid')

    expect(res.status).toBe(400)
    expect(res.body).toEqual({
      error: { code: 'validation_error', message: 'Invalid event_id filter' },
    })
  })

  it('returns delivery detail with attempt timeline', async () => {
    const res = await agent.get(`/v1/deliveries/${deliveryId}`)

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      id: deliveryId,
      event_id: eventId,
      endpoint_id: endpointId,
      endpoint_url: 'https://webhook.site/test',
      status: 'pending',
      attempt_count: 0,
      next_retry_at: null,
      last_error: null,
    })
    expect(res.body.attempts).toHaveLength(1)
    expect(res.body.attempts[0]).toMatchObject({
      attempt_number: 1,
      http_status: 200,
      response_body: '{"ok":true}',
      error: null,
      duration_ms: 145,
    })
    expect(res.body.attempts[0].created_at).toEqual(expect.any(String))
  })

  it('returns 404 for a missing delivery', async () => {
    const res = await agent.get('/v1/deliveries/880e8400-e29b-41d4-a716-446655440099')

    expect(res.status).toBe(404)
    expect(res.body).toEqual({
      error: { code: 'not_found', message: 'Delivery not found' },
    })
  })

  it('does not expose the delivery SSE stream', async () => {
    const res = await agent.get('/v1/deliveries/stream')

    expect(res.status).toBe(404)
  })
})
