import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { DeliveryJobData } from '@hikyaku/shared/constants'
import { deliveries, deliveryAttempts, events } from '@hikyaku/shared/schema'
import { DelayedError, Worker, type Job } from 'bullmq'
import * as backoff from '../../src/backoff.js'
import { queueName } from '@hikyaku/shared/constants/queue'
import { getRedisConnectionOptions } from '../../src/lib/redis.js'
import { asc, eq } from 'drizzle-orm'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '../../../api/src/config.js'
import { getQueue } from '../../../api/src/queue/client.js'
import { createApp } from '../../../api/src/server.js'
import { createTenantWithKey, deleteTenant } from '../../../api/test/helpers/tenant.js'
import { createTenantSession } from '../../../api/test/helpers/user.js'
import '../../src/config.js'
import { getDb } from '../../src/db/client.js'
import { processor } from '../../src/processor.js'

const app = createApp()

function startFixedStatusMockServer(status: number): Promise<{
  port: number
  getRequestCount: () => number
  close: () => Promise<void>
}> {
  let requestCount = 0

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', () => {
      requestCount += 1
      res.writeHead(status)
      res.end(status === 200 ? 'ok' : body || 'error')
    })
  })

  return new Promise((resolve) => {
    server.listen(0, () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      resolve({
        port,
        getRequestCount: () => requestCount,
        close: () =>
          new Promise((closeResolve, closeReject) => {
            server.close((err) => (err ? closeReject(err) : closeResolve()))
          }),
      })
    })
  })
}

function startFlakyMockServer(
  failCount: number,
  failStatus: number,
): Promise<{
  port: number
  getRequestCount: () => number
  close: () => Promise<void>
}> {
  let requestCount = 0

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    req.on('data', () => {})
    req.on('end', () => {
      requestCount += 1
      if (requestCount <= failCount) {
        res.writeHead(failStatus)
        res.end('Service Unavailable')
        return
      }
      res.writeHead(200)
      res.end('ok')
    })
  })

  return new Promise((resolve) => {
    server.listen(0, () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      resolve({
        port,
        getRequestCount: () => requestCount,
        close: () =>
          new Promise((closeResolve, closeReject) => {
            server.close((err) => (err ? closeReject(err) : closeResolve()))
          }),
      })
    })
  })
}

function makeJob(deliveryId: string, tenantId: string): Job<DeliveryJobData> {
  return {
    data: { deliveryId, tenantId, replayCount: 0 },
    moveToDelayed: vi.fn().mockResolvedValue(undefined),
  } as unknown as Job<DeliveryJobData>
}

async function runProcessorUntilSettled(
  deliveryId: string,
  tenantId: string,
  maxRuns: number,
): Promise<void> {
  const db = getDb()

  for (let run = 0; run < maxRuns; run += 1) {
    const [current] = await db
      .select({ status: deliveries.status, nextRetryAt: deliveries.nextRetryAt })
      .from(deliveries)
      .where(eq(deliveries.id, deliveryId))

    if (current?.status === 'succeeded') return
    if (current?.status === 'failed') {
      throw new Error(`delivery ${deliveryId} failed before max runs`)
    }
    if (current?.nextRetryAt && current.nextRetryAt.getTime() > Date.now()) {
      await db
        .update(deliveries)
        .set({ nextRetryAt: new Date(Date.now() - 1_000) })
        .where(eq(deliveries.id, deliveryId))
    }

    try {
      await processor(makeJob(deliveryId, tenantId))
    } catch (err) {
      if (!(err instanceof DelayedError)) throw err
    }
  }

  const [delivery] = await db
    .select({ status: deliveries.status })
    .from(deliveries)
    .where(eq(deliveries.id, deliveryId))
  if (delivery?.status === 'succeeded') return

  throw new Error(`delivery ${deliveryId} did not settle within ${maxRuns} processor runs`)
}

describe('retry integration', () => {
  let tenantId: string
  let apiKey: string
  let agent: ReturnType<typeof request.agent>

  beforeEach(async () => {
    for (const job of await getQueue().getJobs([
      'waiting',
      'delayed',
      'completed',
      'failed',
      'paused',
    ])) {
      await job.remove()
    }
    const tenant = await createTenantWithKey()
    tenantId = tenant.tenantId
    apiKey = tenant.apiKey
    agent = await createTenantSession(app, tenantId)
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    for (const job of await getQueue().getJobs([
      'waiting',
      'delayed',
      'completed',
      'failed',
      'paused',
    ])) {
      await job.remove()
    }
    await deleteTenant(tenantId)
  })

  it('automatically schedules an HTTP retry through BullMQ without manual promotion', async () => {
    const retryDelayMs = 2_000
    vi.spyOn(backoff, 'calculateBackoffDelayMs').mockReturnValue(retryDelayMs)
    const mock = await startFlakyMockServer(1, 503)
    let worker: Worker | undefined
    try {
      const endpoint = await agent.post('/v1/endpoints').send({
        url: `http://127.0.0.1:${mock.port}/hook`,
        description: 'automatic retry',
      })
      expect(endpoint.status).toBe(201)
      const ingest = await request(app)
        .post('/v1/events')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({ idempotency_key: 'automatic-retry', type: 'order.created', payload: {} })
      expect(ingest.status).toBe(202)
      const [delivery] = await getDb()
        .select()
        .from(deliveries)
        .where(eq(deliveries.eventId, ingest.body.id))
      let retryObserved = false
      worker = new Worker(queueName(), processor, {
        connection: getRedisConnectionOptions(),
        concurrency: 1,
      })
      // Use the BullMQ 'delayed' event as the reliable signal — fires the instant
      // the job is moved to the delayed queue, with no polling race.
      worker.on('delayed', async (job) => {
        if (job.data.deliveryId !== delivery.id) return
        retryObserved = true
        expect(mock.getRequestCount()).toBe(1)
        const [current] = await getDb()
          .select()
          .from(deliveries)
          .where(eq(deliveries.id, delivery.id))
        expect(current?.nextRetryAt).not.toBeNull()
        expect(current?.nextRetryAt!.getTime()).toBeGreaterThan(Date.now())
        const delayedJob = (await getQueue().getDelayed()).find(
          (j) => j.data.deliveryId === delivery.id,
        )
        expect(delayedJob).toBeDefined()
      })
      const deadline = Date.now() + 12_000
      let succeeded = false
      while (Date.now() < deadline) {
        const [current] = await getDb()
          .select()
          .from(deliveries)
          .where(eq(deliveries.id, delivery.id))
        if (current?.status === 'succeeded') {
          succeeded = true
          break
        }
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
      expect(retryObserved).toBe(true)
      expect(succeeded).toBe(true)
      expect(mock.getRequestCount()).toBe(2)
      const attempts = await getDb()
        .select()
        .from(deliveryAttempts)
        .where(eq(deliveryAttempts.deliveryId, delivery.id))
        .orderBy(asc(deliveryAttempts.attemptNumber))
      expect(attempts.map((attempt) => attempt.httpStatus)).toEqual([503, 200])
    } finally {
      await worker?.close()
      await mock.close()
    }
  }, 15_000)

  it('succeeds after three 503 responses then 200 (#2)', async () => {
    const mock = await startFlakyMockServer(3, 503)

    const endpointRes = await agent.post('/v1/endpoints').send({
      url: `http://127.0.0.1:${mock.port}/hook`,
      description: 'retry test',
    })

    expect(endpointRes.status).toBe(201)

    const ingestRes = await request(app)
      .post('/v1/events')
      .set('Authorization', `Bearer ${apiKey}`)
      .send({
        idempotency_key: 'retry-test-2',
        type: 'order.created',
        payload: { order_id: 'ord_retry' },
      })

    expect(ingestRes.status).toBe(202)

    const db = getDb()
    const eventId = ingestRes.body.id as string

    const [delivery] = await db.select().from(deliveries).where(eq(deliveries.eventId, eventId))

    await runProcessorUntilSettled(delivery.id, tenantId, 4)

    const [updatedDelivery] = await db
      .select()
      .from(deliveries)
      .where(eq(deliveries.id, delivery.id))

    const attempts = await db
      .select()
      .from(deliveryAttempts)
      .where(eq(deliveryAttempts.deliveryId, delivery.id))
      .orderBy(asc(deliveryAttempts.attemptNumber))

    const [event] = await db.select().from(events).where(eq(events.id, eventId))

    expect(mock.getRequestCount()).toBe(4)
    expect(attempts).toHaveLength(4)
    expect(attempts.map((row) => row.httpStatus)).toEqual([503, 503, 503, 200])
    expect(updatedDelivery.status).toBe('succeeded')
    expect(updatedDelivery.attemptCount).toBe(4)
    expect(event?.status).toBe('completed')

    await mock.close()
  })

  it('fails fast on 400 with a single attempt (#3)', async () => {
    const mock = await startFixedStatusMockServer(400)

    const endpointRes = await agent.post('/v1/endpoints').send({
      url: `http://127.0.0.1:${mock.port}/hook`,
      description: 'fail-fast test',
    })

    expect(endpointRes.status).toBe(201)

    const ingestRes = await request(app)
      .post('/v1/events')
      .set('Authorization', `Bearer ${apiKey}`)
      .send({
        idempotency_key: 'retry-test-3',
        type: 'order.created',
        payload: { order_id: 'ord_failfast' },
      })

    expect(ingestRes.status).toBe(202)

    const db = getDb()
    const eventId = ingestRes.body.id as string

    const [delivery] = await db.select().from(deliveries).where(eq(deliveries.eventId, eventId))

    await processor(makeJob(delivery.id, tenantId))

    const requestCountAfterProcess = mock.getRequestCount()
    await new Promise((resolve) => setTimeout(resolve, 5_000))

    const [updatedDelivery] = await db
      .select()
      .from(deliveries)
      .where(eq(deliveries.id, delivery.id))

    const attempts = await db
      .select()
      .from(deliveryAttempts)
      .where(eq(deliveryAttempts.deliveryId, delivery.id))

    const [event] = await db.select().from(events).where(eq(events.id, eventId))

    expect(requestCountAfterProcess).toBe(1)
    expect(mock.getRequestCount()).toBe(1)
    expect(attempts).toHaveLength(1)
    expect(attempts[0]?.httpStatus).toBe(400)
    expect(updatedDelivery.status).toBe('failed')
    expect(updatedDelivery.attemptCount).toBe(1)
    expect(updatedDelivery.lastError).toBe('http_400')
    expect(event?.status).toBe('failed')

    await mock.close()
  }, 15_000)
})
