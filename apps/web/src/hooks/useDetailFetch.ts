import { useEffect, useRef, useState } from 'react'
import { ApiError } from '@/api/client'

type UseDetailFetchOptions<T> = {
  id: string | undefined
  fetchDetail: (id: string) => Promise<T>
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
  const fetchDetailRef = useRef(fetchDetail)
  const idRef = useRef(id)
  const requestRef = useRef(0)

  fetchDetailRef.current = fetchDetail
  idRef.current = id

  async function load(requestId: string | undefined, initial: boolean): Promise<void> {
    const request = ++requestRef.current
    if (!requestId) {
      setData(null)
      setLoading(false)
      setIsRefreshing(false)
      setError(missingError)
      return
    }

    if (initial) {
      setData(null)
      setLoading(true)
      setIsRefreshing(false)
    } else {
      setIsRefreshing(true)
    }

    try {
      const result = await fetchDetailRef.current(requestId)
      if (request !== requestRef.current || requestId !== idRef.current) return
      setData(result)
      setError(null)
    } catch (err) {
      if (request !== requestRef.current || requestId !== idRef.current) return
      setError(err instanceof ApiError ? err.message : fallbackError)
    } finally {
      if (request === requestRef.current && requestId === idRef.current) {
        setLoading(false)
        setIsRefreshing(false)
      }
    }
  }

  useEffect(() => {
    void load(id, true)
    return () => {
      requestRef.current += 1
    }
  }, [id])

  return {
    data,
    loading,
    isRefreshing,
    error,
    reload: () => load(idRef.current, false),
  }
}
