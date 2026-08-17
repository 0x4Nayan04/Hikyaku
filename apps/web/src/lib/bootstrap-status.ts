import { getBootstrapStatus } from '@/api/client'

const STORAGE_KEY = 'hikyaku:bootstrap-status'
const TTL_MS = 5 * 60 * 1000

type CacheEntry = {
  available: boolean
  exp: number
}

export function readBootstrapStatusCache(): boolean | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CacheEntry
    if (typeof parsed.available !== 'boolean' || typeof parsed.exp !== 'number') return null
    if (Date.now() > parsed.exp) {
      sessionStorage.removeItem(STORAGE_KEY)
      return null
    }
    return parsed.available
  } catch {
    return null
  }
}

export function writeBootstrapStatusCache(available: boolean): void {
  try {
    const entry: CacheEntry = { available, exp: Date.now() + TTL_MS }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entry))
  } catch {
    // sessionStorage can throw in private mode
  }
}

export function invalidateBootstrapStatusCache(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

export async function loadBootstrapStatus(): Promise<boolean> {
  const cached = readBootstrapStatusCache()
  if (cached !== null) return cached
  const { available } = await getBootstrapStatus()
  writeBootstrapStatusCache(available)
  return available
}
