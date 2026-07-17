import { users } from '@webhook/shared/schema'
import { and, count, desc, eq, isNull, sql } from 'drizzle-orm'
import type { NextFunction, Request, Response } from 'express'
import { getDb } from '../../db/client.js'
import { recordAudit } from '../../lib/audit.js'
import { AppError } from '../../lib/errors.js'
import { parsePagination } from '../../lib/pagination.js'
import { createInvite } from '../invites/handlers.js'
import { parseUserId } from './validation.js'

const operatorFilter = and(eq(users.isSuperAdmin, true), isNull(users.tenantId))

function toOperatorJson(row: {
  id: string
  email: string
  name: string
  createdAt: Date
}) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    created_at: row.createdAt.toISOString(),
  }
}

export async function listOperators(req: Request, res: Response, next: NextFunction) {
  try {
    const { limit, offset } = parsePagination(req.query)
    const db = getDb()

    const [countRow] = await db.select({ value: count() }).from(users).where(operatorFilter)
    const total = countRow?.value ?? 0

    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(operatorFilter)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset)

    res.json({
      data: rows.map((row) => toOperatorJson(row)),
      total,
      limit,
      offset,
    })
  } catch (err) {
    next(err)
  }
}

export async function inviteOperator(req: Request, res: Response, next: NextFunction) {
  const body =
    typeof req.body === 'object' && req.body !== null
      ? { ...req.body, kind: 'platform_admin' as const }
      : { kind: 'platform_admin' as const }

  req.body = body
  await createInvite(req, res, next)
}

export async function deleteOperator(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    parseUserId(id)

    if (req.userId === id) {
      throw new AppError(409, 'cannot_delete_self', 'You cannot remove your own operator account')
    }

    const db = getDb()
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT id FROM ${users} WHERE is_super_admin = true AND tenant_id IS NULL FOR UPDATE`,
      )

      const [target] = await tx
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(and(eq(users.id, id), operatorFilter))
        .limit(1)

      if (!target) {
        throw new AppError(404, 'not_found', 'Operator not found')
      }

      const [countRow] = await tx.select({ value: count() }).from(users).where(operatorFilter)

      if ((countRow?.value ?? 0) <= 1) {
        throw new AppError(409, 'last_operator', 'Cannot remove the last platform operator')
      }

      await tx.delete(users).where(eq(users.id, target.id))
      await recordAudit(tx, 'operator.removed', req.userId!, null, { email: target.email })
    })

    res.status(204).send()
  } catch (err) {
    next(err)
  }
}
