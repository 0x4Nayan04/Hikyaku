const seededTenantIds: string[] = []
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { DeliveryJobData } from '@webhook/shared/constants'
import { generateEndpointSecret, verifyPayload } from '@webhook/shared/crypto'
import { deliveries, deliveryAttempts, endpoints, events, tenants } from '@webhook/shared/schema'
import { DelayedError, type Job } from 'bullmq'
import { eq, inArray } from 'drizzle-orm'
import { closePool, getDb } from '../../src/db/client.js'
import { calculateBackoffDelayMs } from '../../src/backoff.js'
import * as httpClient from '../../src/httpClient.js'
import { classifyDeliveryError, isRetryableHttpStatus, processor } from '../../src/processor.js'
import * as rateLimit from '../../src/rateLimit.js'

type CapturedRequest = {
  body: string
  headers: IncomingMessage['headers']
}

function startMockServer(
  onRequest: (req: IncomingMessage, res: ServerResponse) => void,
): Promise<{ port: number; close: () => Promise<void> }> {
  const server = createServer(onRequest)
  return new Promise((resolve) => {
    server.listen(0, () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      resolve({
        port,
        close: () =>
          new Promise((closeResolve, closeReject) => {
            server.close((err) => (err ? closeReject(err) : closeResolve()))
          }),
      })
    })
  })
}

function makeJob(delivery: { id: string; tenantId: string }): Job<DeliveryJobData> {
  return {
    data: { deliveryId: delivery.id, tenantId: delivery.tenantId },
    moveToDelayed: vi.fn().mockResolvedValue(undefined),
  } as unknown as Job<DeliveryJobData>
}

describe('classifyDeliveryError', () => {
  it('classifies AbortError as timeout', () => {
    const err = new DOMException('The operation was aborted', 'AbortError')
    expect(classifyDeliveryError(err)).toBe('timeout')
  })

  it('classifies blocked redirect and too many redirects as terminal errors', () => {
    expect(classifyDeliveryError(new Error('blocked_url: private'))).toBe('blocked_url')
    expect(classifyDeliveryError(new Error('too_many_redirects'))).toBe('too_many_redirects')
  })

  it('classifies other errors as network_error', () => {
    expect(classifyDeliveryError(new TypeError('fetch failed'))).toBe('network_error')
    expect(classifyDeliveryError(new Error('ECONNREFUSED'))).toBe('network_error')
  })
})

describe('isRetryableHttpStatus', () => {
  it.each([
    [408, true],
    [429, true],
    [500, true],
    [503, true],
    [400, false],
    [404, false],
    [422, false],
  ])('classifies HTTP %i as retryable=%s', (status, expected) => {
    expect(isRetryableHttpStatus(status)).toBe(expected)
  })
})

describe('processor', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  afterAll(async () => {
    if (seededTenantIds.length)
      await getDb().delete(tenants).where(inArray(tenants.id, seededTenantIds))
    await closePool()
  })

  it('sets status to in_progress before HTTP POST', async () => {
    const db = getDb()
    let statusDuringRequest: string | undefined
    let attemptDuringRequest: number | undefined
    let deliveryId = ''

    const mock = await startMockServer(async (_req, res) => {
      const [row] = await db.select().from(deliveries).where(eq(deliveries.id, deliveryId))
      statusDuringRequest = row?.status
      attemptDuringRequest = row?.attemptCount
      res.writeHead(200)
      res.end('ok')
    })

    const [tenant] = await db.insert(tenants).values({ name: 'Processor InProgress' }).returning()
    seededTenantIds.push(tenant.id)
    const [endpoint] = await db
      .insert(endpoints)
      .values({
        tenantId: tenant.id,
        url: `http://127.0.0.1:${mock.port}/hook`,
        secret: generateEndpointSecret(),
        status: 'active',
      })
      .returning()
    const [event] = await db
      .insert(events)
      .values({
        tenantId: tenant.id,
        idempotencyKey: 'proc-in-progress-1',
        type: 'test.event',
        payload: {},
      })
      .returning()
    const [delivery] = await db
      .insert(deliveries)
      .values({
        tenantId: tenant.id,
        eventId: event.id,
        endpointId: endpoint.id,
      })
      .returning()

    deliveryId = delivery.id
    await processor(makeJob(delivery))

    expect(statusDuringRequest).toBe('in_progress')
    expect(attemptDuringRequest).toBe(1)

    const [updated] = await db.select().from(deliveries).where(eq(deliveries.id, delivery.id))
    expect(updated.status).toBe('succeeded')

    await mock.close()
  })

  it('delivers signed payload and marks delivery succeeded on 2xx', async () => {
    const db = getDb()
    let captured: CapturedRequest | undefined

    const mock = await startMockServer((req, res) => {
      let body = ''
      req.on('data', (chunk) => {
        body += chunk
      })
      req.on('end', () => {
        captured = { body, headers: req.headers }
        res.writeHead(200)
        res.end('ok')
      })
    })

    const secret = generateEndpointSecret()
    const [tenant] = await db.insert(tenants).values({ name: 'Processor Test' }).returning()
    seededTenantIds.push(tenant.id)
    const [endpoint] = await db
      .insert(endpoints)
      .values({
        tenantId: tenant.id,
        url: `http://127.0.0.1:${mock.port}/hook`,
        secret,
        status: 'active',
      })
      .returning()
    const [event] = await db
      .insert(events)
      .values({
        tenantId: tenant.id,
        idempotencyKey: 'proc-success-1',
        type: 'test.event',
        payload: { x: 1 },
      })
      .returning()
    const [delivery] = await db
      .insert(deliveries)
      .values({
        tenantId: tenant.id,
        eventId: event.id,
        endpointId: endpoint.id,
      })
      .returning()

    await processor(makeJob(delivery))

    const [updated] = await db.select().from(deliveries).where(eq(deliveries.id, delivery.id))
    const attempts = await db
      .select()
      .from(deliveryAttempts)
      .where(eq(deliveryAttempts.deliveryId, delivery.id))

    const [eventRow] = await db.select().from(events).where(eq(events.id, event.id))

    expect(updated.status).toBe('succeeded')
    expect(updated.attemptCount).toBe(1)
    expect(updated.nextRetryAt).toBeNull()
    expect(eventRow?.status).toBe('completed')
    expect(attempts).toHaveLength(1)
    expect(attempts[0]?.httpStatus).toBe(200)
    expect(captured).toBeDefined()

    const parsed = JSON.parse(captured!.body)
    expect(parsed).toEqual({
      id: event.id,
      type: 'test.event',
      created_at: event.createdAt.toISOString(),
      data: { x: 1 },
    })
    expect(captured!.headers['x-webhook-id']).toBe(delivery.id)

    const timestamp = Number(captured!.headers['x-webhook-timestamp'])
    const signature = String(captured!.headers['x-webhook-signature'])
    expect(verifyPayload(secret, timestamp, captured!.body, signature)).toBe(true)

    await mock.close()
  })

  it('delays retryable 5xx using the application backoff', async () => {
    const db = getDb()
    let requestCount = 0

    const mock = await startMockServer((_req, res) => {
      requestCount += 1
      res.writeHead(503)
      res.end('Service Unavailable')
    })

    const [tenant] = await db.insert(tenants).values({ name: 'Processor Retry' }).returning()
    seededTenantIds.push(tenant.id)
    const [endpoint] = await db
      .insert(endpoints)
      .values({
        tenantId: tenant.id,
        url: `http://127.0.0.1:${mock.port}/hook`,
        secret: generateEndpointSecret(),
        status: 'active',
      })
      .returning()
    const [event] = await db
      .insert(events)
      .values({
        tenantId: tenant.id,
        idempotencyKey: 'proc-retry-1',
        type: 'test.event',
        payload: {},
      })
      .returning()
    const [delivery] = await db
      .insert(deliveries)
      .values({
        tenantId: tenant.id,
        eventId: event.id,
        endpointId: endpoint.id,
      })
      .returning()

    const before = Date.now()
    const job = makeJob(delivery)
    await expect(processor(job)).rejects.toThrow(DelayedError)

    const [updated] = await db.select().from(deliveries).where(eq(deliveries.id, delivery.id))
    const attempts = await db
      .select()
      .from(deliveryAttempts)
      .where(eq(deliveryAttempts.deliveryId, delivery.id))

    expect(requestCount).toBe(1)
    expect(updated.status).toBe('pending')
    expect(updated.attemptCount).toBe(1)
    expect(updated.lastError).toBe('http_503')
    expect(updated.nextRetryAt).not.toBeNull()
    expect(updated.nextRetryAt!.getTime()).toBeGreaterThanOrEqual(
      before + calculateBackoffDelayMs(1) - 1_000,
    )
    expect(updated.nextRetryAt!.getTime()).toBeLessThanOrEqual(
      Date.now() + calculateBackoffDelayMs(1) + 1_000,
    )
    expect(attempts).toHaveLength(1)
    expect(attempts[0]?.httpStatus).toBe(503)
    expect(job.moveToDelayed).toHaveBeenCalledWith(updated.nextRetryAt!.getTime(), undefined)

    await mock.close()
  })

  it('sets next_retry_at from backoff after multiple HTTP attempts', async () => {
    const db = getDb()

    const mock = await startMockServer((_req, res) => {
      res.writeHead(503)
      res.end('Service Unavailable')
    })

    const [tenant] = await db.insert(tenants).values({ name: 'Processor Backoff' }).returning()
    seededTenantIds.push(tenant.id)
    const [endpoint] = await db
      .insert(endpoints)
      .values({
        tenantId: tenant.id,
        url: `http://127.0.0.1:${mock.port}/hook`,
        secret: generateEndpointSecret(),
        status: 'active',
      })
      .returning()
    const [event] = await db
      .insert(events)
      .values({
        tenantId: tenant.id,
        idempotencyKey: 'proc-backoff-1',
        type: 'test.event',
        payload: {},
      })
      .returning()
    const [delivery] = await db
      .insert(deliveries)
      .values({
        tenantId: tenant.id,
        eventId: event.id,
        endpointId: endpoint.id,
        attemptCount: 2,
      })
      .returning()

    const before = Date.now()
    await expect(processor(makeJob(delivery))).rejects.toThrow(DelayedError)

    const [updated] = await db.select().from(deliveries).where(eq(deliveries.id, delivery.id))
    const delayMs = calculateBackoffDelayMs(3)

    expect(updated.attemptCount).toBe(3)
    expect(updated.nextRetryAt).not.toBeNull()
    expect(updated.nextRetryAt!.getTime()).toBeGreaterThanOrEqual(before + delayMs - 1_000)
    expect(updated.nextRetryAt!.getTime()).toBeLessThanOrEqual(Date.now() + delayMs + 1_000)

    await mock.close()
  })

  it.each([408, 429])('delays retryable HTTP %i using application backoff', async (status) => {
    const db = getDb()

    const mock = await startMockServer((_req, res) => {
      res.writeHead(status)
      res.end('Retry')
    })

    const [tenant] = await db
      .insert(tenants)
      .values({ name: `Processor Retry ${status}` })
      .returning()
    seededTenantIds.push(tenant.id)
    const [endpoint] = await db
      .insert(endpoints)
      .values({
        tenantId: tenant.id,
        url: `http://127.0.0.1:${mock.port}/hook`,
        secret: generateEndpointSecret(),
        status: 'active',
      })
      .returning()
    const [event] = await db
      .insert(events)
      .values({
        tenantId: tenant.id,
        idempotencyKey: `proc-retry-${status}`,
        type: 'test.event',
        payload: {},
      })
      .returning()
    const [delivery] = await db
      .insert(deliveries)
      .values({
        tenantId: tenant.id,
        eventId: event.id,
        endpointId: endpoint.id,
      })
      .returning()

    await expect(processor(makeJob(delivery))).rejects.toThrow(DelayedError)

    const [updated] = await db.select().from(deliveries).where(eq(deliveries.id, delivery.id))
    const attempts = await db
      .select()
      .from(deliveryAttempts)
      .where(eq(deliveryAttempts.deliveryId, delivery.id))

    expect(updated.status).toBe('pending')
    expect(updated.attemptCount).toBe(1)
    expect(updated.lastError).toBe(`http_${status}`)
    expect(attempts).toHaveLength(1)
    expect(attempts[0]?.httpStatus).toBe(status)

    await mock.close()
  })

  it('delays a timeout using application backoff', async () => {
    const db = getDb()
    const abortErr = new DOMException('The operation was aborted', 'AbortError')
    vi.spyOn(httpClient, 'postWithTimeout').mockRejectedValue(abortErr)

    const [tenant] = await db.insert(tenants).values({ name: 'Processor Timeout' }).returning()
    seededTenantIds.push(tenant.id)
    const [endpoint] = await db
      .insert(endpoints)
      .values({
        tenantId: tenant.id,
        url: 'http://127.0.0.1:9/hook',
        secret: generateEndpointSecret(),
        status: 'active',
      })
      .returning()
    const [event] = await db
      .insert(events)
      .values({
        tenantId: tenant.id,
        idempotencyKey: 'proc-timeout-1',
        type: 'test.event',
        payload: {},
      })
      .returning()
    const [delivery] = await db
      .insert(deliveries)
      .values({
        tenantId: tenant.id,
        eventId: event.id,
        endpointId: endpoint.id,
      })
      .returning()

    await expect(processor(makeJob(delivery))).rejects.toThrow(DelayedError)

    const [updated] = await db.select().from(deliveries).where(eq(deliveries.id, delivery.id))
    const attempts = await db
      .select()
      .from(deliveryAttempts)
      .where(eq(deliveryAttempts.deliveryId, delivery.id))

    expect(updated.status).toBe('pending')
    expect(updated.attemptCount).toBe(1)
    expect(updated.lastError).toBe('timeout')
    expect(attempts).toHaveLength(1)
    expect(attempts[0]?.error).toBe('timeout')
    expect(attempts[0]?.httpStatus).toBeNull()
  })

  it('retries a DNS lookup failure using application backoff', async () => {
    const db = getDb()
    const abortErr = new Error('dns_error: temporary lookup failure')
    vi.spyOn(httpClient, 'postWithTimeout').mockRejectedValue(abortErr)

    const [tenant] = await db.insert(tenants).values({ name: 'Processor DNS' }).returning()
    seededTenantIds.push(tenant.id)
    const [endpoint] = await db
      .insert(endpoints)
      .values({
        tenantId: tenant.id,
        url: 'http://127.0.0.1:9/hook',
        secret: generateEndpointSecret(),
        status: 'active',
      })
      .returning()
    const [event] = await db
      .insert(events)
      .values({
        tenantId: tenant.id,
        idempotencyKey: 'proc-dns-1',
        type: 'test.event',
        payload: {},
      })
      .returning()
    const [delivery] = await db
      .insert(deliveries)
      .values({
        tenantId: tenant.id,
        eventId: event.id,
        endpointId: endpoint.id,
      })
      .returning()

    await expect(processor(makeJob(delivery))).rejects.toThrow(DelayedError)

    const [updated] = await db.select().from(deliveries).where(eq(deliveries.id, delivery.id))
    const attempts = await db
      .select()
      .from(deliveryAttempts)
      .where(eq(deliveryAttempts.deliveryId, delivery.id))

    expect(updated.status).toBe('pending')
    expect(updated.attemptCount).toBe(1)
    expect(updated.lastError).toBe('network_error')
    expect(attempts).toHaveLength(1)
    expect(attempts[0]?.error).toBe('network_error')
    expect(attempts[0]?.httpStatus).toBeNull()
  })

  it('delays a network error using application backoff', async () => {
    const db = getDb()

    const [tenant] = await db.insert(tenants).values({ name: 'Processor Network' }).returning()
    seededTenantIds.push(tenant.id)
    const [endpoint] = await db
      .insert(endpoints)
      .values({
        tenantId: tenant.id,
        url: 'http://127.0.0.1:1/hook',
        secret: generateEndpointSecret(),
        status: 'active',
      })
      .returning()
    const [event] = await db
      .insert(events)
      .values({
        tenantId: tenant.id,
        idempotencyKey: 'proc-network-1',
        type: 'test.event',
        payload: {},
      })
      .returning()
    const [delivery] = await db
      .insert(deliveries)
      .values({
        tenantId: tenant.id,
        eventId: event.id,
        endpointId: endpoint.id,
      })
      .returning()

    await expect(processor(makeJob(delivery))).rejects.toThrow(DelayedError)

    const [updated] = await db.select().from(deliveries).where(eq(deliveries.id, delivery.id))
    const attempts = await db
      .select()
      .from(deliveryAttempts)
      .where(eq(deliveryAttempts.deliveryId, delivery.id))

    expect(updated.status).toBe('pending')
    expect(updated.attemptCount).toBe(1)
    expect(updated.lastError).toBe('network_error')
    expect(attempts).toHaveLength(1)
    expect(attempts[0]?.error).toBe('network_error')
    expect(attempts[0]?.httpStatus).toBeNull()
  })

  it('fails fast on non-retryable 4xx without throwing', async () => {
    const db = getDb()
    let requestCount = 0

    const mock = await startMockServer((_req, res) => {
      requestCount += 1
      res.writeHead(400)
      res.end('Bad Request')
    })

    const [tenant] = await db.insert(tenants).values({ name: 'Processor FailFast' }).returning()
    seededTenantIds.push(tenant.id)
    const [endpoint] = await db
      .insert(endpoints)
      .values({
        tenantId: tenant.id,
        url: `http://127.0.0.1:${mock.port}/hook`,
        secret: generateEndpointSecret(),
        status: 'active',
      })
      .returning()
    const [event] = await db
      .insert(events)
      .values({
        tenantId: tenant.id,
        idempotencyKey: 'proc-failfast-1',
        type: 'test.event',
        payload: {},
      })
      .returning()
    const [delivery] = await db
      .insert(deliveries)
      .values({
        tenantId: tenant.id,
        eventId: event.id,
        endpointId: endpoint.id,
      })
      .returning()

    await processor(makeJob(delivery))

    const [updated] = await db.select().from(deliveries).where(eq(deliveries.id, delivery.id))
    const attempts = await db
      .select()
      .from(deliveryAttempts)
      .where(eq(deliveryAttempts.deliveryId, delivery.id))

    expect(requestCount).toBe(1)
    const [eventRow] = await db.select().from(events).where(eq(events.id, event.id))

    expect(updated.status).toBe('failed')
    expect(updated.lastError).toBe('http_400')
    expect(updated.nextRetryAt).toBeNull()
    expect(eventRow?.status).toBe('failed')
    expect(attempts).toHaveLength(1)
    expect(attempts[0]?.httpStatus).toBe(400)

    await mock.close()
  })

  it('rolls up event status to failed when endpoint is disabled', async () => {
    const db = getDb()

    const mock = await startMockServer((_req, res) => {
      res.writeHead(200)
      res.end('ok')
    })

    const [tenant] = await db.insert(tenants).values({ name: 'Processor Event Rollup' }).returning()
    seededTenantIds.push(tenant.id)
    const [endpoint] = await db
      .insert(endpoints)
      .values({
        tenantId: tenant.id,
        url: `http://127.0.0.1:${mock.port}/hook`,
        secret: generateEndpointSecret(),
        status: 'disabled',
      })
      .returning()
    const [event] = await db
      .insert(events)
      .values({
        tenantId: tenant.id,
        idempotencyKey: 'proc-event-rollup-1',
        type: 'test.event',
        payload: {},
      })
      .returning()
    const [delivery] = await db
      .insert(deliveries)
      .values({
        tenantId: tenant.id,
        eventId: event.id,
        endpointId: endpoint.id,
      })
      .returning()

    await processor(makeJob(delivery))

    const [eventRow] = await db.select().from(events).where(eq(events.id, event.id))
    expect(eventRow?.status).toBe('failed')

    await mock.close()
  })

  it('dead letters on 5th retryable HTTP failure without re-throwing', async () => {
    const db = getDb()

    const mock = await startMockServer((_req, res) => {
      res.writeHead(503)
      res.end('Service Unavailable')
    })

    const [tenant] = await db.insert(tenants).values({ name: 'Processor DeadLetter' }).returning()
    seededTenantIds.push(tenant.id)
    const [endpoint] = await db
      .insert(endpoints)
      .values({
        tenantId: tenant.id,
        url: `http://127.0.0.1:${mock.port}/hook`,
        secret: generateEndpointSecret(),
        status: 'active',
      })
      .returning()
    const [event] = await db
      .insert(events)
      .values({
        tenantId: tenant.id,
        idempotencyKey: 'proc-dead-1',
        type: 'test.event',
        payload: {},
      })
      .returning()
    const [delivery] = await db
      .insert(deliveries)
      .values({
        tenantId: tenant.id,
        eventId: event.id,
        endpointId: endpoint.id,
        attemptCount: 4,
      })
      .returning()

    await processor(makeJob(delivery))

    const [updated] = await db.select().from(deliveries).where(eq(deliveries.id, delivery.id))
    expect(updated.attemptCount).toBe(5)
    expect(updated.status).toBe('failed')
    expect(updated.lastError).toBe('max_attempts')
    expect(updated.nextRetryAt).toBeNull()

    await processor(makeJob(delivery))

    const [final] = await db.select().from(deliveries).where(eq(deliveries.id, delivery.id))
    expect(final.status).toBe('failed')
    expect(final.lastError).toBe('max_attempts')
    expect(final.attemptCount).toBe(5)
    expect(final.nextRetryAt).toBeNull()

    await mock.close()
  })

  it('dead letters on 5th transport failure without re-throwing', async () => {
    const db = getDb()
    const abortErr = new DOMException('The operation was aborted', 'AbortError')
    vi.spyOn(httpClient, 'postWithTimeout').mockRejectedValue(abortErr)

    const [tenant] = await db
      .insert(tenants)
      .values({ name: 'Processor DeadLetter Timeout' })
      .returning()
    seededTenantIds.push(tenant.id)
    const [endpoint] = await db
      .insert(endpoints)
      .values({
        tenantId: tenant.id,
        url: 'http://127.0.0.1:9/hook',
        secret: generateEndpointSecret(),
        status: 'active',
      })
      .returning()
    const [event] = await db
      .insert(events)
      .values({
        tenantId: tenant.id,
        idempotencyKey: 'proc-dead-timeout',
        type: 'test.event',
        payload: {},
      })
      .returning()
    const [delivery] = await db
      .insert(deliveries)
      .values({
        tenantId: tenant.id,
        eventId: event.id,
        endpointId: endpoint.id,
        attemptCount: 4,
      })
      .returning()

    await processor(makeJob(delivery))

    const [updated] = await db.select().from(deliveries).where(eq(deliveries.id, delivery.id))
    expect(updated.attemptCount).toBe(5)
    expect(updated.status).toBe('failed')
    expect(updated.lastError).toBe('max_attempts')
  })

  it('does not count an attempt when max_attempts short-circuits HTTP', async () => {
    const db = getDb()
    let requestCount = 0

    const mock = await startMockServer((_req, res) => {
      requestCount += 1
      res.writeHead(200)
      res.end('ok')
    })

    const [tenant] = await db.insert(tenants).values({ name: 'Processor MaxCap' }).returning()
    seededTenantIds.push(tenant.id)
    const [endpoint] = await db
      .insert(endpoints)
      .values({
        tenantId: tenant.id,
        url: `http://127.0.0.1:${mock.port}/hook`,
        secret: generateEndpointSecret(),
        status: 'active',
      })
      .returning()
    const [event] = await db
      .insert(events)
      .values({
        tenantId: tenant.id,
        idempotencyKey: 'proc-max-cap-1',
        type: 'test.event',
        payload: {},
      })
      .returning()
    const [delivery] = await db
      .insert(deliveries)
      .values({
        tenantId: tenant.id,
        eventId: event.id,
        endpointId: endpoint.id,
        attemptCount: 5,
      })
      .returning()

    await processor(makeJob(delivery))

    const [updated] = await db.select().from(deliveries).where(eq(deliveries.id, delivery.id))
    const attempts = await db
      .select()
      .from(deliveryAttempts)
      .where(eq(deliveryAttempts.deliveryId, delivery.id))

    expect(requestCount).toBe(0)
    expect(updated.status).toBe('failed')
    expect(updated.lastError).toBe('max_attempts')
    expect(updated.attemptCount).toBe(5)
    expect(attempts).toHaveLength(0)

    await mock.close()
  })

  it('increments attempt_count after a real HTTP round-trip', async () => {
    const db = getDb()

    const mock = await startMockServer((_req, res) => {
      res.writeHead(503)
      res.end('Service Unavailable')
    })

    const [tenant] = await db.insert(tenants).values({ name: 'Processor HttpCount' }).returning()
    seededTenantIds.push(tenant.id)
    const [endpoint] = await db
      .insert(endpoints)
      .values({
        tenantId: tenant.id,
        url: `http://127.0.0.1:${mock.port}/hook`,
        secret: generateEndpointSecret(),
        status: 'active',
      })
      .returning()
    const [event] = await db
      .insert(events)
      .values({
        tenantId: tenant.id,
        idempotencyKey: 'proc-http-count-1',
        type: 'test.event',
        payload: {},
      })
      .returning()
    const [delivery] = await db
      .insert(deliveries)
      .values({
        tenantId: tenant.id,
        eventId: event.id,
        endpointId: endpoint.id,
        attemptCount: 2,
      })
      .returning()

    await expect(processor(makeJob(delivery))).rejects.toThrow()

    const [updated] = await db.select().from(deliveries).where(eq(deliveries.id, delivery.id))
    const attempts = await db
      .select()
      .from(deliveryAttempts)
      .where(eq(deliveryAttempts.deliveryId, delivery.id))

    expect(updated.attemptCount).toBe(3)
    expect(attempts).toHaveLength(1)
    expect(attempts[0]?.attemptNumber).toBe(3)
    expect(attempts[0]?.httpStatus).toBe(503)

    await mock.close()
  })

  it('fails immediately when endpoint is disabled without HTTP call', async () => {
    const db = getDb()
    let requestCount = 0

    const mock = await startMockServer((_req, res) => {
      requestCount += 1
      res.writeHead(200)
      res.end('ok')
    })

    const [tenant] = await db.insert(tenants).values({ name: 'Processor Disabled' }).returning()
    seededTenantIds.push(tenant.id)
    const [endpoint] = await db
      .insert(endpoints)
      .values({
        tenantId: tenant.id,
        url: `http://127.0.0.1:${mock.port}/hook`,
        secret: generateEndpointSecret(),
        status: 'disabled',
      })
      .returning()
    const [event] = await db
      .insert(events)
      .values({
        tenantId: tenant.id,
        idempotencyKey: 'proc-disabled-1',
        type: 'test.event',
        payload: {},
      })
      .returning()
    const [delivery] = await db
      .insert(deliveries)
      .values({
        tenantId: tenant.id,
        eventId: event.id,
        endpointId: endpoint.id,
      })
      .returning()

    await processor(makeJob(delivery))

    const [updated] = await db.select().from(deliveries).where(eq(deliveries.id, delivery.id))
    const attempts = await db
      .select()
      .from(deliveryAttempts)
      .where(eq(deliveryAttempts.deliveryId, delivery.id))

    expect(requestCount).toBe(0)
    expect(updated.status).toBe('failed')
    expect(updated.lastError).toBe('endpoint_disabled')
    expect(updated.attemptCount).toBe(1)
    expect(attempts).toHaveLength(1)
    expect(attempts[0]?.error).toBe('endpoint_disabled')
    expect(attempts[0]?.httpStatus).toBeNull()

    await mock.close()
  })

  it('counts a blocked URL rejected before HTTP', async () => {
    const db = getDb()
    const [tenant] = await db.insert(tenants).values({ name: 'Processor BlockedUrl' }).returning()
    seededTenantIds.push(tenant.id)
    const [endpoint] = await db
      .insert(endpoints)
      .values({
        tenantId: tenant.id,
        url: 'ftp://example.com/hook',
        secret: generateEndpointSecret(),
        status: 'active',
      })
      .returning()
    const [event] = await db
      .insert(events)
      .values({
        tenantId: tenant.id,
        idempotencyKey: 'proc-blocked-url-1',
        type: 'test.event',
        payload: {},
      })
      .returning()
    const [delivery] = await db
      .insert(deliveries)
      .values({ tenantId: tenant.id, eventId: event.id, endpointId: endpoint.id })
      .returning()

    await processor(makeJob(delivery))

    const [updated] = await db.select().from(deliveries).where(eq(deliveries.id, delivery.id))
    const attempts = await db
      .select()
      .from(deliveryAttempts)
      .where(eq(deliveryAttempts.deliveryId, delivery.id))

    expect(updated.status).toBe('failed')
    expect(updated.lastError).toBe('blocked_url')
    expect(updated.attemptCount).toBe(1)
    expect(attempts).toHaveLength(1)
    expect(attempts[0]?.error).toBe('blocked_url')
  })

  it('processes a replayed delivery after attempt_count and status reset', async () => {
    const db = getDb()
    let responseStatus = 400

    const mock = await startMockServer((_req, res) => {
      res.writeHead(responseStatus)
      res.end(responseStatus === 200 ? 'ok' : 'error')
    })

    const [tenant] = await db.insert(tenants).values({ name: 'Processor Replay' }).returning()
    seededTenantIds.push(tenant.id)
    const [endpoint] = await db
      .insert(endpoints)
      .values({
        tenantId: tenant.id,
        url: `http://127.0.0.1:${mock.port}/hook`,
        secret: generateEndpointSecret(),
        status: 'active',
      })
      .returning()
    const [event] = await db
      .insert(events)
      .values({
        tenantId: tenant.id,
        idempotencyKey: 'proc-replay-1',
        type: 'test.event',
        payload: {},
      })
      .returning()
    const [delivery] = await db
      .insert(deliveries)
      .values({
        tenantId: tenant.id,
        eventId: event.id,
        endpointId: endpoint.id,
      })
      .returning()

    await processor(makeJob(delivery))

    const [failed] = await db.select().from(deliveries).where(eq(deliveries.id, delivery.id))
    expect(failed.status).toBe('failed')
    expect(failed.attemptCount).toBe(1)

    responseStatus = 200
    await db
      .update(deliveries)
      .set({
        status: 'pending',
        attemptCount: 0,
        lastError: null,
        nextRetryAt: null,
      })
      .where(eq(deliveries.id, delivery.id))
    await db.delete(deliveryAttempts).where(eq(deliveryAttempts.deliveryId, delivery.id))

    await processor(makeJob(delivery))

    const [succeeded] = await db.select().from(deliveries).where(eq(deliveries.id, delivery.id))
    const attempts = await db
      .select()
      .from(deliveryAttempts)
      .where(eq(deliveryAttempts.deliveryId, delivery.id))

    expect(succeeded.status).toBe('succeeded')
    expect(succeeded.attemptCount).toBe(1)
    expect(attempts).toHaveLength(1)
    expect(attempts[0]?.attemptNumber).toBe(1)
    expect(attempts[0]?.httpStatus).toBe(200)

    await mock.close()
  })

  it('defers delivery when rate limit denied without incrementing attempt_count', async () => {
    const db = getDb()
    const retryAt = new Date(Date.now() + 12_000)
    vi.spyOn(rateLimit, 'takeRateLimitToken').mockResolvedValue({
      allowed: false,
      retryAt,
    })
    const postSpy = vi.spyOn(httpClient, 'postWithTimeout')

    const [tenant] = await db.insert(tenants).values({ name: 'Processor RateLimit' }).returning()
    seededTenantIds.push(tenant.id)
    const [endpoint] = await db
      .insert(endpoints)
      .values({
        tenantId: tenant.id,
        url: 'http://127.0.0.1:9/hook',
        secret: generateEndpointSecret(),
        status: 'active',
      })
      .returning()
    const [event] = await db
      .insert(events)
      .values({
        tenantId: tenant.id,
        idempotencyKey: 'proc-rate-limit-1',
        type: 'test.event',
        payload: {},
      })
      .returning()
    const [delivery] = await db
      .insert(deliveries)
      .values({
        tenantId: tenant.id,
        eventId: event.id,
        endpointId: endpoint.id,
        attemptCount: 2,
      })
      .returning()

    const job = makeJob(delivery)
    await expect(processor(job)).rejects.toThrow(DelayedError)

    const [updated] = await db.select().from(deliveries).where(eq(deliveries.id, delivery.id))
    const attempts = await db
      .select()
      .from(deliveryAttempts)
      .where(eq(deliveryAttempts.deliveryId, delivery.id))

    expect(postSpy).not.toHaveBeenCalled()
    expect(job.moveToDelayed).toHaveBeenCalledWith(retryAt.getTime(), undefined)
    expect(updated.status).toBe('pending')
    expect(updated.lastError).toBeNull()
    expect(updated.attemptCount).toBe(2)
    expect(updated.nextRetryAt).toBeNull()
    expect(attempts).toHaveLength(0)

    const [eventRow] = await db.select().from(events).where(eq(events.id, event.id))
    expect(eventRow.status).toBe('pending')
  })

  it('rate-limits legacy jobs that only carry deliveryId', async () => {
    const db = getDb()
    const retryAt = new Date(Date.now() + 12_000)
    const rateLimitSpy = vi.spyOn(rateLimit, 'takeRateLimitToken').mockResolvedValue({
      allowed: false,
      retryAt,
    })
    const postSpy = vi.spyOn(httpClient, 'postWithTimeout')

    const [tenant] = await db.insert(tenants).values({ name: 'Processor Legacy Job' }).returning()
    seededTenantIds.push(tenant.id)
    const [endpoint] = await db
      .insert(endpoints)
      .values({
        tenantId: tenant.id,
        url: 'http://127.0.0.1:9/hook',
        secret: generateEndpointSecret(),
        status: 'active',
      })
      .returning()
    const [event] = await db
      .insert(events)
      .values({
        tenantId: tenant.id,
        idempotencyKey: 'proc-legacy-job-1',
        type: 'test.event',
        payload: {},
      })
      .returning()
    const [delivery] = await db
      .insert(deliveries)
      .values({
        tenantId: tenant.id,
        eventId: event.id,
        endpointId: endpoint.id,
      })
      .returning()

    const job = {
      data: { deliveryId: delivery.id },
      moveToDelayed: vi.fn().mockResolvedValue(undefined),
    } as unknown as Job<DeliveryJobData>
    await expect(processor(job)).rejects.toThrow(DelayedError)

    const [updated] = await db.select().from(deliveries).where(eq(deliveries.id, delivery.id))
    expect(rateLimitSpy).toHaveBeenCalledWith(tenant.id)
    expect(postSpy).not.toHaveBeenCalled()
    expect(job.moveToDelayed).toHaveBeenCalledWith(retryAt.getTime(), undefined)
    expect(updated.status).toBe('pending')
  })

  it('does not mutate a delivery already claimed by another worker', async () => {
    const db = getDb()
    const rateLimitSpy = vi.spyOn(rateLimit, 'takeRateLimitToken').mockResolvedValue({
      allowed: true,
    })
    const [tenant] = await db.insert(tenants).values({ name: 'Processor Claimed' }).returning()
    seededTenantIds.push(tenant.id)
    const [endpoint] = await db
      .insert(endpoints)
      .values({
        tenantId: tenant.id,
        url: 'http://127.0.0.1:9/hook',
        secret: generateEndpointSecret(),
        status: 'active',
      })
      .returning()
    const [event] = await db
      .insert(events)
      .values({
        tenantId: tenant.id,
        idempotencyKey: 'proc-claimed-1',
        type: 'test.event',
        payload: {},
      })
      .returning()
    const [delivery] = await db
      .insert(deliveries)
      .values({
        tenantId: tenant.id,
        eventId: event.id,
        endpointId: endpoint.id,
        status: 'in_progress',
      })
      .returning()

    const job = makeJob(delivery)
    await processor(job)

    const [updated] = await db.select().from(deliveries).where(eq(deliveries.id, delivery.id))
    const attempts = await db
      .select()
      .from(deliveryAttempts)
      .where(eq(deliveryAttempts.deliveryId, delivery.id))

    expect(rateLimitSpy).toHaveBeenCalledWith(tenant.id)
    expect(job.moveToDelayed).not.toHaveBeenCalled()
    expect(updated.status).toBe('in_progress')
    expect(attempts).toHaveLength(0)
  })

  it('does not overwrite a newer in_progress lease after sweeper reclaim', async () => {
    const db = getDb()
    const [tenant] = await db.insert(tenants).values({ name: 'Processor LeaseLost' }).returning()
    seededTenantIds.push(tenant.id)
    const [endpoint] = await db
      .insert(endpoints)
      .values({
        tenantId: tenant.id,
        url: 'http://127.0.0.1:9/hook',
        secret: generateEndpointSecret(),
        status: 'active',
      })
      .returning()
    const [event] = await db
      .insert(events)
      .values({
        tenantId: tenant.id,
        idempotencyKey: 'proc-lease-lost-1',
        type: 'test.event',
        payload: {},
      })
      .returning()
    const [delivery] = await db
      .insert(deliveries)
      .values({
        tenantId: tenant.id,
        eventId: event.id,
        endpointId: endpoint.id,
        status: 'pending',
      })
      .returning()

    vi.spyOn(httpClient, 'postWithTimeout').mockImplementation(async () => {
      const reclaimedAt = new Date(Date.now() + 1_000)
      await db
        .update(deliveries)
        .set({ status: 'pending', updatedAt: reclaimedAt })
        .where(eq(deliveries.id, delivery.id))
      await db
        .update(deliveries)
        .set({ status: 'in_progress', updatedAt: new Date(reclaimedAt.getTime() + 1) })
        .where(eq(deliveries.id, delivery.id))
      return { status: 500, body: 'fail' }
    })

    await processor(makeJob(delivery))

    const [updated] = await db.select().from(deliveries).where(eq(deliveries.id, delivery.id))
    const attempts = await db
      .select()
      .from(deliveryAttempts)
      .where(eq(deliveryAttempts.deliveryId, delivery.id))

    expect(updated.status).toBe('in_progress')
    expect(updated.lastError).toBeNull()
    expect(updated.attemptCount).toBe(1)
    expect(attempts).toHaveLength(0)
  })

  it('fails fast when a redirect target is blocked', async () => {
    const db = getDb()
    vi.spyOn(httpClient, 'postWithTimeout').mockRejectedValue(
      new Error('blocked_url: URL must not target a private or loopback address'),
    )

    const [tenant] = await db
      .insert(tenants)
      .values({ name: 'Processor BlockedRedirect' })
      .returning()
    seededTenantIds.push(tenant.id)
    const [endpoint] = await db
      .insert(endpoints)
      .values({
        tenantId: tenant.id,
        url: 'https://example.com/hook',
        secret: generateEndpointSecret(),
        status: 'active',
      })
      .returning()
    const [event] = await db
      .insert(events)
      .values({
        tenantId: tenant.id,
        idempotencyKey: 'proc-blocked-redirect-1',
        type: 'test.event',
        payload: {},
      })
      .returning()
    const [delivery] = await db
      .insert(deliveries)
      .values({
        tenantId: tenant.id,
        eventId: event.id,
        endpointId: endpoint.id,
      })
      .returning()

    const job = makeJob(delivery)
    await processor(job)

    const [updated] = await db.select().from(deliveries).where(eq(deliveries.id, delivery.id))
    expect(updated.status).toBe('failed')
    expect(updated.lastError).toBe('blocked_url')
    expect(updated.attemptCount).toBe(1)
    expect(job.moveToDelayed).not.toHaveBeenCalled()
  })

  it('keeps a reserved attempt when the outcome write loses the lease', async () => {
    const db = getDb()
    const [tenant] = await db.insert(tenants).values({ name: 'Processor ReserveCrash' }).returning()
    seededTenantIds.push(tenant.id)
    const [endpoint] = await db
      .insert(endpoints)
      .values({
        tenantId: tenant.id,
        url: 'http://127.0.0.1:9/hook',
        secret: generateEndpointSecret(),
        status: 'active',
      })
      .returning()
    const [event] = await db
      .insert(events)
      .values({
        tenantId: tenant.id,
        idempotencyKey: 'proc-reserve-crash',
        type: 'test.event',
        payload: {},
      })
      .returning()
    const [delivery] = await db
      .insert(deliveries)
      .values({ tenantId: tenant.id, eventId: event.id, endpointId: endpoint.id })
      .returning()

    vi.spyOn(httpClient, 'postWithTimeout').mockImplementation(async () => {
      const [during] = await db.select().from(deliveries).where(eq(deliveries.id, delivery.id))
      expect(during?.status).toBe('in_progress')
      expect(during?.attemptCount).toBe(1)
      await db
        .update(deliveries)
        .set({ status: 'pending', updatedAt: new Date(Date.now() + 1_000) })
        .where(eq(deliveries.id, delivery.id))
      return { status: 500, body: 'fail' }
    })

    await processor(makeJob(delivery))

    const [updated] = await db.select().from(deliveries).where(eq(deliveries.id, delivery.id))
    const attempts = await db
      .select()
      .from(deliveryAttempts)
      .where(eq(deliveryAttempts.deliveryId, delivery.id))

    expect(updated.status).toBe('pending')
    expect(updated.attemptCount).toBe(1)
    expect(updated.lastError).toBeNull()
    expect(attempts).toHaveLength(0)
  })

  it('finalizes at the cap after reserved crashes without another HTTP call', async () => {
    const db = getDb()
    let httpCalls = 0
    const [tenant] = await db.insert(tenants).values({ name: 'Processor CapRecovery' }).returning()
    seededTenantIds.push(tenant.id)
    const [endpoint] = await db
      .insert(endpoints)
      .values({
        tenantId: tenant.id,
        url: 'http://127.0.0.1:9/hook',
        secret: generateEndpointSecret(),
        status: 'active',
      })
      .returning()
    const [event] = await db
      .insert(events)
      .values({
        tenantId: tenant.id,
        idempotencyKey: 'proc-cap-recovery',
        type: 'test.event',
        payload: {},
      })
      .returning()
    const [delivery] = await db
      .insert(deliveries)
      .values({
        tenantId: tenant.id,
        eventId: event.id,
        endpointId: endpoint.id,
        attemptCount: 4,
      })
      .returning()

    vi.spyOn(httpClient, 'postWithTimeout').mockImplementation(async () => {
      httpCalls += 1
      await db
        .update(deliveries)
        .set({ status: 'pending', updatedAt: new Date(Date.now() + 1_000) })
        .where(eq(deliveries.id, delivery.id))
      return { status: 500, body: 'fail' }
    })

    await processor(makeJob(delivery))

    const [crashed] = await db.select().from(deliveries).where(eq(deliveries.id, delivery.id))
    expect(httpCalls).toBe(1)
    expect(crashed.status).toBe('pending')
    expect(crashed.attemptCount).toBe(5)

    await processor(makeJob(delivery))

    const [final] = await db.select().from(deliveries).where(eq(deliveries.id, delivery.id))
    const [eventRow] = await db.select().from(events).where(eq(events.id, event.id))
    const attempts = await db
      .select()
      .from(deliveryAttempts)
      .where(eq(deliveryAttempts.deliveryId, delivery.id))

    expect(httpCalls).toBe(1)
    expect(final.status).toBe('failed')
    expect(final.attemptCount).toBe(5)
    expect(final.lastError).toBe('max_attempts')
    expect(eventRow?.status).toBe('failed')
    expect(attempts).toHaveLength(0)
  })

  it('does not send before next_retry_at when the delay was not scheduled', async () => {
    const db = getDb()
    let requestCount = 0
    const mock = await startMockServer((_req, res) => {
      requestCount += 1
      res.writeHead(503)
      res.end('unavailable')
    })

    const [tenant] = await db.insert(tenants).values({ name: 'Processor EarlyRetry' }).returning()
    seededTenantIds.push(tenant.id)
    const [endpoint] = await db
      .insert(endpoints)
      .values({
        tenantId: tenant.id,
        url: `http://127.0.0.1:${mock.port}/hook`,
        secret: generateEndpointSecret(),
        status: 'active',
      })
      .returning()
    const [event] = await db
      .insert(events)
      .values({
        tenantId: tenant.id,
        idempotencyKey: 'proc-early-retry',
        type: 'test.event',
        payload: {},
      })
      .returning()
    const [delivery] = await db
      .insert(deliveries)
      .values({ tenantId: tenant.id, eventId: event.id, endpointId: endpoint.id })
      .returning()

    const job = makeJob(delivery)
    job.moveToDelayed = vi.fn().mockRejectedValue(new Error('crash-before-delay'))
    await expect(processor(job)).rejects.toThrow('crash-before-delay')

    const [retried] = await db.select().from(deliveries).where(eq(deliveries.id, delivery.id))
    expect(requestCount).toBe(1)
    expect(retried.status).toBe('pending')
    expect(retried.attemptCount).toBe(1)
    expect(retried.nextRetryAt).not.toBeNull()

    await processor(makeJob(delivery))

    const [early] = await db.select().from(deliveries).where(eq(deliveries.id, delivery.id))
    expect(requestCount).toBe(1)
    expect(early.attemptCount).toBe(1)
    expect(early.status).toBe('pending')
    expect(early.nextRetryAt?.getTime()).toBe(retried.nextRetryAt?.getTime())

    await db
      .update(deliveries)
      .set({ nextRetryAt: new Date(Date.now() - 1_000) })
      .where(eq(deliveries.id, delivery.id))

    await expect(processor(makeJob(delivery))).rejects.toThrow(DelayedError)
    const [due] = await db.select().from(deliveries).where(eq(deliveries.id, delivery.id))
    expect(requestCount).toBe(2)
    expect(due.attemptCount).toBe(2)
    expect(due.status).toBe('pending')

    await mock.close()
  })

  it('does not claim a delivery whose next_retry_at is still in the future', async () => {
    const db = getDb()
    const postSpy = vi.spyOn(httpClient, 'postWithTimeout')
    const retryAt = new Date(Date.now() + 60_000)
    const [tenant] = await db.insert(tenants).values({ name: 'Processor FutureRetry' }).returning()
    seededTenantIds.push(tenant.id)
    const [endpoint] = await db
      .insert(endpoints)
      .values({
        tenantId: tenant.id,
        url: 'http://127.0.0.1:9/hook',
        secret: generateEndpointSecret(),
        status: 'active',
      })
      .returning()
    const [event] = await db
      .insert(events)
      .values({
        tenantId: tenant.id,
        idempotencyKey: 'proc-future-retry',
        type: 'test.event',
        payload: {},
      })
      .returning()
    const [delivery] = await db
      .insert(deliveries)
      .values({
        tenantId: tenant.id,
        eventId: event.id,
        endpointId: endpoint.id,
        attemptCount: 1,
        nextRetryAt: retryAt,
        lastError: 'http_503',
      })
      .returning()

    await processor(makeJob(delivery))

    const [updated] = await db.select().from(deliveries).where(eq(deliveries.id, delivery.id))
    expect(postSpy).not.toHaveBeenCalled()
    expect(updated.status).toBe('pending')
    expect(updated.attemptCount).toBe(1)
    expect(updated.nextRetryAt?.getTime()).toBe(retryAt.getTime())
  })

  it('does not commit an outcome after a new replay run starts', async () => {
    const db = getDb()
    const [tenant] = await db.insert(tenants).values({ name: 'Processor ReplayRun' }).returning()
    seededTenantIds.push(tenant.id)
    const [endpoint] = await db
      .insert(endpoints)
      .values({
        tenantId: tenant.id,
        url: 'http://127.0.0.1:9/hook',
        secret: generateEndpointSecret(),
        status: 'active',
      })
      .returning()
    const [event] = await db
      .insert(events)
      .values({
        tenantId: tenant.id,
        idempotencyKey: 'proc-replay-run',
        type: 'test.event',
        payload: {},
      })
      .returning()
    const [delivery] = await db
      .insert(deliveries)
      .values({ tenantId: tenant.id, eventId: event.id, endpointId: endpoint.id })
      .returning()

    vi.spyOn(httpClient, 'postWithTimeout').mockImplementation(async () => {
      await db
        .update(deliveries)
        .set({
          status: 'pending',
          attemptCount: 0,
          replayCount: 1,
          lastError: null,
          nextRetryAt: null,
          updatedAt: new Date(Date.now() + 1_000),
        })
        .where(eq(deliveries.id, delivery.id))
      return { status: 200, body: 'ok' }
    })

    await processor(makeJob(delivery))

    const [updated] = await db.select().from(deliveries).where(eq(deliveries.id, delivery.id))
    const attempts = await db
      .select()
      .from(deliveryAttempts)
      .where(eq(deliveryAttempts.deliveryId, delivery.id))

    expect(updated.status).toBe('pending')
    expect(updated.attemptCount).toBe(0)
    expect(updated.replayCount).toBe(1)
    expect(attempts).toHaveLength(0)
  })

  it('retries a truncated 200 response', async () => {
    const db = getDb()
    const mock = await startMockServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.write('partial')
      res.destroy()
    })

    const [tenant] = await db.insert(tenants).values({ name: 'Processor Truncated' }).returning()
    seededTenantIds.push(tenant.id)
    const [endpoint] = await db
      .insert(endpoints)
      .values({
        tenantId: tenant.id,
        url: `http://127.0.0.1:${mock.port}/hook`,
        secret: generateEndpointSecret(),
        status: 'active',
      })
      .returning()
    const [event] = await db
      .insert(events)
      .values({
        tenantId: tenant.id,
        idempotencyKey: 'proc-truncated-200',
        type: 'test.event',
        payload: {},
      })
      .returning()
    const [delivery] = await db
      .insert(deliveries)
      .values({ tenantId: tenant.id, eventId: event.id, endpointId: endpoint.id })
      .returning()

    await expect(processor(makeJob(delivery))).rejects.toThrow(DelayedError)

    const [updated] = await db.select().from(deliveries).where(eq(deliveries.id, delivery.id))
    const attempts = await db
      .select()
      .from(deliveryAttempts)
      .where(eq(deliveryAttempts.deliveryId, delivery.id))

    expect(updated.status).toBe('pending')
    expect(updated.attemptCount).toBe(1)
    expect(attempts).toHaveLength(1)
    expect(attempts[0]?.error).toBe('network_error')
    expect(attempts[0]?.httpStatus).toBeNull()

    await mock.close()
  })
})
