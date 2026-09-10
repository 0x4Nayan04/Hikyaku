import { configureTestEnvironment } from '@webhook/shared/testEnv'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config as loadEnv } from 'dotenv'
import { parseWorkerEnv, type WorkerEnv } from '@webhook/shared/env'

const envPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env')
if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
  configureTestEnvironment()
} else {
  loadEnv({ path: envPath })
}

export const env: WorkerEnv = parseWorkerEnv()
export const WORKER_LOCK_DURATION_MS = env.DELIVERY_TIMEOUT_MS + 30_000
