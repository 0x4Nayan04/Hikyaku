import request from 'supertest'
import { afterAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { tenants, users } from '@webhook/shared/schema'
import { createApp } from '../../src/server.js'
import { getDb, closePool } from '../../src/db/client.js'
import { closeRedis } from '../../src/lib/redis.js'
import { createUser, deleteUser } from '../helpers/user.js'
import { createTenantWithKey, deleteTenant } from '../helpers/tenant.js'

const app = createApp()
describe('installer workspace', () => {
  afterAll(async () => { await closePool(); await closeRedis() })
  it('attaches one workspace, retains Admin, and prevents cross-tenant access and cascading deletion', async () => {
    const user = await createUser({ tenantId: null, isSuperAdmin: true })
    const other = await createTenantWithKey()
    const agent = request.agent(app)
    let workspaceId: string | undefined
    try {
      await agent.post('/v1/auth/login').send({ email: user.email, password: user.password }).expect(200)
      const first = await agent.post('/v1/auth/workspace').send({}).expect(200)
      workspaceId = first.body.id
      expect(first.body.name).toBe('My workspace')
      const again = await agent.post('/v1/auth/workspace').send({ workspace_name: 'Duplicate' }).expect(200)
      expect(again.body.id).toBe(workspaceId)
      const me = await agent.get('/v1/auth/me').expect(200)
      expect(me.body.tenant.id).toBe(workspaceId)
      expect(me.body.user).toMatchObject({ is_super_admin: true, tenant_id: workspaceId })
      await agent.get('/v1/endpoints').expect(200)
      await agent.get('/v1/admin/tenants').expect(200)
      const key = await agent.post('/v1/api-keys').send({}).expect(201)
      expect(key.body.api_key).toBeTruthy()
      await agent.delete(`/v1/admin/tenants/${workspaceId}`).expect(409)
      expect(await getDb().select().from(users).where(eq(users.id, user.userId))).toHaveLength(1)
      const sent = await agent.post('/v1/events').send({ idempotency_key: crypto.randomUUID(), type: 'sample', payload: {} }).expect(202)
      expect(sent.body.status).toBe('no_recipients')
      const outsider = await createUser({ tenantId: other.tenantId })
      const tenantAgent = request.agent(app)
      await tenantAgent.post('/v1/auth/login').send({ email: outsider.email, password: outsider.password }).expect(200)
      await tenantAgent.get(`/v1/events/${sent.body.id}`).expect(404)
      await tenantAgent.post('/v1/auth/workspace').send({}).expect(403)
      await tenantAgent.get('/v1/admin/tenants').expect(403)
    } finally {
      await deleteUser(user.userId)
      if (workspaceId) await getDb().delete(tenants).where(eq(tenants.id, workspaceId))
      await deleteTenant(other.tenantId)
    }
  })
})
