import { eq } from 'drizzle-orm'
import { afterAll, afterEach, describe, expect, it } from 'vitest'
import { endpoints } from '@webhook/shared/schema'
import '../../../src/config.js'
import { closePool, getDb } from '../../../src/db/client.js'
import {
  clearActiveEndpointCache,
  getActiveEndpointIds,
  invalidateActiveEndpointIds,
} from '../../../src/lib/activeEndpoints.js'
import { createTenantWithKey, deleteTenant } from '../../helpers/tenant.js'

describe('getActiveEndpointIds', () => {
  afterEach(() => {
    clearActiveEndpointCache()
  })

  afterAll(async () => {
    await closePool()
  })

  it('serves cached ids until invalidated', async () => {
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
    await expect(getActiveEndpointIds(db, tenantId)).resolves.toEqual([endpoint.id])

    invalidateActiveEndpointIds(tenantId)
    await expect(getActiveEndpointIds(db, tenantId)).resolves.toEqual([])

    await deleteTenant(tenantId)
  })
})
