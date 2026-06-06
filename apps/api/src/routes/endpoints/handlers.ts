import { generateEndpointSecret } from '@webhook/shared/crypto'
import { endpoints } from '@webhook/shared/schema'
import { and, count, desc, eq } from 'drizzle-orm'
import type { NextFunction, Request, Response } from 'express'
import { getDb } from '../../db/client.js'
import { AppError } from '../../lib/errors.js'
import { parsePagination } from '../../lib/pagination.js'
import { getTenantId } from '../../lib/tenant.js'
import { toEndpointJson } from './serialize.js'
import { parseCreateBody, parseEndpointId, parsePatchBody } from './validation.js'

const endpointColumns = {
  id: endpoints.id,
  url: endpoints.url,
  status: endpoints.status,
  description: endpoints.description,
  createdAt: endpoints.createdAt,
}

export async function createEndpoint(req: Request, res: Response, next: NextFunction) {
  try {
    const body = parseCreateBody(req.body)
    const secret = generateEndpointSecret()
    const db = getDb()

    const [row] = await db
      .insert(endpoints)
      .values({
        tenantId: getTenantId(req),
        url: body.url,
        secret,
        description: body.description ?? null,
      })
      .returning(endpointColumns)

    res.status(201).json(toEndpointJson(row, secret))
  } catch (err) {
    next(err)
  }
}

export async function listEndpoints(req: Request, res: Response, next: NextFunction) {
  try {
    const { limit, offset } = parsePagination(req.query)
    const tenantId = getTenantId(req)
    const db = getDb()
    const where = eq(endpoints.tenantId, tenantId)

    const [countRow] = await db.select({ value: count() }).from(endpoints).where(where)
    const total = countRow?.value ?? 0

    const rows = await db
      .select(endpointColumns)
      .from(endpoints)
      .where(where)
      .orderBy(desc(endpoints.createdAt))
      .limit(limit)
      .offset(offset)

    res.json({
      data: rows.map((row) => toEndpointJson(row)),
      total,
      limit,
      offset,
    })
  } catch (err) {
    next(err)
  }
}

export async function patchEndpoint(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    parseEndpointId(id)

    const body = parsePatchBody(req.body)
    const updates: { status?: string; description?: string | null } = {}
    if (body.status !== undefined) {
      updates.status = body.status
    }
    if (body.description !== undefined) {
      updates.description = body.description
    }

    const db = getDb()
    const [row] = await db
      .update(endpoints)
      .set(updates)
      .where(and(eq(endpoints.id, id), eq(endpoints.tenantId, getTenantId(req))))
      .returning(endpointColumns)

    if (!row) {
      throw new AppError(404, 'not_found', 'Endpoint not found')
    }

    res.json(toEndpointJson(row))
  } catch (err) {
    next(err)
  }
}
