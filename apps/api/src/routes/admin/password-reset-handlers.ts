import { generateInviteToken, hashInviteToken } from '@hikyaku/shared/crypto'
import { invites, users } from '@hikyaku/shared/schema'
import { and, eq, isNull, sql } from 'drizzle-orm'
import type { Request, Response } from 'express'
import { env } from '../../config.js'
import { getDb } from '../../db/client.js'
import { AppError } from '../../lib/errors.js'
import { asyncHandler } from '../../lib/asyncHandler.js'
import { inviteEmailMatches, PASSWORD_RESET_KIND } from '../../auth/invites.js'
import { requireSessionUserId } from '../../auth/requireSessionUser.js'
import { assertWritableTenant } from '../../auth/readOnly.js'
import { parseTenantId, parseUserId } from './validation.js'

export const createPasswordReset = asyncHandler(async (req: Request, res: Response) => {
  const { id, userId } = req.params
  parseTenantId(id)
  parseUserId(userId)
  await assertWritableTenant(id)
  const createdByUserId = requireSessionUserId(req)

  const db = getDb()
  const rawToken = generateInviteToken()
  const tokenHash = hashInviteToken(rawToken)
  const expiresAt = new Date(Date.now() + env.INVITE_TTL_MS)

  await db.transaction(async (tx) => {
    const [target] = await tx
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.tenantId, id)))
      .limit(1)

    if (!target) {
      throw new AppError(404, 'not_found', 'User not found')
    }

    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${target.email}))`)
    const [lockedTarget] = await tx
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.tenantId, id)))
      .limit(1)

    if (!lockedTarget) {
      throw new AppError(404, 'not_found', 'User not found')
    }

    await tx
      .update(invites)
      .set({ acceptedAt: new Date() })
      .where(
        and(
          inviteEmailMatches(lockedTarget.email),
          eq(invites.kind, PASSWORD_RESET_KIND),
          isNull(invites.acceptedAt),
        ),
      )
    await tx.insert(invites).values({
      tokenHash,
      kind: PASSWORD_RESET_KIND,
      email: lockedTarget.email,
      tenantId: id,
      createdByUserId,
      expiresAt,
    })
  })

  res.status(201).json({
    reset_url: `${env.WEB_APP_URL}/reset-password?token=${encodeURIComponent(rawToken)}`,
    expires_at: expiresAt.toISOString(),
  })
})
