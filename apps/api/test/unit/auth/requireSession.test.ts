import type { NextFunction, Request, Response } from 'express'
import { afterAll, describe, expect, it } from 'vitest'
import '../../../src/config.js'
import { requireSession } from '../../../src/auth/requireSession.js'
import { closePool } from '../../../src/db/client.js'
import { AppError } from '../../../src/lib/errors.js'
import { createTenantWithKey, deleteTenant } from '../../helpers/tenant.js'
import { createUser, deleteUser } from '../../helpers/user.js'

function createRequest(session?: { userId?: string }): Request {
  return {
    session: session ?? {},
  } as Request
}

async function runRequireSession(
  req: Request,
): Promise<{ error?: unknown; userId?: string; tenantId?: string; isSuperAdmin?: boolean }> {
  return new Promise((resolve) => {
    const next: NextFunction = (err?: unknown) => {
      if (err) {
        resolve({ error: err })
        return
      }
      resolve({
        userId: req.userId,
        tenantId: req.tenantId,
        isSuperAdmin: req.isSuperAdmin,
      })
    }

    requireSession(req, {} as Response, next)
  })
}

describe('requireSession', () => {
  afterAll(async () => {
    await closePool()
  })

  it('returns 401 when session userId is missing', async () => {
    const result = await runRequireSession(createRequest())

    expect(result.error).toBeInstanceOf(AppError)
    expect(result.error).toMatchObject({
      statusCode: 401,
      code: 'unauthorized',
      message: 'Missing or invalid session',
    })
  })

  it('returns 401 when session userId does not exist', async () => {
    const result = await runRequireSession(
      createRequest({ userId: '880e8400-e29b-41d4-a716-446655440099' }),
    )

    expect(result.error).toBeInstanceOf(AppError)
    expect(result.error).toMatchObject({ statusCode: 401, code: 'unauthorized' })
  })

  it('attaches tenant user context for a valid session', async () => {
    const { tenantId } = await createTenantWithKey()
    const { userId } = await createUser({ tenantId })

    const result = await runRequireSession(createRequest({ userId }))

    expect(result.error).toBeUndefined()
    expect(result.userId).toBe(userId)
    expect(result.tenantId).toBe(tenantId)
    expect(result.isSuperAdmin).toBe(false)

    await deleteUser(userId)
    await deleteTenant(tenantId)
  })

  it('attaches super-admin context without tenantId', async () => {
    const { userId } = await createUser({ tenantId: null, isSuperAdmin: true })

    const result = await runRequireSession(createRequest({ userId }))

    expect(result.error).toBeUndefined()
    expect(result.userId).toBe(userId)
    expect(result.tenantId).toBeUndefined()
    expect(result.isSuperAdmin).toBe(true)

    await deleteUser(userId)
  })
})
