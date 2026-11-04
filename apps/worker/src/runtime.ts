import { Worker } from 'bullmq'
import { queueName } from '@hikyaku/shared/constants/queue'
import { closePool, getPool } from './db/client.js'
import { env, WORKER_LOCK_DURATION_MS } from './config.js'
import { logger } from './lib/logger.js'
import { closeRedis, getRedisConnectionOptions } from './lib/redis.js'
import { processor } from './processor.js'
import { closeQueue, getQueue } from './queue/client.js'
import { startSweeper, stopSweeper } from './sweeper.js'

export function startWorker() {
  const name = queueName()
  const queue = getQueue()
  const worker = new Worker(name, processor, {
    connection: getRedisConnectionOptions(),
    concurrency: env.WORKER_CONCURRENCY,
    lockDuration: WORKER_LOCK_DURATION_MS,
  })
  startSweeper(queue)

  const metricsTimer = setInterval(() => {
    const pool = getPool()
    void queue
      .getJobCounts('waiting', 'active', 'delayed', 'failed')
      .then((counts) =>
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
        ),
      )
      .catch((err) => logger.warn({ err }, 'worker_runtime_stats_failed'))
  }, 60_000)
  metricsTimer.unref()

  worker.on('ready', () =>
    logger.info({ queue: name, concurrency: env.WORKER_CONCURRENCY }, 'worker_started'),
  )
  worker.on('error', (err) => logger.error({ err }, 'worker_error'))

  let shutdownPromise: Promise<number> | undefined
  function shutdown(signal = 'shutdown'): Promise<number> {
    if (shutdownPromise) return shutdownPromise
    clearInterval(metricsTimer)
    logger.info({ signal }, 'shutting_down')
    shutdownPromise = (async () => {
      let failed = false
      let timer: ReturnType<typeof setTimeout> | undefined
      const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('shutdown_timeout')), WORKER_LOCK_DURATION_MS)
      })
      async function attempt(resource: string, close: () => Promise<unknown>): Promise<void> {
        try {
          await close()
        } catch (err) {
          failed = true
          logger.warn({ err, resource }, 'shutdown_cleanup_failed')
        }
      }
      try {
        await Promise.race([
          Promise.all([
            (async () => {
              await attempt('worker_pause', () => worker.pause(true))
              await attempt('worker', () => worker.close())
            })(),
            attempt('sweeper', stopSweeper),
          ]),
          deadline,
        ]).catch((err) => {
          failed = true
          logger.warn({ err }, 'shutdown_forced')
        })

        await Promise.race([
          Promise.all([
            attempt('queue', closeQueue),
            attempt('postgres', closePool),
            attempt('redis', closeRedis),
          ]),
          deadline,
        ]).catch((err) => {
          failed = true
          logger.warn({ err }, 'shutdown_forced')
        })
      } finally {
        clearTimeout(timer)
      }
      logger.info({ failed }, 'shutdown_complete')
      return failed ? 1 : 0
    })()
    return shutdownPromise
  }
  return { worker, shutdown }
}
