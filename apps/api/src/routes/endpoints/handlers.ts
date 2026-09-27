import type { EndpointStatus } from '@webhook/shared/constants'
import { generateEndpointSecret } from '@webhook/shared/crypto'
import { deliveries, endpoints } from '@webhook/shared/schema'
import { checkWebhookUrl } from '@webhook/shared/webhookUrl'
import { and, desc, eq, inArray } from 'drizzle-orm'
import type { Request, Response } from 'express'
import { env } from '../../config.js'
import { getDb } from '../../db/client.js'
import { AppError } from '../../lib/errors.js'
import { asyncHandler } from '../../lib/asyncHandler.js'
import { paginatedJson, parsePagination, takePage } from '../../lib/pagination.js'
import { getTenantId } from '../../lib/tenant.js'
import { toEndpointJson, type EndpointLastDeliveryRow } from './serialize.js'
import { parseCreateBody, parseEndpointId, parseListQuery, parsePatchBody } from './validation.js'

const endpointColumns = {
  id: endpoints.id,
  url: endpoints.url,
  status: endpoints.status,
  description: endpoints.description,
  createdAt: endpoints.createdAt,
}

async function loadLastDeliveries(
  tenantId: string,
  endpointIds: string[],
): Promise<Map<string, EndpointLastDeliveryRow>> {
  const map = new Map<string, EndpointLastDeliveryRow>()
  if (endpointIds.length === 0) return map

  const db = getDb()
  const rows = await db
    .selectDistinctOn([deliveries.endpointId], {
      endpointId: deliveries.endpointId,
      id: deliveries.id,
      status: deliveries.status,
      updatedAt: deliveries.updatedAt,
      lastError: deliveries.lastError,
    })
    .from(deliveries)
    .where(and(eq(deliveries.tenantId, tenantId), inArray(deliveries.endpointId, endpointIds)))
    .orderBy(deliveries.endpointId, desc(deliveries.createdAt), desc(deliveries.id))

  for (const row of rows) {
    map.set(row.endpointId, {
      id: row.id,
      status: row.status,
      updatedAt: row.updatedAt,
      lastError: row.lastError,
    })
  }

  return map
}

export const createEndpoint = asyncHandler(async (req: Request, res: Response) => {
  const body = parseCreateBody(req.body)
  const urlCheck = await checkWebhookUrl(body.url, env.NODE_ENV !== 'production')
  if (!urlCheck.ok) {
    throw new AppError(400, 'validation_error', urlCheck.reason)
  }

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
})

export const listEndpoints = asyncHandler(async (req: Request, res: Response) => {
  const { limit, offset } = parsePagination(req.query)
  const { status } = parseListQuery(req.query)
  const tenantId = getTenantId(req)
  const db = getDb()
  const where = and(
    eq(endpoints.tenantId, tenantId),
    status === undefined ? undefined : eq(endpoints.status, status),
  )

  const rows = await db
    .select(endpointColumns)
    .from(endpoints)
    .where(where)
    .orderBy(desc(endpoints.createdAt), desc(endpoints.id))
    .limit(limit + 1)
    .offset(offset)
  const page = takePage(rows, limit)

  const lastByEndpoint = await loadLastDeliveries(
    tenantId,
    page.data.map((row) => row.id),
  )

  res.json(
    paginatedJson(
      page.data.map((row) => toEndpointJson(row, undefined, lastByEndpoint.get(row.id) ?? null)),
      page.hasMore,
      limit,
      offset,
    ),
  )
})

export const patchEndpoint = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params
  parseEndpointId(id)

  const body = parsePatchBody(req.body)
  const updates: { status?: EndpointStatus; description?: string | null } = {}
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
})

export const rotateEndpointSecret = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params
  parseEndpointId(id)

  const secret = generateEndpointSecret()
  const db = getDb()
  const [row] = await db
    .update(endpoints)
    .set({ secret })
    .where(and(eq(endpoints.id, id), eq(endpoints.tenantId, getTenantId(req))))
    .returning(endpointColumns)

  if (!row) {
    throw new AppError(404, 'not_found', 'Endpoint not found')
  }

  res.json(toEndpointJson(row, secret))
})
