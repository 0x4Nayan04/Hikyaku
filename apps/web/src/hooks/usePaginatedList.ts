import { useEffect, useRef, useState } from 'react'
import { ApiError } from '@/api/client'
import type { Paginated } from '@/api/types'

type UsePaginatedListOptions<T> = {
  pageSize: number
  fetchPage: (params: { limit: number; offset: number }) => Promise<Paginated<T>>
  fallbackError: string
  queryKey?: string
}

export function usePaginatedList<T>({
  pageSize,
  fetchPage,
  fallbackError,
  queryKey,
}: UsePaginatedListOptions<T>) {
  const [data, setData] = useState<T[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [isInitial, setIsInitial] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fetchPageRef = useRef(fetchPage)
  const offsetRef = useRef(offset)
  const queryKeyRef = useRef(queryKey)
  const previousQueryKeyRef = useRef(queryKey)
  const requestRef = useRef(0)
  const initializedRef = useRef(false)
  const queryChanged = previousQueryKeyRef.current !== queryKey

  fetchPageRef.current = fetchPage
  offsetRef.current = queryChanged ? 0 : offset
  queryKeyRef.current = queryKey

  async function load(nextOffset: number, requestQueryKey: string | undefined): Promise<void> {
    const request = ++requestRef.current
    if (initializedRef.current) setIsRefreshing(true)

    try {
      const result = await fetchPageRef.current({ limit: pageSize, offset: nextOffset })
      if (request !== requestRef.current || requestQueryKey !== queryKeyRef.current) return
      setData(result.data)
      setTotal(result.total)
      setOffset(result.offset)
      setError(null)
    } catch (err) {
      if (request !== requestRef.current || requestQueryKey !== queryKeyRef.current) return
      setError(err instanceof ApiError ? err.message : fallbackError)
    } finally {
      if (request === requestRef.current && requestQueryKey === queryKeyRef.current) {
        initializedRef.current = true
        setIsInitial(false)
        setIsRefreshing(false)
      }
    }
  }

  useEffect(() => {
    if (queryChanged) {
      previousQueryKeyRef.current = queryKey
      requestRef.current += 1
      if (offset !== 0) {
        setOffset(0)
        return
      }
    }

    void load(offset, queryKey)
    return () => {
      requestRef.current += 1
    }
  }, [offset, pageSize, queryKey])

  return {
    data,
    total,
    offset,
    setOffset,
    isInitial,
    isRefreshing,
    error,
    reload: () => load(offsetRef.current, queryKeyRef.current),
  }
}
