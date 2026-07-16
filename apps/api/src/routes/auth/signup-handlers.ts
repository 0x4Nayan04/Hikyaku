import { signupRequests } from '@webhook/shared/schema'
import type { NextFunction, Request, Response } from 'express'
import { hashPassword } from '../../auth/password.js'
import { getDb } from '../../db/client.js'
import { AppError } from '../../lib/errors.js'
import { assertEmailAvailable, assertNoPendingInvite } from '../../lib/invites.js'
import { assertNoPendingSignupRequest } from '../../lib/signup-requests.js'
import { toSignupRequestJson } from './signup-serialize.js'
import { parseSignupRequestBody } from './signup-validation.js'

function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  const code = 'code' in err ? String((err as { code: unknown }).code) : ''
  if (code === '23505') return true
  const cause = 'cause' in err ? (err as { cause: unknown }).cause : undefined
  return isUniqueViolation(cause)
}

export async function createSignupRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const body = parseSignupRequestBody(req.body)
    const passwordHash = await hashPassword(body.password)
    const db = getDb()

    const request = await db.transaction(async (tx) => {
      await assertEmailAvailable(body.email, tx)
      await assertNoPendingInvite(body.email, tx)
      await assertNoPendingSignupRequest(body.email, tx)

      const [r] = await tx
        .insert(signupRequests)
        .values({
          tenantName: body.tenant_name,
          email: body.email,
          name: body.name,
          passwordHash,
          status: 'pending',
        })
        .returning({
          id: signupRequests.id,
          tenantName: signupRequests.tenantName,
          email: signupRequests.email,
          name: signupRequests.name,
          status: signupRequests.status,
          createdAt: signupRequests.createdAt,
        })

      return r
    })

    if (!request) {
      throw new AppError(500, 'internal_error', 'Failed to create signup request')
    }

    res.status(201).json({ signupRequest: toSignupRequestJson(request) })
  } catch (err) {
    if (isUniqueViolation(err)) {
      next(new AppError(409, 'conflict', 'A signup request is already pending for this email'))
      return
    }
    next(err)
  }
}
