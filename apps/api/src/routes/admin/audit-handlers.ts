import { auditLog, users } from '@webhook/shared/schema'
import { count, desc, eq } from 'drizzle-orm'
import type { NextFunction, Request, Response } from 'express'
import { getDb } from '../../db/client.js'
import { parsePagination } from '../../lib/pagination.js'

type AuditLogRow = {
  id: string
  action: string
  actorId: string | null
  actorEmail: string | null
  tenantId: string | null
  metadata: unknown
  createdAt: Date
}

type AuditLogJson = {
  id: string
  action: string
  actor_id: string | null
  actor_email: string | null
  tenant_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

function toAuditLogJson(row: AuditLogRow): AuditLogJson {
  return {
    id: row.id,
    action: row.action,
    actor_id: row.actorId,
    actor_email: row.actorEmail,
    tenant_id: row.tenantId,
    metadata: row.metadata as Record<string, unknown> | null,
    created_at: row.createdAt.toISOString(),
  }
}

export async function listAuditLog(req: Request, res: Response, next: NextFunction) {
  try {
    const { limit, offset } = parsePagination(req.query)
    const actionFilter = typeof req.query.action === 'string' ? req.query.action : undefined
    const db = getDb()

    const whereClause = actionFilter ? eq(auditLog.action, actionFilter) : undefined

    const [countRow] = await db.select({ value: count() }).from(auditLog).where(whereClause)

    const total = countRow?.value ?? 0

    const rows = await db
      .select({
        id: auditLog.id,
        action: auditLog.action,
        actorId: auditLog.actorId,
        actorEmail: users.email,
        tenantId: auditLog.tenantId,
        metadata: auditLog.metadata,
        createdAt: auditLog.createdAt,
      })
      .from(auditLog)
      .leftJoin(users, eq(auditLog.actorId, users.id))
      .where(whereClause)
      .orderBy(desc(auditLog.createdAt))
      .limit(limit)
      .offset(offset)

    res.json({
      data: rows.map((row) => toAuditLogJson(row)),
      total,
      limit,
      offset,
    })
  } catch (err) {
    next(err)
  }
}
