import express, { type Application, type NextFunction, type Request, type Response } from 'express'
import { pinoHttp } from 'pino-http'
import { env } from './config.js'
import { createCorsMiddleware } from './lib/cors.js'
import { AppError } from './lib/errors.js'
import { logger } from './lib/logger.js'
import { readRequestId, requestIdMiddleware } from './lib/requestId.js'
import { adminRouter } from './routes/admin.js'
import { deliveriesRouter } from './routes/deliveries/index.js'
import { endpointsRouter } from './routes/endpoints/index.js'
import { eventsRouter } from './routes/events/index.js'
import { healthRouter } from './routes/health.js'
import { statsRouter } from './routes/stats.js'

export function createApp(): Application {
  const app = express()

  if (env.NODE_ENV === 'production') {
    app.set('trust proxy', 1)
  }

  app.use(requestIdMiddleware)
  app.use(
    pinoHttp<Request, Response>({
      logger,
      genReqId: (req) => readRequestId(req),
    }),
  )
  app.use(createCorsMiddleware())
  app.use(express.json({ limit: '256kb' }))

  app.use('/v1', healthRouter)
  app.use('/v1', statsRouter)
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
