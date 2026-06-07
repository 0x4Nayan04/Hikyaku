import { afterAll, describe, expect, it } from 'vitest'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { generateEndpointSecret, verifyPayload } from '@webhook/shared/crypto'
import { deliveries, deliveryAttempts, endpoints, events, tenants } from '@webhook/shared/schema'
import type { Job } from 'bullmq'
import { eq } from 'drizzle-orm'
import { closePool, getDb } from '../../src/db/client.js'
import { processor } from '../../src/processor.js'

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
  return { data: { deliveryId } } as Job<{ deliveryId: string }>
}

describe('processor', () => {
  afterAll(async () => {
    await closePool()
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

    expect(updated.status).toBe('succeeded')
    expect(updated.attemptCount).toBe(1)
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
})
