import type { NextFunction, Request, Response } from 'express'
import { eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import { hashPassword } from '@hikyaku/shared/password'
import { users } from '@hikyaku/shared/schema'
import '../../../src/config.js'
import { createCredentialFingerprint } from '../../../src/auth/session.js'
import { requireSession } from '../../../src/auth/requireSession.js'
import { closePool, getDb } from '../../../src/db/client.js'
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

  it('returns 401 when credentialFingerprint is missing (legacy session)', async () => {
    const { tenantId } = await createTenantWithKey()
    const { userId, email } = await createUser({ tenantId, name: 'Legacy' })

    const result = await runRequireSession(
      createRequest({
        userId,
        email,
        name: 'Legacy',
        tenantId,
        isSuperAdmin: false,
        tenantName: 'Acme',
      }),
    )

    expect(result.error).toBeInstanceOf(AppError)
    expect(result.error).toMatchObject({ statusCode: 401, code: 'unauthorized' })

    await deleteUser(userId)
    await deleteTenant(tenantId)
  })

  it('returns 401 when session userId does not exist', async () => {
    const result = await runRequireSession(
      createRequest({
        userId: '880e8400-e29b-41d4-a716-446655440099',
        email: 'gone@test.com',
        name: 'Gone',
        tenantId: null,
        isSuperAdmin: false,
        tenantName: null,
        credentialFingerprint: createCredentialFingerprint('not-a-real-hash'),
      }),
    )

    expect(result.error).toBeInstanceOf(AppError)
    expect(result.error).toMatchObject({ statusCode: 401, code: 'unauthorized' })
  })

  it('returns 401 when credentialFingerprint does not match the current password hash', async () => {
    const { tenantId } = await createTenantWithKey()
    const user = await createUser({ tenantId })

    const result = await runRequireSession(
      createRequest({
        userId: user.userId,
        email: user.email,
        name: 'Session User',
        tenantId,
        isSuperAdmin: false,
        tenantName: 'Acme',
        credentialFingerprint: createCredentialFingerprint('stale-password-hash'),
      }),
    )

    expect(result.error).toBeInstanceOf(AppError)
    expect(result.error).toMatchObject({ statusCode: 401, code: 'unauthorized' })

    await deleteUser(user.userId)
    await deleteTenant(tenantId)
  })

  it('attaches tenant user context and hydrates fresh role/tenant/name/email', async () => {
    const { tenantId } = await createTenantWithKey()
    const user = await createUser({ tenantId, name: 'Session User' })
    const req = createRequest({
      userId: user.userId,
      email: 'stale@test.com',
      name: 'Stale Name',
      tenantId: 'aa0e8400-e29b-41d4-a716-446655440001',
      isSuperAdmin: true,
      tenantName: 'Stale Tenant',
      credentialFingerprint: user.credentialFingerprint,
    })

    await getDb()
      .update(users)
      .set({ name: 'Fresh Name', email: `fresh-${user.userId}@test.com` })
      .where(eq(users.id, user.userId))

    const result = await runRequireSession(req)

    expect(result.error).toBeUndefined()
    expect(result.userId).toBe(user.userId)
    expect(result.tenantId).toBe(tenantId)
    expect(result.isSuperAdmin).toBe(false)
    expect(req.session.email).toBe(`fresh-${user.userId}@test.com`)
    expect(req.session.name).toBe('Fresh Name')
    expect(req.session.tenantId).toBe(tenantId)
    expect(req.session.isSuperAdmin).toBe(false)
    expect(req.session.credentialFingerprint).toBe(user.credentialFingerprint)
    expect(JSON.stringify(req.session)).not.toContain(user.passwordHash)

    await deleteUser(user.userId)
    await deleteTenant(tenantId)
  })

  it('rejects a denormalized blob for a deleted user even with a fingerprint', async () => {
    const result = await runRequireSession(
      createRequest({
        userId: '880e8400-e29b-41d4-a716-446655440099',
        email: 'gone@test.com',
        name: 'Gone',
        tenantId: 'aa0e8400-e29b-41d4-a716-446655440001',
        isSuperAdmin: false,
        tenantName: 'Acme',
        credentialFingerprint: createCredentialFingerprint(await hashPassword('x'.repeat(12))),
      }),
    )

    expect(result.error).toBeInstanceOf(AppError)
    expect(result.error).toMatchObject({ statusCode: 401, code: 'unauthorized' })
  })

  it('attaches super-admin context without tenantId', async () => {
    const user = await createUser({ tenantId: null, isSuperAdmin: true })

    const result = await runRequireSession(
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
    expect(result.userId).toBe(user.userId)
    expect(result.tenantId).toBeUndefined()
    expect(result.isSuperAdmin).toBe(true)

    await deleteUser(user.userId)
  })
})
