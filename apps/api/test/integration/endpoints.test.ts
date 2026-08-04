import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import '../../src/config.js'
import { closePool } from '../../src/db/client.js'
import { closeRedis } from '../../src/lib/redis.js'
import { createApp } from '../../src/server.js'
import { createTenantWithKey, deleteTenant } from '../helpers/tenant.js'
import { createTenantSession } from '../helpers/user.js'

const app = createApp()

describe('endpoints', () => {
  let tenantId: string
  let endpointId: string
  let endpointSecret: string
  let agent: ReturnType<typeof request.agent>

  beforeAll(async () => {
    const tenant = await createTenantWithKey()
    tenantId = tenant.tenantId
    agent = await createTenantSession(app, tenantId)
  })

  afterAll(async () => {
    await deleteTenant(tenantId)
    await closePool()
    await closeRedis()
  })

  it('creates an endpoint and returns the secret once', async () => {
    const res = await agent
      .post('/v1/endpoints')
      .send({ url: 'https://webhook.site/test', description: 'test' })

    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({
      url: 'https://webhook.site/test',
      status: 'active',
      description: 'test',
    })
    expect(res.body.id).toEqual(expect.any(String))
    expect(res.body.created_at).toEqual(expect.any(String))
    expect(res.body.secret).toMatch(/^whsec_[0-9a-f]{32}$/)

    endpointId = res.body.id
    endpointSecret = res.body.secret
  })

  it('lists endpoints without the secret', async () => {
    const res = await agent.get('/v1/endpoints')

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      total: 1,
      limit: 50,
      offset: 0,
    })
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0]).toMatchObject({
      id: endpointId,
      url: 'https://webhook.site/test',
      status: 'active',
      description: 'test',
      last_delivery: null,
    })
    expect(res.body.data[0].secret).toBeUndefined()
    expect(res.body.data[0]).not.toHaveProperty('secret')
  })

  it('disables an endpoint', async () => {
    const res = await agent.patch(`/v1/endpoints/${endpointId}`).send({ status: 'disabled' })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      id: endpointId,
      url: 'https://webhook.site/test',
      status: 'disabled',
      description: 'test',
    })
    expect(res.body.secret).toBeUndefined()
    expect(res.body).not.toHaveProperty('secret')
  })

  it('keeps the secret absent from list after disable', async () => {
    const res = await agent.get('/v1/endpoints')

    expect(res.status).toBe(200)
    expect(res.body.data[0]).toMatchObject({
      id: endpointId,
      status: 'disabled',
    })
    expect(res.body.data[0].secret).toBeUndefined()
    expect(endpointSecret).toMatch(/^whsec_/)
  })

  it('filters endpoints by status', async () => {
    const [active, disabled] = await Promise.all([
      agent.get('/v1/endpoints?status=active'),
      agent.get('/v1/endpoints?status=disabled'),
    ])

    expect(active.status).toBe(200)
    expect(active.body).toMatchObject({ data: [], total: 0 })
    expect(disabled.status).toBe(200)
    expect(disabled.body.total).toBe(1)
    expect(disabled.body.data[0]).toMatchObject({ id: endpointId, status: 'disabled' })
  })
})
