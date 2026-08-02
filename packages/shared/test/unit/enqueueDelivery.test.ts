import type { Queue } from 'bullmq'
import type { DeliveryJobData } from '../../src/constants.js'
import { describe, expect, it, vi } from 'vitest'
import { enqueueDeliveryJob } from '../../src/enqueueDelivery.js'

function makeQueue(existing?: { state: string }) {
  const remove = vi.fn().mockResolvedValue(undefined)
  const add = vi.fn().mockResolvedValue(undefined)
  const getState = vi.fn().mockResolvedValue(existing?.state)
  const getJob = vi.fn().mockResolvedValue(existing ? { getState, remove } : null)

  return {
    queue: { getJob, add } as unknown as Queue<DeliveryJobData>,
    add,
    remove,
  }
}

describe('enqueueDeliveryJob', () => {
  it('adds when no job exists', async () => {
    const queue = makeQueue()
    await enqueueDeliveryJob(queue.queue, 'delivery-1')
    expect(queue.add).toHaveBeenCalledOnce()
    expect(queue.remove).not.toHaveBeenCalled()
  })

  it('skips when a live job already exists', async () => {
    const queue = makeQueue({ state: 'waiting' })
    await enqueueDeliveryJob(queue.queue, 'delivery-1')
    expect(queue.add).not.toHaveBeenCalled()
    expect(queue.remove).not.toHaveBeenCalled()
  })

  it('replaces completed jobs', async () => {
    const queue = makeQueue({ state: 'completed' })
    await enqueueDeliveryJob(queue.queue, 'delivery-1')
    expect(queue.remove).toHaveBeenCalledOnce()
    expect(queue.add).toHaveBeenCalledOnce()
  })

  it('force-replaces any existing job', async () => {
    const queue = makeQueue({ state: 'active' })
    await enqueueDeliveryJob(queue.queue, 'delivery-1', { force: true })
    expect(queue.remove).toHaveBeenCalledOnce()
    expect(queue.add).toHaveBeenCalledOnce()
  })
})
