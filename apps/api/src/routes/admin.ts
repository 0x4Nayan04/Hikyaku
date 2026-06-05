import { generateApiKey, hashApiKey, prefixOf } from '@webhook/shared/crypto'
import { apiKeys, tenants } from '@webhook/shared/schema'
import { Router, type IRouter, type NextFunction, type Request, type Response } from 'express'
import { env } from '../config.js'
import { getDb } from '../db/client.js'
import { AppError } from '../lib/errors.js'

export const adminRouter: IRouter = Router()

function requireAdminSecret(req: Request): void {
  const secret = req.get('x-admin-secret')
  if (secret !== env.ADMIN_BOOTSTRAP_SECRET) {
    throw new AppError(401, 'invalid_admin_secret', 'Wrong or missing X-Admin-Secret')
  }
}

function parseTenantName(body: unknown): string {
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

adminRouter.post('/tenants', async (req, res: Response, next: NextFunction) => {
  try {
    requireAdminSecret(req)
    const name = parseTenantName(req.body)

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
})
