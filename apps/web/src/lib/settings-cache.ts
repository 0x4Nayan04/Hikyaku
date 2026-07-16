import type { ApiKey } from '@/api/types'

let cachedApiKeys: ApiKey[] = []

export function readCachedApiKeys(): ApiKey[] {
  return cachedApiKeys
}

export function writeCachedApiKeys(apiKeys: ApiKey[]): void {
  cachedApiKeys = apiKeys
}
