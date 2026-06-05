import { Router, type IRouter } from 'express'
import { checkPostgres } from '../db/client.js'
import { checkRedis } from '../lib/redis.js'

export const healthRouter: IRouter = Router()

healthRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

healthRouter.get('/ready', async (_req, res) => {
  const [postgresUp, redisUp] = await Promise.all([checkPostgres(), checkRedis()])
  const ready = postgresUp && redisUp

  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not_ready',
    postgres: postgresUp ? 'up' : 'down',
    redis: redisUp ? 'up' : 'down',
  })
})
