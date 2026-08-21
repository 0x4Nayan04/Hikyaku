type Entry<T> = { value: T; expiresAt: number }

export const CACHE_TTL_MS = 30_000
const MAX_ENTRIES = 1024

export function createTtlCache<T>(ttlMs: number) {
  const map = new Map<string, Entry<T>>()

  return {
    get(key: string): T | undefined {
      const entry = map.get(key)
      if (!entry) return undefined
      if (entry.expiresAt <= Date.now()) {
        map.delete(key)
        return undefined
      }
      return entry.value
    },
    set(key: string, value: T): void {
      // ponytail: no background sweep; drop everything if unique keys pile up
      if (map.size >= MAX_ENTRIES) map.clear()
      map.set(key, { value, expiresAt: Date.now() + ttlMs })
    },
    delete(key: string): void {
      map.delete(key)
    },
    clear(): void {
      map.clear()
    },
  }
}
