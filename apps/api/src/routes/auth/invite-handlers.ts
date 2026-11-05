import { tenants, users } from '@hikyaku/shared/schema'
import { acceptInviteSchema } from '@hikyaku/shared/zod'
import { eq } from 'drizzle-orm'
import type { Request, Response } from 'express'
import { hashPassword } from '@hikyaku/shared/password'
import { getDb } from '../../db/client.js'
import { AppError } from '../../lib/errors.js'
import { asyncHandler } from '../../lib/asyncHandler.js'
import {
  assertEmailAvailable,
  assertInviteUsable,
  consumeInvite,
  findInviteByToken,
  PASSWORD_RESET_KIND,
} from '../../auth/invites.js'
import { parseSchema } from '../../lib/validation.js'
import { toUserJson, userColumns } from './serialize.js'
import { assertWritableTenant } from '../../auth/readOnly.js'

export const validateInvite = asyncHandler(async (req: Request, res: Response) => {
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
})

export const acceptInvite = asyncHandler(async (req: Request, res: Response) => {
  const body = parseSchema(acceptInviteSchema, req.body)
  const invite = await findInviteByToken(body.token)

  if (!invite) {
    throw new AppError(404, 'not_found', 'Invite not found')
  }

  if (invite.kind === PASSWORD_RESET_KIND) {
    throw new AppError(400, 'validation_error', 'This link resets a password')
  }

  assertInviteUsable(invite)

  const passwordHash = await hashPassword(body.password)
  const db = getDb()

  const user = await db.transaction(async (tx) => {
    await assertWritableTenant(invite.tenantId, tx)
    await consumeInvite(invite, tx)

    await assertEmailAvailable(invite.email, tx)

    let tenantId: string

    if (invite.kind === 'tenant_owner') {
      if (!invite.tenantName) {
        throw new AppError(500, 'internal_error', 'Invite is missing tenant name')
      }

      const [tenant] = await tx
        .insert(tenants)
        .values({ name: invite.tenantName })
        .returning({ id: tenants.id })

      tenantId = tenant.id
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

      tenantId = tenant.id
    } else {
      throw new AppError(500, 'internal_error', 'Unknown invite kind')
    }

    const [createdUser] = await tx
      .insert(users)
      .values({ tenantId, email: invite.email, passwordHash, name: body.name, isSuperAdmin: false })
      .returning(userColumns)
    return createdUser
  })

  res.status(201).json({ user: toUserJson(user) })
})
