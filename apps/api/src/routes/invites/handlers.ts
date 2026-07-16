import { generateInviteToken, hashInviteToken } from '@webhook/shared/crypto'
import { invites, tenants } from '@webhook/shared/schema'
import { eq } from 'drizzle-orm'
import type { NextFunction, Request, Response } from 'express'
import { env } from '../../config.js'
import { getDb } from '../../db/client.js'
import { AppError } from '../../lib/errors.js'
import { assertEmailAvailable, assertNoPendingInvite } from '../../lib/invites.js'
import { assertNoPendingSignupRequest } from '../../lib/signup-requests.js'
import { parseCreateInviteBody } from './validation.js'

export async function createInvite(req: Request, res: Response, next: NextFunction) {
  try {
    const body = parseCreateInviteBody(req.body)
    const createdByUserId = req.userId
    if (!createdByUserId) {
      throw new AppError(401, 'unauthorized', 'Missing or invalid session')
    }

    const db = getDb()
    const rawToken = generateInviteToken()
    const tokenHash = hashInviteToken(rawToken)
    const expiresAt = new Date(Date.now() + env.INVITE_TTL_MS)

    if (body.kind === 'tenant_owner') {
      await assertEmailAvailable(body.owner_email)
      await assertNoPendingInvite(body.owner_email)
      await assertNoPendingSignupRequest(body.owner_email)

      await db.insert(invites).values({
        tokenHash,
        kind: body.kind,
        email: body.owner_email,
        tenantName: body.tenant_name,
        invitedName: body.owner_name ?? null,
        createdByUserId,
        expiresAt,
      })
    } else {
      await assertEmailAvailable(body.email)
      await assertNoPendingInvite(body.email)
      await assertNoPendingSignupRequest(body.email)

      const [tenant] = await db
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.id, body.tenant_id))
        .limit(1)

      if (!tenant) {
        throw new AppError(404, 'not_found', 'Tenant not found')
      }

      await db.insert(invites).values({
        tokenHash,
        kind: body.kind,
        email: body.email,
        tenantId: body.tenant_id,
        invitedName: body.name ?? null,
        createdByUserId,
        expiresAt,
      })
    }

    const inviteUrl = `${env.WEB_APP_URL}/accept-invite?token=${encodeURIComponent(rawToken)}`

    res.status(201).json({
      invite_url: inviteUrl,
      expires_at: expiresAt.toISOString(),
    })
  } catch (err) {
    next(err)
  }
}
