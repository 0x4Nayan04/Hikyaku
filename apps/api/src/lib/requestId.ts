import { randomUUID } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'

export function readRequestId(req: Request): string {
  return req.requestId
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Always mint our own id — never echo client-supplied values into logs/headers.
  const requestId = randomUUID()
  req.requestId = requestId
  res.setHeader('X-Request-Id', requestId)
  next()
}
