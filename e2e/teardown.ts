import { createDbClient } from '../packages/shared/src/db'
import { configureTestEnvironment } from '../packages/shared/src/testEnv'

export default async function teardown() {
  configureTestEnvironment()
  const { queue } = await import('../apps/api/src/queue/client')
  try {
    for (const job of await queue.getJobs(['waiting', 'delayed', 'completed', 'failed', 'paused'])) await job.remove()
  } finally { await queue.close() }
  const client = createDbClient(process.env.TEST_DATABASE_URL!)
  const connection = await client.getPool().connect()
  try {
    await connection.query('BEGIN')
    const prefix = `e2e-${process.env.TEST_RUN_ID}-`
    const { rows } = await connection.query('SELECT id FROM tenants WHERE left(name, $1) = $2', [prefix.length, prefix])
    const ids = rows.map((row: { id: string }) => row.id)
    await connection.query("DELETE FROM sessions WHERE sess->>'userId' IN (SELECT id::text FROM users WHERE tenant_id = ANY($1::uuid[]))", [ids])
    await connection.query('DELETE FROM users WHERE tenant_id = ANY($1::uuid[])', [ids])
    await connection.query('DELETE FROM tenants WHERE id = ANY($1::uuid[])', [ids])
    await connection.query('COMMIT')
  } catch (error) {
    await connection.query('ROLLBACK')
    throw error
  } finally { connection.release(); await client.closePool() }
}
