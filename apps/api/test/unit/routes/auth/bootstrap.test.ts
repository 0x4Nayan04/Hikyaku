import { count, eq } from 'drizzle-orm'
import type { NextFunction, Request, Response } from 'express'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { users } from '@webhook/shared/schema'
import { verifyPassword } from '@webhook/shared/password'
import '../../../../src/config.js'
import { env } from '../../../../src/config.js'
import { closePool, getDb } from '../../../../src/db/client.js'
import { AppError } from '../../../../src/lib/errors.js'
import { bootstrap } from '../../../../src/routes/auth/handlers.js'
import { createUser, deleteUser } from '../../../helpers/user.js'

const bootstrapPayload = {
  email: `bootstrap-unit-${Date.now()}@test.com`,
  password: 'secure-password-min-12-chars',
  name: 'Platform Admin',
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
  }
  return res as Response & { statusCode: number; body: unknown }
}

async function runBootstrap(
  body: typeof bootstrapPayload,
  adminSecret = env.ADMIN_BOOTSTRAP_SECRET,
): Promise<{ error?: unknown; statusCode?: number; body?: unknown }> {
  const req = {
    body,
    get(name: string) {
      if (name.toLowerCase() === 'x-admin-secret') {
        return adminSecret
      }
      return undefined
    },
  } as Request

  return new Promise((resolve) => {
    const res = createMockRes((result) => {
      resolve(result)
    })

    const next: NextFunction = (err?: unknown) => {
      if (err) {
        resolve({ error: err })
      }
    }

    void bootstrap(req, res, next)
  })
}

describe('bootstrap one-time guard', () => {
  let usersExistAtStart = false
  let createdBootstrapUserId: string | undefined

  beforeAll(async () => {
    const [countRow] = await getDb().select({ value: count() }).from(users)
    usersExistAtStart = (countRow?.value ?? 0) > 0
  })

  afterAll(async () => {
    if (createdBootstrapUserId) {
      await deleteUser(createdBootstrapUserId)
    }
    await closePool()
  })

  it('rejects bootstrap when any user already exists', async () => {
    const { userId } = await createUser({ tenantId: null, isSuperAdmin: true })

    const result = await runBootstrap(bootstrapPayload)

    expect(result.error).toBeInstanceOf(AppError)
    expect(result.error).toMatchObject({
      statusCode: 403,
      code: 'forbidden',
      message: 'Bootstrap is disabled',
    })

    const rows = await getDb()
      .select({ email: users.email })
      .from(users)
      .where(eq(users.email, bootstrapPayload.email))

    expect(rows).toHaveLength(0)

    await deleteUser(userId)
  })

  it('creates a super-admin with a bcrypt password hash when no users exist', async () => {
    const [countRow] = await getDb().select({ value: count() }).from(users)
    if (usersExistAtStart || (countRow?.value ?? 0) > 0) {
      return
    }

    const result = await runBootstrap(bootstrapPayload)

    expect(result.statusCode).toBe(201)
    expect(result.body).toMatchObject({
      user: {
        email: bootstrapPayload.email,
        is_super_admin: true,
      },
    })

    const [row] = await getDb()
      .select({
        id: users.id,
        passwordHash: users.passwordHash,
        tenantId: users.tenantId,
        isSuperAdmin: users.isSuperAdmin,
      })
      .from(users)
      .where(eq(users.email, bootstrapPayload.email))
      .limit(1)

    expect(row).toMatchObject({
      tenantId: null,
      isSuperAdmin: true,
    })
    expect(row?.passwordHash).toMatch(/^\$2[aby]\$12\$/)
    await expect(verifyPassword(bootstrapPayload.password, row!.passwordHash)).resolves.toBe(true)

    createdBootstrapUserId = row?.id
  })
})
