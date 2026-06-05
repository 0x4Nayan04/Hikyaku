import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config as loadEnv } from 'dotenv'
import { parseApiEnv, type ApiEnv } from '@webhook/shared/env'

const envPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env')
loadEnv({ path: envPath })

export const env: ApiEnv = parseApiEnv()
