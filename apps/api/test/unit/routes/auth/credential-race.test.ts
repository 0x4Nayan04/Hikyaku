import { randomUUID } from 'node:crypto'
import { eq, sql } from 'drizzle-orm'
import type { NextFunction, Request, Response } from 'express'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { users } from '@hikyaku/shared/schema'
import { hashPassword } from '@hikyaku/shared/password'
import '../../../../src/config.js'
import {
  createCredentialFingerprint,
  writeSessionUser,
  type SessionUserBlob,
} from '../../../../src/auth/session.js'
import { attachSessionUser } from '../../../../src/auth/requireSession.js'
import { closePool, getDb } from '../../../../src/db/client.js'
import { AppError } from '../../../../src/lib/errors.js'
import { createTenantWithKey, deleteTenant } from '../../../helpers/tenant.js'
import { createUser, deleteUser } from '../../../helpers/user.js'

const passwordGates = vi.hoisted(() => ({
  verifyWait: null as Promise<void> | null,
  hashWait: null as Promise<void> | null,
  onVerifyEnter: null as (() => void) | null,
  onHashEnter: null as (() => void) | null,
}))

vi.mock('@hikyaku/shared/password', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@hikyaku/shared/password')>()
  return {
    ...actual,
    async verifyPassword(plain: string, hash: string) {
      passwordGates.onVerifyEnter?.()
      if (passwordGates.verifyWait) await passwordGates.verifyWait
      return actual.verifyPassword(plain, hash)
    },
    async hashPassword(plain: string) {
      passwordGates.onHashEnter?.()
      if (passwordGates.hashWait) await passwordGates.hashWait
      return actual.hashPassword(plain)
    },
  }
})

const { changePassword, createMyWorkspace, login, me } = await import(
  '../../../../src/routes/auth/handlers.js'
)

type SessionRecord = Partial<SessionUserBlob> & {
  regenerate: (cb: (err?: Error) => void) => void
  save: (cb: (err?: Error) => void) => void
  destroy: (cb: (err?: Error) => void) => void
}

function createMutableSession(initial: Partial<SessionUserBlob> = {}): SessionRecord {
  const session = { ...initial } as SessionRecord
  session.regenerate = (cb) => {
    for (const key of Object.keys(session) as Array<keyof SessionRecord>) {
      if (typeof session[key] !== 'function') delete session[key]
    }
    cb()
  }
  session.save = (cb) => cb()
  session.destroy = (cb) => {
    for (const key of Object.keys(session) as Array<keyof SessionRecord>) {
      if (typeof session[key] !== 'function') delete session[key]
    }
    cb()
  }
  return session
}

function createRequest(partial: {
  body?: unknown
  userId?: string
  session: SessionRecord
}): Request {
  return {
    ...partial,
  } as Request
}

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
    send() {
      onComplete({ statusCode: res.statusCode, body: res.body })
      return res
    },
  }
  return res as Response & { statusCode: number; body: unknown }
}

async function runHandler(
  handler: (req: Request, res: Response, next: NextFunction) => unknown,
  req: Request,
): Promise<{ error?: unknown; statusCode?: number; body?: unknown }> {
  return new Promise((resolve) => {
    const res = createMockRes((result) => resolve(result))
    const next: NextFunction = (err?: unknown) => {
      if (err) resolve({ error: err })
    }
    void handler(req, res, next)
  })
}

describe('auth credential race guards', () => {
  beforeEach(() => {
    passwordGates.verifyWait = null
    passwordGates.hashWait = null
    passwordGates.onVerifyEnter = null
    passwordGates.onHashEnter = null
  })

  afterAll(async () => {
    await closePool()
  })

  it('rejects a late login session after concurrent password reset during verify', async () => {
    const { tenantId } = await createTenantWithKey()
    const user = await createUser({ tenantId })
    const oldFingerprint = user.credentialFingerprint
    const resetHash = await hashPassword(`reset-${randomUUID()}-password`)

    let releaseVerify!: () => void
    let enteredVerify!: () => void
    const verifyEntered = new Promise<void>((resolve) => {
      enteredVerify = resolve
    })
    passwordGates.onVerifyEnter = () => enteredVerify()
    passwordGates.verifyWait = new Promise<void>((resolve) => {
      releaseVerify = resolve
    })

    const session = createMutableSession()
    const loginPromise = runHandler(
      login,
      createRequest({
        body: { email: user.email, password: user.password },
        session,
      }),
    )

    await verifyEntered
    await getDb().update(users).set({ passwordHash: resetHash }).where(eq(users.id, user.userId))
    releaseVerify()

    const loginResult = await loginPromise
    expect(loginResult.error).toBeUndefined()
    expect(loginResult.statusCode).toBe(200)
    expect(session.credentialFingerprint).toBe(oldFingerprint)
    expect(JSON.stringify(loginResult.body)).not.toContain('credentialFingerprint')
    expect(JSON.stringify(loginResult.body)).not.toContain(user.passwordHash)

    await expect(attachSessionUser(createRequest({ session }))).rejects.toMatchObject({
      statusCode: 401,
      code: 'unauthorized',
    })

    await deleteUser(user.userId)
    await deleteTenant(tenantId)
  })

  it('rejects a late login session after concurrent user deletion during verify', async () => {
    const { tenantId } = await createTenantWithKey()
    const user = await createUser({ tenantId })

    let releaseVerify!: () => void
    let enteredVerify!: () => void
    const verifyEntered = new Promise<void>((resolve) => {
      enteredVerify = resolve
    })
    passwordGates.onVerifyEnter = () => enteredVerify()
    passwordGates.verifyWait = new Promise<void>((resolve) => {
      releaseVerify = resolve
    })

    const session = createMutableSession()
    const loginPromise = runHandler(
      login,
      createRequest({
        body: { email: user.email, password: user.password },
        session,
      }),
    )

    await verifyEntered
    await deleteUser(user.userId)
    releaseVerify()

    const loginResult = await loginPromise
    expect(loginResult.error).toBeUndefined()
    expect(loginResult.statusCode).toBe(200)
    expect(session.userId).toBe(user.userId)
    expect(session.credentialFingerprint).toBe(user.credentialFingerprint)

    await expect(attachSessionUser(createRequest({ session }))).rejects.toBeInstanceOf(AppError)

    await deleteTenant(tenantId)
  })

  it('does not overwrite a concurrent reset or revoke newer sessions on stale changePassword', async () => {
    const { tenantId } = await createTenantWithKey()
    const user = await createUser({ tenantId })
    const resetHash = await hashPassword(`reset-${randomUUID()}-password`)
    const newerSessionId = `newer-${randomUUID()}`
    await getDb().execute(sql`
      INSERT INTO sessions (sid, sess, expire)
      VALUES (
        ${newerSessionId},
        ${JSON.stringify({
          cookie: { originalMaxAge: 60_000 },
          userId: user.userId,
          credentialFingerprint: 'newer-session-fingerprint',
        })}::json,
        NOW() + interval '1 hour'
      )
    `)

    let releaseHash!: () => void
    let enteredHash!: () => void
    const hashEntered = new Promise<void>((resolve) => {
      enteredHash = resolve
    })
    passwordGates.onHashEnter = () => enteredHash()
    passwordGates.hashWait = new Promise<void>((resolve) => {
      releaseHash = resolve
    })

    const session = createMutableSession({
      userId: user.userId,
      email: user.email,
      name: 'Session User',
      tenantId,
      isSuperAdmin: false,
      tenantName: 'Acme',
      credentialFingerprint: user.credentialFingerprint,
    })
    const changePromise = runHandler(
      changePassword,
      createRequest({
        body: {
          current_password: user.password,
          new_password: `changed-${randomUUID()}-password`,
        },
        userId: user.userId,
        session,
      }),
    )

    await hashEntered
    await getDb().update(users).set({ passwordHash: resetHash }).where(eq(users.id, user.userId))
    releaseHash()

    const changeResult = await changePromise
    expect(changeResult.error).toBeInstanceOf(AppError)
    expect(changeResult.error).toMatchObject({ statusCode: 401, code: 'unauthorized' })

    const [row] = await getDb()
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, user.userId))
      .limit(1)
    expect(row?.passwordHash).toBe(resetHash)

    const sessions = await getDb().execute(sql`SELECT sid FROM sessions WHERE sid = ${newerSessionId}`)
    expect(sessions.rowCount).toBe(1)

    await getDb().execute(sql`DELETE FROM sessions WHERE sid = ${newerSessionId}`)
    await deleteUser(user.userId)
    await deleteTenant(tenantId)
  })

  it('preserves the authenticated fingerprint across createMyWorkspace regenerate', async () => {
    const user = await createUser({ tenantId: null, isSuperAdmin: true })
    const fingerprint = user.credentialFingerprint
    const session = createMutableSession({
      userId: user.userId,
      email: user.email,
      name: 'Admin',
      tenantId: null,
      isSuperAdmin: true,
      tenantName: null,
      credentialFingerprint: fingerprint,
    })

    const result = await runHandler(
      createMyWorkspace,
      createRequest({
        body: { workspace_name: 'Race Workspace' },
        userId: user.userId,
        session,
      }),
    )

    expect(result.error).toBeUndefined()
    expect(result.statusCode).toBe(200)
    expect(session.credentialFingerprint).toBe(fingerprint)
    expect(session.tenantId).toBeTruthy()

    const workspaceId = session.tenantId as string
    await deleteUser(user.userId)
    await getDb().execute(sql`DELETE FROM tenants WHERE id = ${workspaceId}`)
  })

  it('hydrates fresh user fields for /me and never exposes the fingerprint', async () => {
    const { tenantId } = await createTenantWithKey()
    const user = await createUser({ tenantId, name: 'Original' })
    const session = createMutableSession()
    writeSessionUser(session, {
      userId: user.userId,
      email: user.email,
      name: 'Original',
      tenantId,
      isSuperAdmin: false,
      tenantName: 'Old Tenant Name',
      credentialFingerprint: user.credentialFingerprint,
    })

    await getDb()
      .update(users)
      .set({ name: 'Updated Name', email: `updated-${user.userId}@test.com` })
      .where(eq(users.id, user.userId))

    await attachSessionUser(createRequest({ session }))

    const meResult = await runHandler(me, createRequest({ session }))
    expect(meResult.statusCode).toBe(200)
    expect(meResult.body).toMatchObject({
      user: {
        id: user.userId,
        email: `updated-${user.userId}@test.com`,
        name: 'Updated Name',
        is_super_admin: false,
      },
    })
    expect(JSON.stringify(meResult.body)).not.toContain('credentialFingerprint')
    expect(JSON.stringify(meResult.body)).not.toContain(user.passwordHash)
    expect(createCredentialFingerprint(user.passwordHash)).toBe(user.credentialFingerprint)

    await deleteUser(user.userId)
    await deleteTenant(tenantId)
  })
})
