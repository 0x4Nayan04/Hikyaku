import { DEMO_CREDENTIALS } from '@hikyaku/shared/constants'
import { generateEndpointSecret } from '@hikyaku/shared/crypto'
import { hashPassword } from '@hikyaku/shared/password'
import {
  deliveries,
  deliveryAttempts,
  endpoints,
  events,
  tenants,
  users,
} from '@hikyaku/shared/schema'
import { eq, sql } from 'drizzle-orm'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { closePool, getDb } from '../db/client.js'
import { userEmailMatches } from '../lib/invites.js'

export const DEMO_TENANT_ID = 'd0000000-0000-4000-8000-000000000001'
const DEMO_USER_ID = 'd0000000-0000-4000-8000-000000000002'

/** Separate from the dev seed: explicitly gated, additive, atomic, and never enqueues deliveries. */
export async function seedDemoTenant(): Promise<{ created: boolean }> {
  if (process.env.ALLOW_DEMO_SEED !== '1') {
    throw new Error('Set ALLOW_DEMO_SEED=1 to create the public read-only demo workspace')
  }
  const passwordHash = await hashPassword(DEMO_CREDENTIALS.password)
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(872014004)`)
    const [admin] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.isSuperAdmin, true))
      .limit(1)
    if (!admin) throw new Error('Create the installer administrator before seeding the demo')
    const [tenant] = await tx.select().from(tenants).where(eq(tenants.id, DEMO_TENANT_ID))
    const [existingUser] = await tx
      .select()
      .from(users)
      .where(userEmailMatches(DEMO_CREDENTIALS.email))
    if (tenant || existingUser) {
      if (
        !tenant?.readOnly ||
        existingUser?.id !== DEMO_USER_ID ||
        existingUser.tenantId !== tenant.id ||
        existingUser.isSuperAdmin
      ) {
        throw new Error('Demo ID or email conflicts with existing data; refusing to overwrite it')
      }
      return { created: false }
    }

    const [workspace] = await tx
      .insert(tenants)
      .values({
        id: DEMO_TENANT_ID,
        name: 'Hikyaku Demo · sample data',
        readOnly: true,
      })
      .returning()
    await tx.insert(users).values({
      id: DEMO_USER_ID,
      tenantId: workspace.id,
      email: DEMO_CREDENTIALS.email,
      passwordHash,
      name: 'Demo Visitor',
      isSuperAdmin: false,
    })
    const receivers = await tx
      .insert(endpoints)
      .values([
        {
          tenantId: workspace.id,
          url: 'https://example.com/demo/orders',
          secret: generateEndpointSecret(),
          description: 'Sample order receiver',
        },
        {
          tenantId: workspace.id,
          url: 'https://example.com/demo/analytics',
          secret: generateEndpointSecret(),
          description: 'Sample analytics receiver',
        },
      ])
      .returning()

    const now = Date.now()
    for (const [index, status] of (['completed', 'partial_failure', 'failed'] as const).entries()) {
      const createdAt = new Date(now - (index + 1) * 15 * 60_000)
      const [event] = await tx
        .insert(events)
        .values({
          tenantId: workspace.id,
          idempotencyKey: `demo-order-${index + 1}`,
          type: 'order.created',
          payload: { sample: true, order_id: `DEMO-${index + 1}`, total: 49 + index },
          status,
          createdAt,
        })
        .returning()
      for (const [receiverIndex, endpoint] of receivers.entries()) {
        const succeeded =
          status === 'completed' || (status === 'partial_failure' && receiverIndex === 0)
        const attemptCount = succeeded ? 1 : 5
        const updatedAt = new Date(createdAt.getTime() + 60_000)
        const [delivery] = await tx
          .insert(deliveries)
          .values({
            tenantId: workspace.id,
            eventId: event.id,
            endpointId: endpoint.id,
            status: succeeded ? 'succeeded' : 'failed',
            attemptCount,
            lastError: succeeded ? null : 'http_503',
            createdAt,
            updatedAt,
          })
          .returning()
        await tx.insert(deliveryAttempts).values(
          Array.from({ length: attemptCount }, (_, attempt) => ({
            deliveryId: delivery.id,
            attemptNumber: attempt + 1,
            runNumber: 0,
            httpStatus: succeeded ? 200 : 503,
            responseBody: succeeded
              ? 'Sample receipt (synthetic)'
              : 'Sample service unavailable (synthetic)',
            error: succeeded ? null : 'http_503',
            durationMs: 80 + attempt * 20,
            createdAt: new Date(createdAt.getTime() + (attempt + 1) * 10_000),
          })),
        )
      }
    }
    return { created: true }
  })
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  seedDemoTenant()
    .then(({ created }) =>
      console.log(
        created
          ? 'Read-only demo created; no webhooks queued.'
          : 'Read-only demo already exists; unchanged.',
      ),
    )
    .catch((error: unknown) => {
      console.error(error)
      process.exitCode = 1
    })
    .finally(closePool)
}
