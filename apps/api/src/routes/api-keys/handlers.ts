import { generateApiKey, hashApiKey, prefixOf } from '@webhook/shared/crypto'
import { apiKeys } from '@webhook/shared/schema'
import { and, count, desc, eq, isNull } from 'drizzle-orm'
import type { NextFunction, Request, Response } from 'express'
import { getDb } from '../../db/client.js'
import { AppError } from '../../lib/errors.js'
import { parsePagination } from '../../lib/pagination.js'
import { getTenantId } from '../../lib/tenant.js'
import { toApiKeyJson } from './serialize.js'
import { parseApiKeyId } from './validation.js'

const apiKeyColumns = {
  id: apiKeys.id,
  prefix: apiKeys.prefix,
  lastUsedAt: apiKeys.lastUsedAt,
  revokedAt: apiKeys.revokedAt,
  createdAt: apiKeys.createdAt,
}

export async function listApiKeys(req: Request, res: Response, next: NextFunction) {
  try {
    const { limit, offset } = parsePagination(req.query)
    const tenantId = getTenantId(req)
    const db = getDb()
    const where = eq(apiKeys.tenantId, tenantId)

    const [countRow] = await db.select({ value: count() }).from(apiKeys).where(where)
    const total = countRow?.value ?? 0

    const rows = await db
      .select(apiKeyColumns)
      .from(apiKeys)
      .where(where)
      .orderBy(desc(apiKeys.createdAt))
      .limit(limit)
      .offset(offset)

    res.json({
      data: rows.map((row) => toApiKeyJson(row)),
      total,
      limit,
      offset,
    })
  } catch (err) {
    next(err)
  }
}

export async function createApiKey(req: Request, res: Response, next: NextFunction) {
  try {
    const apiKey = generateApiKey()
    const db = getDb()

    const [row] = await db
      .insert(apiKeys)
      .values({
        tenantId: getTenantId(req),
        keyHash: hashApiKey(apiKey),
        prefix: prefixOf(apiKey),
      })
      .returning(apiKeyColumns)

    res.status(201).json(toApiKeyJson(row, apiKey))
  } catch (err) {
    next(err)
  }
}

export async function revokeApiKey(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    parseApiKeyId(id)

    const db = getDb()
    const tenantId = getTenantId(req)

    const [existing] = await db
      .select(apiKeyColumns)
      .from(apiKeys)
      .where(and(eq(apiKeys.id, id), eq(apiKeys.tenantId, tenantId)))

    if (!existing) {
      throw new AppError(404, 'not_found', 'API key not found')
    }

    if (existing.revokedAt !== null) {
      throw new AppError(409, 'already_revoked', 'API key is already revoked')
    }

    const [row] = await db
      .update(apiKeys)
      .set({ revokedAt: new Date() })
      .where(and(eq(apiKeys.id, id), eq(apiKeys.tenantId, tenantId)))
      .returning(apiKeyColumns)

    res.json(toApiKeyJson(row))
  } catch (err) {
    next(err)
  }
}

export async function rotateApiKey(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    parseApiKeyId(id)

    const db = getDb()
    const tenantId = getTenantId(req)

    const [existing] = await db
      .select({ id: apiKeys.id, revokedAt: apiKeys.revokedAt })
      .from(apiKeys)
      .where(and(eq(apiKeys.id, id), eq(apiKeys.tenantId, tenantId)))

    if (!existing) {
      throw new AppError(404, 'not_found', 'API key not found')
    }

    if (existing.revokedAt !== null) {
      throw new AppError(409, 'already_revoked', 'Cannot rotate a revoked API key')
    }

    const apiKey = generateApiKey()
    const row = await db.transaction(async (tx) => {
      await tx
        .update(apiKeys)
        .set({ revokedAt: new Date() })
        .where(and(eq(apiKeys.id, id), eq(apiKeys.tenantId, tenantId), isNull(apiKeys.revokedAt)))

      const [created] = await tx
        .insert(apiKeys)
        .values({
          tenantId,
          keyHash: hashApiKey(apiKey),
          prefix: prefixOf(apiKey),
        })
        .returning(apiKeyColumns)

      return created
    })

    res.status(201).json(toApiKeyJson(row, apiKey))
  } catch (err) {
    next(err)
  }
}
