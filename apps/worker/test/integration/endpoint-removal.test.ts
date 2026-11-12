import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { deliveries, deliveryAttempts, endpoints, tenants } from '@hikyaku/shared/schema'
import type { DeliveryJobData } from '@hikyaku/shared/constants'
import { DelayedError, type Job } from 'bullmq'
import { closePool, getDb, getPool } from '../../src/db/client.js'
import { processor } from '../../src/processor.js'
import * as httpClient from '../../src/httpClient.js'
import { seedDeliveryRow } from '../../../api/test/helpers/delivery.js'
import { closePool as closeApiPool } from '../../../api/src/db/client.js'

const tenantIds: string[] = []
async function fixture() {
  const [tenant] = await getDb().insert(tenants).values({ name: 'Removal worker test' }).returning()
  tenantIds.push(tenant.id)
  const row = await seedDeliveryRow({ tenantId: tenant.id, idempotencyKey: randomUUID() })
  const job = {
    data: { deliveryId: row.deliveryId, tenantId: tenant.id, replayCount: 0 },
    moveToDelayed: vi.fn().mockResolvedValue(undefined),
  } as unknown as Job<DeliveryJobData>
  return { ...row, job }
}
async function remove(endpointId: string) {
  await getDb()
    .update(endpoints)
    .set({ status: 'disabled', deletedAt: new Date() })
    .where(eq(endpoints.id, endpointId))
}
afterEach(() => vi.restoreAllMocks())
afterAll(async () => {
  for (const id of tenantIds) await getDb().delete(tenants).where(eq(tenants.id, id))
  await closePool()
  await closeApiPool()
})
describe('removed endpoint delivery claims', () => {
  it('does not send HTTP or invent an attempt for a removed endpoint', async () => {
    const f = await fixture()
    const send = vi
      .spyOn(httpClient, 'postWithTimeout')
      .mockResolvedValue({ status: 200, body: 'ok' })
    await remove(f.endpointId)
    await processor(f.job)
    expect(send).not.toHaveBeenCalled()
    const [d] = await getDb().select().from(deliveries).where(eq(deliveries.id, f.deliveryId))
    expect(d).toMatchObject({
      status: 'failed',
      lastError: 'endpoint_removed',
      attemptCount: 0,
      nextRetryAt: null,
    })
    expect(
      await getDb()
        .select()
        .from(deliveryAttempts)
        .where(eq(deliveryAttempts.deliveryId, f.deliveryId)),
    ).toEqual([])
  })
  it('lets an in-flight claimed request finish and stops its retry after removal', async () => {
    const f = await fixture()
    const send = vi.spyOn(httpClient, 'postWithTimeout').mockImplementation(async () => {
      await remove(f.endpointId)
      return { status: 503, body: 'retry' }
    })
    await expect(processor(f.job)).rejects.toThrow(DelayedError)
    await getDb()
      .update(deliveries)
      .set({ nextRetryAt: new Date(0) })
      .where(eq(deliveries.id, f.deliveryId))
    await processor(f.job)
    expect(send).toHaveBeenCalledTimes(1)
    const [d] = await getDb().select().from(deliveries).where(eq(deliveries.id, f.deliveryId))
    expect(d).toMatchObject({ status: 'failed', lastError: 'endpoint_removed', attemptCount: 1 })
    const attempts = await getDb()
      .select()
      .from(deliveryAttempts)
      .where(eq(deliveryAttempts.deliveryId, f.deliveryId))
    expect(attempts).toHaveLength(1)
    expect(attempts[0].httpStatus).toBe(503)
  })
  it('keeps a successful in-flight outcome after removal', async () => {
    const f = await fixture()
    vi.spyOn(httpClient, 'postWithTimeout').mockImplementation(async () => {
      await remove(f.endpointId)
      return { status: 200, body: 'ok' }
    })
    await processor(f.job)
    const [d] = await getDb().select().from(deliveries).where(eq(deliveries.id, f.deliveryId))
    expect(d.status).toBe('succeeded')
  })
  it('waits for removal to commit before claiming and does not send using a stale endpoint snapshot', async () => {
    const f = await fixture()
    const send = vi
      .spyOn(httpClient, 'postWithTimeout')
      .mockResolvedValue({ status: 200, body: 'ok' })
    const blocker = await getPool().connect()
    const pid = (await blocker.query('SELECT pg_backend_pid() AS pid')).rows[0].pid
    let processing: Promise<void> | undefined
    try {
      await blocker.query('BEGIN')
      await blocker.query(
        "UPDATE endpoints SET status = 'disabled', deleted_at = NOW() WHERE id = $1",
        [f.endpointId],
      )
      processing = processor(f.job)
      await vi.waitFor(async () => {
        const result = await getPool().query(
          'SELECT count(*)::int AS count FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid))',
          [pid],
        )
        expect(result.rows[0].count).toBeGreaterThan(0)
      })
      expect(send).not.toHaveBeenCalled()
      await blocker.query('COMMIT')
      await processing
      expect(send).not.toHaveBeenCalled()
      const [d] = await getDb().select().from(deliveries).where(eq(deliveries.id, f.deliveryId))
      expect(d).toMatchObject({ status: 'failed', lastError: 'endpoint_removed', attemptCount: 0 })
    } finally {
      await blocker.query('ROLLBACK')
      blocker.release()
      await processing
    }
  })
})
