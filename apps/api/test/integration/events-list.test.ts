import request from 'supertest'
import { events } from '@webhook/shared/schema'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import '../../src/config.js'
import { closePool, getDb } from '../../src/db/client.js'
import { closeRedis } from '../../src/lib/redis.js'
import { queue } from '../../src/queue/client.js'
import { createApp } from '../../src/server.js'
import { beginDeliveryTestIsolation, endDeliveryTestIsolation } from '../helpers/delivery.js'
import { createTenantWithKey, deleteTenant } from '../helpers/tenant.js'
import { createTenantSession } from '../helpers/user.js'

const app = createApp()

describe('GET /v1/events status filter', () => {
  let tenantId: string
  let failedId: string
  let completedId: string
  let agent: ReturnType<typeof request.agent>

  beforeAll(async () => {
    await beginDeliveryTestIsolation()

    const tenant = await createTenantWithKey()
    tenantId = tenant.tenantId
    agent = await createTenantSession(app, tenantId)

    const db = getDb()
    const [failed] = await db
      .insert(events)
      .values({
        tenantId,
        idempotencyKey: 'events-filter-failed',
        type: 'invoice.failed',
        payload: {},
        status: 'failed',
      })
      .returning({ id: events.id })
    const [completed] = await db
      .insert(events)
      .values({
        tenantId,
        idempotencyKey: 'events-filter-completed',
        type: 'invoice.paid',
        payload: {},
        status: 'completed',
      })
      .returning({ id: events.id })

    failedId = failed.id
    completedId = completed.id
  })

  afterAll(async () => {
    await endDeliveryTestIsolation()
    await queue.close()
    await deleteTenant(tenantId)
    await closePool()
    await closeRedis()
  })

  it('returns only events with the requested status', async () => {
    const failed = await agent.get('/v1/events?status=failed')

    expect(failed.status).toBe(200)
    expect(failed.body.data.map((row: { id: string }) => row.id)).toEqual([failedId])
    expect(failed.body.data[0].status).toBe('failed')

    const completed = await agent.get('/v1/events?status=completed')

    expect(completed.status).toBe(200)
    expect(completed.body.data.map((row: { id: string }) => row.id)).toEqual([completedId])

    const invalid = await agent.get('/v1/events?status=paused')

    expect(invalid.status).toBe(400)
    expect(invalid.body).toEqual({
      error: { code: 'validation_error', message: 'Invalid status filter' },
    })
  })
})
