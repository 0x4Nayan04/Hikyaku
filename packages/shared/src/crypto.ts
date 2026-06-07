import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const API_KEY_PREFIX = 'whk_'
const ENDPOINT_SECRET_PREFIX = 'whsec_'
const API_KEY_RANDOM_BYTES = 16
const ENDPOINT_SECRET_RANDOM_BYTES = 16
const API_KEY_PREFIX_LENGTH = 8

export function generateApiKey(): string {
  return `${API_KEY_PREFIX}${randomBytes(API_KEY_RANDOM_BYTES).toString('hex')}`
}

export function generateEndpointSecret(): string {
  return `${ENDPOINT_SECRET_PREFIX}${randomBytes(ENDPOINT_SECRET_RANDOM_BYTES).toString('hex')}`
}

export function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey, 'utf8').digest('hex')
}

export function prefixOf(apiKey: string): string {
  return apiKey.slice(API_KEY_PREFIX.length, API_KEY_PREFIX.length + API_KEY_PREFIX_LENGTH)
}

export function signPayload(secret: string, timestamp: number, body: string): string {
  const payload = `${timestamp}.${body}`
  const hmac = createHmac('sha256', secret).update(payload, 'utf8').digest('hex')
  return `sha256=${hmac}`
}

export function verifyPayload(
  secret: string,
  timestamp: number,
  body: string,
  signature: string,
): boolean {
  const expected = signPayload(secret, timestamp, body)
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
