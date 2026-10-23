import { afterEach, expect, it, vi } from 'vitest'
import { createPageCache, SavedResult } from '@/lib/page-cache'

afterEach(() => vi.restoreAllMocks())

it('retains one matching result for 60 seconds without extending its age on reads', () => {
  const now = vi.spyOn(Date, 'now').mockReturnValue(1000)
  const saved = new SavedResult<string>()
  saved.write('all', 'old', saved.generation)
  expect(saved.read('failed')).toBeUndefined()
  now.mockReturnValue(60_999)
  expect(saved.read('all')).toBe('old')
  now.mockReturnValue(61_000)
  expect(saved.read('all')).toBeUndefined()
  saved.write('failed', 'new', saved.generation)
  expect(saved.read('all')).toBeUndefined()
  expect(saved.read('failed')).toBe('new')
})

it('clears every page and rejects writes started before invalidation', () => {
  const cache = createPageCache()
  const generation = cache.events.generation
  const page = { data: [], offset: 0, limit: 25, has_more: false }
  cache.events.write('all', page, generation)
  cache.endpoints.write('active', page, cache.endpoints.generation)
  cache.clear()
  cache.events.write('all', page, generation)
  expect(cache.events.read('all')).toBeUndefined()
  expect(cache.endpoints.read('active')).toBeUndefined()
  cache.events.write('all', page, cache.events.generation)
  expect(cache.events.read('all')).toEqual(page)
})
