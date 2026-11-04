import { Queue } from 'bullmq'
import { queueName } from '@hikyaku/shared/constants/queue'
import { logger } from '../lib/logger.js'
import { getRedisConnectionOptions } from '../lib/redis.js'

let queue: Queue | undefined

export function getQueue(): Queue {
  if (!queue) {
    queue = new Queue(queueName(), { connection: getRedisConnectionOptions() })
    queue.on('error', (err) => logger.error({ err }, 'queue_error'))
  }
  return queue
}

export async function closeQueue(): Promise<void> {
  const current = queue
  queue = undefined
  await current?.close()
}
