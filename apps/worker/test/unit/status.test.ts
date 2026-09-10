const seededTenantIds: string[] = []
import { deliveries, endpoints, events, tenants } from '@webhook/shared/schema'
import { reevaluateEventStatus } from '@webhook/shared/eventStatus'
import { eq, inArray } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import { closePool, getDb } from '../../src/db/client.js'

async function seedEventWithDeliveries(deliveryStatuses: string[]): Promise<{ eventId: string }> {
  const db = getDb()
  const [tenant] = await db.insert(tenants).values({ name: 'Status Test' }).returning()
  seededTenantIds.push(tenant.id)
  const [event] = await db
    .insert(events)
    .values({
      tenantId: tenant.id,
      idempotencyKey: `status-${crypto.randomUUID()}`,
      type: 'test.event',
      payload: {},
    })
    .returning()

  for (let i = 0; i < deliveryStatuses.length; i += 1) {
    const [endpoint] = await db
      .insert(endpoints)
      .values({
        tenantId: tenant.id,
        url: `https://example.com/${i}`,
        secret: `whsec_${i.toString().padStart(32, '0')}`,
        status: 'active',
      })
      .returning()

    await db.insert(deliveries).values({
      tenantId: tenant.id,
      eventId: event.id,
      endpointId: endpoint.id,
      status: deliveryStatuses[i],
    })
  }

  return { eventId: event.id }
}

async function getEventStatus(eventId: string): Promise<string> {
  const db = getDb()
  const [row] = await db
    .select({ status: events.status })
    .from(events)
    .where(eq(events.id, eventId))
  return row?.status ?? ''
}

describe('reevaluateEventStatus', () => {
  afterAll(async () => {
    if (seededTenantIds.length) await getDb().delete(tenants).where(inArray(tenants.id, seededTenantIds))
    await closePool()
  })

  it('sets completed when all deliveries succeeded', async () => {
    const { eventId } = await seedEventWithDeliveries(['succeeded', 'succeeded'])
    await expect(reevaluateEventStatus(eventId, getDb())).resolves.toBe('completed')
    expect(await getEventStatus(eventId)).toBe('completed')
  })

  it('sets failed when all deliveries failed', async () => {
    const { eventId } = await seedEventWithDeliveries(['failed', 'failed'])
    await expect(reevaluateEventStatus(eventId, getDb())).resolves.toBe('failed')
    expect(await getEventStatus(eventId)).toBe('failed')
  })

  it('sets partial_failure when deliveries are mixed succeeded and failed', async () => {
    const { eventId } = await seedEventWithDeliveries(['succeeded', 'failed'])
    await expect(reevaluateEventStatus(eventId, getDb())).resolves.toBe('partial_failure')
    expect(await getEventStatus(eventId)).toBe('partial_failure')
  })

  it('keeps pending when one delivery is still pending', async () => {
    const { eventId } = await seedEventWithDeliveries(['succeeded', 'pending'])
    await expect(reevaluateEventStatus(eventId, getDb())).resolves.toBe('pending')
    expect(await getEventStatus(eventId)).toBe('pending')
  })

  it('keeps pending when one delivery is in_progress', async () => {
    const { eventId } = await seedEventWithDeliveries(['succeeded', 'in_progress'])
    await expect(reevaluateEventStatus(eventId, getDb())).resolves.toBe('pending')
    expect(await getEventStatus(eventId)).toBe('pending')
  })

  it('sets no_recipients when there are zero deliveries', async () => {
    const db = getDb()
    const [tenant] = await db.insert(tenants).values({ name: 'Status Zero' }).returning()
  seededTenantIds.push(tenant.id)
    const [event] = await db
      .insert(events)
      .values({
        tenantId: tenant.id,
        idempotencyKey: `status-zero-${crypto.randomUUID()}`,
        type: 'test.event',
        payload: {},
      })
      .returning()

    await expect(reevaluateEventStatus(event.id, db)).resolves.toBe('no_recipients')
    expect(await getEventStatus(event.id)).toBe('no_recipients')
  })

  it('does not leave a stale rollup when two deliveries finish together', async () => {
    const { eventId } = await seedEventWithDeliveries(['pending', 'pending'])
    const rows = await getDb().select().from(deliveries).where(eq(deliveries.eventId, eventId))
    await Promise.all(rows.map(row => getDb().transaction(async tx => {
      await tx.update(deliveries).set({ status: 'succeeded' }).where(eq(deliveries.id, row.id))
      await reevaluateEventStatus(eventId, tx)
    })))
    expect(await getEventStatus(eventId)).toBe('completed')
  })

  it('returns the current status without requiring a write when it is unchanged', async () => {
    const { eventId } = await seedEventWithDeliveries(['succeeded', 'pending'])
    await expect(reevaluateEventStatus(eventId, getDb())).resolves.toBe('pending')
    await expect(reevaluateEventStatus(eventId, getDb())).resolves.toBe('pending')
    expect(await getEventStatus(eventId)).toBe('pending')
  })
})
