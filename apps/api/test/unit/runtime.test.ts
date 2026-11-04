import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const server = {
    close: vi.fn<(callback: (err?: Error) => void) => void>(),
    closeAllConnections: vi.fn(),
    keepAliveTimeout: 0,
    headersTimeout: 0,
    requestTimeout: 0,
  }
  return {
    server,
    createApp: vi.fn(() => ({ listen: vi.fn(() => server) })),
    closePool: vi.fn(),
    closeQueue: vi.fn(),
    closeRedis: vi.fn(),
    getPool: vi.fn(() => ({ totalCount: 0, idleCount: 0, waitingCount: 0 })),
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  }
})
vi.mock('../../src/config.js', () => ({ env: { PORT: 0 } }))
vi.mock('../../src/server.js', () => ({ createApp: mocks.createApp }))
vi.mock('../../src/db/client.js', () => ({ closePool: mocks.closePool, getPool: mocks.getPool }))
vi.mock('../../src/queue/client.js', () => ({ closeQueue: mocks.closeQueue }))
vi.mock('../../src/lib/redis.js', () => ({ closeRedis: mocks.closeRedis }))
vi.mock('../../src/lib/logger.js', () => ({ logger: mocks.logger }))
import { startApi } from '../../src/runtime.js'

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  mocks.server.close.mockImplementation((done) => done())
  mocks.closePool.mockResolvedValue(undefined)
  mocks.closeQueue.mockResolvedValue(undefined)
  mocks.closeRedis.mockResolvedValue(undefined)
})
afterEach(() => vi.useRealTimers())

describe('API runtime ownership', () => {
  it('does not start or acquire resources merely from import', () => {
    expect(mocks.createApp).not.toHaveBeenCalled()
    expect(mocks.getPool).not.toHaveBeenCalled()
  })

  it('shares shutdown completion and attempts every resource despite rejection', async () => {
    mocks.closeQueue.mockRejectedValue(new Error('queue close failed'))
    const runtime = startApi()
    const stopping = runtime.shutdown('SIGTERM')
    expect(runtime.shutdown('SIGINT')).toBe(stopping)
    await expect(stopping).resolves.toBe(1)
    expect(mocks.closePool).toHaveBeenCalledTimes(1)
    expect(mocks.closeRedis).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('bounds HTTP draining and still initiates every resource close', async () => {
    mocks.server.close.mockImplementation(() => undefined)
    const runtime = startApi()
    const stopping = runtime.shutdown('SIGTERM')
    await vi.advanceTimersByTimeAsync(25_000)
    await expect(stopping).resolves.toBe(1)
    expect(mocks.server.closeAllConnections).toHaveBeenCalledTimes(1)
    expect(mocks.closePool).toHaveBeenCalledTimes(1)
    expect(mocks.closeQueue).toHaveBeenCalledTimes(1)
    expect(mocks.closeRedis).toHaveBeenCalledTimes(1)
  })

  it('includes resource cleanup in the same shutdown deadline', async () => {
    mocks.closePool.mockImplementation(() => new Promise(() => undefined))
    const runtime = startApi()
    const stopping = runtime.shutdown('SIGTERM')
    await vi.advanceTimersByTimeAsync(25_000)
    await expect(stopping).resolves.toBe(1)
    expect(mocks.closePool).toHaveBeenCalledTimes(1)
    expect(mocks.closeQueue).toHaveBeenCalledTimes(1)
    expect(mocks.closeRedis).toHaveBeenCalledTimes(1)
  })
})
