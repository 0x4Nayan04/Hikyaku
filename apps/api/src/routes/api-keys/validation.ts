import { AppError } from '../../lib/errors.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function parseApiKeyId(id: string): void {
  if (!UUID_RE.test(id)) {
    throw new AppError(404, 'not_found', 'API key not found')
  }
}
