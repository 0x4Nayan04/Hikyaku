import { configureTestEnvironment } from '@hikyaku/shared/testEnv'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config as loadEnv } from 'dotenv'
import { EnvValidationError, parseWorkerEnv, type WorkerEnv } from '@hikyaku/shared/env'

const envPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env')
if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
  configureTestEnvironment()
} else {
  loadEnv({ path: envPath })
}

function loadEnvironment(): WorkerEnv {
  try {
    return parseWorkerEnv()
  } catch (err) {
    if (!(err instanceof EnvValidationError)) throw err
    console.error(err.message)
    process.exit(1)
  }
}

export const env: WorkerEnv = loadEnvironment()
export const WORKER_LOCK_DURATION_MS = env.DELIVERY_TIMEOUT_MS + 30_000
