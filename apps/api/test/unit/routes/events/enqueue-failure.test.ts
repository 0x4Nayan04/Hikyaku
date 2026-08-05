import { randomUUID } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import { and, eq } from 'drizzle-orm'
import { deliveries, endpoints, events } from '@webhook/shared/schema'
import { enqueueDeliveryJobs } from '@webhook/shared/enqueueDelivery'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import '../../../../src/config.js'
import { closePool, getDb } from '../../../../src/db/client.js'
import { AppError } from '../../../../src/lib/errors.js'
import { ingestEvent } from '../../../../src/routes/events/handlers.js'
import { createTenantWithKey, deleteTenant } from '../../../helpers/tenant.js'

vi.mock('@webhook/shared/enqueueDelivery', () => ({
  enqueueDeliveryJobs: vi.fn(),
}))

vi.mock('../../../../src/queue/client.js', () => ({ queue: {} }))

const enqueueMock = vi.mocked(enqueueDeliveryJobs)

function createMockRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code
      return res
    },
    json(payload: unknown) {
      res.body = payload
      return res
    },
  }
  return res as Response & { statusCode: number; body: unknown }
}

async function runIngestEvent(
  req: Request,
): Promise<{ error?: unknown; statusCode?: number; body?: unknown }> {
  return new Promise((resolve) => {
    const res = createMockRes()
    const originalJson = res.json.bind(res)
    res.json = ((payload: unknown) => {
      originalJson(payload)
      resolve({ statusCode: res.statusCode, body: res.body })
      return res
    }) as typeof res.json

    const next: NextFunction = (err?: unknown) => {
      if (err) {
        resolve({ error: err })
      }
    }

    void ingestEvent(req, res, next)
  })
}

describe('ingestEvent enqueue failure', () => {
  let tenantId: string

  beforeAll(async () => {
    const tenant = await createTenantWithKey()
    tenantId = tenant.tenantId

    await getDb()
      .insert(endpoints)
      .values({
        tenantId,
        url: 'https://example.com/hook',
        secret: `whsec_${'a'.repeat(32)}`,
        status: 'active',
      })
  })

  afterAll(async () => {
    await deleteTenant(tenantId)
    await closePool()
  })

  it('returns 503 when BullMQ enqueue fails after commit', async () => {
    enqueueMock.mockRejectedValueOnce(new Error('redis unreachable'))

    const req = {
      tenantId,
      body: {
        idempotency_key: `enqueue-fail-${randomUUID()}`,
        type: 'test.event',
        payload: {},
      },
    } as Request

    const result = await runIngestEvent(req)

    expect(result.error).toBeInstanceOf(AppError)
    expect(result.error).toMatchObject({
      statusCode: 503,
      code: 'service_unavailable',
      message: 'Service temporarily unavailable',
    })
  })

  it('re-enqueues open deliveries on idempotent retry after a prior enqueue 503', async () => {
    const idempotencyKey = `enqueue-retry-${randomUUID()}`
    enqueueMock.mockRejectedValueOnce(new Error('redis unreachable'))

    const first = await runIngestEvent({
      tenantId,
      body: {
        idempotency_key: idempotencyKey,
        type: 'test.event',
        payload: {},
      },
    } as Request)

    expect(first.error).toMatchObject({ statusCode: 503 })

    const [event] = await getDb()
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.tenantId, tenantId), eq(events.idempotencyKey, idempotencyKey)))
      .limit(1)

    expect(event).toBeDefined()

    const open = await getDb()
      .select({ id: deliveries.id })
      .from(deliveries)
      .where(and(eq(deliveries.eventId, event!.id), eq(deliveries.status, 'pending')))

    expect(open.length).toBeGreaterThan(0)

    enqueueMock.mockResolvedValue(undefined)
    enqueueMock.mockClear()

    const retry = await runIngestEvent({
      tenantId,
      body: {
        idempotency_key: idempotencyKey,
        type: 'test.event',
        payload: {},
      },
    } as Request)

    expect(retry.error).toBeUndefined()
    expect(retry.statusCode).toBe(202)
    expect(enqueueMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining(open.map((row) => row.id)),
    )
  })
})
