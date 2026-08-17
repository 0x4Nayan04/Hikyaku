import connectPgSimple from 'connect-pg-simple'
import type { Request, RequestHandler } from 'express'
import session from 'express-session'
import { env } from '../config.js'
import { getPool } from '../db/client.js'

const PgSession = connectPgSimple(session)

export const SESSION_COOKIE_NAME = 'sid'
const BEARER_PREFIX = 'Bearer '

/** Health probes and Bearer ingest skip express-session + CSRF. Cookie ingest still uses both. */
export function shouldSkipSessionStack(req: Pick<Request, 'method' | 'path' | 'headers'>): boolean {
  if (req.path === '/v1/health' || req.path === '/v1/ready') return true
  return (
    req.method === 'POST' &&
    req.path === '/v1/events' &&
    typeof req.headers.authorization === 'string' &&
    req.headers.authorization.startsWith(BEARER_PREFIX)
  )
}

export function skipSessionStack(mw: RequestHandler): RequestHandler {
  return (req, res, next) => {
    if (shouldSkipSessionStack(req)) {
      next()
      return
    }
    mw(req, res, next)
  }
}

declare module 'express-session' {
  interface SessionData {
    userId?: string
    email?: string
    name?: string
    tenantId?: string | null
    isSuperAdmin?: boolean
    tenantName?: string | null
  }
}

/** Denormalized user fields stored in the session row. Deleted users stay valid until the cookie dies. */
export type SessionUserBlob = {
  userId: string
  email: string
  name: string
  tenantId: string | null
  isSuperAdmin: boolean
  tenantName: string | null
}

export function readSessionUserBlob(
  session: Partial<SessionUserBlob> | undefined,
): SessionUserBlob | null {
  if (
    typeof session?.userId !== 'string' ||
    typeof session.email !== 'string' ||
    typeof session.name !== 'string' ||
    typeof session.isSuperAdmin !== 'boolean'
  ) {
    return null
  }
  return {
    userId: session.userId,
    email: session.email,
    name: session.name,
    tenantId: session.tenantId ?? null,
    isSuperAdmin: session.isSuperAdmin,
    tenantName: session.tenantName ?? null,
  }
}

export function writeSessionUser(
  session: Partial<SessionUserBlob>,
  user: SessionUserBlob,
): void {
  session.userId = user.userId
  session.email = user.email
  session.name = user.name
  session.tenantId = user.tenantId
  session.isSuperAdmin = user.isSuperAdmin
  session.tenantName = user.tenantName
}

export function createSessionMiddleware(): RequestHandler {
  return session({
    name: SESSION_COOKIE_NAME,
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: new PgSession({
      pool: getPool(),
      tableName: 'sessions',
    }),
    cookie: {
      httpOnly: true,
      // Split web/api hosts are cross-site; Lax drops the session cookie on XHR.
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
      secure: env.NODE_ENV === 'production',
      maxAge: env.SESSION_COOKIE_MAX_AGE,
    },
  })
}
