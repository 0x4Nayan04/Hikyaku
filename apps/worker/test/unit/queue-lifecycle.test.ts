import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ close: vi.fn(), create: vi.fn() }))
vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => {
    mocks.create()
    return { on: vi.fn(), close: mocks.close }
  }),
}))
vi.mock('../../src/lib/redis.js', () => ({ getRedisConnectionOptions: () => ({}) }))
vi.mock('../../src/lib/logger.js', () => ({ logger: { error: vi.fn() } }))

import { closeQueue, getQueue } from '../../src/queue/client.js'

afterEach(async () => {
  await closeQueue()
  vi.clearAllMocks()
})

describe('worker queue lifecycle', () => {
  it('creates on demand, reuses while open, and recreates after close', async () => {
    expect(mocks.create).not.toHaveBeenCalled()
    const first = getQueue()
    expect(getQueue()).toBe(first)
    expect(mocks.create).toHaveBeenCalledTimes(1)
    await closeQueue()
    expect(mocks.close).toHaveBeenCalledTimes(1)
    expect(getQueue()).not.toBe(first)
    expect(mocks.create).toHaveBeenCalledTimes(2)
  })
})
