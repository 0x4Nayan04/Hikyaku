import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import * as schema from './schema.js'

const { Pool } = pg

export type DbClient = {
  getPool(): pg.Pool
  getDb(): NodePgDatabase<typeof schema>
  checkPostgres(): Promise<boolean>
  closePool(): Promise<void>
}

export function createDbClient(connectionString: string, maxPoolSize = 10): DbClient {
  let pool: pg.Pool | undefined
  let db: NodePgDatabase<typeof schema> | undefined

  function getPool(): pg.Pool {
    if (!pool) {
      pool = new Pool({ connectionString, max: maxPoolSize })
    }
    return pool
  }

  function getDb(): NodePgDatabase<typeof schema> {
    if (!db) {
      db = drizzle({ client: getPool(), schema })
    }
    return db
  }

  async function checkPostgres(): Promise<boolean> {
    try {
      await getPool().query('SELECT 1')
      return true
    } catch {
      return false
    }
  }

  async function closePool(): Promise<void> {
    if (pool) {
      await pool.end()
      pool = undefined
      db = undefined
    }
  }

  return { getPool, getDb, checkPostgres, closePool }
}
