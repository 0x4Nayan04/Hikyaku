import { Queue } from 'bullmq'
import { queueName } from '@hikyaku/shared/constants/queue'
import { redisConnectionOptions } from '@hikyaku/shared/redis'
import { env } from '../config.js'
import { logger } from '../lib/logger.js'

let queue: Queue | undefined

export function getQueue(): Queue {
  if (!queue) {
    queue = new Queue(queueName(), {
      connection: redisConnectionOptions(env.REDIS_URL, null),
    })
    queue.on('error', (err) => logger.error({ err }, 'queue_error'))
  }
  return queue
}

export async function closeQueue(): Promise<void> {
  const current = queue
  queue = undefined
  await current?.close()
}
