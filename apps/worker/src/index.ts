import { Worker } from 'bullmq'
import { QUEUE_NAME, WORKER_LOCK_DURATION_MS } from '@webhook/shared/constants'
import { closePool } from './db/client.js'
import { env } from './config.js'
import { logger } from './lib/logger.js'
import { getRedisConnectionOptions } from './lib/redis.js'
import { processor } from './processor.js'
import { startSweeper, stopSweeper } from './sweeper.js'

const SHUTDOWN_TIMEOUT_MS = 25_000

const worker = new Worker(QUEUE_NAME, processor, {
  connection: getRedisConnectionOptions(),
  concurrency: env.WORKER_CONCURRENCY,
  lockDuration: WORKER_LOCK_DURATION_MS,
})

startSweeper()

worker.on('ready', () => {
  logger.info({ queue: QUEUE_NAME, concurrency: env.WORKER_CONCURRENCY }, 'worker_started')
})

worker.on('error', (err) => {
  logger.error({ err }, 'worker_error')
})

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'shutting_down')

  stopSweeper()

  await Promise.race([
    (async () => {
      await worker.pause(true)
      await worker.close()
      await closePool()
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
