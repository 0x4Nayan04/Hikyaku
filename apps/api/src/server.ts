import express, { type Application, type NextFunction, type Request, type Response } from 'express'
import { pinoHttp } from 'pino-http'
import { MAX_INGEST_BODY_BYTES } from '@webhook/shared/constants'
import { env } from './config.js'
import { createSessionMiddleware, skipSessionStack } from './auth/session.js'
import { createCorsMiddleware } from './lib/cors.js'
import { createSessionCsrfMiddleware } from './lib/csrf.js'
import { AppError } from './lib/errors.js'
import { logger } from './lib/logger.js'
import { serializeRequestForLog, serializeResponseForLog } from './lib/requestLog.js'
import { readRequestId, requestIdMiddleware } from './lib/requestId.js'
import { adminRouter } from './routes/admin/index.js'
import { apiKeysRouter } from './routes/api-keys/index.js'
import { authRouter } from './routes/auth/index.js'
import { deliveriesRouter } from './routes/deliveries/index.js'
import { endpointsRouter } from './routes/endpoints/index.js'
import { eventsRouter } from './routes/events/index.js'
import { healthRouter } from './routes/health.js'
import { statsRouter } from './routes/stats.js'

export function createApp(): Application {
  const app = express()
  app.disable('x-powered-by')

  // Only trust X-Forwarded-* when explicitly configured (e.g. TRUST_PROXY=1 behind nginx).
  if (env.TRUST_PROXY > 0) {
    app.set('trust proxy', env.TRUST_PROXY)
  }

  app.use(requestIdMiddleware)
  app.use(
    pinoHttp<Request, Response>({
      logger,
      genReqId: (req) => readRequestId(req),
      serializers: { req: serializeRequestForLog, res: serializeResponseForLog },
      autoLogging: {
        ignore: (req) => {
          const path = req.url?.split('?')[0]
          return path === '/v1/health' || path === '/v1/ready'
        },
      },
    }),
  )
  app.use(createCorsMiddleware())
  app.use(skipSessionStack(createSessionMiddleware()))
  app.use(skipSessionStack(createSessionCsrfMiddleware()))
  app.use(express.json({ limit: MAX_INGEST_BODY_BYTES }))

  app.use('/v1', healthRouter)
  app.use('/v1', authRouter)
  app.use('/v1', statsRouter)
  app.use('/v1', apiKeysRouter)
  app.use('/v1', endpointsRouter)
  app.use('/v1', eventsRouter)
  app.use('/v1', deliveriesRouter)
  app.use('/v1/admin', adminRouter)

  app.use((_req, res) => {
    res.status(404).json({
      error: { code: 'not_found', message: 'Not found' },
    })
  })

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({
        error: { code: err.code, message: err.message },
      })
      return
    }

    if (
      err !== null &&
      typeof err === 'object' &&
      (err as { type?: string }).type === 'entity.too.large'
    ) {
      res.status(413).json({
        error: { code: 'payload_too_large', message: 'Request body too large' },
      })
      return
    }

    if (err instanceof SyntaxError && 'body' in err) {
      res.status(400).json({
        error: { code: 'invalid_json', message: 'Invalid JSON body' },
      })
      return
    }

    logger.error({ err }, 'unhandled_error')
    res.status(500).json({
      error: { code: 'internal_error', message: 'Internal server error' },
    })
  })

  return app
}
