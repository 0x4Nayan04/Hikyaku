import { createWorkspaceSchema } from '@webhook/shared/zod'
import { parseSchema } from '../../lib/validation.js'
import { count, eq, sql } from 'drizzle-orm'
import type { Request, Response } from 'express'
import { tenants, users } from '@webhook/shared/schema'
import { hashPassword, INVALID_PASSWORD_HASH, verifyPassword } from '@webhook/shared/password'
import { writeSessionUser } from '../../auth/session.js'
import { getDb } from '../../db/client.js'
import { AppError } from '../../lib/errors.js'
import { asyncHandler } from '../../lib/asyncHandler.js'
import { userEmailMatches } from '../../lib/invites.js'
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
export const bootstrapStatus = asyncHandler(async (_req: Request, res: Response) => {
  const available = await isBootstrapAvailable()
  res.status(200).json({ available })
})

export const bootstrap = asyncHandler(async (req: Request, res: Response) => {
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

    const [workspace] = await tx.insert(tenants).values({ name: body.workspace_name }).returning()
    const [created] = await tx
      .insert(users)
      .values({
        email: body.email,
        passwordHash,
        name: body.name,
        isSuperAdmin: true,
        tenantId: workspace.id,
      })
      .returning(userColumns)

    return created
  })

  res.status(201).json({
    user: { id: user.id, email: user.email, is_super_admin: user.isSuperAdmin },
  })
})

export const login = asyncHandler(async (req: Request, res: Response) => {
  const body = parseLoginBody(req.body)
  const db = getDb()

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      isSuperAdmin: users.isSuperAdmin,
      passwordHash: users.passwordHash,
      tenantId: users.tenantId,
      tenantName: tenants.name,
    })
    .from(users)
    .leftJoin(tenants, eq(users.tenantId, tenants.id))
    .where(userEmailMatches(body.email))
    .limit(1)

  const user = rows[0]
  // Always perform bcrypt work so unknown users are not distinguishable by timing.
  const passwordMatches = await verifyPassword(
    body.password,
    user?.passwordHash ?? INVALID_PASSWORD_HASH,
  )
  if (!user || !passwordMatches) {
    throw new AppError(401, 'unauthorized', 'Invalid email or password')
  }

  await regenerateSession(req)
  writeSessionUser(req.session, {
    userId: user.id,
    email: user.email,
    name: user.name,
    tenantId: user.tenantId,
    isSuperAdmin: user.isSuperAdmin,
    tenantName: user.tenantName,
  })
  await saveSession(req)

  res.status(200).json({
    user: toUserJson({
      id: user.id,
      email: user.email,
      name: user.name,
      isSuperAdmin: user.isSuperAdmin,
      tenantId: user.tenantId,
    }),
  })
})

export const logout = asyncHandler(async (req: Request, res: Response) => {
  await destroySession(req)
  res.status(204).send()
})

export const me = asyncHandler(async (req: Request, res: Response) => {
  const session = req.session
  if (
    !session.userId ||
    session.email === undefined ||
    session.name === undefined ||
    session.isSuperAdmin === undefined
  ) {
    throw new AppError(401, 'unauthorized', 'Missing or invalid session')
  }

  res.status(200).json({
    user: toUserJson({
      id: session.userId,
      email: session.email,
      name: session.name,
      isSuperAdmin: session.isSuperAdmin,
      tenantId: session.tenantId,
    }),
    tenant: session.tenantId
      ? { id: session.tenantId, name: session.tenantName ?? '' }
      : null,
  })
})

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
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
})

/** Existing admin-only installations can attach exactly one workspace to their account. */
export const createMyWorkspace = asyncHandler(async (req: Request, res: Response) => {
  const body = parseSchema(createWorkspaceSchema, req.body ?? {})
  const workspace = await getDb().transaction(async (tx) => {
    const [user] = await tx.select().from(users).where(eq(users.id, req.userId!)).for('update')
    if (!user?.isSuperAdmin) throw new AppError(403, 'forbidden', 'Admin access required')
    if (user.tenantId) {
      const [existing] = await tx.select().from(tenants).where(eq(tenants.id, user.tenantId))
      return existing
    }
    const [created] = await tx.insert(tenants).values({ name: body.workspace_name }).returning()
    await tx.update(users).set({ tenantId: created.id }).where(eq(users.id, user.id))
    await revokeUserSessions(user.id, tx)
    return created
  })
  // Recreate this session after invalidating older cached admin-only sessions.
  const { email, name, userId } = req.session
  await regenerateSession(req)
  writeSessionUser(req.session, {
    userId: userId!, email: email!, name: name!, isSuperAdmin: true,
    tenantId: workspace.id, tenantName: workspace.name,
  })
  await saveSession(req)
  res.status(200).json({ id: workspace.id, name: workspace.name })
})
