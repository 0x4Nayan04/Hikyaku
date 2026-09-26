import '../../src/config.js'
import { closePool as closeApiPool } from '../../../api/src/db/client.js'
import { closeRedis as closeApiRedis } from '../../../api/src/lib/redis.js'
import { queue } from '../../../api/src/queue/client.js'
import { closePool } from '../../src/db/client.js'
import { closeRedis } from '../../src/lib/redis.js'

export default async function globalTeardown(): Promise<void> {
  for (const job of await queue.getJobs(['waiting', 'delayed', 'completed', 'failed', 'paused'])) {
    await job.remove()
  }
  await queue.close()
  await closePool()
  await closeApiPool()
  await closeRedis()
  await closeApiRedis()
}
