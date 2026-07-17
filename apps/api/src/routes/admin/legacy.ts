import { generateApiKey, hashApiKey, prefixOf } from '@webhook/shared/crypto'
import { apiKeys, tenants } from '@webhook/shared/schema'
import type { NextFunction, Request, Response } from 'express'
import { env } from '../../config.js'
import { getDb } from '../../db/client.js'
import { recordAudit } from '../../lib/audit.js'
import { AppError } from '../../lib/errors.js'
import { logger } from '../../lib/logger.js'
import { requireAdminSecret } from '../auth/validation.js'

function parseLegacyTenantName(body: unknown): string {
  if (
    typeof body !== 'object' ||
    body === null ||
    typeof (body as { name?: unknown }).name !== 'string'
  ) {
    throw new AppError(400, 'validation_error', 'name is required')
  }

  const name = (body as { name: string }).name.trim()
  if (name.length === 0) {
    throw new AppError(400, 'validation_error', 'name is required')
  }

  return name
}

export function assertLegacyTenantCreationAllowed(nodeEnv: string): void {
  if (nodeEnv === 'production') {
    throw new AppError(
      410,
      'gone',
      'Legacy admin tenant creation is disabled in production. Use session-authenticated POST /v1/admin/tenants instead.',
    )
  }
}

export async function createTenantLegacy(req: Request, res: Response, next: NextFunction) {
  try {
    assertLegacyTenantCreationAllowed(env.NODE_ENV)
    requireAdminSecret(req)
    const name = parseLegacyTenantName(req.body)

    const apiKey = generateApiKey()
    const db = getDb()

    const [tenant] = await db.insert(tenants).values({ name }).returning({
      id: tenants.id,
      name: tenants.name,
      createdAt: tenants.createdAt,
    })

    await db.insert(apiKeys).values({
      tenantId: tenant.id,
      keyHash: hashApiKey(apiKey),
      prefix: prefixOf(apiKey),
    })
    await recordAudit(db, 'tenant.created', null, tenant.id, {
      tenantName: name,
      source: 'legacy_admin_secret',
    })

    res.setHeader('Deprecation', 'true')
    res.setHeader('Link', '</v1/admin/tenants>; rel="successor-version"')
    logger.warn({ tenant_id: tenant.id }, 'legacy_admin_tenant_created')

    res.status(201).json({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        created_at: tenant.createdAt.toISOString(),
      },
      api_key: apiKey,
    })
  } catch (err) {
    next(err)
  }
}
