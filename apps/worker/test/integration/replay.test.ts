import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { deliveries, deliveryAttempts, events } from '@webhook/shared/schema'
import type { Job } from 'bullmq'
import { asc, eq } from 'drizzle-orm'
import request from 'supertest'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '../../../api/src/config.js'
import { closePool as closeApiPool } from '../../../api/src/db/client.js'
import { closeRedis } from '../../../api/src/lib/redis.js'
import { queue } from '../../../api/src/queue/client.js'
import { createApp } from '../../../api/src/server.js'
import { seedDeliveryRow } from '../../../api/test/helpers/delivery.js'
import { createTenantWithKey, deleteTenant } from '../../../api/test/helpers/tenant.js'
import { createTenantSession } from '../../../api/test/helpers/user.js'
import '../../src/config.js'
import { closePool, getDb } from '../../src/db/client.js'
import { processor } from '../../src/processor.js'

// Replay still calls enqueue; keep jobs off Redis so a local worker cannot race processor().
vi.mock('@webhook/shared/enqueueDelivery', () => ({
  enqueueDeliveryJob: vi.fn().mockResolvedValue(undefined),
}))

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
        setStatus: (status) => {
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
  let agent: ReturnType<typeof request.agent>

  beforeEach(async () => {
    await queue.obliterate({ force: true })
    const tenant = await createTenantWithKey()
    tenantId = tenant.tenantId
    agent = await createTenantSession(app, tenantId)
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
    const db = getDb()

    const { deliveryId, eventId } = await seedDeliveryRow({
      tenantId,
      idempotencyKey: 'replay-worker-test',
      endpointUrl: `http://127.0.0.1:${mock.port}/hook`,
      eventType: 'order.created',
      payload: { order_id: 'ord_replay' },
    })

    await processor(makeJob(deliveryId))

    const [failedDelivery] = await db
      .select()
      .from(deliveries)
      .where(eq(deliveries.id, deliveryId))

    expect(failedDelivery.status).toBe('failed')
    expect(failedDelivery.attemptCount).toBe(1)
    expect(mock.getRequestCount()).toBe(1)

    mock.setStatus(200)

    const replayRes = await agent.post(`/v1/deliveries/${deliveryId}/replay`)

    expect(replayRes.status).toBe(202)
    expect(replayRes.body).toEqual({ id: deliveryId, status: 'pending' })

    const [resetDelivery] = await db
      .select()
      .from(deliveries)
      .where(eq(deliveries.id, deliveryId))

    expect(resetDelivery).toMatchObject({
      status: 'pending',
      attemptCount: 0,
      lastError: null,
      nextRetryAt: null,
    })

    const [eventBefore] = await db.select().from(events).where(eq(events.id, eventId))
    expect(eventBefore.status).toBe('pending')

    await processor(makeJob(deliveryId))

    const [succeededDelivery] = await db
      .select()
      .from(deliveries)
      .where(eq(deliveries.id, deliveryId))

    const attempts = await db
      .select()
      .from(deliveryAttempts)
      .where(eq(deliveryAttempts.deliveryId, deliveryId))
      .orderBy(asc(deliveryAttempts.attemptNumber))

    const [eventAfter] = await db.select().from(events).where(eq(events.id, eventId))

    expect(mock.getRequestCount()).toBe(2)
    expect(succeededDelivery.status).toBe('succeeded')
    expect(succeededDelivery.attemptCount).toBe(1)
    expect(succeededDelivery.lastError).toBeNull()
    expect(attempts).toHaveLength(1)
    expect(attempts[0]?.httpStatus).toBe(200)
    expect(attempts[0]?.attemptNumber).toBe(1)
    expect(eventAfter.status).toBe('completed')

    await mock.close()
  })
})
