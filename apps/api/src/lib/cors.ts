import cors from 'cors'
import type { RequestHandler } from 'express'
import { env } from '../config.js'
import { AppError } from './errors.js'

export function parseCorsOrigins(corsOrigin: string): string[] {
  return corsOrigin
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)
}

export function createCorsMiddleware(): RequestHandler {
  const allowedOrigins = new Set(parseCorsOrigins(env.CORS_ORIGIN))

  return cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true)
        return
      }

      callback(new AppError(403, 'origin_not_allowed', 'Origin is not allowed'))
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Admin-Secret'],
    credentials: true,
  })
}
