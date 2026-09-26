import { createDbClient } from '@webhook/shared/db'
import { env } from '../config.js'

export const { getPool, getDb, closePool } = createDbClient(
  env.DATABASE_URL,
  env.DB_POOL_MAX,
)
