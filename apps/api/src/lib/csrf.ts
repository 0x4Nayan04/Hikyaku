import type { RequestHandler } from 'express'
import { SESSION_COOKIE_NAME } from '../auth/session.js'
import { env } from '../config.js'
import { parseCorsOrigins } from './cors.js'
import { AppError } from './errors.js'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export function sessionCookiePresent(
  cookieHeader: string | undefined,
  cookieName: string,
): boolean {
  if (!cookieHeader) return false
  return cookieHeader.split(';').some((part) => part.trim().startsWith(`${cookieName}=`))
}

/** Production SameSite=None: mutating requests with a session cookie need an allowlisted Origin. */
export function assertSessionMutationOrigin(options: {
  method: string
  origin: string | undefined
  cookieHeader: string | undefined
  cookieName: string
  allowedOrigins: ReadonlySet<string>
  enforce: boolean
}): void {
  if (!options.enforce) return
  if (SAFE_METHODS.has(options.method.toUpperCase())) return
  if (!sessionCookiePresent(options.cookieHeader, options.cookieName)) return

  const { origin } = options
  if (typeof origin === 'string' && options.allowedOrigins.has(origin)) return

  throw new AppError(403, 'origin_not_allowed', 'Origin is not allowed')
}

export function createSessionCsrfMiddleware(): RequestHandler {
  const allowedOrigins = new Set(parseCorsOrigins(env.CORS_ORIGIN))
  const enforce = env.NODE_ENV === 'production'

  return (req, _res, next) => {
    try {
      assertSessionMutationOrigin({
        method: req.method,
        origin: typeof req.headers.origin === 'string' ? req.headers.origin : undefined,
        cookieHeader: req.headers.cookie,
        cookieName: SESSION_COOKIE_NAME,
        allowedOrigins,
        enforce,
      })
      next()
    } catch (err) {
      next(err)
    }
  }
}
