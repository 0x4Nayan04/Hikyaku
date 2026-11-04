import pino from 'pino'
import type { LogLevel } from './env.js'

export function createLogger(level: LogLevel) {
  return pino({ level }, pino.destination({ sync: false }))
}
