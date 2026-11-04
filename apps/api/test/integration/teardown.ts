import '../../src/config.js'
import { getQueue, closeQueue } from '../../src/queue/client.js'

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
  await getQueue().pause()
  await getQueue().resume()
  await closeQueue()
}
