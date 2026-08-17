import { afterEach, describe, expect, it } from 'vitest'
import { createDbClient } from '../../src/db.js'

let client: ReturnType<typeof createDbClient> | undefined

describe('createDbClient', () => {
  afterEach(async () => {
    await client?.closePool()
    client = undefined
  })

  it('sets statement and idle timeouts on the pool', () => {
    client = createDbClient('postgresql://webhook:webhook@127.0.0.1:1/webhooks', 4)
    const pool = client.getPool()

    expect(pool.options.max).toBe(4)
    expect(pool.options.idleTimeoutMillis).toBe(10_000)
    expect(pool.options.connectionTimeoutMillis).toBe(5_000)
    expect(pool.options.options).toContain('statement_timeout=5000')
    expect(pool.options.options).toContain('idle_in_transaction_session_timeout=10000')
  })
})
