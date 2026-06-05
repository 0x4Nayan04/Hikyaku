import { createHash, randomBytes } from 'node:crypto'

const API_KEY_PREFIX = 'whk_'
const API_KEY_RANDOM_BYTES = 16
const API_KEY_PREFIX_LENGTH = 8

export function generateApiKey(): string {
  return `${API_KEY_PREFIX}${randomBytes(API_KEY_RANDOM_BYTES).toString('hex')}`
}

export function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey, 'utf8').digest('hex')
}

export function prefixOf(apiKey: string): string {
  return apiKey.slice(API_KEY_PREFIX.length, API_KEY_PREFIX.length + API_KEY_PREFIX_LENGTH)
}
