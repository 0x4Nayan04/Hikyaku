import connectPgSimple from 'connect-pg-simple'
import { createHash } from 'node:crypto'
import type { Request, RequestHandler } from 'express'
import session from 'express-session'
import { env } from '../config.js'
import { getPool } from '../db/client.js'
import { BEARER_PREFIX } from './bearer.js'

/** Server-only SHA-256 of the password hash verified at login. Never expose in API responses or logs. */
export function createCredentialFingerprint(passwordHash: string): string {
  return createHash('sha256').update(passwordHash, 'utf8').digest('base64url')
}

const PgSession = connectPgSimple(session)

export const SESSION_COOKIE_NAME = 'sid'

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
    credentialFingerprint?: string
  }
}

/**
 * Denormalized user fields stored in the session row.
 * credentialFingerprint must match SHA-256 of the current password hash or the session is rejected.
 */
export type SessionUserBlob = {
  userId: string
  email: string
  name: string
  tenantId: string | null
  isSuperAdmin: boolean
  tenantName: string | null
  credentialFingerprint: string
}

export function readSessionUserBlob(
  session: Partial<SessionUserBlob> | undefined,
): SessionUserBlob | null {
  if (
    typeof session?.userId !== 'string' ||
    typeof session.email !== 'string' ||
    typeof session.name !== 'string' ||
    typeof session.isSuperAdmin !== 'boolean' ||
    typeof session.credentialFingerprint !== 'string'
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
    credentialFingerprint: session.credentialFingerprint,
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
  session.credentialFingerprint = user.credentialFingerprint
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
