import { count, eq, sql } from 'drizzle-orm'
import type { NextFunction, Request, Response } from 'express'
import { tenants, users } from '@webhook/shared/schema'
import { hashPassword, verifyPassword } from '@webhook/shared/password'
import { getDb } from '../../db/client.js'
import { AppError } from '../../lib/errors.js'
import { revokeUserSessions } from '../../lib/revokeSessions.js'
import { toUserJson, userColumns } from './serialize.js'
import {
  parseBootstrapBody,
  parseChangePasswordBody,
  parseLoginBody,
  requireAdminSecret,
} from './validation.js'

/** Transaction-scoped advisory lock so concurrent bootstrap cannot create two super-admins. */
const BOOTSTRAP_LOCK_KEY = 872_014_001

function saveSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.save((err) => {
      if (err) {
        reject(err)
        return
      }
      resolve()
    })
  })
}

function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) {
        reject(err)
        return
      }
      resolve()
    })
  })
}

function destroySession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.destroy((err) => {
      if (err) {
        reject(err)
        return
      }
      resolve()
    })
  })
}

async function isBootstrapAvailable(): Promise<boolean> {
  const [countRow] = await getDb().select({ value: count() }).from(users)
  return (countRow?.value ?? 0) === 0
}

/** Public: whether one-time bootstrap can still create the first user. No account data. */
export async function bootstrapStatus(_req: Request, res: Response, next: NextFunction) {
  try {
    const available = await isBootstrapAvailable()
    res.status(200).json({ available })
  } catch (err) {
    next(err)
  }
}

export async function bootstrap(req: Request, res: Response, next: NextFunction) {
  try {
    requireAdminSecret(req)
    const body = parseBootstrapBody(req.body)
    const passwordHash = await hashPassword(body.password)
    const db = getDb()

    const user = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${BOOTSTRAP_LOCK_KEY})`)

      const [countRow] = await tx.select({ value: count() }).from(users)
      if ((countRow?.value ?? 0) > 0) {
        throw new AppError(403, 'forbidden', 'Bootstrap is disabled')
      }

      const [created] = await tx
        .insert(users)
        .values({
          email: body.email,
          passwordHash,
          name: body.name,
          isSuperAdmin: true,
          tenantId: null,
        })
        .returning(userColumns)

      return created
    })

    res.status(201).json({
      user: { id: user.id, email: user.email, is_super_admin: user.isSuperAdmin },
    })
  } catch (err) {
    next(err)
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const body = parseLoginBody(req.body)
    const db = getDb()

    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        isSuperAdmin: users.isSuperAdmin,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .where(eq(users.email, body.email))
      .limit(1)

    const user = rows[0]
    // Keep the same response for missing users and wrong passwords.
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      throw new AppError(401, 'unauthorized', 'Invalid email or password')
    }

    await regenerateSession(req)
    req.session.userId = user.id
    await saveSession(req)

    res.status(200).json({
      user: toUserJson({
        id: user.id,
        email: user.email,
        name: user.name,
        isSuperAdmin: user.isSuperAdmin,
      }),
    })
  } catch (err) {
    next(err)
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    await destroySession(req)
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    const db = getDb()
    const userId = req.userId
    if (!userId) {
      throw new AppError(401, 'unauthorized', 'Missing or invalid session')
    }

    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        isSuperAdmin: users.isSuperAdmin,
        tenantId: users.tenantId,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    const user = rows[0]
    if (!user) {
      throw new AppError(401, 'unauthorized', 'Missing or invalid session')
    }

    let tenant: { id: string; name: string } | null = null
    if (user.tenantId) {
      const tenantRows = await db
        .select({ id: tenants.id, name: tenants.name })
        .from(tenants)
        .where(eq(tenants.id, user.tenantId))
        .limit(1)

      const tenantRow = tenantRows[0]
      if (tenantRow) {
        tenant = { id: tenantRow.id, name: tenantRow.name }
      }
    }

    res.status(200).json({
      user: toUserJson({
        id: user.id,
        email: user.email,
        name: user.name,
        isSuperAdmin: user.isSuperAdmin,
      }),
      tenant,
    })
  } catch (err) {
    next(err)
  }
}

export async function changePassword(req: Request, res: Response, next: NextFunction) {
  try {
    const body = parseChangePasswordBody(req.body)
    const userId = req.userId
    if (!userId) {
      throw new AppError(401, 'unauthorized', 'Missing or invalid session')
    }

    const db = getDb()
    const rows = await db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    const user = rows[0]
    if (!user || !(await verifyPassword(body.current_password, user.passwordHash))) {
      throw new AppError(401, 'invalid_credentials', 'Current password is incorrect')
    }

    const passwordHash = await hashPassword(body.new_password)
    await db.transaction(async (tx) => {
      await tx.update(users).set({ passwordHash }).where(eq(users.id, userId))
      await revokeUserSessions(userId, tx)
    })
    await destroySession(req)

    res.status(204).send()
  } catch (err) {
    next(err)
  }
}
