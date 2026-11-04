import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  pause: vi.fn(),
  close: vi.fn(),
  startSweep: vi.fn(),
  stopSweep: vi.fn(),
  queueClose: vi.fn(),
  poolClose: vi.fn(),
  redisClose: vi.fn(),
  warn: vi.fn(),
}))
vi.mock('bullmq', () => ({
  Worker: vi.fn().mockImplementation(() => {
    mocks.create()
    return { pause: mocks.pause, close: mocks.close, on: vi.fn() }
  }),
}))
vi.mock('../../src/config.js', () => ({
  env: { WORKER_CONCURRENCY: 5 },
  WORKER_LOCK_DURATION_MS: 100,
}))
vi.mock('../../src/processor.js', () => ({ processor: vi.fn() }))
vi.mock('../../src/lib/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: mocks.warn },
}))
vi.mock('../../src/db/client.js', () => ({ getPool: vi.fn(), closePool: mocks.poolClose }))
vi.mock('../../src/lib/redis.js', () => ({
  getRedisConnectionOptions: () => ({}),
  closeRedis: mocks.redisClose,
}))
vi.mock('../../src/queue/client.js', () => ({ getQueue: () => ({}), closeQueue: mocks.queueClose }))
vi.mock('../../src/sweeper.js', () => ({
  startSweeper: mocks.startSweep,
  stopSweeper: mocks.stopSweep,
}))

import { startWorker } from '../../src/runtime.js'

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('worker runtime', () => {
  it('does not launch or install process handlers when the entry module is imported', async () => {
    const before = process.listenerCount('SIGTERM')
    await import('../../src/index.js')
    expect(mocks.create).not.toHaveBeenCalled()
    expect(process.listenerCount('SIGTERM')).toBe(before)
  })

  it('imports without starting workers, then drains work before closing dependencies', async () => {
    expect(mocks.create).not.toHaveBeenCalled()
    const runtime = startWorker()
    let release!: () => void
    mocks.stopSweep.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        release = resolve
      }),
    )
    const shutdown = runtime.shutdown('SIGTERM')
    expect(runtime.shutdown('SIGINT')).toBe(shutdown)
    await Promise.resolve()
    expect(mocks.queueClose).not.toHaveBeenCalled()
    release()
    await expect(shutdown).resolves.toBe(0)
    expect(mocks.close).toHaveBeenCalledTimes(1)
    expect(mocks.queueClose).toHaveBeenCalledTimes(1)
    expect(mocks.poolClose).toHaveBeenCalledTimes(1)
    expect(mocks.redisClose).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('attempts every cleanup and reports failure if an earlier close rejects', async () => {
    mocks.pause.mockRejectedValueOnce(new Error('pause failed'))
    mocks.queueClose.mockRejectedValueOnce(new Error('queue failed'))
    await expect(startWorker().shutdown()).resolves.toBe(1)
    expect(mocks.close).toHaveBeenCalledTimes(1)
    expect(mocks.poolClose).toHaveBeenCalledTimes(1)
    expect(mocks.redisClose).toHaveBeenCalledTimes(1)
  })

  it('bounds drain and still attempts resource closure on timeout', async () => {
    mocks.stopSweep.mockReturnValueOnce(new Promise(() => {}))
    const shutdown = startWorker().shutdown()
    await vi.advanceTimersByTimeAsync(100)
    await expect(shutdown).resolves.toBe(1)
    expect(mocks.queueClose).toHaveBeenCalledTimes(1)
    expect(mocks.poolClose).toHaveBeenCalledTimes(1)
    expect(mocks.redisClose).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })
})
