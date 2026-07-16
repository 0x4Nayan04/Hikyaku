import type { ExtractTablesWithRelations } from 'drizzle-orm'
import type { NodePgDatabase, NodePgQueryResultHKT } from 'drizzle-orm/node-postgres'
import type { PgTransaction } from 'drizzle-orm/pg-core'
import * as schema from '@webhook/shared/schema'
import { signupRequests } from '@webhook/shared/schema'
import { and, eq } from 'drizzle-orm'
import { getDb } from '../db/client.js'
import { AppError } from './errors.js'

type Db = NodePgDatabase<typeof schema>
type Tx = PgTransaction<NodePgQueryResultHKT, typeof schema, ExtractTablesWithRelations<typeof schema>>
type DbExecutor = Db | Tx

export type SignupRequestRow = {
  id: string
  tenantName: string
  email: string
  name: string
  passwordHash: string
  status: string
  reviewedByUserId: string | null
  reviewedAt: Date | null
  tenantId: string | null
  userId: string | null
  createdAt: Date
}

const signupRequestColumns = {
  id: signupRequests.id,
  tenantName: signupRequests.tenantName,
  email: signupRequests.email,
  name: signupRequests.name,
  passwordHash: signupRequests.passwordHash,
  status: signupRequests.status,
  reviewedByUserId: signupRequests.reviewedByUserId,
  reviewedAt: signupRequests.reviewedAt,
  tenantId: signupRequests.tenantId,
  userId: signupRequests.userId,
  createdAt: signupRequests.createdAt,
}

export async function assertNoPendingSignupRequest(email: string, tx?: DbExecutor): Promise<void> {
  const db = tx ?? getDb()
  const [pending] = await db
    .select({ id: signupRequests.id })
    .from(signupRequests)
    .where(and(eq(signupRequests.email, email), eq(signupRequests.status, 'pending')))
    .limit(1)

  if (pending) {
    throw new AppError(409, 'conflict', 'A signup request is already pending for this email')
  }
}

export async function findPendingSignupByEmail(email: string): Promise<SignupRequestRow | null> {
  const db = getDb()
  const [row] = await db
    .select(signupRequestColumns)
    .from(signupRequests)
    .where(and(eq(signupRequests.email, email), eq(signupRequests.status, 'pending')))
    .limit(1)

  return row ?? null
}

export async function findSignupRequestById(id: string): Promise<SignupRequestRow | null> {
  const db = getDb()
  const [row] = await db
    .select(signupRequestColumns)
    .from(signupRequests)
    .where(eq(signupRequests.id, id))
    .limit(1)

  return row ?? null
}

export function assertSignupRequestPending(request: SignupRequestRow): void {
  if (request.status !== 'pending') {
    throw new AppError(409, 'conflict', 'Signup request is no longer pending')
  }
}
