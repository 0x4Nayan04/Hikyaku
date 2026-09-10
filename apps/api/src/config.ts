import { configureTestEnvironment } from '@webhook/shared/testEnv'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config as loadEnv } from 'dotenv'
import { parseApiEnv, type ApiEnv } from '@webhook/shared/env'

const envPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env')
if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
  configureTestEnvironment()
} else {
  loadEnv({ path: envPath })
}

export const env: ApiEnv = parseApiEnv()
