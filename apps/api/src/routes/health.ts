import { Router, type IRouter } from 'express'
import { checkPostgres } from '../db/client.js'
import { checkRedis } from '../lib/redis.js'

export const healthRouter: IRouter = Router()

function buildRevision(): string | undefined {
  const revision =
    process.env.BUILD_REVISION ?? process.env.GIT_SHA ?? process.env.RAILWAY_GIT_COMMIT_SHA
  if (!revision || revision.trim().length === 0) {
    return undefined
  }
  return revision.trim()
}

healthRouter.get('/health', (_req, res) => {
  const revision = buildRevision()
  res.json({
    status: 'ok',
    ...(revision ? { revision } : {}),
  })
})

healthRouter.get('/ready', async (_req, res) => {
  const [postgresUp, redisUp] = await Promise.all([checkPostgres(), checkRedis()])
  const ready = postgresUp && redisUp
  const revision = buildRevision()

  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not_ready',
    postgres: postgresUp ? 'up' : 'down',
    redis: redisUp ? 'up' : 'down',
    ...(revision ? { revision } : {}),
  })
})
