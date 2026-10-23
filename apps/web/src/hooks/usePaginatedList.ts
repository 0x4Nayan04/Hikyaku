import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '@/api/client'
import type { SavedResult } from '@/lib/page-cache'
import type { Paginated } from '@/api/types'

type UsePaginatedListOptions<T> = {
  pageSize: number
  fetchPage: (params: {
    limit: number
    offset: number
    signal: AbortSignal
  }) => Promise<Paginated<T>>
  fallbackError: string
  queryKey?: string
  enabled?: boolean
  cache?: SavedResult<Paginated<T>>
}

export function usePaginatedList<T>({
  pageSize,
  fetchPage,
  fallbackError,
  queryKey,
  enabled = true,
  cache,
}: UsePaginatedListOptions<T>) {
  const [initial] = useState(() =>
    enabled ? cache?.read(JSON.stringify([queryKey, 0, pageSize])) : undefined,
  )
  const [data, setData] = useState<T[]>(initial?.data ?? [])
  const [hasMore, setHasMore] = useState(initial?.has_more ?? false)
  const [offset, setOffset] = useState(0)
  const currentKey = JSON.stringify([cache?.id, queryKey, offset, pageSize])
  const [loadedKey, setLoadedKey] = useState<string | null>(initial ? currentKey : null)
  const [settledKey, setSettledKey] = useState<string | null>(initial ? currentKey : null)
  const [isRefreshing, setIsRefreshing] = useState(Boolean(initial))
  const [error, setError] = useState<string | null>(null)
  const fetchPageRef = useRef<typeof fetchPage | null>(null)
  const offsetRef = useRef(offset)
  const queryKeyRef = useRef(queryKey)
  const previousQueryKeyRef = useRef(queryKey)
  const requestRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const initializedRef = useRef(Boolean(initial))
  const cacheRef = useRef(cache)

  useEffect(() => {
    fetchPageRef.current = fetchPage
  }, [fetchPage])

  useEffect(() => {
    offsetRef.current = offset
    queryKeyRef.current = queryKey
    cacheRef.current = cache
  }, [offset, queryKey, cache])

  const isStale = (request: number, requestQueryKey: string | undefined) =>
    request !== requestRef.current || requestQueryKey !== queryKeyRef.current

  const load = useCallback(async (): Promise<boolean | undefined> => {
    const generation = cache?.generation
    const request = ++requestRef.current
    const fetch = fetchPageRef.current
    if (!fetch) return undefined
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    if (initializedRef.current) setIsRefreshing(true)
    const nextOffset = offsetRef.current
    const requestQueryKey = queryKeyRef.current
    const requestKey = JSON.stringify([cache?.id, requestQueryKey, nextOffset, pageSize])
    const stale = () =>
      controller.signal.aborted ||
      isStale(request, requestQueryKey) ||
      cache !== cacheRef.current ||
      generation !== cache?.generation

    try {
      const result = await fetch({ limit: pageSize, offset: nextOffset, signal: controller.signal })
      if (stale()) return undefined
      if (result.data.length === 0 && result.offset > 0) {
        setOffset(Math.max(0, result.offset - pageSize))
        return true
      }
      if (nextOffset === 0 && generation !== undefined) {
        cache?.write(JSON.stringify([requestQueryKey, 0, pageSize]), result, generation)
      }
      setLoadedKey(requestKey)
      setData(result.data)
      setHasMore(result.has_more)
      setOffset(result.offset)
      setError(null)
      return true
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return undefined
      if (stale()) return undefined
      if (cache && err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        cache.clear()
        setData([])
        setHasMore(false)
        setLoadedKey(null)
        setSettledKey(requestKey)
        initializedRef.current = true
      }
      setError(err instanceof ApiError ? err.message : fallbackError)
      return false
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
        setIsRefreshing(false)
      }
      const obsolete = stale()
      if (!obsolete) initializedRef.current = true
      if (!obsolete) setSettledKey(requestKey)
    }
  }, [fallbackError, pageSize, cache])

  useEffect(() => {
    if (!enabled) {
      return
    }
    if (previousQueryKeyRef.current !== queryKey) {
      previousQueryKeyRef.current = queryKey
      requestRef.current += 1
      if (offset !== 0) {
        setOffset(0)
        return
      }
    }
    void load()
    return () => {
      requestRef.current += 1
      abortRef.current?.abort()
    }
  }, [offset, pageSize, queryKey, load, enabled])

  const refresh = useCallback(() => {
    if (abortRef.current) return Promise.resolve(undefined)
    return load()
  }, [load])

  const isCurrent = loadedKey === currentKey
  const currentError = settledKey === currentKey ? error : null
  const isInitial = settledKey !== currentKey

  return {
    data: isCurrent ? data : [],
    hasMore: isCurrent && hasMore,
    isEmpty: isCurrent && !isInitial && !isRefreshing && currentError === null && data.length === 0,
    offset,
    setOffset,
    isInitial,
    isRefreshing,
    error: currentError,
    reload: load,
    refresh,
  }
}
