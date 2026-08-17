// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
}: Props) {
  state = usePaginatedList<Item>({ pageSize, fetchPage, fallbackError, enabled, queryKey })
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

  it('skips loading while disabled', async () => {
    const fetchPage = vi.fn<FetchPage>().mockResolvedValue(page([1], false, 0))
    await renderHarness({ fetchPage, enabled: false })

    await act(async () => {})

    expect(fetchPage).not.toHaveBeenCalled()
    expect(state!.isInitial).toBe(true)
    expect(state!.data).toEqual([])
  })
})
