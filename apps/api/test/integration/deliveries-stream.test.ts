import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { eq } from 'drizzle-orm'
import { deliveries } from '@webhook/shared/schema'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import '../../src/config.js'
import { closePool, getDb } from '../../src/db/client.js'
import { closeRedis } from '../../src/lib/redis.js'
import { queue } from '../../src/queue/client.js'
import { createApp } from '../../src/server.js'
import { createTenantWithKey, deleteTenant } from '../helpers/tenant.js'
import { createUser, deleteUser } from '../helpers/user.js'
import {
  beginDeliveryTestIsolation,
  endDeliveryTestIsolation,
  seedDeliveryRow,
} from '../helpers/delivery.js'

const app = createApp()

function parseSseChunks(body: string): Array<{ event: string; data: unknown }> {
  const events: Array<{ event: string; data: unknown }> = []

  for (const block of body.split('\n\n')) {
    if (block.length === 0 || block.startsWith(':')) {
      continue
    }

    const lines = block.split('\n')
    const eventLine = lines.find((line) => line.startsWith('event: '))
    const dataLine = lines.find((line) => line.startsWith('data: '))

    if (!eventLine || !dataLine) {
      continue
    }

    events.push({
      event: eventLine.slice('event: '.length),
      data: JSON.parse(dataLine.slice('data: '.length)) as unknown,
    })
  }

  return events
}

function openSseStream(
  agent: ReturnType<typeof request.agent>,
  timeoutMs: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: string[] = []
    const timer = setTimeout(() => resolve(chunks.join('')), timeoutMs)

    void agent
      .get('/v1/deliveries/stream')
      .buffer(false)
      .parse((res, fn) => {
        res.setEncoding('utf8')
        res.on('data', (chunk: string) => {
          chunks.push(chunk)
        })
        res.on('error', (err) => {
          clearTimeout(timer)
          reject(err)
        })
        res.on('end', () => {
          clearTimeout(timer)
          fn(null, chunks.join(''))
        })
      })
      .end((err) => {
        if (err) {
          clearTimeout(timer)
          reject(err)
        }
      })
  })
}

describe('GET /v1/deliveries/stream', () => {
  let tenantId: string
  let apiKey: string
  let userId: string
  let email: string
  let password: string
  let deliveryId: string

  beforeAll(async () => {
    await beginDeliveryTestIsolation()

    const tenant = await createTenantWithKey()
    tenantId = tenant.tenantId
    apiKey = tenant.apiKey

    const user = await createUser({
      tenantId,
      email: `stream-${randomUUID()}@test.com`,
    })
    userId = user.userId
    email = user.email
    password = user.password

    const seeded = await seedDeliveryRow({
      tenantId,
      idempotencyKey: 'stream-test',
      endpointUrl: 'https://webhook.site/stream-test',
    })
    deliveryId = seeded.deliveryId
  })

  afterAll(async () => {
    await endDeliveryTestIsolation()
    await queue.close()
    await deleteUser(userId)
    await deleteTenant(tenantId)
    await closePool()
    await closeRedis()
  })

  it('returns 401 without a session cookie', async () => {
    const res = await request(app).get('/v1/deliveries/stream')

    expect(res.status).toBe(401)
    expect(res.body.error.message).toBe('Missing or invalid session')
  })

  it('returns 401 with Bearer auth only', async () => {
    const res = await request(app)
      .get('/v1/deliveries/stream')
      .set('Authorization', `Bearer ${apiKey}`)

    expect(res.status).toBe(401)
    expect(res.body.error.message).toBe('Missing or invalid session')
  })

  it('streams delivery_updated when a delivery row changes', async () => {
    const db = getDb()
    await db
      .update(deliveries)
      .set({
        status: 'pending',
        lastError: null,
        attemptCount: 0,
        nextRetryAt: null,
        updatedAt: new Date(),
      })
      .where(eq(deliveries.id, deliveryId))

    const agent = request.agent(app)

    const loginRes = await agent.post('/v1/auth/login').send({ email, password })
    expect(loginRes.status).toBe(200)

    const streamPromise = openSseStream(agent, 2_000)

    await new Promise((resolve) => setTimeout(resolve, 250))

    await db
      .update(deliveries)
      .set({
        status: 'failed',
        lastError: 'http_500',
        updatedAt: new Date(),
      })
      .where(eq(deliveries.id, deliveryId))

    const body = await streamPromise
    const events = parseSseChunks(body)
    const updated = events.find((event) => event.event === 'delivery_updated')

    expect(updated).toBeDefined()
    expect(updated?.data).toMatchObject({
      id: deliveryId,
      status: 'failed',
      last_error: 'http_500',
    })
  })

  it(
    'streams delivery_updated when a failed delivery is replayed',
    async () => {
      await beginDeliveryTestIsolation()

      const db = getDb()
    await db
      .update(deliveries)
      .set({
        status: 'failed',
        lastError: 'http_500',
        attemptCount: 2,
        nextRetryAt: null,
        updatedAt: new Date(),
      })
      .where(eq(deliveries.id, deliveryId))

    const [baseline] = await db
      .select({ status: deliveries.status })
      .from(deliveries)
      .where(eq(deliveries.id, deliveryId))

    expect(baseline?.status).toBe('failed')

    const agent = request.agent(app)

    const loginRes = await agent.post('/v1/auth/login').send({ email, password })
    expect(loginRes.status).toBe(200)

    const streamPromise = openSseStream(agent, 2_500)

    // Let the stream capture the failed baseline before replay changes the row.
    await new Promise((resolve) => setTimeout(resolve, 300))

    const replayRes = await request(app)
      .post(`/v1/deliveries/${deliveryId}/replay`)
      .set('Authorization', `Bearer ${apiKey}`)
    expect(replayRes.status).toBe(202)

    const body = await streamPromise
    const events = parseSseChunks(body)
    const updates = events.filter(
      (event) =>
        event.event === 'delivery_updated' &&
        (event.data as { id?: string }).id === deliveryId,
    )

    expect(updates.length).toBeGreaterThan(0)

    const updated = updates.find((event) => {
      const data = event.data as {
        status?: string
        attempt_count?: number
        last_error?: string | null
      }
      return data.attempt_count === 0 && data.last_error === null
    })

    expect(updated).toBeDefined()
    expect(updated?.data).toMatchObject({
      id: deliveryId,
      last_error: null,
      attempt_count: 0,
    })
    expect(['pending', 'in_progress']).toContain(
      (updated?.data as { status?: string }).status,
    )
    },
    12_000,
  )
})
