import { createLogger } from '@webhook/shared/logger'
import { env } from '../config.js'

export const logger = createLogger(env.LOG_LEVEL)
