import '../../src/config.js'
import { queue } from '../../src/queue/client.js'

export default async function globalTeardown(): Promise<void> {
  for (const job of await queue.getJobs(['waiting', 'delayed', 'completed', 'failed', 'paused'])) {
      await job.remove()
    }
  await queue.pause()
  await queue.resume()
  await queue.close()
}
