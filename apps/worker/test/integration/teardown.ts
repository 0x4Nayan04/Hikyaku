import '../../src/config.js'
import { closePool as closeApiPool } from '../../../api/src/db/client.js'
import { closeRedis as closeApiRedis } from '../../../api/src/lib/redis.js'
import { getQueue, closeQueue } from '../../../api/src/queue/client.js'
import { closePool } from '../../src/db/client.js'
import { closeRedis } from '../../src/lib/redis.js'

export async function teardown(): Promise<void> {
  for (const job of await getQueue().getJobs([
    'waiting',
    'delayed',
    'completed',
    'failed',
    'paused',
  ])) {
    await job.remove()
  }
  await closeQueue()
  await closePool()
  await closeApiPool()
  await closeRedis()
  await closeApiRedis()
}
