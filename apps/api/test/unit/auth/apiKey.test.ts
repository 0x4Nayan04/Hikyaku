import { afterAll, describe, expect, it } from 'vitest'
import '../../../src/config.js'
import { resolveTenantId } from '../../../src/auth/apiKey.js'
import { closePool } from '../../../src/db/client.js'
import { createTenantWithKey, deleteTenant } from '../../helpers/tenant.js'

describe('resolveTenantId', () => {
  afterAll(async () => {
    await closePool()
  })

  it('returns tenant id for a valid api key', async () => {
    const { tenantId, apiKey } = await createTenantWithKey()

    await expect(resolveTenantId(apiKey)).resolves.toBe(tenantId)

    await deleteTenant(tenantId)
  })

  it('returns null for an unknown api key', async () => {
    await expect(resolveTenantId('whk_00000000000000000000000000000000')).resolves.toBeNull()
  })

  it('returns null for a revoked api key', async () => {
    const { tenantId, apiKey } = await createTenantWithKey({ revoked: true })

    await expect(resolveTenantId(apiKey)).resolves.toBeNull()

    await deleteTenant(tenantId)
  })
})
