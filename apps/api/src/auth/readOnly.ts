import { tenants, users } from '@hikyaku/shared/schema'
import { eq } from 'drizzle-orm'
import { getDb } from '../db/client.js'
import { AppError } from '../lib/errors.js'
import { asyncHandler } from '../lib/asyncHandler.js'

export function assertWritable(readOnly: boolean): void {
  if (readOnly) throw new AppError(403, 'read_only', 'This demo workspace is read-only')
}

/** Also accepts the current transaction, so target checks precede token consumption or writes. */
export async function assertWritableTenant(tenantId: string | null, db = getDb()): Promise<void> {
  if (!tenantId) return
  const [tenant] = await db
    .select({ readOnly: tenants.readOnly })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1)
  if (tenant) assertWritable(tenant.readOnly)
}

/** Login/logout remain usable; every other mutation with a demo session is denied, including public auth routes. */
export const protectReadOnlySession = asyncHandler(async (req, _res, next) => {
  if (
    ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ||
    ['/v1/auth/login', '/v1/auth/logout'].includes(req.path) ||
    !req.session?.userId
  ) {
    next()
    return
  }
  // Read the user's current workspace, never the denormalized tenant ID in the cookie/session.
  const [user] = await getDb()
    .select({ readOnly: tenants.readOnly })
    .from(users)
    .innerJoin(tenants, eq(users.tenantId, tenants.id))
    .where(eq(users.id, req.session.userId))
    .limit(1)
  if (user) assertWritable(user.readOnly)
  next()
})
