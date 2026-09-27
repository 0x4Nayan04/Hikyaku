import { invites, users } from '@webhook/shared/schema'
import { hashPassword } from '@webhook/shared/password'
import { passwordResetSchema } from '@webhook/shared/zod'
import { and, eq, gt, isNull } from 'drizzle-orm'
import type { Request, Response } from 'express'
import { getDb } from '../../db/client.js'
import { AppError } from '../../lib/errors.js'
import { asyncHandler } from '../../lib/asyncHandler.js'
import {
  assertPasswordResetUsable,
  findInviteByToken,
  userEmailMatches,
} from '../../lib/invites.js'
import { revokeUserSessions } from '../../lib/revokeSessions.js'
import { parseSchema } from '../../lib/validation.js'

export const validatePasswordReset = asyncHandler(async (req: Request, res: Response) => {
  const token = req.query.token
  if (typeof token !== 'string' || !token) {
    throw new AppError(400, 'validation_error', 'token query parameter is required')
  }

  const invite = await findInviteByToken(token)
  if (!invite) {
    throw new AppError(404, 'not_found', 'Reset link not found')
  }

  assertPasswordResetUsable(invite)

  res.status(200).json({
    email: invite.email,
    expires_at: invite.expiresAt.toISOString(),
  })
})

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const body = parseSchema(passwordResetSchema, req.body)
  const invite = await findInviteByToken(body.token)

  if (!invite) {
    throw new AppError(404, 'not_found', 'Reset link not found')
  }

  assertPasswordResetUsable(invite)

  const passwordHash = await hashPassword(body.password)
  const db = getDb()

  await db.transaction(async (tx) => {
    const [consumed] = await tx
      .update(invites)
      .set({ acceptedAt: new Date() })
      .where(
        and(
          eq(invites.id, invite.id),
          isNull(invites.acceptedAt),
          gt(invites.expiresAt, new Date()),
        ),
      )
      .returning({ id: invites.id })

    if (!consumed) {
      const [current] = await tx
        .select({
          acceptedAt: invites.acceptedAt,
          expiresAt: invites.expiresAt,
          kind: invites.kind,
        })
        .from(invites)
        .where(eq(invites.id, invite.id))
        .limit(1)
      if (current) {
        assertPasswordResetUsable({
          ...invite,
          acceptedAt: current.acceptedAt,
          expiresAt: current.expiresAt,
          kind: current.kind,
        })
      }
      throw new AppError(410, 'reset_used', 'This reset link has already been used')
    }

    const [user] = await tx
      .select({ id: users.id })
      .from(users)
      .where(userEmailMatches(invite.email))
      .limit(1)

    if (!user) {
      throw new AppError(404, 'not_found', 'User not found')
    }

    await tx.update(users).set({ passwordHash }).where(eq(users.id, user.id))
    await revokeUserSessions(user.id, tx)
  })

  res.status(204).send()
})
