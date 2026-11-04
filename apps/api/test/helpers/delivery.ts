import type { DeliveryStatus, EventStatus } from '@hikyaku/shared/constants'
import { deliveries, endpoints, events } from '@hikyaku/shared/schema'
import { getDb } from '../../src/db/client.js'
import { getQueue } from '../../src/queue/client.js'

type SeedDeliveryOptions = {
  tenantId: string
  idempotencyKey: string
  endpointUrl?: string
  eventType?: string
  payload?: unknown
  eventStatus?: EventStatus
  deliveryStatus?: DeliveryStatus
  attemptCount?: number
  lastError?: string | null
  nextRetryAt?: Date | null
}

export async function waitForActiveJobsToFinish(timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const active = await getQueue().getJobs(['active'], 0, 10)
    if (active.length === 0) {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('Active delivery jobs did not finish before test isolation timeout')
}

export async function beginDeliveryTestIsolation(): Promise<void> {
  await getQueue().pause()
  await waitForActiveJobsToFinish()
  for (const job of await getQueue().getJobs([
    'waiting',
    'delayed',
    'completed',
    'failed',
    'paused',
  ])) {
    await job.remove()
  }
  await getQueue().pause()
}

export async function endDeliveryTestIsolation(): Promise<void> {
  await getQueue().pause()
}

export async function seedDeliveryRow(options: SeedDeliveryOptions): Promise<{
  endpointId: string
  eventId: string
  deliveryId: string
}> {
  const db = getDb()

  const [endpoint] = await db
    .insert(endpoints)
    .values({
      tenantId: options.tenantId,
      url: options.endpointUrl ?? 'https://webhook.site/test',
      secret: `whsec_${'a'.repeat(32)}`,
    })
    .returning({ id: endpoints.id })

  const [event] = await db
    .insert(events)
    .values({
      tenantId: options.tenantId,
      idempotencyKey: options.idempotencyKey,
      type: options.eventType ?? 'test',
      payload: options.payload ?? { ok: true },
      status: options.eventStatus ?? 'pending',
    })
    .returning({ id: events.id })

  const [delivery] = await db
    .insert(deliveries)
    .values({
      tenantId: options.tenantId,
      eventId: event.id,
      endpointId: endpoint.id,
      status: options.deliveryStatus ?? 'pending',
      attemptCount: options.attemptCount ?? 0,
      lastError: options.lastError ?? null,
      nextRetryAt: options.nextRetryAt ?? null,
    })
    .returning({ id: deliveries.id })

  return {
    endpointId: endpoint.id,
    eventId: event.id,
    deliveryId: delivery.id,
  }
}
