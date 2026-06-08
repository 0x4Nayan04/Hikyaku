import type { NextFunction, Request, Response } from 'express'
import { afterAll, describe, expect, it } from 'vitest'
import '../../../src/config.js'
import { requireTenantAuth } from '../../../src/auth/middleware.js'
import { closePool } from '../../../src/db/client.js'
import { AppError } from '../../../src/lib/errors.js'
import { createTenantWithKey, deleteTenant } from '../../helpers/tenant.js'
import { createUser, deleteUser } from '../../helpers/user.js'

function createRequest(options?: {
  authorization?: string
  session?: { userId?: string }
}): Request {
  return {
    get(name: string) {
      if (name.toLowerCase() === 'authorization') {
        return options?.authorization
      }
      return undefined
    },
    session: options?.session ?? {},
  } as Request
}

async function runRequireTenantAuth(
  req: Request,
): Promise<{ error?: unknown; tenantId?: string; userId?: string }> {
  return new Promise((resolve) => {
    const next: NextFunction = (err?: unknown) => {
      if (err) {
        resolve({ error: err })
        return
      }
      resolve({ tenantId: req.tenantId, userId: req.userId })
    }

    requireTenantAuth(req, {} as Response, next)
  })
}

describe('requireTenantAuth', () => {
  afterAll(async () => {
    await closePool()
  })

  it('returns 401 when neither Bearer nor session is present', async () => {
    const result = await runRequireTenantAuth(createRequest())

    expect(result.error).toBeInstanceOf(AppError)
    expect(result.error).toMatchObject({
      statusCode: 401,
      code: 'unauthorized',
      message: 'Missing or invalid Bearer token or session',
    })
  })

  it('returns 401 for a malformed Bearer token without session', async () => {
    const result = await runRequireTenantAuth(createRequest({ authorization: 'Token oops' }))

    expect(result.error).toBeInstanceOf(AppError)
    expect(result.error).toMatchObject({ statusCode: 401, code: 'unauthorized' })
  })

  it('returns 401 for a revoked api key', async () => {
    const { tenantId, apiKey } = await createTenantWithKey({ revoked: true })

    const result = await runRequireTenantAuth(createRequest({ authorization: `Bearer ${apiKey}` }))

    expect(result.error).toBeInstanceOf(AppError)
    expect(result.error).toMatchObject({ statusCode: 401, code: 'unauthorized' })

    await deleteTenant(tenantId)
  })

  it('sets req.tenantId for a valid api key', async () => {
    const { tenantId, apiKey } = await createTenantWithKey()

    const result = await runRequireTenantAuth(createRequest({ authorization: `Bearer ${apiKey}` }))

    expect(result.error).toBeUndefined()
    expect(result.tenantId).toBe(tenantId)

    await deleteTenant(tenantId)
  })

  it('prefers Bearer auth when both Bearer and session are present', async () => {
    const { tenantId: bearerTenantId, apiKey } = await createTenantWithKey()
    const { tenantId: sessionTenantId } = await createTenantWithKey()
    const { userId } = await createUser({ tenantId: sessionTenantId })

    const result = await runRequireTenantAuth(
      createRequest({
        authorization: `Bearer ${apiKey}`,
        session: { userId },
      }),
    )

    expect(result.error).toBeUndefined()
    expect(result.tenantId).toBe(bearerTenantId)

    await deleteUser(userId)
    await deleteTenant(bearerTenantId)
    await deleteTenant(sessionTenantId)
  })

  it('sets req.tenantId for a valid tenant user session', async () => {
    const { tenantId } = await createTenantWithKey()
    const { userId } = await createUser({ tenantId })

    const result = await runRequireTenantAuth(createRequest({ session: { userId } }))

    expect(result.error).toBeUndefined()
    expect(result.tenantId).toBe(tenantId)
    expect(result.userId).toBe(userId)

    await deleteUser(userId)
    await deleteTenant(tenantId)
  })

  it('returns 401 for a super-admin session', async () => {
    const { userId } = await createUser({ tenantId: null, isSuperAdmin: true })

    const result = await runRequireTenantAuth(createRequest({ session: { userId } }))

    expect(result.error).toBeInstanceOf(AppError)
    expect(result.error).toMatchObject({
      statusCode: 401,
      code: 'unauthorized',
      message: 'Missing or invalid Bearer token or session',
    })

    await deleteUser(userId)
  })
})
