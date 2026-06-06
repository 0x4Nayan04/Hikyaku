import { randomUUID } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import { endpoints } from '@webhook/shared/schema'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import '../../../../src/config.js'
import { closePool, getDb } from '../../../../src/db/client.js'
import { AppError } from '../../../../src/lib/errors.js'
import { ingestEvent } from '../../../../src/routes/events/handlers.js'
import { createTenantWithKey, deleteTenant } from '../../../helpers/tenant.js'

vi.mock('../../../../src/queue/client.js', () => ({
  enqueueDelivery: vi.fn().mockRejectedValue(new Error('redis unreachable')),
}))

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
  const res = createMockRes()
  return new Promise((resolve) => {
    const next: NextFunction = (err?: unknown) => {
      if (err) {
        resolve({ error: err })
        return
      }
      resolve({ statusCode: res.statusCode, body: res.body })
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
})
