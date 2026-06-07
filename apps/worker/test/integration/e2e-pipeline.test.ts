import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { verifyPayload } from '@webhook/shared/crypto'
import { QUEUE_NAME, WORKER_LOCK_DURATION_MS } from '@webhook/shared/constants'
import { deliveries, events } from '@webhook/shared/schema'
import { Worker } from 'bullmq'
import { eq } from 'drizzle-orm'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import '../../../api/src/config.js'
import { closePool as closeApiPool } from '../../../api/src/db/client.js'
import { closeRedis } from '../../../api/src/lib/redis.js'
import { queue } from '../../../api/src/queue/client.js'
import { createApp } from '../../../api/src/server.js'
import { createTenantWithKey, deleteTenant } from '../../../api/test/helpers/tenant.js'
import '../../src/config.js'
import { closePool, getDb } from '../../src/db/client.js'
import { getRedisConnectionOptions } from '../../src/lib/redis.js'
import { processor } from '../../src/processor.js'

const app = createApp()

type CapturedRequest = {
  body: string
  headers: IncomingMessage['headers']
}

function startMockServer(): Promise<{
  port: number
  getCapture: () => CapturedRequest | undefined
  close: () => Promise<void>
}> {
  let captured: CapturedRequest | undefined

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
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

  return new Promise((resolve) => {
    server.listen(0, () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      resolve({
        port,
        getCapture: () => captured,
        close: () =>
          new Promise((closeResolve, closeReject) => {
            server.close((err) => (err ? closeReject(err) : closeResolve()))
          }),
      })
    })
  })
}

async function waitForDeliveryStatus(
  deliveryId: string,
  status: string,
  timeoutMs = 10_000,
): Promise<void> {
  const db = getDb()
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    const [row] = await db
      .select({ status: deliveries.status })
      .from(deliveries)
      .where(eq(deliveries.id, deliveryId))

    if (row?.status === status) {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, 50))
  }

  throw new Error(`timed out waiting for delivery ${deliveryId} to reach ${status}`)
}

describe('e2e pipeline', () => {
  let tenantId: string
  let apiKey: string
  let endpointSecret: string
  let worker: Worker
  let mockServer: Awaited<ReturnType<typeof startMockServer>>

  beforeAll(async () => {
    await queue.obliterate({ force: true })

    const tenant = await createTenantWithKey()
    tenantId = tenant.tenantId
    apiKey = tenant.apiKey

    mockServer = await startMockServer()

    const endpointRes = await request(app)
      .post('/v1/endpoints')
      .set('Authorization', `Bearer ${apiKey}`)
      .send({
        url: `http://127.0.0.1:${mockServer.port}/hook`,
        description: 'e2e pipeline',
      })

    expect(endpointRes.status).toBe(201)
    endpointSecret = endpointRes.body.secret as string

    worker = new Worker(QUEUE_NAME, processor, {
      connection: getRedisConnectionOptions(),
      concurrency: 1,
      lockDuration: WORKER_LOCK_DURATION_MS,
    })
  })

  afterAll(async () => {
    await worker.close()
    await mockServer.close()
    await queue.obliterate({ force: true })
    await queue.close()
    await deleteTenant(tenantId)
    await closePool()
    await closeApiPool()
    await closeRedis()
  })

  it('delivers a signed payload after ingest', async () => {
    const ingestBody = {
      idempotency_key: 'e2e-pipeline-1',
      type: 'order.created',
      payload: { order_id: 'ord_123', total: 99 },
    }

    const ingestRes = await request(app)
      .post('/v1/events')
      .set('Authorization', `Bearer ${apiKey}`)
      .send(ingestBody)

    expect(ingestRes.status).toBe(202)

    const db = getDb()
    const [event] = await db
      .select({
        id: events.id,
        type: events.type,
        createdAt: events.createdAt,
        payload: events.payload,
      })
      .from(events)
      .where(eq(events.id, ingestRes.body.id as string))

    const [delivery] = await db
      .select({ id: deliveries.id, status: deliveries.status })
      .from(deliveries)
      .where(eq(deliveries.eventId, event.id))

    await waitForDeliveryStatus(delivery.id, 'succeeded')

    const [updatedDelivery] = await db
      .select({ status: deliveries.status })
      .from(deliveries)
      .where(eq(deliveries.id, delivery.id))

    expect(updatedDelivery.status).toBe('succeeded')

    const captured = mockServer.getCapture()
    expect(captured).toBeDefined()

    const parsed = JSON.parse(captured!.body)
    expect(parsed).toEqual({
      id: event.id,
      type: event.type,
      created_at: event.createdAt.toISOString(),
      data: event.payload,
    })

    expect(captured!.headers['x-webhook-id']).toBe(delivery.id)

    const timestamp = Number(captured!.headers['x-webhook-timestamp'])
    const signature = String(captured!.headers['x-webhook-signature'])
    expect(verifyPayload(endpointSecret, timestamp, captured!.body, signature)).toBe(true)
  })
})
