import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { RATE_LIMIT_DEFER_MS } from '@webhook/shared/constants'
import { generateEndpointSecret, verifyPayload } from '@webhook/shared/crypto'
import { deliveries, deliveryAttempts, endpoints, events, tenants } from '@webhook/shared/schema'
import { DelayedError, type Job } from 'bullmq'
import { eq } from 'drizzle-orm'
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

function makeJob(deliveryId: string): Job<{ deliveryId: string }> {
  return {
    data: { deliveryId },
    moveToDelayed: vi.fn().mockResolvedValue(undefined),
  } as unknown as Job<{ deliveryId: string }>
}

describe('classifyDeliveryError', () => {
  it('classifies AbortError as timeout', () => {
    const err = new DOMException('The operation was aborted', 'AbortError')
    expect(classifyDeliveryError(err)).toBe('timeout')
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
    await closePool()
  })

  it('sets status to in_progress before HTTP POST', async () => {
    const db = getDb()
    let statusDuringRequest: string | undefined
    let deliveryId = ''

    const mock = await startMockServer(async (_req, res) => {
      const [row] = await db.select().from(deliveries).where(eq(deliveries.id, deliveryId))
      statusDuringRequest = row?.status
      res.writeHead(200)
      res.end('ok')
    })

    const [tenant] = await db.insert(tenants).values({ name: 'Processor InProgress' }).returning()
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
    await processor(makeJob(delivery.id))

    expect(statusDuringRequest).toBe('in_progress')

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

    await processor(makeJob(delivery.id))

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

  it('throws for retryable 5xx status to trigger BullMQ backoff', async () => {
    const db = getDb()
    let requestCount = 0

    const mock = await startMockServer((_req, res) => {
      requestCount += 1
      res.writeHead(503)
      res.end('Service Unavailable')
    })

    const [tenant] = await db.insert(tenants).values({ name: 'Processor Retry' }).returning()
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
    await expect(processor(makeJob(delivery.id))).rejects.toThrow()

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

    await mock.close()
  })

  it('sets next_retry_at from backoff after multiple HTTP attempts', async () => {
    const db = getDb()

    const mock = await startMockServer((_req, res) => {
      res.writeHead(503)
      res.end('Service Unavailable')
    })

    const [tenant] = await db.insert(tenants).values({ name: 'Processor Backoff' }).returning()
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
    await expect(processor(makeJob(delivery.id))).rejects.toThrow()

    const [updated] = await db.select().from(deliveries).where(eq(deliveries.id, delivery.id))
    const delayMs = calculateBackoffDelayMs(3)

    expect(updated.attemptCount).toBe(3)
    expect(updated.nextRetryAt).not.toBeNull()
    expect(updated.nextRetryAt!.getTime()).toBeGreaterThanOrEqual(before + delayMs - 1_000)
    expect(updated.nextRetryAt!.getTime()).toBeLessThanOrEqual(Date.now() + delayMs + 1_000)

    await mock.close()
  })

  it.each([408, 429])('throws for retryable HTTP %i to trigger BullMQ backoff', async (status) => {
    const db = getDb()

    const mock = await startMockServer((_req, res) => {
      res.writeHead(status)
      res.end('Retry')
    })

    const [tenant] = await db
      .insert(tenants)
      .values({ name: `Processor Retry ${status}` })
      .returning()
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

    await expect(processor(makeJob(delivery.id))).rejects.toThrow()

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

  it('throws on timeout to trigger BullMQ backoff', async () => {
    const db = getDb()
    const abortErr = new DOMException('The operation was aborted', 'AbortError')
    vi.spyOn(httpClient, 'postWithTimeout').mockRejectedValue(abortErr)

    const [tenant] = await db.insert(tenants).values({ name: 'Processor Timeout' }).returning()
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

    await expect(processor(makeJob(delivery.id))).rejects.toThrow('timeout')

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

  it('throws on network error to trigger BullMQ backoff', async () => {
    const db = getDb()

    const [tenant] = await db.insert(tenants).values({ name: 'Processor Network' }).returning()
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

    await expect(processor(makeJob(delivery.id))).rejects.toThrow('network_error')

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

    await processor(makeJob(delivery.id))

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

    await processor(makeJob(delivery.id))

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

    await processor(makeJob(delivery.id))

    const [updated] = await db.select().from(deliveries).where(eq(deliveries.id, delivery.id))
    expect(updated.attemptCount).toBe(5)
    expect(updated.status).toBe('failed')
    expect(updated.lastError).toBe('max_attempts')
    expect(updated.nextRetryAt).toBeNull()

    await processor(makeJob(delivery.id))

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

    await processor(makeJob(delivery.id))

    const [updated] = await db.select().from(deliveries).where(eq(deliveries.id, delivery.id))
    expect(updated.attemptCount).toBe(5)
    expect(updated.status).toBe('failed')
    expect(updated.lastError).toBe('max_attempts')
  })

  it('does not increment attempt_count on max_attempts short-circuit', async () => {
    const db = getDb()
    let requestCount = 0

    const mock = await startMockServer((_req, res) => {
      requestCount += 1
      res.writeHead(200)
      res.end('ok')
    })

    const [tenant] = await db.insert(tenants).values({ name: 'Processor MaxCap' }).returning()
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

    await processor(makeJob(delivery.id))

    const [updated] = await db.select().from(deliveries).where(eq(deliveries.id, delivery.id))
    const attempts = await db
      .select()
      .from(deliveryAttempts)
      .where(eq(deliveryAttempts.deliveryId, delivery.id))

    expect(requestCount).toBe(0)
    expect(updated.status).toBe('failed')
    expect(updated.lastError).toBe('max_attempts')
    expect(updated.attemptCount).toBe(5)
    expect(attempts).toHaveLength(1)
    expect(attempts[0]?.error).toBe('max_attempts')
    expect(attempts[0]?.httpStatus).toBeNull()

    await mock.close()
  })

  it('increments attempt_count only after a real HTTP round-trip', async () => {
    const db = getDb()

    const mock = await startMockServer((_req, res) => {
      res.writeHead(503)
      res.end('Service Unavailable')
    })

    const [tenant] = await db.insert(tenants).values({ name: 'Processor HttpCount' }).returning()
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

    await expect(processor(makeJob(delivery.id))).rejects.toThrow()

    const [updated] = await db.select().from(deliveries).where(eq(deliveries.id, delivery.id))
    const attempts = await db
      .select()
      .from(deliveryAttempts)
      .where(eq(deliveryAttempts.deliveryId, delivery.id))

    expect(updated.attemptCount).toBe(3)
    expect(attempts).toHaveLength(1)
    expect(attempts[0]?.attemptNumber).toBe(1)
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

    await processor(makeJob(delivery.id))

    const [updated] = await db.select().from(deliveries).where(eq(deliveries.id, delivery.id))
    const attempts = await db
      .select()
      .from(deliveryAttempts)
      .where(eq(deliveryAttempts.deliveryId, delivery.id))

    expect(requestCount).toBe(0)
    expect(updated.status).toBe('failed')
    expect(updated.lastError).toBe('endpoint_disabled')
    expect(updated.attemptCount).toBe(0)
    expect(attempts).toHaveLength(1)
    expect(attempts[0]?.error).toBe('endpoint_disabled')
    expect(attempts[0]?.httpStatus).toBeNull()

    await mock.close()
  })

  it('processes a replayed delivery after attempt_count and status reset', async () => {
    const db = getDb()
    let responseStatus = 400

    const mock = await startMockServer((_req, res) => {
      res.writeHead(responseStatus)
      res.end(responseStatus === 200 ? 'ok' : 'error')
    })

    const [tenant] = await db.insert(tenants).values({ name: 'Processor Replay' }).returning()
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

    await processor(makeJob(delivery.id))

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

    await processor(makeJob(delivery.id))

    const [succeeded] = await db.select().from(deliveries).where(eq(deliveries.id, delivery.id))
    const attempts = await db
      .select()
      .from(deliveryAttempts)
      .where(eq(deliveryAttempts.deliveryId, delivery.id))

    expect(succeeded.status).toBe('succeeded')
    expect(succeeded.attemptCount).toBe(1)
    expect(attempts).toHaveLength(2)
    expect(attempts[1]?.attemptNumber).toBe(2)
    expect(attempts[1]?.httpStatus).toBe(200)

    await mock.close()
  })

  it('defers delivery when rate limit denied without incrementing attempt_count', async () => {
    const db = getDb()
    vi.spyOn(rateLimit, 'takeRateLimitToken').mockResolvedValue(false)
    const postSpy = vi.spyOn(httpClient, 'postWithTimeout')

    const [tenant] = await db.insert(tenants).values({ name: 'Processor RateLimit' }).returning()
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

    const before = Date.now()
    const job = makeJob(delivery.id)
    await expect(processor(job)).rejects.toThrow(DelayedError)

    const [updated] = await db.select().from(deliveries).where(eq(deliveries.id, delivery.id))
    const attempts = await db
      .select()
      .from(deliveryAttempts)
      .where(eq(deliveryAttempts.deliveryId, delivery.id))

    expect(postSpy).not.toHaveBeenCalled()
    expect(job.moveToDelayed).toHaveBeenCalledOnce()
    const delayedUntil = vi.mocked(job.moveToDelayed).mock.calls[0]?.[0] as number
    expect(delayedUntil).toBeGreaterThanOrEqual(before + RATE_LIMIT_DEFER_MS - 1_000)
    expect(updated.status).toBe('deferred')
    expect(updated.attemptCount).toBe(2)
    expect(updated.nextRetryAt).not.toBeNull()
    expect(updated.nextRetryAt!.getTime()).toBeGreaterThanOrEqual(
      before + RATE_LIMIT_DEFER_MS - 1_000,
    )
    expect(attempts).toHaveLength(1)
    expect(attempts[0]?.error).toBe('rate_limited')
    expect(attempts[0]?.httpStatus).toBeNull()

    const [eventRow] = await db.select().from(events).where(eq(events.id, event.id))
    expect(eventRow.status).toBe('pending')
  })
})
