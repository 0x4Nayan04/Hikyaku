import type { Queue } from 'bullmq'
import type { DeliveryJobData } from '../../src/constants.js'
import { describe, expect, it, vi } from 'vitest'
import { enqueueDeliveryJob, enqueueDeliveryJobs } from '../../src/enqueueDelivery.js'

function makeQueue() {
  const add = vi.fn().mockResolvedValue(undefined)
  const addBulk = vi.fn().mockResolvedValue(undefined)

  return {
    queue: { add, addBulk } as unknown as Queue<DeliveryJobData>,
    add,
    addBulk,
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

describe('enqueueDeliveryJobs', () => {
  it('batches jobs without dropping per-delivery deduplication', async () => {
    const queue = makeQueue()
    await enqueueDeliveryJobs(queue.queue, ['delivery-1', 'delivery-2'])
    expect(queue.addBulk).toHaveBeenCalledWith([
      expect.objectContaining({
        data: { deliveryId: 'delivery-1' },
        opts: expect.objectContaining({ deduplication: { id: 'delivery-1' } }),
      }),
      expect.objectContaining({
        data: { deliveryId: 'delivery-2' },
        opts: expect.objectContaining({ deduplication: { id: 'delivery-2' } }),
      }),
    ])
  })
})
