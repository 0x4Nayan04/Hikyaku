import { randomUUID } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import { eq } from 'drizzle-orm'
import { deliveries, endpoints, events } from '@webhook/shared/schema'
import { enqueueDeliveryJob } from '@webhook/shared/enqueueDelivery'
import { afterAll, describe, expect, it, vi } from 'vitest'
import '../../../../src/config.js'
import { closePool, getDb } from '../../../../src/db/client.js'
import { AppError } from '../../../../src/lib/errors.js'
import { replayDelivery } from '../../../../src/routes/deliveries/handlers.js'
import { createTenantWithKey, deleteTenant } from '../../../helpers/tenant.js'

vi.mock('@webhook/shared/enqueueDelivery', () => ({
  enqueueDeliveryJob: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../../../src/queue/client.js', () => ({ queue: {} }))

const enqueueMock = vi.mocked(enqueueDeliveryJob)

function createMockRes(onComplete: (result: { statusCode: number; body: unknown }) => void) {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code
      return res
    },
    json(payload: unknown) {
      res.body = payload
      onComplete({ statusCode: res.statusCode, body: res.body })
      return res
    },
  }
  return res as Response & { statusCode: number; body: unknown }
}

async function runReplayDelivery(
  deliveryId: string,
  tenantId: string,
): Promise<{ error?: unknown; statusCode?: number; body?: unknown }> {
  const req = {
    params: { id: deliveryId },
    tenantId,
  } as unknown as Request

  return new Promise((resolve) => {
    const res = createMockRes((result) => {
      resolve(result)
    })

    const next: NextFunction = (err?: unknown) => {
      if (err) {
        resolve({ error: err })
      }
    }

    void replayDelivery(req, res, next)
  })
}

describe('replayDelivery validation', () => {
  afterAll(async () => {
    await closePool()
  })

  it('returns 404 when the delivery belongs to another tenant', async () => {
    const owner = await createTenantWithKey()
    const other = await createTenantWithKey()

    try {
      const db = getDb()
      const [endpoint] = await db
        .insert(endpoints)
        .values({
          tenantId: owner.tenantId,
          url: 'https://example.com/hook',
          secret: 'whsec_test',
          status: 'active',
        })
        .returning({ id: endpoints.id })

      const [event] = await db
        .insert(events)
        .values({
          tenantId: owner.tenantId,
          idempotencyKey: `replay-unit-${randomUUID()}`,
          type: 'test',
          payload: {},
        })
        .returning({ id: events.id })

      const [delivery] = await db
        .insert(deliveries)
        .values({
          tenantId: owner.tenantId,
          eventId: event.id,
          endpointId: endpoint.id,
          status: 'failed',
          lastError: 'http_500',
        })
        .returning({ id: deliveries.id })

      const result = await runReplayDelivery(delivery.id, other.tenantId)

      expect(result.error).toBeInstanceOf(AppError)
      expect(result.error).toMatchObject({
        statusCode: 404,
        code: 'not_found',
        message: 'Delivery not found',
      })
    } finally {
      await deleteTenant(owner.tenantId)
      await deleteTenant(other.tenantId)
    }
  })

  it('returns 400 when the delivery is not failed', async () => {
    const { tenantId } = await createTenantWithKey()

    try {
      const db = getDb()
      const [endpoint] = await db
        .insert(endpoints)
        .values({
          tenantId,
          url: 'https://example.com/hook',
          secret: 'whsec_test',
          status: 'active',
        })
        .returning({ id: endpoints.id })

      const [event] = await db
        .insert(events)
        .values({
          tenantId,
          idempotencyKey: `replay-unit-${randomUUID()}`,
          type: 'test',
          payload: {},
        })
        .returning({ id: events.id })

      const [delivery] = await db
        .insert(deliveries)
        .values({
          tenantId,
          eventId: event.id,
          endpointId: endpoint.id,
          status: 'succeeded',
        })
        .returning({ id: deliveries.id })

      const result = await runReplayDelivery(delivery.id, tenantId)

      expect(result.error).toBeInstanceOf(AppError)
      expect(result.error).toMatchObject({
        statusCode: 400,
        code: 'invalid_state',
        message: 'Only failed deliveries can be replayed',
      })
    } finally {
      await deleteTenant(tenantId)
    }
  })

  it('returns 404 for an invalid delivery id format', async () => {
    const { tenantId } = await createTenantWithKey()

    try {
      const result = await runReplayDelivery('not-a-uuid', tenantId)

      expect(result.error).toBeInstanceOf(AppError)
      expect(result.error).toMatchObject({
        statusCode: 404,
        code: 'not_found',
        message: 'Delivery not found',
      })
    } finally {
      await deleteTenant(tenantId)
    }
  })

  it('replays a failed delivery for the owning tenant', async () => {
    enqueueMock.mockResolvedValue(undefined)
    const { tenantId } = await createTenantWithKey()

    try {
      const db = getDb()
      const [endpoint] = await db
        .insert(endpoints)
        .values({
          tenantId,
          url: 'https://example.com/hook',
          secret: 'whsec_test',
          status: 'active',
        })
        .returning({ id: endpoints.id })

      const [event] = await db
        .insert(events)
        .values({
          tenantId,
          idempotencyKey: `replay-unit-${randomUUID()}`,
          type: 'test',
          payload: {},
          status: 'failed',
        })
        .returning({ id: events.id })

      const [delivery] = await db
        .insert(deliveries)
        .values({
          tenantId,
          eventId: event.id,
          endpointId: endpoint.id,
          status: 'failed',
          lastError: 'http_500',
          attemptCount: 3,
        })
        .returning({ id: deliveries.id })

      const result = await runReplayDelivery(delivery.id, tenantId)

      expect(result.error).toBeUndefined()
      expect(result.statusCode).toBe(202)
      expect(result.body).toEqual({ id: delivery.id, status: 'pending' })

      const [updated] = await db
        .select({
          status: deliveries.status,
          attemptCount: deliveries.attemptCount,
          lastError: deliveries.lastError,
        })
        .from(deliveries)
        .where(eq(deliveries.id, delivery.id))

      expect(updated).toMatchObject({
        status: 'pending',
        attemptCount: 0,
        lastError: null,
      })
    } finally {
      await deleteTenant(tenantId)
    }
  })

  it('reverts to failed when replay enqueue fails so replay can be retried', async () => {
    enqueueMock.mockRejectedValueOnce(new Error('redis unreachable'))
    const { tenantId } = await createTenantWithKey()

    try {
      const db = getDb()
      const [endpoint] = await db
        .insert(endpoints)
        .values({
          tenantId,
          url: 'https://example.com/hook',
          secret: 'whsec_test',
          status: 'active',
        })
        .returning({ id: endpoints.id })

      const [event] = await db
        .insert(events)
        .values({
          tenantId,
          idempotencyKey: `replay-enqueue-fail-${randomUUID()}`,
          type: 'test',
          payload: {},
          status: 'failed',
        })
        .returning({ id: events.id })

      const [delivery] = await db
        .insert(deliveries)
        .values({
          tenantId,
          eventId: event.id,
          endpointId: endpoint.id,
          status: 'failed',
          lastError: 'http_500',
          attemptCount: 2,
        })
        .returning({ id: deliveries.id })

      const result = await runReplayDelivery(delivery.id, tenantId)

      expect(result.error).toBeInstanceOf(AppError)
      expect(result.error).toMatchObject({
        statusCode: 503,
        code: 'service_unavailable',
      })

      const [updated] = await db
        .select({
          status: deliveries.status,
          lastError: deliveries.lastError,
        })
        .from(deliveries)
        .where(eq(deliveries.id, delivery.id))

      expect(updated).toMatchObject({
        status: 'failed',
        lastError: 'enqueue_failed',
      })
    } finally {
      await deleteTenant(tenantId)
    }
  })

  it('does not overwrite a newer delivery state when replay enqueue fails', async () => {
    let signalEnqueue!: () => void
    let rejectEnqueue!: (reason?: unknown) => void
    const enqueueStarted = new Promise<void>((resolve) => {
      signalEnqueue = resolve
    })
    enqueueMock.mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectEnqueue = reject
          signalEnqueue()
        }),
    )
    const { tenantId } = await createTenantWithKey()

    try {
      const db = getDb()
      const [endpoint] = await db
        .insert(endpoints)
        .values({
          tenantId,
          url: 'https://example.com/hook',
          secret: 'whsec_test',
          status: 'active',
        })
        .returning({ id: endpoints.id })
      const [event] = await db
        .insert(events)
        .values({
          tenantId,
          idempotencyKey: `replay-state-change-${randomUUID()}`,
          type: 'test',
          payload: {},
          status: 'failed',
        })
        .returning({ id: events.id })
      const [delivery] = await db
        .insert(deliveries)
        .values({
          tenantId,
          eventId: event.id,
          endpointId: endpoint.id,
          status: 'failed',
          lastError: 'http_500',
        })
        .returning({ id: deliveries.id })

      const replay = runReplayDelivery(delivery.id, tenantId)
      await enqueueStarted
      await db
        .update(deliveries)
        .set({ status: 'succeeded', lastError: null })
        .where(eq(deliveries.id, delivery.id))
      rejectEnqueue(new Error('redis unreachable'))

      const result = await replay
      expect(result.error).toMatchObject({ statusCode: 503 })

      const [updated] = await db
        .select({ status: deliveries.status })
        .from(deliveries)
        .where(eq(deliveries.id, delivery.id))
      expect(updated?.status).toBe('succeeded')
    } finally {
      await deleteTenant(tenantId)
    }
  })
})
