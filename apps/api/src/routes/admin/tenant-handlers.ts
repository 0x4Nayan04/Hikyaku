import { invites, tenants, users } from '@hikyaku/shared/schema'
import { adminPatchTenantSchema } from '@hikyaku/shared/zod'
import { and, count, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm'
import type { Request, Response } from 'express'
import { getDb } from '../../db/client.js'
import { AppError } from '../../lib/errors.js'
import { asyncHandler } from '../../lib/asyncHandler.js'
import { inviteEmailMatches, PASSWORD_RESET_KIND } from '../../auth/invites.js'
import { paginatedJson, parsePagination, takePage } from '../../lib/pagination.js'
import { revokeTenantSessions, revokeUserSessions } from '../../auth/revokeSessions.js'
import { isUuid, parseSchema } from '../../lib/validation.js'
import { toAdminTenantJson } from './serialize.js'
import { parseTenantId, parseUserId } from './validation.js'
import { toUserJson, userColumns } from '../auth/serialize.js'
import { assertWritableTenant } from '../../auth/readOnly.js'

const tenantColumns = {
  id: tenants.id,
  name: tenants.name,
  createdAt: tenants.createdAt,
}

export const listTenants = asyncHandler(async (req: Request, res: Response) => {
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
  let idFilter
  if (isUuid(searchQuery ?? '')) {
    idFilter = eq(tenants.id, searchQuery!)
  } else if (isIdPrefix && compactId !== undefined) {
    idFilter = sql`replace(${tenants.id}::text, '-', '') LIKE ${`${compactId.toLowerCase()}%`}`
  }
  const nameFilter = escaped ? ilike(tenants.name, `%${escaped}%`) : undefined
  const filter = nameFilter && idFilter ? or(nameFilter, idFilter) : (nameFilter ?? idFilter)

  const query = db
    .select(tenantColumns)
    .from(tenants)
    .orderBy(desc(tenants.createdAt), desc(tenants.id))
    .limit(limit + 1)
    .offset(offset)
  const rows = searchQuery ? await query.where(filter) : await query
  const page = takePage(rows, limit)

  res.json(
    paginatedJson(
      page.data.map((row) => toAdminTenantJson(row)),
      page.hasMore,
      limit,
      offset,
    ),
  )
})

export const getTenant = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params
  parseTenantId(id)

  const db = getDb()
  const [row] = await db.select(tenantColumns).from(tenants).where(eq(tenants.id, id)).limit(1)

  if (!row) {
    throw new AppError(404, 'not_found', 'Tenant not found')
  }

  res.json(toAdminTenantJson(row))
})

export const deleteTenant = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params
  parseTenantId(id)
  await assertWritableTenant(id)

  const db = getDb()

  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM ${tenants} WHERE id = ${id} FOR UPDATE`)
    const [tenant] = await tx
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.id, id))
      .limit(1)

    if (!tenant) {
      throw new AppError(404, 'not_found', 'Tenant not found')
    }

    const [admin] = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.tenantId, id), eq(users.isSuperAdmin, true)))
      .limit(1)
    if (admin)
      throw new AppError(
        409,
        'workspace_has_admin',
        'Cannot delete a workspace linked to a super-admin',
      )

    await revokeTenantSessions(id, tx)
    await tx.delete(tenants).where(eq(tenants.id, id))
  })

  res.status(204).send()
})

export const patchTenant = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params
  parseTenantId(id)
  await assertWritableTenant(id)

  const body = parseSchema(adminPatchTenantSchema, req.body)
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
})

export const deleteTenantUser = asyncHandler(async (req: Request, res: Response) => {
  const { id, userId } = req.params
  parseTenantId(id)
  parseUserId(userId)
  await assertWritableTenant(id)

  if (req.userId === userId) {
    throw new AppError(409, 'cannot_delete_self', 'You cannot delete your own account')
  }

  const db = getDb()
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM ${tenants} WHERE id = ${id} FOR UPDATE`)

    const [target] = await tx
      .select({ id: users.id, email: users.email, isSuperAdmin: users.isSuperAdmin })
      .from(users)
      .where(sql`${users.id} = ${userId} AND ${users.tenantId} = ${id}`)
      .limit(1)

    if (!target) {
      throw new AppError(404, 'not_found', 'User not found')
    }

    if (target.isSuperAdmin)
      throw new AppError(
        409,
        'cannot_delete_admin',
        'Cannot delete a super-admin through workspace management',
      )

    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${target.email}))`)

    const [countRow] = await tx.select({ value: count() }).from(users).where(eq(users.tenantId, id))

    if ((countRow?.value ?? 0) <= 1) {
      throw new AppError(409, 'last_tenant_user', 'Cannot delete the last user in a tenant')
    }

    await revokeUserSessions(target.id, tx)
    await tx
      .update(invites)
      .set({ acceptedAt: new Date() })
      .where(
        and(
          inviteEmailMatches(target.email),
          eq(invites.kind, PASSWORD_RESET_KIND),
          isNull(invites.acceptedAt),
        ),
      )
    await tx.delete(users).where(eq(users.id, target.id))
  })

  res.status(204).send()
})

export const listTenantUsers = asyncHandler(async (req: Request, res: Response) => {
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

  const rows = await db
    .select(userColumns)
    .from(users)
    .where(eq(users.tenantId, id))
    .orderBy(desc(users.createdAt), desc(users.id))
    .limit(limit + 1)
    .offset(offset)
  const page = takePage(rows, limit)

  res.json(
    paginatedJson(
      page.data.map((row) => toUserJson(row)),
      page.hasMore,
      limit,
      offset,
    ),
  )
})
