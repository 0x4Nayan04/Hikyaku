import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, type ApiFetchOptions } from '@/api/client'

type UseDetailFetchOptions<T> = {
  id: string | undefined
  fetchDetail: (id: string, options?: ApiFetchOptions) => Promise<T>
  missingError: string
  fallbackError: string
}

export function useDetailFetch<T>({
  id,
  fetchDetail,
  missingError,
  fallbackError,
}: UseDetailFetchOptions<T>) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(Boolean(id))
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(id ? null : missingError)
  const requestRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)

  const isStale = (request: number, requestId: string | undefined) =>
    request !== requestRef.current || requestId !== id

  const load = useCallback(
    async (requestId: string | undefined, initial: boolean): Promise<void> => {
      const request = ++requestRef.current
      if (!requestId) {
        setData(null)
        setLoading(false)
        setIsRefreshing(false)
        setError(missingError)
        return
      }
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      if (initial) {
        setData(null)
        setLoading(true)
        setIsRefreshing(false)
      } else {
        setIsRefreshing(true)
      }

      try {
        const result = await fetchDetail(requestId, { signal: controller.signal })
        if (isStale(request, requestId)) return
        setData(result)
        setError(null)
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        if (isStale(request, requestId)) return
        setError(err instanceof ApiError ? err.message : fallbackError)
      } finally {
        if (abortRef.current === controller) abortRef.current = null
        const stale = isStale(request, requestId)
        setLoading((loading) => (stale ? loading : false))
        setIsRefreshing((refreshing) => (stale ? refreshing : false))
      }
    },
    [fallbackError, fetchDetail, id, missingError],
  )

  useEffect(() => {
    void load(id, true)
    return () => {
      requestRef.current += 1
      abortRef.current?.abort()
    }
  }, [id, load])

  return {
    data,
    loading,
    isRefreshing,
    error,
    reload: () => load(id, false),
  }
}
