import { tenants, users } from '@webhook/shared/schema'
import type { TenantStatus } from '@webhook/shared/constants'
import { count, desc, eq, ilike, or, sql } from 'drizzle-orm'
import type { NextFunction, Request, Response } from 'express'
import { hashPassword } from '../../auth/password.js'
import { getDb } from '../../db/client.js'
import { recordAudit } from '../../lib/audit.js'
import { AppError } from '../../lib/errors.js'
import { assertEmailAvailable } from '../../lib/invites.js'
import { parsePagination } from '../../lib/pagination.js'
import { toUserJson } from '../auth/serialize.js'
import { toAdminTenantJson } from './serialize.js'
import {
  parseCreateTenantBody,
  parseCreateUserBody,
  parsePatchTenantBody,
  parseResetUserPasswordBody,
  parseTenantId,
  parseUserId,
} from './validation.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const tenantColumns = {
  id: tenants.id,
  name: tenants.name,
  status: tenants.status,
  createdAt: tenants.createdAt,
}

const userColumns = {
  id: users.id,
  email: users.email,
  name: users.name,
  isSuperAdmin: users.isSuperAdmin,
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
    const idFilter = UUID_RE.test(searchQuery ?? '')
      ? eq(tenants.id, searchQuery!)
      : isIdPrefix
        ? sql`${tenants.id}::text LIKE ${`${searchQuery!.toLowerCase()}%`}`
        : undefined
    const nameFilter = escaped ? ilike(tenants.name, `%${escaped}%`) : undefined
    const filter = nameFilter && idFilter ? or(nameFilter, idFilter) : (nameFilter ?? idFilter)

    const [countRow] = searchQuery
      ? await db.select({ value: count() }).from(tenants).where(filter)
      : await db.select({ value: count() }).from(tenants)
    const total = countRow?.value ?? 0

    const query = db
      .select(tenantColumns)
      .from(tenants)
      .orderBy(desc(tenants.createdAt))
      .limit(limit)
      .offset(offset)

    const rows = searchQuery ? await query.where(filter) : await query

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

export async function createTenantWithOwner(req: Request, res: Response, next: NextFunction) {
  try {
    const body = parseCreateTenantBody(req.body)
    const passwordHash = await hashPassword(body.owner_password)
    const db = getDb()

    const result = await db.transaction(async (tx) => {
      await assertEmailAvailable(body.owner_email, tx)

      const [tenant] = await tx
        .insert(tenants)
        .values({ name: body.tenant_name })
        .returning(tenantColumns)

      const [user] = await tx
        .insert(users)
        .values({
          tenantId: tenant.id,
          email: body.owner_email,
          passwordHash,
          name: body.owner_name,
          isSuperAdmin: false,
        })
        .returning(userColumns)

      await recordAudit(tx, 'tenant.created', req.userId!, tenant.id, {
        tenantName: body.tenant_name,
        ownerEmail: body.owner_email,
      })

      return { tenant, user }
    })

    res.status(201).json({
      tenant: toAdminTenantJson(result.tenant),
      user: toUserJson(result.user),
    })
  } catch (err) {
    next(err)
  }
}

export async function deleteTenant(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    parseTenantId(id)

    const db = getDb()

    const [tenant] = await db
      .select({ id: tenants.id, name: tenants.name })
      .from(tenants)
      .where(eq(tenants.id, id))
      .limit(1)

    if (!tenant) {
      throw new AppError(404, 'not_found', 'Tenant not found')
    }

    await recordAudit(db, 'tenant.deleted', req.userId!, id, {
      tenantId: tenant.id,
      tenantName: tenant.name,
    })

    await db.delete(tenants).where(eq(tenants.id, id))

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

    const [existing] = await db
      .select({ name: tenants.name })
      .from(tenants)
      .where(eq(tenants.id, id))
      .limit(1)

    if (!existing) {
      throw new AppError(404, 'not_found', 'Tenant not found')
    }

    const [row] = await db
      .update(tenants)
      .set({ name: body.tenant_name })
      .where(eq(tenants.id, id))
      .returning(tenantColumns)

    await recordAudit(db, 'tenant.renamed', req.userId!, id, {
      oldName: existing.name,
      newName: body.tenant_name,
    })

    res.json(toAdminTenantJson(row))
  } catch (err) {
    next(err)
  }
}

async function setTenantStatus(
  req: Request,
  res: Response,
  next: NextFunction,
  status: TenantStatus,
) {
  try {
    const { id } = req.params
    parseTenantId(id)

    const db = getDb()
    const [existing] = await db
      .select(tenantColumns)
      .from(tenants)
      .where(eq(tenants.id, id))
      .limit(1)

    if (!existing) {
      throw new AppError(404, 'not_found', 'Tenant not found')
    }

    if (existing.status === status) {
      res.json(toAdminTenantJson(existing))
      return
    }

    const row = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(tenants)
        .set({ status })
        .where(eq(tenants.id, id))
        .returning(tenantColumns)

      await recordAudit(
        tx,
        status === 'suspended' ? 'tenant.suspended' : 'tenant.unsuspended',
        req.userId!,
        id,
        { tenantName: existing.name },
      )

      return updated
    })

    res.json(toAdminTenantJson(row))
  } catch (err) {
    next(err)
  }
}

export function suspendTenant(req: Request, res: Response, next: NextFunction) {
  return setTenantStatus(req, res, next, 'suspended')
}

export function unsuspendTenant(req: Request, res: Response, next: NextFunction) {
  return setTenantStatus(req, res, next, 'active')
}

export async function createTenantUser(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    parseTenantId(id)

    const body = parseCreateUserBody(req.body)
    const passwordHash = await hashPassword(body.password)
    const db = getDb()

    const [tenant] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.id, id))
      .limit(1)

    if (!tenant) {
      throw new AppError(404, 'not_found', 'Tenant not found')
    }

    const user = await db.transaction(async (tx) => {
      await assertEmailAvailable(body.email, tx)

      const [u] = await tx
        .insert(users)
        .values({
          tenantId: tenant.id,
          email: body.email,
          passwordHash,
          name: body.name,
          isSuperAdmin: false,
        })
        .returning(userColumns)

      return u
    })

    res.status(201).json({ user: toUserJson(user) })
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

      await tx.delete(users).where(eq(users.id, target.id))
      await recordAudit(tx, 'user.deleted', req.userId!, id, { email: target.email })
    })

    res.status(204).send()
  } catch (err) {
    next(err)
  }
}

export async function resetTenantUserPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { id, userId } = req.params
    parseTenantId(id)
    parseUserId(userId)
    const body = parseResetUserPasswordBody(req.body)
    const passwordHash = await hashPassword(body.password)
    const db = getDb()

    const [target] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(sql`${users.id} = ${userId} AND ${users.tenantId} = ${id}`)
      .limit(1)

    if (!target) {
      throw new AppError(404, 'not_found', 'User not found')
    }

    await db.transaction(async (tx) => {
      await tx.update(users).set({ passwordHash }).where(eq(users.id, target.id))
      await recordAudit(tx, 'user.password_reset', req.userId!, id, { email: target.email })
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

    const [countRow] = await db.select({ value: count() }).from(users).where(eq(users.tenantId, id))
    const total = countRow?.value ?? 0

    const rows = await db
      .select(userColumns)
      .from(users)
      .where(eq(users.tenantId, id))
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset)

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
