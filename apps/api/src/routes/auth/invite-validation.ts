import { acceptInviteSchema } from '@webhook/shared/zod'
import { parseSchema } from '../../lib/validation.js'

export function parseAcceptInviteBody(body: unknown) {
  return parseSchema(acceptInviteSchema, body)
}
