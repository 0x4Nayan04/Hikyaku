import request from 'supertest'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { deliveries, deliveryAttempts, endpoints, tenants } from '@hikyaku/shared/schema'
import { closePool, getDb, getPool } from '../../../src/db/client.js'
import { closeRedis } from '../../../src/lib/redis.js'
import { ingestFanout } from '../../../src/ingest/fanout.js'
import { createApp } from '../../../src/server.js'
import { seedDeliveryRow } from '../../helpers/delivery.js'
import { createTenantWithKey, deleteTenant } from '../../helpers/tenant.js'
import { createTenantSession } from '../../helpers/user.js'

const app = createApp()
describe('permanent endpoint removal', () => {
  let tenantId: string
  let apiKey: string
  let otherTenantId: string
  let agent: ReturnType<typeof request.agent>
  let other: ReturnType<typeof request.agent>
  beforeAll(async () => {
    ;({ tenantId, apiKey } = await createTenantWithKey())
    otherTenantId = (await createTenantWithKey()).tenantId
    agent = await createTenantSession(app, tenantId)
    other = await createTenantSession(app, otherTenantId)
  })
  afterAll(async () => {
    await deleteTenant(tenantId)
    await deleteTenant(otherTenantId)
    await closePool()
    await closeRedis()
  })
  it('requires a session, writable workspace and ownership', async () => {
    const { endpointId } = await seedDeliveryRow({ tenantId, idempotencyKey: randomUUID() })
    const path = `/v1/endpoints/${endpointId}`
    expect((await request(app).delete(path)).status).toBe(401)
    expect((await request(app).delete(path).set('Authorization', `Bearer ${apiKey}`)).status).toBe(
      401,
    )
    expect((await other.delete(path)).status).toBe(404)
    expect((await agent.delete(`/v1/endpoints/${randomUUID()}`)).status).toBe(404)
    await getDb().update(tenants).set({ readOnly: true }).where(eq(tenants.id, tenantId))
    try {
      expect((await agent.delete(path)).status).toBe(403)
      const [row] = await getDb().select().from(endpoints).where(eq(endpoints.id, endpointId))
      expect(row.deletedAt).toBeNull()
    } finally {
      await getDb().update(tenants).set({ readOnly: false }).where(eq(tenants.id, tenantId))
    }
    expect((await agent.delete(path)).status).toBe(204)
  })
  it('is idempotent, hides all list variants and retains delivery and attempt history', async () => {
    const { endpointId, deliveryId } = await seedDeliveryRow({
      tenantId,
      idempotencyKey: randomUUID(),
      deliveryStatus: 'failed',
      attemptCount: 1,
    })
    await getDb().insert(deliveryAttempts).values({ deliveryId, attemptNumber: 1, httpStatus: 500 })
    const path = `/v1/endpoints/${endpointId}`
    const removed = await agent.delete(path)
    expect(removed.status).toBe(204)
    expect(removed.text).toBe('')
    const [first] = await getDb().select().from(endpoints).where(eq(endpoints.id, endpointId))
    expect(first.status).toBe('disabled')
    expect(first.deletedAt).toBeInstanceOf(Date)
    expect((await agent.delete(path)).status).toBe(204)
    const [second] = await getDb().select().from(endpoints).where(eq(endpoints.id, endpointId))
    expect(second.deletedAt).toEqual(first.deletedAt)
    for (const query of ['', '?status=active', '?status=disabled']) {
      const listed = await agent.get(`/v1/endpoints${query}`)
      expect(listed.status).toBe(200)
      expect(listed.body.data).toEqual([])
    }
    expect((await agent.patch(path).send({ status: 'active' })).status).toBe(404)
    expect((await agent.patch(path).send({ description: 'changed' })).status).toBe(404)
    expect((await agent.post(`${path}/rotate`)).status).toBe(404)
    const detail = await agent.get(`/v1/deliveries/${deliveryId}`)
    expect(detail.status).toBe(200)
    expect(detail.body.endpoint_deleted_at).toEqual(first.deletedAt!.toISOString())
    expect(detail.body.attempts).toHaveLength(1)
    expect(
      (await agent.get('/v1/deliveries')).body.data.map((d: { id: string }) => d.id),
    ).toContain(deliveryId)
    expect((await agent.post(`/v1/deliveries/${deliveryId}/replay`)).status).toBe(400)
    await getDb().update(deliveries).set({ status: 'pending' }).where(eq(deliveries.id, deliveryId))
    expect((await agent.post(`/v1/deliveries/${deliveryId}/replay`)).status).toBe(400)
    const fanout = await ingestFanout(tenantId, {
      idempotency_key: randomUUID(),
      type: 'test',
      payload: {},
    })
    expect(fanout.jobs).toEqual([])
    expect(fanout.event.status).toBe('no_recipients')
  })
  it('waits for concurrent removal before fanout and replay choose the endpoint', async () => {
    const { endpointId, deliveryId } = await seedDeliveryRow({
      tenantId,
      idempotencyKey: randomUUID(),
      deliveryStatus: 'failed',
    })
    const blocker = await getPool().connect()
    const pid = (await blocker.query('SELECT pg_backend_pid() AS pid')).rows[0].pid
    let work: Promise<unknown[]> | undefined
    try {
      await blocker.query('BEGIN')
      await blocker.query(
        "UPDATE endpoints SET status = 'disabled', deleted_at = NOW() WHERE id = $1",
        [endpointId],
      )
      const fanout = ingestFanout(tenantId, {
        idempotency_key: randomUUID(),
        type: 'test',
        payload: {},
      })
      const replay = agent.post(`/v1/deliveries/${deliveryId}/replay`).then((res) => res)
      work = Promise.all([fanout, replay])
      await vi.waitFor(async () => {
        const result = await getPool().query(
          'SELECT count(*)::int AS count FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid))',
          [pid],
        )
        expect(result.rows[0].count).toBeGreaterThanOrEqual(2)
      })
      await blocker.query('COMMIT')
      const [event, response] = await Promise.all([fanout, replay])
      expect(event.jobs).toEqual([])
      expect(response.status).toBe(400)
      const [delivery] = await getDb()
        .select()
        .from(deliveries)
        .where(eq(deliveries.id, deliveryId))
      expect(delivery.replayCount).toBe(0)
    } finally {
      await blocker.query('ROLLBACK')
      blocker.release()
      await work
    }
  })
})
