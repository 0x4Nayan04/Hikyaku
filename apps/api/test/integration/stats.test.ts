import request from 'supertest'
import { eq } from 'drizzle-orm'
import { deliveries, endpoints, events } from '@webhook/shared/schema'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import '../../src/config.js'
import { closePool, getDb } from '../../src/db/client.js'
import { closeRedis } from '../../src/lib/redis.js'
import { loadTenantStats } from '../../src/routes/stats.js'
import { createApp } from '../../src/server.js'
import { createTenantWithKey, deleteTenant } from '../helpers/tenant.js'

const app = createApp()

describe('GET /v1/stats', () => {
  let tenantId: string
  let otherTenantId: string
  let apiKey: string
  beforeAll(async () => {
    const tenant = await createTenantWithKey()
    tenantId = tenant.tenantId
    apiKey = tenant.apiKey

    const other = await createTenantWithKey()
    otherTenantId = other.tenantId

    const db = getDb()

    const endpointRows = await db
      .insert(endpoints)
      .values(
        Array.from({ length: 5 }, (_, index) => ({
          tenantId,
          url: `https://webhook.site/stats-test-${index}`,
          secret: 'whsec_' + 'a'.repeat(32),
        })),
      )
      .returning({ id: endpoints.id })

    const [event] = await db
      .insert(events)
      .values({
        tenantId,
        idempotencyKey: 'stats-test-event',
        type: 'test',
        payload: {},
        status: 'pending',
      })
      .returning({ id: events.id })

    const statuses = ['pending', 'in_progress', 'deferred', 'succeeded', 'failed'] as const
    await db.insert(deliveries).values(
      endpointRows.map((endpoint, index) => ({
        tenantId,
        eventId: event.id,
        endpointId: endpoint.id,
        status: statuses[index],
        attemptCount: statuses[index] === 'pending' || statuses[index] === 'deferred' ? 0 : 1,
        updatedAt: statuses[index] === 'succeeded' || statuses[index] === 'failed' ? new Date() : undefined,
      })),
    )

    await db.insert(events).values({
      tenantId: otherTenantId,
      idempotencyKey: 'other-tenant-event',
      type: 'test',
      payload: {},
      status: 'completed',
    })
  })

  afterAll(async () => {
    await deleteTenant(tenantId)
    await deleteTenant(otherTenantId)
    await closePool()
    await closeRedis()
  })

  it('returns tenant-scoped counts and success rate', async () => {
    const res = await request(app).get('/v1/stats').set('Authorization', `Bearer ${apiKey}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      events_today: 1,
      deliveries_active: 2,
      deliveries_deferred: 1,
      deliveries_succeeded_24h: 1,
      deliveries_failed_24h: 1,
      success_rate_24h: 0.5,
    })
  })

  it('excludes another tenant data when loading stats directly', async () => {
    const stats = await loadTenantStats(otherTenantId)

    expect(stats).toEqual({
      events_today: 1,
      deliveries_active: 0,
      deliveries_deferred: 0,
      deliveries_succeeded_24h: 0,
      deliveries_failed_24h: 0,
      success_rate_24h: null,
    })
  })

  it('returns null success rate when no terminal deliveries in 24h', async () => {
    const db = getDb()
    await db.delete(deliveries).where(eq(deliveries.tenantId, tenantId))

    const res = await request(app).get('/v1/stats').set('Authorization', `Bearer ${apiKey}`)

    expect(res.status).toBe(200)
    expect(res.body.success_rate_24h).toBeNull()
    expect(res.body.deliveries_succeeded_24h).toBe(0)
    expect(res.body.deliveries_failed_24h).toBe(0)
  })
})
