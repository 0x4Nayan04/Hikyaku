import { generateInviteToken, hashInviteToken } from '@webhook/shared/crypto'
import { invites, tenants, users } from '@webhook/shared/schema'
import { adminCreateInviteSchema } from '@webhook/shared/zod'
import { count, desc, eq, ilike, or, sql } from 'drizzle-orm'
import type { NextFunction, Request, Response } from 'express'
import { env } from '../../config.js'
import { getDb } from '../../db/client.js'
import { AppError } from '../../lib/errors.js'
import { assertEmailAvailable, assertNoPendingInvite } from '../../lib/invites.js'
import { parsePagination } from '../../lib/pagination.js'
import { revokeTenantSessions, revokeUserSessions } from '../../lib/revokeSessions.js'
import { isUuid, parseSchema } from '../../lib/validation.js'
import { toAdminTenantJson } from './serialize.js'
import { parsePatchTenantBody, parseTenantId, parseUserId } from './validation.js'
import { toUserJson, userColumns } from '../auth/serialize.js'

const tenantColumns = {
  id: tenants.id,
  name: tenants.name,
  createdAt: tenants.createdAt,
}

export async function listTenants(req: Request, res: Response, next: NextFunction) {
  try {
    const { limit, offset } = parsePagination(req.query)
    const searchQuery = typeof req.query.search === 'string' ? req.query.search.trim() : undefined
    const db = getDb()

    const escaped = searchQuery?.replace(/[%_]/g, '\\$&')
    const compactId = searchQuery?.replaceAll('-', '')
    const isIdPrefix =
      compactId !== undefined &&
      compactId.length >= 8 &&
      compactId.length <= 32 &&
      /^[0-9a-f]+$/i.test(compactId)
    const idFilter = isUuid(searchQuery ?? '')
      ? eq(tenants.id, searchQuery!)
      : isIdPrefix
        ? sql`${tenants.id}::text LIKE ${`${searchQuery!.toLowerCase()}%`}`
        : undefined
    const nameFilter = escaped ? ilike(tenants.name, `%${escaped}%`) : undefined
    const filter = nameFilter && idFilter ? or(nameFilter, idFilter) : (nameFilter ?? idFilter)

    const countQuery = searchQuery
      ? db.select({ value: count() }).from(tenants).where(filter)
      : db.select({ value: count() }).from(tenants)
    const query = db
      .select(tenantColumns)
      .from(tenants)
      .orderBy(desc(tenants.createdAt))
      .limit(limit)
      .offset(offset)
    const [countResult, rows] = await Promise.all([
      countQuery,
      searchQuery ? query.where(filter) : query,
    ])
    const [countRow] = countResult
    const total = countRow?.value ?? 0

    res.json({
      data: rows.map((row) => toAdminTenantJson(row)),
      total,
      limit,
      offset,
    })
  } catch (err) {
    next(err)
  }
}

export async function getTenant(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    parseTenantId(id)

    const db = getDb()
    const [row] = await db.select(tenantColumns).from(tenants).where(eq(tenants.id, id)).limit(1)

    if (!row) {
      throw new AppError(404, 'not_found', 'Tenant not found')
    }

    res.json(toAdminTenantJson(row))
  } catch (err) {
    next(err)
  }
}

export async function deleteTenant(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    parseTenantId(id)

    const db = getDb()

    await db.transaction(async (tx) => {
      const [tenant] = await tx
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.id, id))
        .limit(1)

      if (!tenant) {
        throw new AppError(404, 'not_found', 'Tenant not found')
      }

      await revokeTenantSessions(id, tx)
      await tx.delete(tenants).where(eq(tenants.id, id))
    })

    res.status(204).send()
  } catch (err) {
    next(err)
  }
}

export async function patchTenant(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    parseTenantId(id)

    const body = parsePatchTenantBody(req.body)
    const db = getDb()

    const [row] = await db
      .update(tenants)
      .set({ name: body.tenant_name })
      .where(eq(tenants.id, id))
      .returning(tenantColumns)

    if (!row) {
      throw new AppError(404, 'not_found', 'Tenant not found')
    }

    res.json(toAdminTenantJson(row))
  } catch (err) {
    next(err)
  }
}

export async function deleteTenantUser(req: Request, res: Response, next: NextFunction) {
  try {
    const { id, userId } = req.params
    parseTenantId(id)
    parseUserId(userId)

    if (req.userId === userId) {
      throw new AppError(409, 'cannot_delete_self', 'You cannot delete your own account')
    }

    const db = getDb()
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM ${tenants} WHERE id = ${id} FOR UPDATE`)

      const [target] = await tx
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(sql`${users.id} = ${userId} AND ${users.tenantId} = ${id}`)
        .limit(1)

      if (!target) {
        throw new AppError(404, 'not_found', 'User not found')
      }

      const [countRow] = await tx
        .select({ value: count() })
        .from(users)
        .where(eq(users.tenantId, id))

      if ((countRow?.value ?? 0) <= 1) {
        throw new AppError(409, 'last_tenant_user', 'Cannot delete the last user in a tenant')
      }

      await revokeUserSessions(target.id, tx)
      await tx.delete(users).where(eq(users.id, target.id))
    })

    res.status(204).send()
  } catch (err) {
    next(err)
  }
}

export async function listTenantUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    parseTenantId(id)

    const { limit, offset } = parsePagination(req.query)
    const db = getDb()

    const [tenant] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.id, id))
      .limit(1)

    if (!tenant) {
      throw new AppError(404, 'not_found', 'Tenant not found')
    }

    const [countResult, rows] = await Promise.all([
      db.select({ value: count() }).from(users).where(eq(users.tenantId, id)),
      db
        .select(userColumns)
        .from(users)
        .where(eq(users.tenantId, id))
        .orderBy(desc(users.createdAt))
        .limit(limit)
        .offset(offset),
    ])
    const [countRow] = countResult
    const total = countRow?.value ?? 0

    res.json({
      data: rows.map((row) => toUserJson(row)),
      total,
      limit,
      offset,
    })
  } catch (err) {
    next(err)
  }
}

export async function createInvite(req: Request, res: Response, next: NextFunction) {
  try {
    const body = parseSchema(adminCreateInviteSchema, req.body)
    const createdByUserId = req.userId
    if (!createdByUserId) {
      throw new AppError(401, 'unauthorized', 'Missing or invalid session')
    }

    const db = getDb()
    const rawToken = generateInviteToken()
    const tokenHash = hashInviteToken(rawToken)
    const expiresAt = new Date(Date.now() + env.INVITE_TTL_MS)
    const email = body.kind === 'tenant_owner' ? body.owner_email : body.email

    await db.transaction(async (tx) => {
      // Serializes check-and-create for this email; released automatically on commit or rollback.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${email}))`)
      await assertEmailAvailable(email, tx)
      await assertNoPendingInvite(email, tx)

      if (body.kind === 'tenant_owner') {
        await tx.insert(invites).values({
          tokenHash,
          kind: body.kind,
          email,
          tenantName: body.tenant_name,
          invitedName: body.owner_name ?? null,
          createdByUserId,
          expiresAt,
        })
      } else if (body.kind === 'tenant_user') {
        const [tenant] = await tx
          .select({ id: tenants.id })
          .from(tenants)
          .where(eq(tenants.id, body.tenant_id))
          .limit(1)

        if (!tenant) {
          throw new AppError(404, 'not_found', 'Tenant not found')
        }

        await tx.insert(invites).values({
          tokenHash,
          kind: body.kind,
          email,
          tenantId: body.tenant_id,
          invitedName: body.name ?? null,
          createdByUserId,
          expiresAt,
        })
      } else {
        const _exhaustive: never = body
        throw new AppError(500, 'internal_error', `Unknown invite kind: ${String(_exhaustive)}`)
      }
    })

    const inviteUrl = `${env.WEB_APP_URL}/accept-invite?token=${encodeURIComponent(rawToken)}`

    res.status(201).json({
      invite_url: inviteUrl,
      expires_at: expiresAt.toISOString(),
    })
  } catch (err) {
    next(err)
  }
}
