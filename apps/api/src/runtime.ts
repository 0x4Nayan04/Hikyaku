import type { Server } from 'node:http'
import { env } from './config.js'
import { closePool, getPool } from './db/client.js'
import { logger } from './lib/logger.js'
import { closeRedis } from './lib/redis.js'
import { closeQueue } from './queue/client.js'
import { createApp } from './server.js'

const SHUTDOWN_TIMEOUT_MS = 25_000

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()))
  })
}

export function startApi() {
  const server = createApp().listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'server_started')
  })
  server.keepAliveTimeout = 55_000
  server.headersTimeout = 60_000
  server.requestTimeout = 60_000

  const metricsTimer = setInterval(() => {
    const pool = getPool()
    logger.info(
      { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount },
      'db_pool_stats',
    )
  }, 60_000)
  metricsTimer.unref()
  let shutdownPromise: Promise<number> | undefined

  function shutdown(signal: string): Promise<number> {
    if (shutdownPromise) return shutdownPromise
    shutdownPromise = (async () => {
      logger.info({ signal }, 'shutting_down')
      clearInterval(metricsTimer)
      let cleanupPromise: Promise<number> | undefined
      const closeResources = () => {
        cleanupPromise ??= (async () => {
          const results = await Promise.allSettled([
            Promise.resolve().then(closeQueue),
            Promise.resolve().then(closePool),
            Promise.resolve().then(closeRedis),
          ])
          let failed = false
          for (const result of results) {
            if (result.status === 'rejected') {
              failed = true
              logger.error({ err: result.reason }, 'shutdown_cleanup_failed')
            }
          }
          return failed ? 1 : 0
        })()
        return cleanupPromise
      }
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        const code = await Promise.race([
          (async () => {
            let failed = false
            try {
              await closeServer(server)
            } catch (err) {
              failed = true
              logger.error({ err }, 'shutdown_server_close_failed')
            }
            const cleanupCode = await closeResources()
            return failed ? 1 : cleanupCode
          })(),
          new Promise<number>((resolve) => {
            timer = setTimeout(() => {
              server.closeAllConnections()
              void closeResources()
              logger.warn('shutdown_timeout')
              resolve(1)
            }, SHUTDOWN_TIMEOUT_MS)
          }),
        ])
        logger.info({ exit_code: code }, code === 0 ? 'shutdown_complete' : 'shutdown_failed')
        return code
      } finally {
        clearTimeout(timer)
      }
    })()
    return shutdownPromise
  }
  return { server, shutdown }
}
