import { beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ close: vi.fn(), on: vi.fn(), create: vi.fn() }))
vi.mock('bullmq', () => ({
  Queue: vi.fn(function () {
    state.create()
    return { close: state.close, on: state.on }
  }),
}))
vi.mock('../../src/config.js', () => ({ env: { REDIS_URL: 'redis://127.0.0.1:6388/15' } }))
vi.mock('../../src/lib/logger.js', () => ({ logger: { error: vi.fn() } }))
import { closeQueue, getQueue } from '../../src/queue/client.js'
beforeEach(() => vi.clearAllMocks())
it('imports without connecting, memoizes on demand, and recreates after close', async () => {
  expect(state.create).not.toHaveBeenCalled()
  const queue = getQueue()
  expect(getQueue()).toBe(queue)
  expect(state.create).toHaveBeenCalledTimes(1)
  await closeQueue()
  expect(state.close).toHaveBeenCalledTimes(1)
  expect(getQueue()).not.toBe(queue)
  await closeQueue()
})
