import cors from 'cors'
import express, { type Application, type NextFunction, type Request, type Response } from 'express'
import { pinoHttp } from 'pino-http'
import { env } from './config.js'
import { AppError } from './lib/errors.js'
import { logger } from './lib/logger.js'
import { requestIdMiddleware } from './lib/requestId.js'
import { healthRouter } from './routes/health.js'

export function createApp(): Application {
  const app = express()

  if (env.NODE_ENV === 'production') {
    app.set('trust proxy', 1)
  }

  app.use(requestIdMiddleware)
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as Request).requestId,
    }),
  )
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(',').map((origin) => origin.trim()),
      methods: ['GET', 'POST', 'PATCH'],
      allowedHeaders: ['Authorization', 'Content-Type', 'X-Admin-Secret'],
      credentials: false,
    }),
  )
  app.use(express.json({ limit: '256kb' }))

  app.use('/v1', healthRouter)

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
