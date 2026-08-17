import type { NextFunction, Request, Response } from 'express'
import { afterAll, describe, expect, it } from 'vitest'
import '../../../src/config.js'
import { requireSession } from '../../../src/auth/requireSession.js'
import { closePool } from '../../../src/db/client.js'
import { AppError } from '../../../src/lib/errors.js'
import { createTenantWithKey, deleteTenant } from '../../helpers/tenant.js'
import { createUser, deleteUser } from '../../helpers/user.js'

function createRequest(session?: {
  userId?: string
  email?: string
  name?: string
  tenantId?: string | null
  isSuperAdmin?: boolean
  tenantName?: string | null
}): Request {
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
    const { userId, email } = await createUser({ tenantId, name: 'Session User' })
    const req = createRequest({ userId })

    const result = await runRequireSession(req)

    expect(result.error).toBeUndefined()
    expect(result.userId).toBe(userId)
    expect(result.tenantId).toBe(tenantId)
    expect(result.isSuperAdmin).toBe(false)
    expect(req.session.email).toBe(email)
    expect(req.session.name).toBe('Session User')
    expect(req.session.tenantId).toBe(tenantId)

    await deleteUser(userId)
    await deleteTenant(tenantId)
  })

  it('uses the session blob without a users lookup', async () => {
    const result = await runRequireSession(
      createRequest({
        userId: '880e8400-e29b-41d4-a716-446655440099',
        email: 'gone@test.com',
        name: 'Gone',
        tenantId: 'aa0e8400-e29b-41d4-a716-446655440001',
        isSuperAdmin: false,
        tenantName: 'Acme',
      }),
    )

    expect(result.error).toBeUndefined()
    expect(result.userId).toBe('880e8400-e29b-41d4-a716-446655440099')
    expect(result.tenantId).toBe('aa0e8400-e29b-41d4-a716-446655440001')
    expect(result.isSuperAdmin).toBe(false)
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
