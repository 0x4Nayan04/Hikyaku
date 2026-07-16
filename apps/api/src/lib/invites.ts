import type { ExtractTablesWithRelations } from 'drizzle-orm'
import type { NodePgDatabase, NodePgQueryResultHKT } from 'drizzle-orm/node-postgres'
import type { PgTransaction } from 'drizzle-orm/pg-core'
import * as schema from '@webhook/shared/schema'
import { invites, users } from '@webhook/shared/schema'
import { hashInviteToken } from '@webhook/shared/crypto'
import { and, eq, gt, isNull } from 'drizzle-orm'
import { getDb } from '../db/client.js'
import { AppError } from './errors.js'

type Db = NodePgDatabase<typeof schema>
type Tx = PgTransaction<NodePgQueryResultHKT, typeof schema, ExtractTablesWithRelations<typeof schema>>
type DbExecutor = Db | Tx

export type InviteRow = {
  id: string
  tokenHash: string
  kind: string
  email: string
  tenantId: string | null
  tenantName: string | null
  invitedName: string | null
  expiresAt: Date
  acceptedAt: Date | null
}

const inviteColumns = {
  id: invites.id,
  tokenHash: invites.tokenHash,
  kind: invites.kind,
  email: invites.email,
  tenantId: invites.tenantId,
  tenantName: invites.tenantName,
  invitedName: invites.invitedName,
  expiresAt: invites.expiresAt,
  acceptedAt: invites.acceptedAt,
}

export async function assertEmailAvailable(email: string, tx?: DbExecutor): Promise<void> {
  const db = tx ?? getDb()
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  if (existing) {
    throw new AppError(409, 'conflict', 'Email already in use')
  }
}

export async function assertNoPendingInvite(email: string, tx?: DbExecutor): Promise<void> {
  const db = tx ?? getDb()
  const [pending] = await db
    .select({ id: invites.id })
    .from(invites)
    .where(
      and(eq(invites.email, email), isNull(invites.acceptedAt), gt(invites.expiresAt, new Date())),
    )
    .limit(1)

  if (pending) {
    throw new AppError(409, 'conflict', 'Pending invite already exists for this email')
  }
}

export async function findInviteByToken(token: string): Promise<InviteRow | null> {
  const db = getDb()
  const tokenHash = hashInviteToken(token)
  const [invite] = await db
    .select(inviteColumns)
    .from(invites)
    .where(eq(invites.tokenHash, tokenHash))
    .limit(1)

  return invite ?? null
}

export function assertInviteUsable(invite: InviteRow): void {
  if (invite.acceptedAt) {
    throw new AppError(410, 'invite_used', 'Invite has already been used')
  }

  if (invite.expiresAt.getTime() <= Date.now()) {
    throw new AppError(410, 'invite_expired', 'Invite has expired')
  }
}
