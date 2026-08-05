import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '@/api/client'
import type { Paginated } from '@/api/types'
import { lastPageOffset } from '@/components/console/pagination-utils'

type UsePaginatedListOptions<T> = {
  pageSize: number
  fetchPage: (params: { limit: number; offset: number; signal: AbortSignal }) => Promise<Paginated<T>>
  fallbackError: string
  queryKey?: string
  enabled?: boolean
}

export function usePaginatedList<T>({
  pageSize,
  fetchPage,
  fallbackError,
  queryKey,
  enabled = true,
}: UsePaginatedListOptions<T>) {
  const [data, setData] = useState<T[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [isInitial, setIsInitial] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fetchPageRef = useRef<typeof fetchPage | null>(null)
  const offsetRef = useRef(offset)
  const queryKeyRef = useRef(queryKey)
  const previousQueryKeyRef = useRef(queryKey)
  const requestRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const initializedRef = useRef(false)

  useEffect(() => {
    fetchPageRef.current = fetchPage
  }, [fetchPage])

  useEffect(() => {
    offsetRef.current = offset
    queryKeyRef.current = queryKey
  }, [offset, queryKey])

  const isStale = (request: number, requestQueryKey: string | undefined) =>
    request !== requestRef.current || requestQueryKey !== queryKeyRef.current

  const load = useCallback(
    async (): Promise<boolean | undefined> => {
      const request = ++requestRef.current
      const fetch = fetchPageRef.current
      if (!fetch) return undefined
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      if (initializedRef.current) setIsRefreshing(true)
      const nextOffset = offsetRef.current
      const requestQueryKey = queryKeyRef.current

      try {
        const result = await fetch({ limit: pageSize, offset: nextOffset, signal: controller.signal })
        if (isStale(request, requestQueryKey)) return undefined
        const lastOffset = lastPageOffset(result.total, pageSize)
        if (result.offset > lastOffset) {
          setOffset(lastOffset)
          return true
        }
        setData(result.data)
        setTotal(result.total)
        setOffset(result.offset)
        setError(null)
        return true
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return undefined
        if (isStale(request, requestQueryKey)) return undefined
        setError(err instanceof ApiError ? err.message : fallbackError)
        return false
      } finally {
        if (abortRef.current === controller) abortRef.current = null
        const stale = isStale(request, requestQueryKey)
        if (!stale) initializedRef.current = true
        setIsInitial((initial) => (stale ? initial : false))
        setIsRefreshing((refreshing) => (stale ? refreshing : false))
      }
    },
    [fallbackError, pageSize],
  )

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

  return {
    data,
    total,
    offset,
    setOffset,
    isInitial,
    isRefreshing,
    error,
    reload: load,
  }
}
