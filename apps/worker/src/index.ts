import { Worker } from 'bullmq'
import { QUEUE_NAME } from '@webhook/shared/constants'
import { closePool, getPool } from './db/client.js'
import { env, WORKER_LOCK_DURATION_MS } from './config.js'
import { logger } from './lib/logger.js'
import { closeRedis, getRedisConnectionOptions } from './lib/redis.js'
import { processor } from './processor.js'
import { queue } from './queue/client.js'
import { startSweeper, stopSweeper } from './sweeper.js'

const SHUTDOWN_TIMEOUT_MS = WORKER_LOCK_DURATION_MS
let shuttingDown = false

const worker = new Worker(QUEUE_NAME, processor, {
  connection: getRedisConnectionOptions(),
  concurrency: env.WORKER_CONCURRENCY,
  lockDuration: WORKER_LOCK_DURATION_MS,
})

startSweeper()

const metricsTimer = setInterval(() => {
  const pool = getPool()
  void queue
    .getJobCounts('waiting', 'active', 'delayed', 'failed')
    .then((counts) => {
      logger.info(
        {
          db_pool_total: pool.totalCount,
          db_pool_idle: pool.idleCount,
          db_pool_waiting: pool.waitingCount,
          queue_waiting: counts.waiting,
          queue_active: counts.active,
          queue_delayed: counts.delayed,
          queue_failed: counts.failed,
        },
        'worker_runtime_stats',
      )
    })
    .catch((err) => logger.warn({ err }, 'worker_runtime_stats_failed'))
}, 60_000)
metricsTimer.unref()

worker.on('ready', () => {
  logger.info({ queue: QUEUE_NAME, concurrency: env.WORKER_CONCURRENCY }, 'worker_started')
})

worker.on('error', (err) => {
  logger.error({ err }, 'worker_error')
})

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return
  shuttingDown = true

  logger.info({ signal }, 'shutting_down')
  clearInterval(metricsTimer)

  stopSweeper()

  await Promise.race([
    (async () => {
      await worker.pause(true)
      await worker.close()
      await closePool()
      await closeRedis()
    })(),
    new Promise<void>((_, reject) => {
      setTimeout(() => reject(new Error('shutdown_timeout')), SHUTDOWN_TIMEOUT_MS)
    }),
  ]).catch((err) => {
    logger.warn({ err }, 'shutdown_forced')
  })

  logger.info('shutdown_complete')
  process.exit(0)
}

process.on('SIGTERM', () => {
  void shutdown('SIGTERM')
})

process.on('SIGINT', () => {
  void shutdown('SIGINT')
})
