import { QUEUE_NAME } from '@webhook/shared/constants'
import { WORKER_LOCK_DURATION_MS } from '../../src/config.js'
import { deliveries, deliveryAttempts } from '@webhook/shared/schema'
import { Worker } from 'bullmq'
import { and, eq } from 'drizzle-orm'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import '../../../api/src/config.js'
import { closePool as closeApiPool } from '../../../api/src/db/client.js'
import { closeRedis as closeApiRedis } from '../../../api/src/lib/redis.js'
import { queue } from '../../../api/src/queue/client.js'
import { createApp } from '../../../api/src/server.js'
import { createTenantWithKey, deleteTenant } from '../../../api/test/helpers/tenant.js'
import { createTenantSession } from '../../../api/test/helpers/user.js'
import '../../src/config.js'
import { env } from '../../src/config.js'
import { closePool, getDb } from '../../src/db/client.js'
import {
  closeRedis as closeWorkerRedis,
  getRedis,
  getRedisConnectionOptions,
} from '../../src/lib/redis.js'
import { processor } from '../../src/processor.js'

const app = createApp()

type DeliveryCounts = {
  succeeded: number
  pending: number
  inProgress: number
  rateLimited: number
}

function startCountingMockServer(): Promise<{
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
      res.writeHead(200)
      res.end(body.length > 0 ? 'ok' : 'ok')
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

async function clearQueue(): Promise<void> {
  await queue.pause()
  await queue.obliterate({ force: true })
  await queue.resume()
}

async function countDeliveriesByStatus(tenantId: string): Promise<DeliveryCounts> {
  const db = getDb()
  const rows = await db
    .select({ status: deliveries.status, lastError: deliveries.lastError })
    .from(deliveries)
    .where(eq(deliveries.tenantId, tenantId))

  const counts: DeliveryCounts = {
    succeeded: 0,
    pending: 0,
    inProgress: 0,
    rateLimited: 0,
  }

  for (const row of rows) {
    if (row.status === 'succeeded') counts.succeeded += 1
    else if (row.status === 'pending') counts.pending += 1
    else if (row.status === 'in_progress') counts.inProgress += 1
    if (row.lastError === 'rate_limited') counts.rateLimited += 1
  }

  return counts
}

async function waitForDeliveryCounts(
  tenantId: string,
  predicate: (counts: DeliveryCounts) => boolean,
  timeoutMs = 30_000,
): Promise<DeliveryCounts> {
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    const counts = await countDeliveriesByStatus(tenantId)
    if (predicate(counts)) {
      return counts
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  const finalCounts = await countDeliveriesByStatus(tenantId)
  throw new Error(`timed out waiting for delivery counts: ${JSON.stringify(finalCounts)}`)
}

async function promoteDelayedJobs(): Promise<void> {
  const delayed = await queue.getDelayed()
  await Promise.all(delayed.map((job) => job.promote()))
}

async function clearTenantRateLimit(tenantId: string): Promise<void> {
  const redis = getRedis()
  const keys = await redis.keys(`ratelimit:tenant:${tenantId}:*`)
  if (keys.length > 0) await redis.del(...keys)
}

describe('rate limit integration', () => {
  let tenantId: string
  let apiKey: string
  let agent: ReturnType<typeof request.agent>
  let mockServer: Awaited<ReturnType<typeof startCountingMockServer>>

  beforeAll(async () => {
    await clearQueue()

    const tenant = await createTenantWithKey()
    tenantId = tenant.tenantId
    apiKey = tenant.apiKey
    agent = await createTenantSession(app, tenantId)

    mockServer = await startCountingMockServer()

    const endpointRes = await agent.post('/v1/endpoints').send({
      url: `http://127.0.0.1:${mockServer.port}/hook`,
      description: 'rate limit burst',
    })

    expect(endpointRes.status).toBe(201)
  })

  afterAll(async () => {
    await mockServer.close()
    await clearQueue()
    await queue.close()
    await deleteTenant(tenantId)
    await closePool()
    await closeApiPool()
    await closeApiRedis()
    await closeWorkerRedis()
  })

  it('defers deliveries over the tenant burst cap then delivers after refill', async () => {
    const limit = env.RATE_LIMIT_PER_MINUTE
    const eventCount = limit + 10
    const overLimit = eventCount - limit

    await clearTenantRateLimit(tenantId)

    for (let i = 0; i < eventCount; i += 1) {
      const ingestRes = await request(app)
        .post('/v1/events')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({
          idempotency_key: `rate-limit-burst-${i}`,
          type: 'burst.test',
          payload: { index: i },
        })

      expect(ingestRes.status).toBe(202)
    }

    const worker = new Worker(QUEUE_NAME, processor, {
      connection: getRedisConnectionOptions(),
      concurrency: 1,
      lockDuration: WORKER_LOCK_DURATION_MS,
    })

    try {
      const initialCounts = await waitForDeliveryCounts(
        tenantId,
        (counts) =>
          counts.succeeded >= limit &&
          counts.pending >= overLimit - 1 &&
          counts.inProgress === 0 &&
          counts.succeeded + counts.pending === eventCount,
      )

      expect(initialCounts.succeeded).toBeGreaterThanOrEqual(limit)
      expect(initialCounts.pending).toBeGreaterThanOrEqual(overLimit - 1)
      expect(initialCounts.succeeded + initialCounts.pending).toBe(eventCount)
      expect(mockServer.getRequestCount()).toBe(initialCounts.succeeded)
      expect(mockServer.getRequestCount()).toBeLessThanOrEqual(limit + 1)

      const db = getDb()
      const pendingRows = await db
        .select()
        .from(deliveries)
        .where(and(eq(deliveries.tenantId, tenantId), eq(deliveries.status, 'pending')))

      expect(pendingRows.length).toBeGreaterThanOrEqual(overLimit - 1)

      for (const delivery of pendingRows) {
        expect(delivery.attemptCount).toBe(0)
        expect(delivery.lastError).toBeNull()

        const attempts = await db
          .select()
          .from(deliveryAttempts)
          .where(eq(deliveryAttempts.deliveryId, delivery.id))

        expect(attempts).toHaveLength(0)
      }

      await clearTenantRateLimit(tenantId)
      await promoteDelayedJobs()

      const finalCounts = await waitForDeliveryCounts(
        tenantId,
        (counts) =>
          counts.succeeded === eventCount && counts.pending === 0 && counts.inProgress === 0,
      )

      expect(finalCounts.succeeded).toBe(eventCount)
      expect(mockServer.getRequestCount()).toBe(eventCount)
    } finally {
      await worker.close()
    }
  }, 60_000)
})
