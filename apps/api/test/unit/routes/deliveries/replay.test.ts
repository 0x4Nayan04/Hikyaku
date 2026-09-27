import { randomUUID } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import { eq } from 'drizzle-orm'
import {
  deliveries,
  deliveryAttempts,
  deliveryOutbox,
  endpoints,
  events,
} from '@webhook/shared/schema'
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
  }, 15_000)

  it('does not replay a failed delivery when the endpoint is disabled', async () => {
    enqueueMock.mockClear()
    const { tenantId } = await createTenantWithKey()

    try {
      const db = getDb()
      const [endpoint] = await db
        .insert(endpoints)
        .values({
          tenantId,
          url: 'https://example.com/hook',
          secret: 'whsec_test',
          status: 'disabled',
        })
        .returning({ id: endpoints.id })

      const [event] = await db
        .insert(events)
        .values({
          tenantId,
          idempotencyKey: `replay-disabled-${randomUUID()}`,
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
          lastError: 'endpoint_disabled',
          attemptCount: 5,
        })
        .returning({ id: deliveries.id })

      const result = await runReplayDelivery(delivery.id, tenantId)

      expect(result.error).toBeInstanceOf(AppError)
      expect(result.error).toMatchObject({
        statusCode: 400,
        code: 'invalid_state',
        message: 'Endpoint is disabled',
      })

      const [updated] = await db
        .select({
          status: deliveries.status,
          lastError: deliveries.lastError,
          attemptCount: deliveries.attemptCount,
          replayCount: deliveries.replayCount,
        })
        .from(deliveries)
        .where(eq(deliveries.id, delivery.id))

      expect(updated).toMatchObject({
        status: 'failed',
        lastError: 'endpoint_disabled',
        attemptCount: 5,
        replayCount: 0,
      })
      expect(enqueueMock).not.toHaveBeenCalled()
    } finally {
      await deleteTenant(tenantId)
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
        message: 'Only failed or pending deliveries can be replayed',
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

  it('leaves the delivery pending when replay enqueue fails', async () => {
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

      await db.insert(deliveryAttempts).values({
        deliveryId: delivery.id,
        attemptNumber: 1,
        httpStatus: 500,
        error: 'http_500',
        durationMs: 12,
      })

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
          attemptCount: deliveries.attemptCount,
        })
        .from(deliveries)
        .where(eq(deliveries.id, delivery.id))

      expect(updated).toMatchObject({
        status: 'pending',
        lastError: null,
        attemptCount: 0,
      })

      const attempts = await db
        .select({ attemptNumber: deliveryAttempts.attemptNumber })
        .from(deliveryAttempts)
        .where(eq(deliveryAttempts.deliveryId, delivery.id))

      expect(attempts).toEqual([{ attemptNumber: 1 }])

      const outbox = await db
        .select({ deliveryId: deliveryOutbox.deliveryId })
        .from(deliveryOutbox)
        .where(eq(deliveryOutbox.deliveryId, delivery.id))
      expect(outbox).toEqual([{ deliveryId: delivery.id }])
    } finally {
      await deleteTenant(tenantId)
    }
  })

  it('re-enqueues a pending delivery', async () => {
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
          idempotencyKey: `replay-pending-${randomUUID()}`,
          type: 'test',
          payload: {},
        })
        .returning({ id: events.id })

      const retryAt = new Date(Date.now() + 120_000)
      const [delivery] = await db
        .insert(deliveries)
        .values({
          tenantId,
          eventId: event.id,
          endpointId: endpoint.id,
          status: 'pending',
          attemptCount: 2,
          replayCount: 1,
          nextRetryAt: retryAt,
          lastError: 'http_503',
        })
        .returning({ id: deliveries.id })

      enqueueMock.mockClear()
      const result = await runReplayDelivery(delivery.id, tenantId)

      expect(result.error).toBeUndefined()
      expect(result.statusCode).toBe(202)
      expect(result.body).toEqual({ id: delivery.id, status: 'pending' })
      expect(enqueueMock).toHaveBeenCalledWith(expect.anything(), delivery.id, tenantId)

      const [updated] = await db
        .select({
          status: deliveries.status,
          attemptCount: deliveries.attemptCount,
          replayCount: deliveries.replayCount,
          nextRetryAt: deliveries.nextRetryAt,
          lastError: deliveries.lastError,
        })
        .from(deliveries)
        .where(eq(deliveries.id, delivery.id))

      expect(updated).toMatchObject({
        status: 'pending',
        attemptCount: 2,
        replayCount: 1,
        lastError: 'http_503',
      })
      expect(updated?.nextRetryAt?.getTime()).toBe(retryAt.getTime())
    } finally {
      await deleteTenant(tenantId)
    }
  })

  it('rejects an in-progress delivery without enqueueing', async () => {
    enqueueMock.mockClear()
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
          idempotencyKey: `replay-in-progress-${randomUUID()}`,
          type: 'test',
          payload: {},
        })
        .returning({ id: events.id })

      const retryAt = new Date(Date.now() + 120_000)
      const [delivery] = await db
        .insert(deliveries)
        .values({
          tenantId,
          eventId: event.id,
          endpointId: endpoint.id,
          status: 'in_progress',
          attemptCount: 2,
          replayCount: 1,
          nextRetryAt: retryAt,
        })
        .returning({ id: deliveries.id })

      const result = await runReplayDelivery(delivery.id, tenantId)

      expect(result.error).toBeInstanceOf(AppError)
      expect(result.error).toMatchObject({
        statusCode: 400,
        code: 'invalid_state',
      })
      expect(enqueueMock).not.toHaveBeenCalled()

      const [updated] = await db
        .select({
          status: deliveries.status,
          attemptCount: deliveries.attemptCount,
          replayCount: deliveries.replayCount,
        })
        .from(deliveries)
        .where(eq(deliveries.id, delivery.id))

      expect(updated).toMatchObject({
        status: 'in_progress',
        attemptCount: 2,
        replayCount: 1,
      })
    } finally {
      await deleteTenant(tenantId)
    }
  })
})
