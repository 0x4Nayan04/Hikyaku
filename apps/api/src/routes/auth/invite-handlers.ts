import { invites, tenants, users } from '@webhook/shared/schema'
import { and, eq, isNull } from 'drizzle-orm'
import type { NextFunction, Request, Response } from 'express'
import { hashPassword } from '../../auth/password.js'
import { getDb } from '../../db/client.js'
import { AppError } from '../../lib/errors.js'
import { assertEmailAvailable, assertInviteUsable, findInviteByToken } from '../../lib/invites.js'
import { toUserJson } from './serialize.js'
import { parseAcceptInviteBody } from './invite-validation.js'

const userColumns = {
  id: users.id,
  email: users.email,
  name: users.name,
  isSuperAdmin: users.isSuperAdmin,
}

export async function validateInvite(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.query.token
    if (typeof token !== 'string' || !token) {
      throw new AppError(400, 'validation_error', 'token query parameter is required')
    }

    const invite = await findInviteByToken(token)
    if (!invite) {
      throw new AppError(404, 'not_found', 'Invite not found')
    }

    assertInviteUsable(invite)

    res.status(200).json({
      kind: invite.kind,
      email: invite.email,
      tenant_name: invite.tenantName,
      invited_name: invite.invitedName,
      expires_at: invite.expiresAt.toISOString(),
    })
  } catch (err) {
    next(err)
  }
}

export async function acceptInvite(req: Request, res: Response, next: NextFunction) {
  try {
    const body = parseAcceptInviteBody(req.body)
    const invite = await findInviteByToken(body.token)

    if (!invite) {
      throw new AppError(404, 'not_found', 'Invite not found')
    }

    assertInviteUsable(invite)

    const passwordHash = await hashPassword(body.password)
    const db = getDb()

    const user = await db.transaction(async (tx) => {
      await assertEmailAvailable(invite.email, tx)

      let createdUser

      if (invite.kind === 'tenant_owner') {
        if (!invite.tenantName) {
          throw new AppError(500, 'internal_error', 'Invite is missing tenant name')
        }

        const [tenant] = await tx
          .insert(tenants)
          .values({ name: invite.tenantName })
          .returning({ id: tenants.id })

        ;[createdUser] = await tx
          .insert(users)
          .values({
            tenantId: tenant.id,
            email: invite.email,
            passwordHash,
            name: body.name,
            isSuperAdmin: false,
          })
          .returning(userColumns)
      } else if (invite.kind === 'tenant_user') {
        if (!invite.tenantId) {
          throw new AppError(500, 'internal_error', 'Invite is missing tenant')
        }

        const [tenant] = await tx
          .select({ id: tenants.id })
          .from(tenants)
          .where(eq(tenants.id, invite.tenantId))
          .limit(1)

        if (!tenant) {
          throw new AppError(404, 'not_found', 'Tenant not found')
        }

        ;[createdUser] = await tx
          .insert(users)
          .values({
            tenantId: tenant.id,
            email: invite.email,
            passwordHash,
            name: body.name,
            isSuperAdmin: false,
          })
          .returning(userColumns)
      } else if (invite.kind === 'platform_admin') {
        ;[createdUser] = await tx
          .insert(users)
          .values({
            tenantId: null,
            email: invite.email,
            passwordHash,
            name: body.name,
            isSuperAdmin: true,
          })
          .returning(userColumns)
      } else {
        throw new AppError(500, 'internal_error', 'Unknown invite kind')
      }

      const [consumed] = await tx
        .update(invites)
        .set({ acceptedAt: new Date() })
        .where(and(eq(invites.id, invite.id), isNull(invites.acceptedAt)))
        .returning({ id: invites.id })

      if (!consumed) {
        throw new AppError(410, 'invite_used', 'Invite has already been used')
      }

      return createdUser
    })

    res.status(201).json({ user: toUserJson(user) })
  } catch (err) {
    next(err)
  }
}
