import type { Queue } from 'bullmq'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ set: vi.fn(), eval: vi.fn(), limit: vi.fn() }))
vi.mock('../../src/config.js', () => ({
  env: { SWEEP_INTERVAL_MS: 100 },
  WORKER_LOCK_DURATION_MS: 50,
}))
vi.mock('../../src/lib/redis.js', () => ({
  getRedis: () => ({ set: mocks.set, eval: mocks.eval }),
}))
vi.mock('../../src/lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('../../src/db/client.js', () => ({
  getDb: () => {
    const chain = {
      select: () => chain,
      from: () => chain,
      innerJoin: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: mocks.limit,
    }
    return chain
  },
}))

import { startSweeper, stopSweeper } from '../../src/sweeper.js'

const queue = { name: 'lifecycle-test' } as Queue
beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  mocks.set.mockResolvedValue('OK')
  mocks.eval.mockResolvedValue(1)
  mocks.limit.mockResolvedValue([])
})
afterEach(async () => {
  await stopSweeper()
  vi.useRealTimers()
})

describe('sweeper lifecycle', () => {
  it('does not overlap sweeps and waits for lock release before stopping', async () => {
    let releaseRead!: () => void
    let releaseLock!: () => void
    mocks.limit.mockReturnValueOnce(
      new Promise<never[]>((resolve) => {
        releaseRead = () => resolve([])
      }),
    )
    mocks.eval.mockReturnValueOnce(
      new Promise<number>((resolve) => {
        releaseLock = () => resolve(1)
      }),
    )
    startSweeper(queue)
    await vi.advanceTimersByTimeAsync(300)
    expect(mocks.set).toHaveBeenCalledTimes(1)
    const stopped = stopSweeper()
    expect(stopSweeper()).toBe(stopped)
    let done = false
    void stopped.then(() => {
      done = true
    })
    startSweeper(queue)
    releaseRead()
    await vi.advanceTimersByTimeAsync(0)
    expect(done).toBe(false)
    expect(mocks.eval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('get', KEYS[1]) == ARGV[1]"),
      1,
      'lifecycle-test:sweeper-lock',
      expect.any(String),
    )
    releaseLock()
    await stopped
    await vi.advanceTimersByTimeAsync(500)
    expect(mocks.set).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not read or release a lock owned by another worker', async () => {
    mocks.set.mockResolvedValueOnce(null)
    startSweeper(queue)
    await vi.advanceTimersByTimeAsync(0)
    await stopSweeper()
    expect(mocks.limit).not.toHaveBeenCalled()
    expect(mocks.eval).not.toHaveBeenCalled()
  })

  it('releases its token even when a sweep fails', async () => {
    mocks.limit.mockRejectedValueOnce(new Error('database unavailable'))
    startSweeper(queue)
    await vi.advanceTimersByTimeAsync(0)
    await stopSweeper()
    expect(mocks.eval).toHaveBeenCalledTimes(1)
  })
})
