import type { Request } from 'express'
import { BEARER_PREFIX } from '../../auth/bearer.js'

export const EVENTS_PATH = '/v1/events'

/** Bearer ingest is stateless; cookie ingest retains sessions and CSRF protection. */
export function isStatelessIngest(req: Pick<Request, 'method' | 'path' | 'headers'>): boolean {
  return (
    req.method === 'POST' &&
    req.path === EVENTS_PATH &&
    typeof req.headers.authorization === 'string' &&
    req.headers.authorization.startsWith(BEARER_PREFIX)
  )
}
