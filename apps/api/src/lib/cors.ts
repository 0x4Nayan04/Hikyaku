import cors from 'cors'
import type { RequestHandler } from 'express'
import { env } from '../config.js'

export function parseCorsOrigins(corsOrigin: string): string[] {
  return corsOrigin
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)
}

export function createCorsMiddleware(): RequestHandler {
  return cors({
    origin: parseCorsOrigins(env.CORS_ORIGIN),
    methods: ['GET', 'POST', 'PATCH'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Admin-Secret'],
    credentials: true,
  })
}
