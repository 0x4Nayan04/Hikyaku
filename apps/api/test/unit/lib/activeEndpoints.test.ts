import { eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import { endpoints } from '@webhook/shared/schema'
import '../../../src/config.js'
import { closePool, getDb } from '../../../src/db/client.js'
import { getActiveEndpointIds } from '../../../src/lib/activeEndpoints.js'
import { createTenantWithKey, deleteTenant } from '../../helpers/tenant.js'

describe('getActiveEndpointIds', () => {
  afterAll(async () => {
    await closePool()
  })

  it('reads current active endpoint ids after a change', async () => {
    const { tenantId } = await createTenantWithKey()
    const db = getDb()

    const [endpoint] = await db
      .insert(endpoints)
      .values({
        tenantId,
        url: 'https://webhook.site/cache-test',
        secret: 'whsec_' + 'c'.repeat(32),
      })
      .returning({ id: endpoints.id })

    await expect(getActiveEndpointIds(db, tenantId)).resolves.toEqual([endpoint.id])

    await db.delete(endpoints).where(eq(endpoints.id, endpoint.id))
    await expect(getActiveEndpointIds(db, tenantId)).resolves.toEqual([])

    await deleteTenant(tenantId)
  })
})
