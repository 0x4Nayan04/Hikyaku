import connectPgSimple from 'connect-pg-simple'
import type { RequestHandler } from 'express'
import session from 'express-session'
import { env } from '../config.js'
import { getPool } from '../db/client.js'

const PgSession = connectPgSimple(session)

const SESSION_COOKIE_NAME = 'sid'

declare module 'express-session' {
  interface SessionData {
    userId?: string
  }
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
