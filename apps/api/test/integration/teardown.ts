import '../../src/config.js'
import { queue } from '../../src/queue/client.js'

export default async function globalTeardown(): Promise<void> {
  await queue.obliterate({ force: true })
  await queue.pause()
  await queue.resume()
  await queue.close()
}
