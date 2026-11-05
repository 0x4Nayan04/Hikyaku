import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enqueueAndAcknowledge } from '../../../src/queue/publish.js'

const { acknowledge } = vi.hoisted(() => ({ acknowledge: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../../../src/db/client.js', () => ({
  getDb: () => ({ delete: () => ({ where: acknowledge }) }),
}))
vi.mock('../../../src/lib/logger.js', () => ({ logger: { error: vi.fn() } }))

describe('queue publication and durable outbox acknowledgement', () => {
  beforeEach(() => acknowledge.mockClear())
  afterEach(() => vi.useRealTimers())

  it('acknowledges only after the queue accepts the job', async () => {
    let accept!: () => void
    const queued = new Promise<void>((resolve) => {
      accept = resolve
    })
    const published = enqueueAndAcknowledge(queued, ['delivery-1'], {}, 'enqueue_failed')
    expect(acknowledge).not.toHaveBeenCalled()
    accept()
    await published
    expect(acknowledge).toHaveBeenCalledOnce()
  })

  it('keeps recovery records when queue publication fails', async () => {
    await expect(
      enqueueAndAcknowledge(
        Promise.reject(new Error('redis unavailable')),
        ['delivery-1'],
        {},
        'enqueue_failed',
      ),
    ).rejects.toMatchObject({ statusCode: 503, code: 'service_unavailable' })
    expect(acknowledge).not.toHaveBeenCalled()
  })

  it('keeps recovery records after timeout even when the queue later accepts', async () => {
    vi.useFakeTimers()
    let accept!: () => void
    const queued = new Promise<void>((resolve) => {
      accept = resolve
    })
    const published = enqueueAndAcknowledge(queued, ['delivery-1'], {}, 'enqueue_failed')
    const rejected = expect(published).rejects.toMatchObject({ statusCode: 503 })
    await vi.advanceTimersByTimeAsync(3_000)
    await rejected
    accept()
    await queued
    expect(acknowledge).not.toHaveBeenCalled()
  })
})
