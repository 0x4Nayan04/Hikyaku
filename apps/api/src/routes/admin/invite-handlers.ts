import { generateInviteToken, hashInviteToken } from '@hikyaku/shared/crypto'
import { invites, tenants } from '@hikyaku/shared/schema'
import { adminCreateInviteSchema } from '@hikyaku/shared/zod'
import { eq, sql } from 'drizzle-orm'
import type { Request, Response } from 'express'
import { env } from '../../config.js'
import { getDb } from '../../db/client.js'
import { AppError } from '../../lib/errors.js'
import { asyncHandler } from '../../lib/asyncHandler.js'
import {
  assertEmailAvailable,
  invalidatePendingSignupInvites,
} from '../../auth/invites.js'
import { requireSessionUserId } from '../../auth/requireSessionUser.js'
import { parseSchema } from '../../lib/validation.js'
import { assertWritableTenant } from '../../auth/readOnly.js'

export const createInvite = asyncHandler(async (req: Request, res: Response) => {
  const body = parseSchema(adminCreateInviteSchema, req.body)
  if (body.kind === 'tenant_user') await assertWritableTenant(body.tenant_id)
  const createdByUserId = requireSessionUserId(req)

  const db = getDb()
  const rawToken = generateInviteToken()
  const tokenHash = hashInviteToken(rawToken)
  const expiresAt = new Date(Date.now() + env.INVITE_TTL_MS)
  const email = body.kind === 'tenant_owner' ? body.owner_email : body.email

  await db.transaction(async (tx) => {
    // Serializes check-and-create for this email; released automatically on commit or rollback.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${email}))`)
    await assertEmailAvailable(email, tx)
    await invalidatePendingSignupInvites(email, tx)

    if (body.kind === 'tenant_owner') {
      await tx.insert(invites).values({
        tokenHash,
        kind: body.kind,
        email,
        tenantName: body.tenant_name,
        invitedName: body.owner_name ?? null,
        createdByUserId,
        expiresAt,
      })
    } else if (body.kind === 'tenant_user') {
      const [tenant] = await tx
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.id, body.tenant_id))
        .limit(1)

      if (!tenant) {
        throw new AppError(404, 'not_found', 'Tenant not found')
      }

      await tx.insert(invites).values({
        tokenHash,
        kind: body.kind,
        email,
        tenantId: body.tenant_id,
        invitedName: body.name ?? null,
        createdByUserId,
        expiresAt,
      })
    } else {
      const _exhaustive: never = body
      throw new AppError(500, 'internal_error', `Unknown invite kind: ${String(_exhaustive)}`)
    }
  })

  const inviteUrl = `${env.WEB_APP_URL}/accept-invite?token=${encodeURIComponent(rawToken)}`

  res.status(201).json({
    invite_url: inviteUrl,
    expires_at: expiresAt.toISOString(),
  })
})
