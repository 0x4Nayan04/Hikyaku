import { tenants, users } from '@webhook/shared/schema'
import { count, desc, eq } from 'drizzle-orm'
import type { NextFunction, Request, Response } from 'express'
import { hashPassword } from '../../auth/password.js'
import { getDb } from '../../db/client.js'
import { AppError } from '../../lib/errors.js'
import { parsePagination } from '../../lib/pagination.js'
import { toUserJson } from '../auth/serialize.js'
import { toAdminTenantJson } from './serialize.js'
import { parseCreateTenantBody, parseCreateUserBody, parseTenantId } from './validation.js'

const tenantColumns = {
  id: tenants.id,
  name: tenants.name,
  createdAt: tenants.createdAt,
}

const userColumns = {
  id: users.id,
  email: users.email,
  name: users.name,
  isSuperAdmin: users.isSuperAdmin,
}

async function assertEmailAvailable(email: string): Promise<void> {
  const db = getDb()
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  if (existing) {
    throw new AppError(409, 'conflict', 'Email already in use')
  }
}

export async function listTenants(req: Request, res: Response, next: NextFunction) {
  try {
    const { limit, offset } = parsePagination(req.query)
    const db = getDb()

    const [countRow] = await db.select({ value: count() }).from(tenants)
    const total = countRow?.value ?? 0

    const rows = await db
      .select(tenantColumns)
      .from(tenants)
      .orderBy(desc(tenants.createdAt))
      .limit(limit)
      .offset(offset)

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

export async function createTenantWithOwner(req: Request, res: Response, next: NextFunction) {
  try {
    const body = parseCreateTenantBody(req.body)
    await assertEmailAvailable(body.owner_email)

    const passwordHash = await hashPassword(body.owner_password)
    const db = getDb()

    const result = await db.transaction(async (tx) => {
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

export async function createTenantUser(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    parseTenantId(id)

    const body = parseCreateUserBody(req.body)
    await assertEmailAvailable(body.email)

    const db = getDb()
    const [tenant] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.id, id))
      .limit(1)

    if (!tenant) {
      throw new AppError(404, 'not_found', 'Tenant not found')
    }

    const passwordHash = await hashPassword(body.password)
    const [user] = await db
      .insert(users)
      .values({
        tenantId: tenant.id,
        email: body.email,
        passwordHash,
        name: body.name,
        isSuperAdmin: false,
      })
      .returning(userColumns)

    res.status(201).json({ user: toUserJson(user) })
  } catch (err) {
    next(err)
  }
}
