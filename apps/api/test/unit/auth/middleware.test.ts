import type { NextFunction, Request, Response } from 'express'
import { afterAll, describe, expect, it } from 'vitest'
import '../../../src/config.js'
import { requireAuth } from '../../../src/auth/middleware.js'
import { closePool } from '../../../src/db/client.js'
import { AppError } from '../../../src/lib/errors.js'
import { createTenantWithKey, deleteTenant } from '../../helpers/tenant.js'

function createRequest(authorization?: string): Request {
  return {
    get(name: string) {
      if (name.toLowerCase() === 'authorization') {
        return authorization
      }
      return undefined
    },
  } as Request
}

async function runRequireAuth(req: Request): Promise<{ error?: unknown; tenantId?: string }> {
  return new Promise((resolve) => {
    const next: NextFunction = (err?: unknown) => {
      if (err) {
        resolve({ error: err })
        return
      }
      resolve({ tenantId: req.tenantId })
    }

    requireAuth(req, {} as Response, next)
  })
}

describe('requireAuth', () => {
  afterAll(async () => {
    await closePool()
  })

  it('returns 401 when Authorization header is missing', async () => {
    const result = await runRequireAuth(createRequest())

    expect(result.error).toBeInstanceOf(AppError)
    expect((result.error as AppError).statusCode).toBe(401)
    expect((result.error as AppError).code).toBe('unauthorized')
  })

  it('returns 401 for a malformed Bearer token', async () => {
    const result = await runRequireAuth(createRequest('Token oops'))

    expect(result.error).toBeInstanceOf(AppError)
    expect((result.error as AppError).statusCode).toBe(401)
  })

  it('returns 401 for a revoked api key', async () => {
    const { tenantId, apiKey } = await createTenantWithKey({ revoked: true })

    const result = await runRequireAuth(createRequest(`Bearer ${apiKey}`))

    expect(result.error).toBeInstanceOf(AppError)
    expect((result.error as AppError).statusCode).toBe(401)

    await deleteTenant(tenantId)
  })

  it('sets req.tenantId and calls next for a valid api key', async () => {
    const { tenantId, apiKey } = await createTenantWithKey()

    const result = await runRequireAuth(createRequest(`Bearer ${apiKey}`))

    expect(result.error).toBeUndefined()
    expect(result.tenantId).toBe(tenantId)

    await deleteTenant(tenantId)
  })
})
