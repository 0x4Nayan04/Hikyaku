import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { deliveries, deliveryAttempts, events } from '@webhook/shared/schema'
import type { Job } from 'bullmq'
import { asc, eq } from 'drizzle-orm'
import request from 'supertest'
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import '../../../api/src/config.js'
import { closePool as closeApiPool } from '../../../api/src/db/client.js'
import { closeRedis } from '../../../api/src/lib/redis.js'
import { queue } from '../../../api/src/queue/client.js'
import { createApp } from '../../../api/src/server.js'
import { createTenantWithKey, deleteTenant } from '../../../api/test/helpers/tenant.js'
import '../../src/config.js'
import { closePool, getDb } from '../../src/db/client.js'
import { processor } from '../../src/processor.js'

const app = createApp()

function startSwitchableMockServer(initialStatus: number): Promise<{
  port: number
  setStatus: (status: number) => void
  getRequestCount: () => number
  close: () => Promise<void>
}> {
  let responseStatus = initialStatus
  let requestCount = 0

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    req.on('data', () => {})
    req.on('end', () => {
      requestCount += 1
      res.writeHead(responseStatus)
      res.end(responseStatus === 200 ? 'ok' : 'error')
    })
  })

  return new Promise((resolve) => {
    server.listen(0, () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      resolve({
        port,
        setStatus: (status: number) => {
          responseStatus = status
        },
        getRequestCount: () => requestCount,
        close: () =>
          new Promise((closeResolve, closeReject) => {
            server.close((err) => (err ? closeReject(err) : closeResolve()))
          }),
      })
    })
  })
}

function makeJob(deliveryId: string): Job<{ deliveryId: string }> {
  return { data: { deliveryId } } as Job<{ deliveryId: string }>
}

describe('delivery replay', () => {
  let tenantId: string
  let apiKey: string

  beforeEach(async () => {
    await queue.obliterate({ force: true })
    const tenant = await createTenantWithKey()
    tenantId = tenant.tenantId
    apiKey = tenant.apiKey
  })

  afterEach(async () => {
    await queue.obliterate({ force: true })
    await deleteTenant(tenantId)
  })

  afterAll(async () => {
    await queue.close()
    await closePool()
    await closeApiPool()
    await closeRedis()
  })

  it('reprocesses a replayed failed delivery after status reset', async () => {
    const mock = await startSwitchableMockServer(400)

    const endpointRes = await request(app)
      .post('/v1/endpoints')
      .set('Authorization', `Bearer ${apiKey}`)
      .send({
        url: `http://127.0.0.1:${mock.port}/hook`,
        description: 'replay test',
      })

    expect(endpointRes.status).toBe(201)

    const ingestRes = await request(app)
      .post('/v1/events')
      .set('Authorization', `Bearer ${apiKey}`)
      .send({
        idempotency_key: 'replay-worker-test',
        type: 'order.created',
        payload: { order_id: 'ord_replay' },
      })

    expect(ingestRes.status).toBe(202)

    const db = getDb()
    const eventId = ingestRes.body.id as string

    const [delivery] = await db
      .select()
      .from(deliveries)
      .where(eq(deliveries.eventId, eventId))

    await processor(makeJob(delivery.id))

    const [failedDelivery] = await db
      .select()
      .from(deliveries)
      .where(eq(deliveries.id, delivery.id))

    expect(failedDelivery.status).toBe('failed')
    expect(failedDelivery.attemptCount).toBe(1)
    expect(mock.getRequestCount()).toBe(1)

    mock.setStatus(200)

    const replayRes = await request(app)
      .post(`/v1/deliveries/${delivery.id}/replay`)
      .set('Authorization', `Bearer ${apiKey}`)

    expect(replayRes.status).toBe(202)
    expect(replayRes.body).toEqual({ id: delivery.id, status: 'pending' })

    const [resetDelivery] = await db
      .select()
      .from(deliveries)
      .where(eq(deliveries.id, delivery.id))

    expect(resetDelivery).toMatchObject({
      status: 'pending',
      attemptCount: 0,
      lastError: null,
      nextRetryAt: null,
    })

    const [eventBefore] = await db.select().from(events).where(eq(events.id, eventId))
    expect(eventBefore.status).toBe('pending')

    await processor(makeJob(delivery.id))

    const [succeededDelivery] = await db
      .select()
      .from(deliveries)
      .where(eq(deliveries.id, delivery.id))

    const attempts = await db
      .select()
      .from(deliveryAttempts)
      .where(eq(deliveryAttempts.deliveryId, delivery.id))
      .orderBy(asc(deliveryAttempts.attemptNumber))

    const [eventAfter] = await db.select().from(events).where(eq(events.id, eventId))

    expect(mock.getRequestCount()).toBe(2)
    expect(succeededDelivery.status).toBe('succeeded')
    expect(succeededDelivery.attemptCount).toBe(1)
    expect(succeededDelivery.lastError).toBeNull()
    expect(attempts).toHaveLength(2)
    expect(attempts[0]?.httpStatus).toBe(400)
    expect(attempts[1]?.httpStatus).toBe(200)
    expect(attempts[1]?.attemptNumber).toBe(2)
    expect(eventAfter.status).toBe('completed')

    await mock.close()
  })
})
