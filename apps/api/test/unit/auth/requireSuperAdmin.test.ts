import type { NextFunction, Request, Response } from 'express'
import { afterAll, describe, expect, it } from 'vitest'
import '../../../src/config.js'
import { requireSuperAdmin } from '../../../src/auth/requireSuperAdmin.js'
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
  credentialFingerprint?: string
}): Request {
  return {
    session: session ?? {},
  } as Request
}

async function runRequireSuperAdmin(req: Request): Promise<{ error?: unknown }> {
  return new Promise((resolve) => {
    const next: NextFunction = (err?: unknown) => {
      if (err) {
        resolve({ error: err })
        return
      }
      resolve({})
    }

    requireSuperAdmin(req, {} as Response, next)
  })
}

describe('requireSuperAdmin', () => {
  afterAll(async () => {
    await closePool()
  })

  it('returns 401 when session userId is missing', async () => {
    const result = await runRequireSuperAdmin(createRequest())

    expect(result.error).toBeInstanceOf(AppError)
    expect(result.error).toMatchObject({ statusCode: 401, code: 'unauthorized' })
  })

  it('returns 403 for a tenant user session', async () => {
    const { tenantId } = await createTenantWithKey()
    const user = await createUser({ tenantId })

    const result = await runRequireSuperAdmin(
      createRequest({
        userId: user.userId,
        email: user.email,
        name: 'Member',
        tenantId,
        isSuperAdmin: false,
        tenantName: 'Acme',
        credentialFingerprint: user.credentialFingerprint,
      }),
    )

    expect(result.error).toBeInstanceOf(AppError)
    expect(result.error).toMatchObject({
      statusCode: 403,
      code: 'forbidden',
      message: 'Super-admin access required',
    })

    await deleteUser(user.userId)
    await deleteTenant(tenantId)
  })

  it('allows a super-admin session', async () => {
    const user = await createUser({ tenantId: null, isSuperAdmin: true })

    const result = await runRequireSuperAdmin(
      createRequest({
        userId: user.userId,
        email: user.email,
        name: 'Admin',
        tenantId: null,
        isSuperAdmin: true,
        tenantName: null,
        credentialFingerprint: user.credentialFingerprint,
      }),
    )

    expect(result.error).toBeUndefined()

    await deleteUser(user.userId)
  })
})
