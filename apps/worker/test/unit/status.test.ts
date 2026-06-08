import { deliveries, endpoints, events, tenants } from '@webhook/shared/schema'
import { eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import { closePool, getDb } from '../../src/db/client.js'
import { reevaluateEventStatus } from '../../src/status.js'

async function seedEventWithDeliveries(
  deliveryStatuses: string[],
): Promise<{ eventId: string }> {
  const db = getDb()
  const [tenant] = await db.insert(tenants).values({ name: 'Status Test' }).returning()
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
    await closePool()
  })

  it('sets completed when all deliveries succeeded', async () => {
    const { eventId } = await seedEventWithDeliveries(['succeeded', 'succeeded'])
    await reevaluateEventStatus(eventId)
    expect(await getEventStatus(eventId)).toBe('completed')
  })

  it('sets failed when all deliveries failed', async () => {
    const { eventId } = await seedEventWithDeliveries(['failed', 'failed'])
    await reevaluateEventStatus(eventId)
    expect(await getEventStatus(eventId)).toBe('failed')
  })

  it('sets completed when deliveries are mixed succeeded and failed', async () => {
    const { eventId } = await seedEventWithDeliveries(['succeeded', 'failed'])
    await reevaluateEventStatus(eventId)
    expect(await getEventStatus(eventId)).toBe('completed')
  })

  it('keeps pending when one delivery is still pending', async () => {
    const { eventId } = await seedEventWithDeliveries(['succeeded', 'pending'])
    await reevaluateEventStatus(eventId)
    expect(await getEventStatus(eventId)).toBe('pending')
  })

  it('keeps pending when one delivery is deferred', async () => {
    const { eventId } = await seedEventWithDeliveries(['succeeded', 'deferred'])
    await reevaluateEventStatus(eventId)
    expect(await getEventStatus(eventId)).toBe('pending')
  })

  it('keeps pending when the only delivery is deferred', async () => {
    const { eventId } = await seedEventWithDeliveries(['deferred'])
    await reevaluateEventStatus(eventId)
    expect(await getEventStatus(eventId)).toBe('pending')
  })

  it('keeps pending when one delivery is in_progress', async () => {
    const { eventId } = await seedEventWithDeliveries(['succeeded', 'in_progress'])
    await reevaluateEventStatus(eventId)
    expect(await getEventStatus(eventId)).toBe('pending')
  })

  it('sets completed when there are zero deliveries', async () => {
    const db = getDb()
    const [tenant] = await db.insert(tenants).values({ name: 'Status Zero' }).returning()
    const [event] = await db
      .insert(events)
      .values({
        tenantId: tenant.id,
        idempotencyKey: `status-zero-${crypto.randomUUID()}`,
        type: 'test.event',
        payload: {},
      })
      .returning()

    await reevaluateEventStatus(event.id)
    expect(await getEventStatus(event.id)).toBe('completed')
  })
})
