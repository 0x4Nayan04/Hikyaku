// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, type ApiFetchOptions } from '@/api/client'
import { useDetailFetch } from '@/hooks/useDetailFetch'

type Item = { id: string; value: string }

type FetchDetail = (id: string, options?: ApiFetchOptions) => Promise<Item>

globalThis.IS_REACT_ACT_ENVIRONMENT = true

type Props = {
  id: string | undefined
  fetchDetail: FetchDetail
  missingError?: string
  fallbackError?: string
}

let container: HTMLDivElement
let root: Root
let state: ReturnType<typeof useDetailFetch<Item>> | null

function Harness({ id, fetchDetail, missingError = 'Missing', fallbackError = 'Failed to load' }: Props) {
  state = useDetailFetch<Item>({ id, fetchDetail, missingError, fallbackError })
  return null
}

async function renderHarness(props: Props) {
  state = null
  await act(async () => {
    root.render(<Harness {...props} />)
  })
}

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

describe('useDetailFetch', () => {
  it('loads the detail and clears the initial loading state', async () => {
    const { promise, resolve } = deferred<Item>()
    const fetchDetail = vi.fn<FetchDetail>().mockReturnValue(promise)
    await renderHarness({ id: 'a', fetchDetail })

    expect(fetchDetail).toHaveBeenCalledWith('a', { signal: expect.any(AbortSignal) })
    expect(state!.loading).toBe(true)
    expect(state!.isRefreshing).toBe(false)
    expect(state!.data).toBeNull()

    await act(async () => {
      resolve({ id: 'a', value: 'A' })
    })

    expect(state!.loading).toBe(false)
    expect(state!.data).toEqual({ id: 'a', value: 'A' })
    expect(state!.error).toBeNull()
  })

  it('ignores a stale response after the route id changes', async () => {
    const { promise: promiseA, resolve: resolveA } = deferred<Item>()
    const { promise: promiseB, resolve: resolveB } = deferred<Item>()
    const fetchDetail = vi.fn<FetchDetail>()
      .mockImplementationOnce(() => promiseA)
      .mockImplementationOnce(() => promiseB)
    await renderHarness({ id: 'a', fetchDetail })

    await renderHarness({ id: 'b', fetchDetail })
    expect(state!.loading).toBe(true)

    await act(async () => {
      resolveB({ id: 'b', value: 'B' })
    })
    expect(state!.data).toEqual({ id: 'b', value: 'B' })
    expect(state!.loading).toBe(false)

    await act(async () => {
      resolveA({ id: 'a', value: 'A' })
    })
    expect(state!.data).toEqual({ id: 'b', value: 'B' })
    expect(state!.error).toBeNull()
  })

  it('reports a failed refresh without discarding the loaded detail', async () => {
    const fetchDetail = vi.fn<FetchDetail>()
      .mockResolvedValueOnce({ id: 'a', value: 'A' })
      .mockRejectedValueOnce(new ApiError(500, 'boom', 'boom'))
    await renderHarness({ id: 'a', fetchDetail })

    expect(state!.data).toEqual({ id: 'a', value: 'A' })
    expect(state!.loading).toBe(false)

    await act(async () => {
      await state!.reload()
    })

    expect(state!.error).toBe('boom')
    expect(state!.data).toEqual({ id: 'a', value: 'A' })
    expect(state!.isRefreshing).toBe(false)
  })

  it('handles a missing id without fetching', async () => {
    const fetchDetail = vi.fn<FetchDetail>()
    await renderHarness({ id: undefined, fetchDetail })

    await act(async () => {})

    expect(fetchDetail).not.toHaveBeenCalled()
    expect(state!.loading).toBe(false)
    expect(state!.error).toBe('Missing')
    expect(state!.data).toBeNull()
  })
})
