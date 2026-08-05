import { createDbClient } from '@webhook/shared/db'
import { env } from '../config.js'

export const { getPool, getDb, checkPostgres, closePool } = createDbClient(
  env.DATABASE_URL,
  env.DB_POOL_MAX,
)
