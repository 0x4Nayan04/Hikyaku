import { signupRequests, tenants, users } from '@webhook/shared/schema'
import { and, count, desc, eq } from 'drizzle-orm'
import type { NextFunction, Request, Response } from 'express'
import { recordAudit } from '../../lib/audit.js'
import { getDb } from '../../db/client.js'
import { AppError } from '../../lib/errors.js'
import { assertEmailAvailable } from '../../lib/invites.js'
import { assertSignupRequestPending, findSignupRequestById } from '../../lib/signup-requests.js'
import { parsePagination } from '../../lib/pagination.js'
import { toUserJson } from '../auth/serialize.js'
import { toSignupRequestJson } from '../auth/signup-serialize.js'
import { toAdminTenantJson } from './serialize.js'
import { parseSignupRequestId, parseSignupRequestStatusFilter } from './signup-request-validation.js'

const signupRequestListColumns = {
  id: signupRequests.id,
  tenantName: signupRequests.tenantName,
  email: signupRequests.email,
  name: signupRequests.name,
  status: signupRequests.status,
  createdAt: signupRequests.createdAt,
}

const tenantColumns = {
  id: tenants.id,
  name: tenants.name,
  createdAt: tenants.createdAt,
}

const userColumns = {
  id: users.id,
  email: users.email,
  name: users.name,
  isSuperAdmin: users.isSuperAdmin,
}

export async function listSignupRequests(req: Request, res: Response, next: NextFunction) {
  try {
    const { limit, offset } = parsePagination(req.query)
    const status = parseSignupRequestStatusFilter(req.query.status)
    const db = getDb()

    const whereClause = status ? eq(signupRequests.status, status) : undefined

    const [countRow] = await db
      .select({ value: count() })
      .from(signupRequests)
      .where(whereClause)

    const total = countRow?.value ?? 0

    const rows = await db
      .select(signupRequestListColumns)
      .from(signupRequests)
      .where(whereClause)
      .orderBy(desc(signupRequests.createdAt))
      .limit(limit)
      .offset(offset)

    res.json({
      data: rows.map((row) => toSignupRequestJson(row)),
      total,
      limit,
      offset,
    })
  } catch (err) {
    next(err)
  }
}

export async function approveSignupRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    parseSignupRequestId(id)

    const reviewerId = req.userId
    if (!reviewerId) {
      throw new AppError(401, 'unauthorized', 'Missing or invalid session')
    }

    const request = await findSignupRequestById(id)
    if (!request) {
      throw new AppError(404, 'not_found', 'Signup request not found')
    }

    assertSignupRequestPending(request)

    const db = getDb()
    const reviewedAt = new Date()

    const result = await db.transaction(async (tx) => {
      await assertEmailAvailable(request.email, tx)
      const [tenant] = await tx
        .insert(tenants)
        .values({ name: request.tenantName })
        .returning(tenantColumns)

      const [user] = await tx
        .insert(users)
        .values({
          tenantId: tenant.id,
          email: request.email,
          passwordHash: request.passwordHash,
          name: request.name,
          isSuperAdmin: false,
        })
        .returning(userColumns)

      const [updatedRequest] = await tx
        .update(signupRequests)
        .set({
          status: 'approved',
          reviewedByUserId: reviewerId,
          reviewedAt,
          tenantId: tenant.id,
          userId: user.id,
        })
        .where(and(eq(signupRequests.id, id), eq(signupRequests.status, 'pending')))
        .returning(signupRequestListColumns)

      if (!updatedRequest) {
        throw new AppError(409, 'conflict', 'Signup request is no longer pending')
      }

      await recordAudit(tx, 'signup.approved', reviewerId, tenant.id, {
        signupRequestId: id,
        email: request.email,
      })

      return { tenant, user, signupRequest: updatedRequest }
    })

    res.status(200).json({
      signupRequest: toSignupRequestJson(result.signupRequest),
      tenant: toAdminTenantJson(result.tenant),
      user: toUserJson(result.user),
    })
  } catch (err) {
    next(err)
  }
}

export async function rejectSignupRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    parseSignupRequestId(id)

    const reviewerId = req.userId
    if (!reviewerId) {
      throw new AppError(401, 'unauthorized', 'Missing or invalid session')
    }

    const request = await findSignupRequestById(id)
    if (!request) {
      throw new AppError(404, 'not_found', 'Signup request not found')
    }

    assertSignupRequestPending(request)

    const db = getDb()
    const reviewedAt = new Date()

    const result = await db.transaction(async (tx) => {
      const [updatedRequest] = await tx
        .update(signupRequests)
        .set({
          status: 'rejected',
          reviewedByUserId: reviewerId,
          reviewedAt,
        })
        .where(and(eq(signupRequests.id, id), eq(signupRequests.status, 'pending')))
        .returning(signupRequestListColumns)

      if (!updatedRequest) {
        throw new AppError(409, 'conflict', 'Signup request is no longer pending')
      }

      await recordAudit(tx, 'signup.rejected', reviewerId, null, {
        signupRequestId: id,
        email: request.email,
      })

      return updatedRequest
    })

    res.status(200).json({ signupRequest: toSignupRequestJson(result) })
  } catch (err) {
    next(err)
  }
}
