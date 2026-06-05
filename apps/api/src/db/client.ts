import pg from 'pg'
import { env } from '../config.js'

const { Pool } = pg

let pool: pg.Pool | undefined

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({ connectionString: env.DATABASE_URL })
  }
  return pool
}

export async function checkPostgres(): Promise<boolean> {
  try {
    await getPool().query('SELECT 1')
    return true
  } catch {
    return false
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = undefined
  }
}
