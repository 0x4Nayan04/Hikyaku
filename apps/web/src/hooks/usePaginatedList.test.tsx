// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SavedResult } from '@/lib/page-cache'
import { ApiError } from '@/api/client'
import type { Paginated } from '@/api/types'
import { usePaginatedList } from '@/hooks/usePaginatedList'

type Item = { id: number }

type FetchPage = (params: {
  limit: number
  offset: number
  signal: AbortSignal
}) => Promise<Paginated<Item>>

globalThis.IS_REACT_ACT_ENVIRONMENT = true

type Props = {
  pageSize?: number
  fetchPage: FetchPage
  fallbackError?: string
  enabled?: boolean
  queryKey?: string
  cache?: SavedResult<Paginated<Item>>
}

let container: HTMLDivElement
let root: Root
let state: ReturnType<typeof usePaginatedList<Item>> | null

function Harness({
  pageSize = 25,
  fetchPage,
  fallbackError = 'Failed to load',
  enabled,
  queryKey,
  cache,
}: Props) {
  state = usePaginatedList<Item>({ pageSize, fetchPage, fallbackError, enabled, queryKey, cache })
  return null
}

function renderHarness(props: Props) {
  state = null
  return act(async () => {
    root.render(<Harness {...props} />)
  })
}

const page = (ids: number[], hasMore: boolean, offset: number): Paginated<Item> => ({
  data: ids.map((id) => ({ id })),
  has_more: hasMore,
  limit: 25,
  offset,
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => {
    root.unmount()
  })
  document.body.removeChild(container)
})

describe('usePaginatedList', () => {
  it('applies the first loaded page and clears the initial loading state', async () => {
    const { promise, resolve } = deferred<Paginated<Item>>()
    const fetchPage = vi.fn<FetchPage>().mockReturnValue(promise)
    await renderHarness({ fetchPage })

    expect(fetchPage).toHaveBeenCalledWith({
      limit: 25,
      offset: 0,
      signal: expect.any(AbortSignal),
    })
    expect(state!.isInitial).toBe(true)
    expect(state!.isRefreshing).toBe(false)
    expect(state!.data).toEqual([])
    expect(state!.error).toBeNull()

    await act(async () => {
      resolve(page([1, 2], false, 0))
    })

    expect(state!.isInitial).toBe(false)
    expect(state!.data).toEqual([{ id: 1 }, { id: 2 }])
    expect(state!.hasMore).toBe(false)
    expect(state!.offset).toBe(0)
  })

  it('navigates between pages', async () => {
    const fetchPage = vi
      .fn<FetchPage>()
      .mockResolvedValueOnce(page([1, 2, 3, 4, 5], true, 0))
      .mockResolvedValueOnce(page([26, 27, 28, 29, 30], false, 25))
    await renderHarness({ fetchPage })

    expect(state!.offset).toBe(0)
    expect(state!.data).toHaveLength(5)

    await act(async () => {
      state!.setOffset(25)
    })

    expect(fetchPage).toHaveBeenCalledTimes(2)
    expect(state!.offset).toBe(25)
    expect(state!.data).toEqual([{ id: 26 }, { id: 27 }, { id: 28 }, { id: 29 }, { id: 30 }])
    expect(state!.hasMore).toBe(false)
    expect(state!.isInitial).toBe(false)
  })

  it('corrects the offset when the final page disappears after a mutation', async () => {
    const fetchPage = vi
      .fn<FetchPage>()
      .mockResolvedValueOnce(page([1, 2, 3, 4, 5], true, 0))
      .mockResolvedValueOnce(page([26, 27, 28, 29, 30], false, 25))
      .mockResolvedValueOnce(page([], false, 25))
      .mockResolvedValueOnce(page([1, 2], false, 0))
    await renderHarness({ fetchPage })

    await act(async () => {
      state!.setOffset(25)
    })

    expect(state!.offset).toBe(25)
    expect(state!.data).toHaveLength(5)

    await act(async () => {
      await state!.reload()
    })
    await act(async () => {})

    expect(fetchPage).toHaveBeenCalledTimes(4)
    expect(state!.offset).toBe(0)
    expect(state!.data).toEqual([{ id: 1 }, { id: 2 }])
    expect(state!.hasMore).toBe(false)
    expect(state!.error).toBeNull()
  })

  it('reports a failed refresh without discarding the loaded list', async () => {
    const fetchPage = vi
      .fn<FetchPage>()
      .mockResolvedValueOnce(page([1], false, 0))
      .mockRejectedValueOnce(new ApiError(500, 'boom', 'boom'))
    await renderHarness({ fetchPage })

    expect(state!.error).toBeNull()
    expect(state!.data).toEqual([{ id: 1 }])

    let refreshed: boolean | undefined
    await act(async () => {
      refreshed = await state!.reload()
    })

    expect(refreshed).toBe(false)
    expect(state!.error).toBe('boom')
    expect(state!.data).toEqual([{ id: 1 }])
    expect(state!.isRefreshing).toBe(false)
  })

  it('does not apply a stale response after the query filter changes', async () => {
    const { promise: allPromise, resolve: resolveAll } = deferred<Paginated<Item>>()
    const { promise: activePromise, resolve: resolveActive } = deferred<Paginated<Item>>()
    const fetchPage = vi
      .fn<FetchPage>()
      .mockImplementationOnce(() => allPromise)
      .mockImplementationOnce(() => activePromise)
    await renderHarness({ fetchPage, queryKey: 'all' })

    await renderHarness({ fetchPage, queryKey: 'active' })

    await act(async () => {
      resolveActive(page([2], false, 0))
    })
    expect(state!.data).toEqual([{ id: 2 }])

    await act(async () => {
      resolveAll(page([1], false, 0))
    })
    expect(state!.data).toEqual([{ id: 2 }])
  })

  it.each(['filter', 'page'])('hides previous rows when a %s request fails', async (change) => {
    const fetchPage = vi
      .fn<FetchPage>()
      .mockResolvedValueOnce(page([1], true, 0))
      .mockRejectedValueOnce(new Error('unavailable'))
    await renderHarness({ fetchPage, queryKey: 'all' })

    if (change === 'filter') {
      await renderHarness({ fetchPage, queryKey: 'failed' })
    } else {
      await act(async () => {
        state!.setOffset(25)
      })
    }

    expect(state!.data).toEqual([])
    expect(state!.hasMore).toBe(false)
    expect(state!.error).toBe('Failed to load')
    expect(state!.isEmpty).toBe(false)
  })

  it('shows empty only after a successful current-page load', async () => {
    const fetchPage = vi
      .fn<FetchPage>()
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValueOnce(page([], false, 0))
    await renderHarness({ fetchPage })
    expect(state!.isInitial).toBe(false)
    expect(state!.isEmpty).toBe(false)
    await act(async () => {
      await state!.reload()
    })
    expect(state!.isEmpty).toBe(true)
    expect(state!.error).toBeNull()
  })

  it('hides old rows immediately while a new filter is loading and resets its offset', async () => {
    const next = deferred<Paginated<Item>>()
    const fetchPage = vi
      .fn<FetchPage>()
      .mockResolvedValueOnce(page([1], true, 0))
      .mockResolvedValueOnce(page([2], false, 25))
      .mockReturnValueOnce(next.promise)
    await renderHarness({ fetchPage, queryKey: 'all' })
    await act(async () => {
      state!.setOffset(25)
    })
    await renderHarness({ fetchPage, queryKey: 'failed' })
    expect(state!.data).toEqual([])
    expect(state!.offset).toBe(0)
    expect(state!.isInitial).toBe(true)
    expect(state!.isEmpty).toBe(false)
    expect(fetchPage).toHaveBeenLastCalledWith({
      limit: 25,
      offset: 0,
      signal: expect.any(AbortSignal),
    })
    await act(async () => {
      next.resolve(page([3], false, 0))
    })
    expect(state!.data).toEqual([{ id: 3 }])
  })

  it('skips loading while disabled', async () => {
    const fetchPage = vi.fn<FetchPage>().mockResolvedValue(page([1], false, 0))
    await renderHarness({ fetchPage, enabled: false })

    await act(async () => {})

    expect(fetchPage).not.toHaveBeenCalled()
    expect(state!.isInitial).toBe(true)
    expect(state!.data).toEqual([])
  })
})

it('background refresh skips busy loads and preserves current page/filter ownership', async () => {
  const first = deferred<Paginated<Item>>()
  const next = deferred<Paginated<Item>>()
  const fetchPage = vi
    .fn<FetchPage>()
    .mockReturnValueOnce(first.promise)
    .mockResolvedValueOnce(page([2], true, 25))
    .mockReturnValueOnce(next.promise)
    .mockResolvedValue(page([4], false, 0))
  await renderHarness({ fetchPage, queryKey: 'all' })
  const firstSignal = fetchPage.mock.calls[0][0].signal
  await act(async () => {
    await state!.refresh()
  })
  expect(fetchPage).toHaveBeenCalledTimes(1)
  expect(firstSignal.aborted).toBe(false)
  await act(async () => {
    first.resolve(page([1], true, 0))
  })
  await act(async () => {
    state!.setOffset(25)
  })
  let refreshing!: Promise<boolean | undefined>
  await act(async () => {
    refreshing = state!.refresh()
  })
  expect(fetchPage.mock.calls[2][0].offset).toBe(25)
  await act(async () => {
    await state!.refresh()
  })
  expect(fetchPage).toHaveBeenCalledTimes(3)
  await renderHarness({ fetchPage, queryKey: 'failed' })
  expect(fetchPage.mock.calls[2][0].signal.aborted).toBe(true)
  await act(async () => {
    next.resolve(page([3], false, 25))
    await refreshing
  })
  expect(state!.offset).toBe(0)
  expect(state!.data).toEqual([{ id: 4 }])
})

describe('saved first pages', () => {
  it('restores rows on return before the fresh response and retains them if refresh fails', async () => {
    const cache = new SavedResult<Paginated<Item>>()
    const next = deferred<Paginated<Item>>()
    const fetchPage = vi
      .fn<FetchPage>()
      .mockResolvedValueOnce(page([1], true, 0))
      .mockReturnValueOnce(next.promise)
      .mockRejectedValueOnce(new Error('offline'))
    await renderHarness({ fetchPage, cache, queryKey: 'all' })
    await act(async () => root.render(null))
    await renderHarness({ fetchPage, cache, queryKey: 'all' })
    expect(state!.data).toEqual([{ id: 1 }])
    expect(state!.hasMore).toBe(true)
    expect(state!.isInitial).toBe(false)
    expect(state!.isRefreshing).toBe(true)
    expect(fetchPage).toHaveBeenCalledTimes(2)
    await act(async () => next.resolve(page([2], false, 0)))
    expect(state!.data).toEqual([{ id: 2 }])
    expect(state!.isRefreshing).toBe(false)
    await act(async () => {
      await state!.refresh()
    })
    expect(state!.data).toEqual([{ id: 2 }])
    expect(state!.error).toBe('Failed to load')
  })

  it.each(['filter', 'size', 'expired', 'owner'])(
    'does not restore a result with a different %s',
    async (change) => {
      const cache = new SavedResult<Paginated<Item>>()
      cache.write(JSON.stringify(['all', 0, 25]), page([1], false, 0), cache.generation)
      const fetchPage = vi.fn<FetchPage>().mockReturnValue(deferred<Paginated<Item>>().promise)
      const now =
        change === 'expired' ? vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 60_000) : null
      try {
        await renderHarness({
          fetchPage,
          cache: change === 'owner' ? new SavedResult<Paginated<Item>>() : cache,
          queryKey: change === 'filter' ? 'failed' : 'all',
          pageSize: change === 'size' ? 10 : 25,
        })
        expect(state!.data).toEqual([])
        expect(state!.isInitial).toBe(true)
      } finally {
        now?.mockRestore()
      }
    },
  )

  it('does not apply or save a response started before cache invalidation', async () => {
    const cache = new SavedResult<Paginated<Item>>()
    const next = deferred<Paginated<Item>>()
    const fetchPage = vi
      .fn<FetchPage>()
      .mockReturnValueOnce(next.promise)
      .mockResolvedValue(page([2], false, 0))
    await renderHarness({ fetchPage, cache, queryKey: 'all' })
    cache.clear()
    await act(async () => next.resolve(page([1], false, 0)))
    expect(state!.data).toEqual([])
    expect(cache.read(JSON.stringify(['all', 0, 25]))).toBeUndefined()
    await act(async () => {
      await state!.refresh()
    })
    expect(state!.data).toEqual([{ id: 2 }])
  })

  it('hides the previous owner immediately when the session changes during a request', async () => {
    const cache = new SavedResult<Paginated<Item>>()
    cache.write(JSON.stringify(['all', 0, 25]), page([1], false, 0), cache.generation)
    const old = deferred<Paginated<Item>>()
    const next = deferred<Paginated<Item>>()
    const fetchPage = vi
      .fn<FetchPage>()
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(next.promise)
    await renderHarness({ fetchPage, cache, queryKey: 'all' })
    const newCache = new SavedResult<Paginated<Item>>()
    await renderHarness({ fetchPage, cache: newCache, queryKey: 'all' })
    expect(state!.data).toEqual([])
    await act(async () => old.resolve(page([3], false, 0)))
    expect(state!.data).toEqual([])
    await act(async () => next.resolve(page([2], false, 0)))
    expect(state!.data).toEqual([{ id: 2 }])
  })

  it('keeps the first page saved while later pages are loaded', async () => {
    const cache = new SavedResult<Paginated<Item>>()
    const fetchPage = vi
      .fn<FetchPage>()
      .mockResolvedValueOnce(page([1], true, 0))
      .mockResolvedValueOnce(page([2], false, 25))
      .mockReturnValue(deferred<Paginated<Item>>().promise)
    await renderHarness({ fetchPage, cache, queryKey: 'all' })
    await act(async () => state!.setOffset(25))
    await act(async () => root.render(null))
    await renderHarness({ fetchPage, cache, queryKey: 'all' })
    expect(state!.offset).toBe(0)
    expect(state!.data).toEqual([{ id: 1 }])
  })
})

it('discards saved and visible rows when the server denies access', async () => {
  const cache = new SavedResult<Paginated<Item>>()
  const key = JSON.stringify(['all', 0, 25])
  cache.write(key, page([1], false, 0), cache.generation)
  const fetchPage = vi
    .fn<FetchPage>()
    .mockRejectedValue(new ApiError(403, 'forbidden', 'Access denied'))
  await renderHarness({ cache, queryKey: 'all', fetchPage })
  expect(state!.data).toEqual([])
  expect(state!.error).toBe('Access denied')
  expect(state!.isInitial).toBe(false)
  expect(cache.read(key)).toBeUndefined()
})
