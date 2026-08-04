import type { Queue } from 'bullmq'
import type { DeliveryJobData } from '../../src/constants.js'
import { describe, expect, it, vi } from 'vitest'
import { enqueueDeliveryJob } from '../../src/enqueueDelivery.js'

function makeQueue() {
  const add = vi.fn().mockResolvedValue(undefined)

  return {
    queue: { add } as unknown as Queue<DeliveryJobData>,
    add,
  }
}

describe('enqueueDeliveryJob', () => {
  it('adds when no job exists', async () => {
    const queue = makeQueue()
    await enqueueDeliveryJob(queue.queue, 'delivery-1')
    expect(queue.add).toHaveBeenCalledWith(
      'deliver',
      { deliveryId: 'delivery-1' },
      expect.objectContaining({ deduplication: { id: 'delivery-1' } }),
    )
  })
})
