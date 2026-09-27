import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}

const pool = new pg.Pool({ connectionString: databaseUrl })
const migrationsFolder = resolve(dirname(fileURLToPath(import.meta.url)), '../../drizzle')

try {
  await migrate(drizzle(pool), { migrationsFolder })
  console.log('migrations applied')
} catch (err) {
  console.error(err)
  process.exitCode = 1
} finally {
  await pool.end()
}
