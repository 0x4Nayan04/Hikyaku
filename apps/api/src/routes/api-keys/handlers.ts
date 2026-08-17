import { generateApiKey, hashApiKey, prefixOf } from '@webhook/shared/crypto'
import { apiKeys } from '@webhook/shared/schema'
import { and, desc, eq, isNotNull, isNull } from 'drizzle-orm'
import type { NextFunction, Request, Response } from 'express'
import { invalidateApiKeyCache } from '../../auth/apiKey.js'
import { getDb } from '../../db/client.js'
import { AppError } from '../../lib/errors.js'
import { paginatedJson, parsePagination, takePage } from '../../lib/pagination.js'
import { getTenantId } from '../../lib/tenant.js'
import { toApiKeyJson } from './serialize.js'
import { parseApiKeyId, parseListQuery } from './validation.js'

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
    const { status } = parseListQuery(req.query)
    const tenantId = getTenantId(req)
    const db = getDb()
    const where = and(
      eq(apiKeys.tenantId, tenantId),
      status === 'active'
        ? isNull(apiKeys.revokedAt)
        : status === 'revoked'
          ? isNotNull(apiKeys.revokedAt)
          : undefined,
    )

    const rows = await db
      .select(apiKeyColumns)
      .from(apiKeys)
      .where(where)
      .orderBy(desc(apiKeys.createdAt))
      .limit(limit + 1)
      .offset(offset)
    const page = takePage(rows, limit)

    res.json(
      paginatedJson(
        page.data.map((row) => toApiKeyJson(row)),
        page.hasMore,
        limit,
        offset,
      ),
    )
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

    invalidateApiKeyCache(hashApiKey(apiKey))
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
      .select({ ...apiKeyColumns, keyHash: apiKeys.keyHash })
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
      .where(and(eq(apiKeys.id, id), eq(apiKeys.tenantId, tenantId), isNull(apiKeys.revokedAt)))
      .returning(apiKeyColumns)

    if (!row) {
      throw new AppError(409, 'already_revoked', 'API key is already revoked')
    }

    invalidateApiKeyCache(existing.keyHash)
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
      .select({ id: apiKeys.id, revokedAt: apiKeys.revokedAt, keyHash: apiKeys.keyHash })
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
      const [revoked] = await tx
        .update(apiKeys)
        .set({ revokedAt: new Date() })
        .where(and(eq(apiKeys.id, id), eq(apiKeys.tenantId, tenantId), isNull(apiKeys.revokedAt)))
        .returning({ id: apiKeys.id })

      if (!revoked) {
        throw new AppError(409, 'already_revoked', 'Cannot rotate a revoked API key')
      }

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

    invalidateApiKeyCache(existing.keyHash)
    res.status(201).json(toApiKeyJson(row, apiKey))
  } catch (err) {
    next(err)
  }
}
